import Transaction from '../models/Transaction';
import { ITransaction, ITransactionDocument } from '../types';
import logger from '../lib/log/winston.log';

export class TransactionService {
  /**
   * Get recent transactions for a user
   */
  static async getRecentTransactions(
    userId: string,
    accountId?: string,
    limit: number = 10
  ): Promise<ITransactionDocument[]> {
    try {
      const query: any = {
        userId,
        status: 'COMPLETED'
      };

      if (accountId) {
        query.accountId = accountId;
      }

      const transactions = await Transaction.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return transactions as ITransactionDocument[];
    } catch (error) {
      logger.error('Error getting recent transactions:', error);
      throw error;
    }
  }

  /**
   * Get transactions with filters
   */
  static async getTransactions(
    userId: string,
    filters: {
      accountId?: string;
      budgetId?: string;
      category?: string;
      type?: 'DEBIT' | 'CREDIT' | 'TRANSFER';
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      skip?: number;
    }
  ): Promise<{ transactions: ITransactionDocument[]; total: number }> {
    try {
      const query: any = {
        userId,
        status: 'COMPLETED'
      };

      if (filters.accountId) query.accountId = filters.accountId;
      if (filters.budgetId) query.budgetId = filters.budgetId;
      if (filters.category) query.category = filters.category;
      if (filters.type) query.type = filters.type;
      if (filters.startDate || filters.endDate) {
        query.createdAt = {};
        if (filters.startDate) query.createdAt.$gte = filters.startDate;
        if (filters.endDate) query.createdAt.$lte = filters.endDate;
      }

      const total = await Transaction.countDocuments(query);

      const transactions = await Transaction.find(query)
        .sort({ createdAt: -1 })
        .limit(filters.limit || 50)
        .skip(filters.skip || 0)
        .lean();

      return {
        transactions: transactions as ITransactionDocument[],
        total
      };
    } catch (error) {
      logger.error('Error getting transactions:', error);
      throw error;
    }
  }

  /**
   * Create a new transaction
   */
  static async createTransaction(
    userId: string,
    accountId: string,
    transactionData: {
      type: 'DEBIT' | 'CREDIT' | 'TRANSFER';
      category: string;
      subCategory?: string;
      merchant?: string;
      description?: string;
      amount: number;
      currency?: 'NGN' | 'USD';
      paymentMethod?: 'CARD' | 'BANK_TRANSFER' | 'WALLET' | 'BILL_PAYMENT' | 'OTHER';
      budgetId?: string;
      reference?: string;
      icon?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<ITransactionDocument> {
    try {
      // Generate reference if not provided
      const reference = transactionData.reference || await this.generateReference();

      const transaction = new Transaction({
        userId,
        accountId,
        type: transactionData.type,
        category: transactionData.category,
        subCategory: transactionData.subCategory,
        merchant: transactionData.merchant,
        description: transactionData.description,
        amount: transactionData.amount,
        currency: transactionData.currency || 'NGN',
        status: 'COMPLETED',
        paymentMethod: transactionData.paymentMethod || 'WALLET',
        budgetId: transactionData.budgetId,
        reference,
        icon: transactionData.icon,
        metadata: transactionData.metadata || {}
      });

      await transaction.save();
      return transaction;
    } catch (error) {
      logger.error('Error creating transaction:', error);
      throw error;
    }
  }

  /**
   * Generate unique transaction reference
   */
  private static async generateReference(): Promise<string> {
    const prefix = 'TXN';
    let reference: string;
    let exists = true;

    do {
      const timestamp = Date.now();
      const randomNum = Math.floor(Math.random() * 10000);
      reference = `${prefix}${timestamp}${randomNum}`;
      const transaction = await Transaction.findOne({ reference });
      exists = !!transaction;
    } while (exists);

    return reference;
  }

  /**
   * Get transaction summary for a period
   */
  static async getTransactionSummary(
    userId: string,
    accountId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalIncome: number;
    totalExpenses: number;
    monthlySpending: number;
  }> {
    try {
      const query: any = {
        userId,
        status: 'COMPLETED'
      };

      if (accountId) query.accountId = accountId;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = startDate;
        if (endDate) query.createdAt.$lte = endDate;
      }

      const summary = await Transaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' }
          }
        }
      ]);

      const totalIncome = summary.find(s => s._id === 'CREDIT')?.total || 0;
      const totalExpenses = summary.find(s => s._id === 'DEBIT')?.total || 0;

      // Calculate monthly spending (current month)
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const monthlyQuery = {
        ...query,
        type: 'DEBIT',
        createdAt: { $gte: monthStart, $lte: monthEnd }
      };

      const monthlyResult = await Transaction.aggregate([
        { $match: monthlyQuery },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]);

      const monthlySpending = monthlyResult.length > 0 ? monthlyResult[0].total : 0;

      return {
        totalIncome,
        totalExpenses,
        monthlySpending
      };
    } catch (error) {
      logger.error('Error getting transaction summary:', error);
      throw error;
    }
  }

  /**
   * Expense analytics for a calendar month: weekly totals + category breakdown.
   */
  static async getExpenseAnalytics(
    userId: string,
    month: number,
    year: number,
    accountId?: string
  ): Promise<{
    totalExpenses: number;
    previousMonthExpenses: number;
    changePercent: number;
    weeks: { week: number; total: number; categories: Record<string, number> }[];
    categories: { name: string; amount: number }[];
  }> {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const prevStart = new Date(year, month - 1, 1);
    const prevEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const base: any = { userId, status: 'COMPLETED', type: 'DEBIT' };
    if (accountId) base.accountId = accountId;

    const [current, previous] = await Promise.all([
      Transaction.find({ ...base, createdAt: { $gte: start, $lte: end } }).lean(),
      Transaction.find({ ...base, createdAt: { $gte: prevStart, $lte: prevEnd } }).lean()
    ]);

    const normalizeCategory = (raw?: string): string => {
      const key = (raw || 'OTHERS').toUpperCase();
      if (key === 'FOOD') return 'Food';
      if (key === 'DATA') return 'Data';
      if (key === 'GROCERIES' || key === 'GROCERY') return 'Groceries';
      if (key === 'FUEL' || key === 'TRANSPORTATION' || key === 'LOGISTICS') return 'Logistics';
      return 'Others';
    };

    const weekOf = (date: Date): number => {
      const day = date.getDate();
      if (day <= 7) return 1;
      if (day <= 14) return 2;
      if (day <= 21) return 3;
      return 4;
    };

    const weeks = [1, 2, 3, 4].map((week) => ({
      week,
      total: 0,
      categories: {} as Record<string, number>
    }));

    const categoryTotals: Record<string, number> = {};
    let totalExpenses = 0;

    for (const tx of current) {
      const amount = tx.amount || 0;
      const cat = normalizeCategory(tx.category);
      const week = weekOf(new Date(tx.createdAt as Date));
      totalExpenses += amount;
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
      const bucket = weeks[week - 1];
      bucket.total += amount;
      bucket.categories[cat] = (bucket.categories[cat] || 0) + amount;
    }

    const previousMonthExpenses = previous.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const changePercent =
      previousMonthExpenses === 0
        ? totalExpenses > 0 ? 100 : 0
        : Math.round(((totalExpenses - previousMonthExpenses) / previousMonthExpenses) * 100);

    return {
      totalExpenses,
      previousMonthExpenses,
      changePercent,
      weeks,
      categories: Object.entries(categoryTotals)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
    };
  }
}

