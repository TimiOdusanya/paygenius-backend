import bcrypt from 'bcryptjs';
import User from '../models/User';
import Budget from '../models/Budget';
import Transaction from '../models/Transaction';
import { AccountService } from './accountService';
import { TransactionService } from './transactionService';
import { WalletService } from './walletService';
import { vtpassService } from './vtpassService';
import { NotificationService } from './notificationService';

export type BillCategory = 'AIRTIME' | 'DATA' | 'ELECTRICITY' | 'TELEVISION';
export type PaymentSource = 'WALLET' | 'BUDGET';

export type Biller = {
  code: string;
  name: string;
  category: BillCategory;
  image?: string;
  minAmount?: number;
  maxAmount?: number;
};

export type DataPlan = {
  code: string;
  name: string;
  amount: number;
  billerCode: string;
};

export type PayBillInput = {
  category: BillCategory;
  billerCode: string;
  customerId: string;
  amount: number;
  pin?: string;
  useBiometric?: boolean;
  paymentSource: PaymentSource;
  budgetId?: string;
  planCode?: string;
  planName?: string;
  meterType?: 'prepaid' | 'postpaid';
};

const CATEGORY_IDENTIFIER: Record<BillCategory, string> = {
  AIRTIME: 'airtime',
  DATA: 'data',
  ELECTRICITY: 'electricity-bill',
  TELEVISION: 'tv-subscription',
};

const CATEGORY_LABEL: Record<BillCategory, string> = {
  AIRTIME: 'Airtime',
  DATA: 'Mobile Data',
  ELECTRICITY: 'Electricity',
  TELEVISION: 'Television',
};

function digitsOnly(value: string) {
  return String(value ?? '').replace(/\D/g, '');
}

function receiptReference(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = String(Math.floor(10000000 + Math.random() * 90000000));
  return `${y}${m}${d}-${rand}`;
}

function toPaymentJson(transaction: any) {
  const json =
    typeof transaction?.toJSON === 'function' ? transaction.toJSON() : transaction;
  const meta = json.metadata ?? {};
  return {
    _id: json._id,
    reference: json.reference,
    amount: json.amount,
    category: meta.category,
    description: json.description ?? meta.description,
    customerId: meta.customerId,
    customerName: meta.customerName,
    planName: meta.planName,
    billerName: json.merchant ?? meta.billerName,
    billerCode: meta.billerCode,
    paymentMethod: meta.paymentSource === 'BUDGET' ? 'BUDGET' : 'WALLET',
    paymentMethodLabel: meta.paymentMethodLabel,
    token: meta.token,
    units: meta.units,
    createdAt: json.createdAt,
  };
}

function mapBiller(service: { serviceID: string; name: string; image?: string; minimium_amount?: string; maximum_amount?: string }, category: BillCategory): Biller {
  return {
    code: service.serviceID,
    name: service.name,
    category,
    image: service.image,
    minAmount: Number(service.minimium_amount) || undefined,
    maxAmount: Number(service.maximum_amount) || undefined,
  };
}

export class BillService {
  static async listBillers(category?: string): Promise<Biller[]> {
    const key = String(category ?? '').toUpperCase() as BillCategory;
    if (!CATEGORY_IDENTIFIER[key]) {
      const [airtime, data, power, tv] = await Promise.all([
        this.listBillers('AIRTIME'),
        this.listBillers('DATA'),
        this.listBillers('ELECTRICITY'),
        this.listBillers('TELEVISION'),
      ]);
      return [...airtime, ...data, ...power, ...tv];
    }
    const services = await vtpassService.listServices(CATEGORY_IDENTIFIER[key]);
    return services.map((service) => mapBiller(service, key));
  }

  static async listPlans(billerCode: string) {
    if (!billerCode) {
      throw Object.assign(new Error('Provider is required'), { status: 400 });
    }
    const variations = await vtpassService.listVariations(billerCode);
    const seen = new Set<string>();
    const plans: DataPlan[] = [];
    for (const item of variations) {
      const code = item.variation_code;
      if (!code || seen.has(code)) continue;
      seen.add(code);
      plans.push({
        code,
        name: item.name,
        amount: Number(item.variation_amount) || 0,
        billerCode,
      });
    }
    return plans;
  }

