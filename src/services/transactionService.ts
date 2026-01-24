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

    while (exists) {
      const timestamp = Date.now();
      const randomNum = Math.floor(Math.random() * 10000);
      reference = `${prefix}${timestamp}${randomNum}`;
      const transaction = await Transaction.findOne({ reference });
      exists = !!transaction;
    }

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
}

