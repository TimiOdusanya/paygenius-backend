import mongoose from 'mongoose';
import User from '../models/User';
import Transaction from '../models/Transaction';

const DEFAULT_SPEND_LIMIT = 500000;
const DEFAULT_TRANSFER_LIMIT = 200000;

function serviceError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

async function debitTotalToday(userId: string, types: Array<'DEBIT' | 'TRANSFER'> = ['DEBIT']) {
  const result = await Transaction.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        type: { $in: types },
        status: 'COMPLETED',
        createdAt: { $gte: startOfToday() },
      },
    },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);
  return Number(result[0]?.total || 0);
}

export class LimitService {
  static async assertDailySpend(userId: string, amount: number) {
    const user = await User.findById(userId).select('dailySpendLimit');
    if (!user) throw serviceError('User not found', 404);
    const limit = user.dailySpendLimit ?? DEFAULT_SPEND_LIMIT;
    const spent = await debitTotalToday(userId);
    if (spent + amount > limit) {
      throw serviceError(
        `This payment would exceed your daily spend limit of ₦${limit.toLocaleString('en-NG')}. You can raise it in Settings.`,
        400
      );
    }
  }

  static async assertDailyTransfer(userId: string, amount: number) {
    const user = await User.findById(userId).select('dailyTransferLimit');
    if (!user) throw serviceError('User not found', 404);
    const limit = user.dailyTransferLimit ?? DEFAULT_TRANSFER_LIMIT;
    const moved = await debitTotalToday(userId, ['TRANSFER', 'DEBIT']);
    if (moved + amount > limit) {
      throw serviceError(
        `This transfer would exceed your daily transfer limit of ₦${limit.toLocaleString('en-NG')}. You can raise it in Settings.`,
        400
      );
    }
  }
}
