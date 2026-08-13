import crypto from 'crypto';
import SavingsGoal, {
  ISavingsGoal,
  SavingAccent,
  SavingFrequency,
  SavingSource,
  SavingType,
} from '../models/SavingsGoal';
import LinkedAccount, { ILinkedAccount } from '../models/LinkedAccount';
import { WalletService } from './walletService';
import { paystackService } from './paystackService';
import logger from '../lib/log/winston.log';

function luhnValid(digits: string) {
  if (!/^\d{13,19}$/.test(digits)) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function expiryValid(month: string, year: string) {
  const mm = Number(month);
  const yy = Number(year.length === 2 ? `20${year}` : year);
  if (!Number.isInteger(mm) || mm < 1 || mm > 12) return false;
  if (!Number.isInteger(yy) || yy < 2000) return false;
  const now = new Date();
  const end = new Date(yy, mm, 0, 23, 59, 59);
  return end >= now;
}

function normalizeBrand(brand?: string) {
  const value = String(brand ?? '').trim().toUpperCase();
  if (value.includes('MASTER')) return 'MASTERCARD';
  if (value.includes('VERVE')) return 'VERVE';
  if (value.includes('AMEX') || value.includes('AMERICAN')) return 'AMEX';
  if (value.includes('VISA')) return 'VISA';
  return value || 'CARD';
}

export type CreateGoalInput = {
  name: string;
  targetAmount: number;
  description?: string;
  targetDate?: string;
  savingType: SavingType;
  frequency?: SavingFrequency;
  installmentAmount: number;
  maturityDate?: string;
  sourceType: SavingSource;
  linkedAccountId?: string;
};

function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24) || 'goal';
  return `${base}-${crypto.randomBytes(4).toString('hex')}`;
}

function toGoalJson(goal: ISavingsGoal) {
  const json = typeof (goal as any).toJSON === 'function' ? (goal as any).toJSON() : goal;
  const progress =
    json.targetAmount > 0
      ? Math.min(100, Math.round((json.currentAmount / json.targetAmount) * 100))
      : 0;
  return { ...json, progress };
}

