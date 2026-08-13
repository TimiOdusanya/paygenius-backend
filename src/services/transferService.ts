import User from '../models/User';
import Budget from '../models/Budget';
import Wallet from '../models/Wallet';
import Beneficiary, { TransferRail } from '../models/Beneficiary';
import { BillService, PaymentSource } from './billService';
import { WalletService } from './walletService';
import { AccountService } from './accountService';
import { TransactionService } from './transactionService';
import { LimitService } from './limitService';
import paystackService from './paystackService';
import { NotificationService } from './notificationService';
import logger from '../lib/log/winston.log';

const AVATAR_COLORS = ['#AFE9D6', '#F6E27A', '#D5C7F7', '#F5C6C6', '#F4B183', '#C7E9F5'];

export type TransferInput = {
  rail: TransferRail;
  amount: number;
  note?: string;
  recipientUserId?: string;
  accountNumber?: string;
  bankCode?: string;
  bankName?: string;
  accountName?: string;
  paymentSource?: PaymentSource;
  budgetId?: string;
  pin?: string;
  useBiometric?: boolean;
  saveBeneficiary?: boolean;
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

function displayName(user: any) {
  return [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.username || 'PayGenius user';
}

function handleFor(user: any) {
  return user?.username ? `@${user.username}` : user?.phoneNumber || '';
}

function toTransferJson(transaction: any) {
  const json = typeof transaction?.toJSON === 'function' ? transaction.toJSON() : transaction;
  const meta = json.metadata ?? {};
  return {
    _id: json._id,
    reference: json.reference,
    amount: json.amount,
    status: json.status,
    rail: meta.rail,
    recipientName: meta.recipientName,
    recipientHandle: meta.recipientHandle,
    recipientAccount: meta.recipientAccount,
    bankName: meta.bankName,
    source: meta.paymentSource === 'BUDGET' ? 'BUDGET' : 'WALLET',
    sourceLabel: meta.paymentMethodLabel,
    note: meta.note,
    createdAt: json.createdAt,
  };
}

function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash + seed.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

export class TransferService {
  static async lookupUsers(userId: string, query: string) {
    const q = String(query || '').trim();
    if (q.length < 2) return [];

    if (/^\d{10}$/.test(q)) {
      const resolved = await this.resolveRecipient(userId, {
        rail: 'PAYGENIUS',
        accountNumber: q,
      }).catch(() => null);
      if (!resolved?.recipientUserId) return [];
      return [
        {
          _id: resolved.recipientUserId,
          name: resolved.name,
          handle: resolved.handle,
          profilePicture: undefined,
          avatarColor: avatarColor(resolved.recipientUserId),
          rail: 'PAYGENIUS' as const,
          accountNumber: resolved.accountNumber,
        },
      ];
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(escaped, 'i');
    const users = await User.find({
      _id: { $ne: userId },
      $or: [{ username: rx }, { firstName: rx }, { lastName: rx }, { phoneNumber: rx }],
    })
      .select('firstName lastName username phoneNumber profilePicture')
      .limit(12);
    return users.map((user) => ({
      _id: user._id,
      name: displayName(user),
      handle: handleFor(user),
      profilePicture: user.profilePicture,
      avatarColor: avatarColor(String(user._id)),
      rail: 'PAYGENIUS' as const,
    }));
  }

  static async resolveRecipient(
    userId: string,
    input: { rail?: TransferRail; accountNumber: string; bankCode?: string; bankName?: string }
  ) {
    const accountNumber = digitsOnly(input.accountNumber || '');
    if (accountNumber.length !== 10) {
      throw Object.assign(new Error('Enter a valid 10-digit account number'), { status: 400 });
    }

    const internal = await Wallet.findOne({ virtualAccountNumber: accountNumber, isActive: true });
    if (internal) {
      if (String(internal.userId) === userId) {
        throw Object.assign(new Error('You cannot transfer to your own account'), { status: 400 });
      }
      const user = await User.findById(internal.userId);
      if (!user) {
        throw Object.assign(new Error('That PayGenius account was not found'), { status: 404 });
      }
      return {
        rail: 'PAYGENIUS' as const,
        recipientUserId: String(user._id),
        name: displayName(user),
        handle: handleFor(user),
        accountNumber,
        bankCode: input.bankCode,
        bankName: 'PayGenius',
      };
    }

    if (input.rail === 'PAYGENIUS') {
      throw Object.assign(new Error('No PayGenius account matches that number'), { status: 404 });
    }
    if (!input.bankCode) {
      throw Object.assign(new Error('Select a bank to resolve this account'), { status: 400 });
    }

    const resolved = await paystackService.resolveAccount(accountNumber, input.bankCode);
    return {
      rail: 'BANK' as const,
      recipientUserId: undefined,
      name: resolved.accountName,
      handle: input.bankName || 'Other bank',
      accountNumber,
      bankCode: input.bankCode,
      bankName: input.bankName || 'Other bank',
    };
  }

  static async listBeneficiaries(userId: string, rail?: TransferRail) {
    const filter: Record<string, unknown> = { userId };
    if (rail) filter.rail = rail;
    const items = await Beneficiary.find(filter).sort({ lastUsedAt: -1, updatedAt: -1 }).limit(40);
    return items.map((item) => ({
      _id: item._id,
      rail: item.rail,
      name: item.name,
      handle: item.handle,
      recipientUserId: item.recipientUserId,
      accountNumber: item.accountNumber,
      bankCode: item.bankCode,
      bankName: item.bankName,
      avatarColor: item.avatarColor || avatarColor(item.name),
    }));
  }

  static async saveBeneficiary(
    userId: string,
    payload: {
      rail: TransferRail;
      name: string;
      handle?: string;
      recipientUserId?: string;
      accountNumber?: string;
      bankCode?: string;
      bankName?: string;
    }
  ) {
    const query =
      payload.rail === 'PAYGENIUS' && payload.recipientUserId
        ? { userId, recipientUserId: payload.recipientUserId }
        : { userId, accountNumber: payload.accountNumber, bankCode: payload.bankCode };
    const beneficiary = await Beneficiary.findOneAndUpdate(
      query,
      {
        $set: {
          ...payload,
          userId,
          avatarColor: avatarColor(payload.name || payload.accountNumber || 'x'),
          lastUsedAt: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return beneficiary;
  }

  static async deleteBeneficiary(userId: string, id: string) {
    const removed = await Beneficiary.findOneAndDelete({ _id: id, userId });
    if (!removed) {
      throw Object.assign(new Error('Beneficiary not found'), { status: 404 });
    }
  }

  static async getTransfer(userId: string, id: string) {
    const Transaction = (await import('../models/Transaction')).default;
    const tx = await Transaction.findOne({ _id: id, userId, type: 'TRANSFER' });
    if (!tx) {
      throw Object.assign(new Error('Transfer not found'), { status: 404 });
    }
    return toTransferJson(tx);
  }

  static async send(userId: string, input: TransferInput) {
    await BillService.verifyAuthorization(userId, input.pin, input.useBiometric);

    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount < 100) {
      throw Object.assign(new Error('Enter an amount of at least ₦100'), { status: 400 });
    }

    const wallet = await WalletService.getWalletByUserId(userId);
    if (!wallet) {
      throw Object.assign(new Error('Wallet not found'), { status: 404 });
    }
    const available = wallet.availableBalance ?? 0;
    if (available < amount) {
      throw Object.assign(new Error('Insufficient wallet balance'), { status: 400 });
    }

    await LimitService.assertDailyTransfer(userId, amount);

    const paymentSource: PaymentSource = input.paymentSource === 'BUDGET' ? 'BUDGET' : 'WALLET';
    let budget: any = null;
    if (paymentSource === 'BUDGET') {
      if (!input.budgetId) {
        throw Object.assign(new Error('Select a budget to transfer from'), { status: 400 });
      }
      budget = await Budget.findOne({ _id: input.budgetId, userId, isActive: true });
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

    let rail: TransferRail = input.rail;
    let recipientName = '';
    let recipientHandle = '';
    let recipientAccount = '';
    let bankName = '';
    let recipientUser: any = null;

    if (rail === 'BANK') {
      const accountNumber = digitsOnly(input.accountNumber || '');
      if (accountNumber.length !== 10 || !input.bankCode) {
        throw Object.assign(new Error('Enter a valid 10-digit account and bank'), { status: 400 });
      }
      const internal = await Wallet.findOne({ virtualAccountNumber: accountNumber, isActive: true });
      if (internal && String(internal.userId) !== userId) {
        recipientUser = await User.findById(internal.userId);
        rail = 'PAYGENIUS';
        recipientName = displayName(recipientUser);
        recipientHandle = handleFor(recipientUser);
        recipientAccount = accountNumber;
        bankName = 'PayGenius';
      } else {
        const resolved = await paystackService.resolveAccount(accountNumber, input.bankCode);
        recipientName = resolved.accountName;
        recipientHandle = input.bankName || 'Other bank';
        recipientAccount = accountNumber;
        bankName = input.bankName || 'Other bank';
      }
    } else {
      if (!input.recipientUserId) {
        throw Object.assign(new Error('Select a PayGenius recipient'), { status: 400 });
      }
      recipientUser = await User.findById(input.recipientUserId);
      if (!recipientUser || String(recipientUser._id) === userId) {
        throw Object.assign(new Error('That PayGenius user was not found'), { status: 404 });
      }
      recipientName = displayName(recipientUser);
      recipientHandle = handleFor(recipientUser);
      const destWallet = await WalletService.getWalletByUserId(String(recipientUser._id));
      recipientAccount = destWallet?.virtualAccountNumber || '';
      bankName = 'PayGenius';
    }

    const reference = receiptReference();
    const sourceLabel = budget?.name ? `${budget.name} budget` : 'PayGenius wallet';
    const note = String(input.note || '').trim();
    const previousAvailable = available;
    const previousTotal = wallet.totalBalance ?? 0;

    await WalletService.updateWalletBalances(userId, {
      availableBalance: available - amount,
      totalBalance: Math.max(0, previousTotal - amount),
    });

    try {
      if (rail === 'PAYGENIUS' && recipientUser) {
        const destWallet = await WalletService.getWalletByUserId(String(recipientUser._id));
        if (!destWallet) {
          throw Object.assign(new Error('Recipient wallet is not ready yet'), { status: 400 });
        }
        await WalletService.updateWalletBalances(String(recipientUser._id), {
          availableBalance: (destWallet.availableBalance ?? 0) + amount,
          totalBalance: (destWallet.totalBalance ?? 0) + amount,
        });
        const destAccount =
          (await AccountService.getPrimaryAccount(String(recipientUser._id))) ??
          (await AccountService.getUserAccounts(String(recipientUser._id)))[0];
        if (destAccount) {
          await TransactionService.createTransaction(String(recipientUser._id), String(destAccount._id), {
            type: 'CREDIT',
            category: 'Transfer',
            merchant: displayName(await User.findById(userId)),
            description: note || 'Transfer received',
            amount,
            paymentMethod: 'WALLET',
            reference: `${reference}-IN`,
            metadata: { rail: 'PAYGENIUS', direction: 'IN' },
          });
        }
        try {
          await NotificationService.createAndDispatch(String(recipientUser._id), {
            type: 'TRANSACTION',
            title: 'Money received',
            body: `You received ₦${amount.toLocaleString('en-NG')} from a PayGenius transfer.`,
          });
        } catch {
          /* optional */
        }
      } else {
        const recipient = await paystackService.createTransferRecipient({
          name: recipientName,
          accountNumber: recipientAccount,
          bankCode: String(input.bankCode),
        });
        await paystackService.initiateTransfer({
          amount,
          recipientCode: recipient.recipientCode,
          reason: note || `Transfer to ${recipientName}`,
          reference,
        });
      }
    } catch (error) {
      await WalletService.updateWalletBalances(userId, {
        availableBalance: previousAvailable,
        totalBalance: previousTotal,
      });
      throw error;
    }

    if (budget) {
      budget.spentAmount = (budget.spentAmount ?? 0) + amount;
      await budget.save();
    }

    const sender = await User.findById(userId);
    const tx = await TransactionService.createTransaction(userId, String(account._id), {
      type: 'TRANSFER',
      category: 'Transfer',
      merchant: recipientName,
      description: note || `Transfer to ${recipientName}`,
      amount,
      paymentMethod: rail === 'BANK' ? 'BANK_TRANSFER' : 'WALLET',
      budgetId: budget ? String(budget._id) : undefined,
      reference,
      metadata: {
        rail,
        recipientName,
        recipientHandle,
        recipientAccount,
        bankName,
        note,
        paymentSource,
        paymentMethodLabel: sourceLabel,
        senderName: displayName(sender),
      },
    });

    if (input.saveBeneficiary !== false) {
      try {
        await this.saveBeneficiary(userId, {
          rail,
          name: recipientName,
          handle: recipientHandle,
          recipientUserId: recipientUser ? String(recipientUser._id) : undefined,
          accountNumber: recipientAccount || undefined,
          bankCode: input.bankCode,
          bankName,
        });
      } catch (error) {
        logger.warn('Could not save beneficiary', error);
      }
    }

    return toTransferJson(tx);
  }
}