  static async validateCustomer(input: {
    category: BillCategory;
    billerCode: string;
    customerId: string;
    meterType?: 'prepaid' | 'postpaid';
  }) {
    const customerId = digitsOnly(input.customerId);
    const minLength = input.category === 'AIRTIME' || input.category === 'DATA' ? 10 : 8;
    if (customerId.length < minLength) {
      throw Object.assign(new Error('Enter a valid customer number'), { status: 400 });
    }

    if (input.category === 'AIRTIME' || input.category === 'DATA') {
      if (!/^0[7-9]\d{8,10}$/.test(customerId)) {
        throw Object.assign(new Error('Enter a valid Nigerian phone number'), { status: 400 });
      }
      return {
        valid: true,
        customerId,
        customerName: undefined,
        biller: { code: input.billerCode },
      };
    }

    if (input.category === 'ELECTRICITY' && !input.meterType) {
      throw Object.assign(new Error('Select prepaid or postpaid'), { status: 400 });
    }

    const verified = await vtpassService.verifyCustomer({
      serviceID: input.billerCode,
      billersCode: customerId,
      type: input.category === 'ELECTRICITY' ? input.meterType : undefined,
    });
    if (!verified.valid) {
      throw Object.assign(
        new Error('This meter or smartcard number could not be verified for the selected provider'),
        { status: 400 }
      );
    }
    return {
      valid: true,
      customerId,
      customerName: verified.customerName,
      customerAddress: verified.customerAddress,
      minPurchaseAmount: verified.minPurchaseAmount,
      currentBouquet: verified.currentBouquet,
      renewalAmount: verified.renewalAmount,
      biller: { code: input.billerCode },
    };
  }

  static async verifyAuthorization(
    userId: string,
    pin?: string,
    useBiometric?: boolean
  ) {
    const user = await User.findById(userId).select('+transactionPin biometricEnabled');
    if (!user) {
      throw Object.assign(new Error('User not found'), { status: 404 });
    }

    if (useBiometric) {
      if (!user.biometricEnabled) {
        throw Object.assign(new Error('Biometrics are not enabled on this account'), {
          status: 400,
        });
      }
      return user;
    }

    if (!pin || !/^\d{4}$/.test(pin)) {
      throw Object.assign(new Error('Enter your 4-digit transactional PIN'), {
        status: 400,
      });
    }
    if (!user.transactionPin) {
      throw Object.assign(new Error('Set a transactional PIN before making payments'), {
        status: 400,
      });
    }

    const matches = await bcrypt.compare(pin, user.transactionPin);
    if (!matches) {
      throw Object.assign(new Error('Incorrect PIN. Try again.'), { status: 401 });
    }
    return user;
  }