export class SavingsService {
  static async listGoals(userId: string) {
    const goals = await SavingsGoal.find({ userId, isActive: true }).sort({
      createdAt: -1,
    });
    const totalBalance = goals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);
    return {
      goals: goals.map(toGoalJson),
      totalBalance,
    };
  }

  static async getGoal(userId: string, id: string) {
    const goal = await SavingsGoal.findOne({ _id: id, userId, isActive: true });
    return goal ? toGoalJson(goal) : null;
  }

  static async createGoal(userId: string, input: CreateGoalInput) {
    const existingCount = await SavingsGoal.countDocuments({ userId, isActive: true });
    const accent: SavingAccent = existingCount % 2 === 0 ? 'navy' : 'green';

    const goal = await SavingsGoal.create({
      userId,
      name: input.name.trim(),
      targetAmount: Number(input.targetAmount),
      currentAmount: 0,
      description: input.description?.trim() || undefined,
      targetDate: input.targetDate ? new Date(input.targetDate) : undefined,
      savingType: input.savingType,
      frequency: input.frequency,
      installmentAmount: Number(input.installmentAmount),
      maturityDate: input.maturityDate ? new Date(input.maturityDate) : undefined,
      sourceType: input.sourceType,
      linkedAccountId: input.linkedAccountId || undefined,
      shareSlug: slugify(input.name),
      accent,
      isActive: true,
    });

    const depositAmount = Number(input.installmentAmount);
    if (input.sourceType === 'PAYGENIUS' && depositAmount > 0) {
      await this.depositFromWallet(userId, goal, depositAmount);
    }

    const fresh = await SavingsGoal.findById(goal._id);
    return toGoalJson(fresh ?? goal);
  }

  static async updateGoal(
    userId: string,
    id: string,
    updates: { description?: string }
  ) {
    const goal = await SavingsGoal.findOneAndUpdate(
      { _id: id, userId, isActive: true },
      { $set: { description: updates.description?.trim() ?? '' } },
      { new: true }
    );
    return goal ? toGoalJson(goal) : null;
  }

  static async deposit(userId: string, id: string, amount: number) {
    const goal = await SavingsGoal.findOne({ _id: id, userId, isActive: true });
    if (!goal) return null;

    if (goal.sourceType === 'PAYGENIUS') {
      await this.depositFromWallet(userId, goal, amount);
    } else {
      goal.currentAmount += amount;
      await goal.save();
    }

    const fresh = await SavingsGoal.findById(goal._id);
    return toGoalJson(fresh ?? goal);
  }

  static async listCards(userId: string) {
    return LinkedAccount.find({ userId, isActive: true }).sort({ createdAt: -1 });
  }

  static async addCard(
    userId: string,
    input: {
      accountName?: string;
      accountNumber: string;
      bankCode: string;
      cardNumber: string;
      expiryMonth: string;
      expiryYear: string;
    }
  ): Promise<ILinkedAccount> {
    const accountNumber = String(input.accountNumber ?? '').replace(/\D/g, '');
    const bankCode = String(input.bankCode ?? '').trim();
    const digits = String(input.cardNumber ?? '').replace(/\D/g, '');
    const expiryMonth = String(input.expiryMonth ?? '').padStart(2, '0');
    const expiryYear = String(input.expiryYear ?? '');

    if (accountNumber.length !== 10) {
      throw Object.assign(new Error('Enter a valid 10-digit account number'), { status: 400 });
    }
    if (!bankCode) {
      throw Object.assign(new Error('Select the bank for this account'), { status: 400 });
    }
    if (!luhnValid(digits)) {
      throw Object.assign(new Error('This card number is not valid'), { status: 400 });
    }
    if (!expiryValid(expiryMonth, expiryYear)) {
      throw Object.assign(new Error('This card has expired or the expiry date is invalid'), {
        status: 400,
      });
    }

    const resolved = await paystackService.resolveAccount(accountNumber, bankCode);
    const bin = await paystackService.resolveCardBin(digits.slice(0, 6));
    const banks = await paystackService.listBanks('nigeria');
    const bank = banks.find((item) => item.code === bankCode);

    const card = await LinkedAccount.create({
      userId,
      accountName: resolved.accountName,
      accountNumber: resolved.accountNumber,
      last4: digits.slice(-4),
      brand: normalizeBrand(bin.brand),
      bankCode,
      bankName: bank?.name || bin.bank,
      expiryMonth,
      expiryYear: expiryYear.length === 2 ? `20${expiryYear}` : expiryYear,
      isActive: true,
    });
    return card;
  }

  static async deleteCard(userId: string, id: string) {
    const card = await LinkedAccount.findOne({ _id: id, userId, isActive: true });
    if (!card) return null;
    card.isActive = false;
    await card.save();
    return card;
  }

  private static async depositFromWallet(
    userId: string,
    goal: ISavingsGoal,
    amount: number
  ) {
    const wallet = await WalletService.getWalletByUserId(userId);
    if (!wallet) {
      logger.warn('No wallet found for savings deposit', { userId });
      return;
    }

    const available = wallet.availableBalance ?? 0;
    const transfer = Math.min(amount, available);
    if (transfer > 0) {
      const { LimitService } = await import('./limitService');
      await LimitService.assertDailyTransfer(userId, transfer);
    }
    if (transfer <= 0) {
      logger.info('Insufficient wallet balance for savings deposit', {
        userId,
        requested: amount,
        available,
      });
      return;
    }

    await WalletService.updateWalletBalances(userId, {
      availableBalance: available - transfer,
      totalBalance: Math.max(0, (wallet.totalBalance ?? 0) - transfer),
    });

    goal.currentAmount += transfer;
    await (goal as any).save();
  }
}