  static async payBill(userId: string, input: PayBillInput) {
    const user = await this.verifyAuthorization(userId, input.pin, input.useBiometric);

    const customerId = digitsOnly(input.customerId);
    const validated = await this.validateCustomer({
      category: input.category,
      billerCode: input.billerCode,
      customerId,
      meterType: input.meterType,
    });

    const billers = await this.listBillers(input.category);
    const biller = billers.find((item) => item.code === input.billerCode);
    if (!biller) {
      throw Object.assign(new Error('Select a valid provider'), { status: 400 });
    }

    let amount = Number(input.amount);
    let planName = input.planName;
    let variationCode = input.planCode;
    if (input.category === 'DATA' || input.category === 'TELEVISION') {
      const plans = await this.listPlans(input.billerCode);
      const plan = plans.find((item) => item.code === input.planCode);
      if (!plan) {
        throw Object.assign(new Error('Select a valid plan'), { status: 400 });
      }
      amount = plan.amount || amount;
      planName = plan.name;
      variationCode = plan.code;
    }
    if (input.category === 'ELECTRICITY') {
      variationCode = input.meterType || 'prepaid';
    }

    const verifyMinimum = Number((validated as any).minPurchaseAmount) || 0;
    const minimum =
      verifyMinimum > 0
        ? verifyMinimum
        : biller.minAmount && biller.minAmount > 0
          ? biller.minAmount
          : 50;
    if (!Number.isFinite(amount) || amount < minimum) {
      throw Object.assign(new Error(`Enter an amount of at least ₦${minimum}`), { status: 400 });
    }
    if (biller.maxAmount && amount > biller.maxAmount) {
      throw Object.assign(new Error(`Amount cannot exceed ₦${biller.maxAmount}`), { status: 400 });
    }

    const wallet = await WalletService.getWalletByUserId(userId);
    if (!wallet) {
      throw Object.assign(new Error('Wallet not found'), { status: 404 });
    }

    const available = wallet.availableBalance ?? 0;
    if (available < amount) {
      throw Object.assign(new Error('Insufficient wallet balance'), { status: 400 });
    }

    const { LimitService } = await import('./limitService');
    await LimitService.assertDailySpend(userId, amount);

    let budget: any = null;
    if (input.paymentSource === 'BUDGET') {
      if (!input.budgetId) {
        throw Object.assign(new Error('Select a budget to pay from'), { status: 400 });
      }
      budget = await Budget.findOne({
        _id: input.budgetId,
        userId,
        isActive: true,
      });
      if (!budget) {
        throw Object.assign(new Error('Budget not found'), { status: 404 });
      }
      const remaining = (budget.totalAmount ?? 0) - (budget.spentAmount ?? 0);
      if (remaining < amount) {
        throw Object.assign(new Error('Insufficient budget balance'), { status: 400 });
      }
    }

    const account =
      (await AccountService.getPrimaryAccount(userId)) ??
      (await AccountService.getUserAccounts(userId))[0];
    if (!account) {
      throw Object.assign(new Error('No account found for this user'), { status: 404 });
    }

    const previousAvailable = available;
    const previousTotal = wallet.totalBalance ?? 0;
    await WalletService.updateWalletBalances(userId, {
      availableBalance: available - amount,
      totalBalance: Math.max(0, previousTotal - amount),
    });

    let vtpassResult: Awaited<ReturnType<typeof vtpassService.pay>> | undefined;
    try {
      const phone = digitsOnly((user as any).phoneNumber || customerId);
      vtpassResult = await vtpassService.pay({
        kind: input.category,
        serviceID: input.billerCode,
        billersCode: customerId,
        amount,
        phone: phone.length >= 10 ? phone : customerId,
        variationCode,
        subscriptionType: input.category === 'TELEVISION' ? 'change' : undefined,
      });
    } catch (error: any) {
      if (!error?.pending) {
        await WalletService.updateWalletBalances(userId, {
          availableBalance: previousAvailable,
          totalBalance: previousTotal,
        });
      }
      throw error;
    }

    if (budget) {
      budget.spentAmount = (budget.spentAmount ?? 0) + amount;
      await budget.save();
    }

    const now = new Date();
    const description = CATEGORY_LABEL[input.category];
    const paymentMethodLabel =
      input.paymentSource === 'BUDGET'
        ? budget?.name || `${description} Budget`
        : 'PayGenius wallet';

    const transaction = await TransactionService.createTransaction(
      userId,
      account._id.toString(),
      {
        type: 'DEBIT',
        category: input.category === 'DATA' || input.category === 'AIRTIME' ? 'DATA' : 'UTILITY',
        subCategory: input.category,
        merchant: biller.name,
        description,
        amount,
        currency: 'NGN',
        paymentMethod: 'BILL_PAYMENT',
        budgetId: budget?._id?.toString(),
        reference: receiptReference(now),
        metadata: {
          category: input.category,
          description,
          customerId,
          customerName: validated.customerName,
          planCode: variationCode,
          planName,
          billerCode: input.billerCode,
          billerName: biller.name,
          paymentSource: input.paymentSource,
          paymentMethodLabel,
          token: vtpassResult?.token,
          units: vtpassResult?.units,
          vtpassRequestId: vtpassResult?.requestId,
          vtpassTransactionId: vtpassResult?.transactionId,
        },
      }
    );

    try {
      const paymentId = transaction._id?.toString?.() ?? String(transaction._id);
      await NotificationService.createAndDispatch(userId, {
        type: 'TRANSACTION',
        title: 'Bill payment successful',
        body: `You paid ₦${amount} for ${biller.name}`,
        data: { paymentId },
      });
    } catch {
      // Notification failures must not roll back a successful bill payment
    }

    return toPaymentJson(transaction);
  }

  static async getPayment(userId: string, id: string) {
    const transaction = await Transaction.findOne({
      _id: id,
      userId,
      paymentMethod: 'BILL_PAYMENT',
    });
    return transaction ? toPaymentJson(transaction) : null;
  }
}
