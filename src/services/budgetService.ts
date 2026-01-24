import logger from '../lib/log/winston.log';
import Budget from '../models/Budget';
import Transaction from '../models/Transaction';
import { IBudgetDocument } from '../types';

export class BudgetService {
  /**
   * Get active budgets for a user with pagination
   */
  static async getUserBudgets(
    userId: string,
    accountId?: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{ budgets: IBudgetDocument[]; total: number; page: number; totalPages: number }> {
    const startTime = Date.now();
    try {
      logger.info(`Getting budgets for user ${userId}, page ${page}, limit ${limit}`);
      const query: any = {
        userId,
        isActive: true,
        endDate: { $gte: new Date() }
      };

      console.log("query", query);

      if (accountId) {
        query.accountId = accountId;
      }

      // Calculate skip for pagination
      const skip = (page - 1) * limit;

      // Get total count for pagination
      const total = await Budget.countDocuments(query);

      const budgets = await Budget.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

        console.log("budgets", budgets);

      // Optimize: Calculate spent amounts for all budgets efficiently
      // Use Promise.all with timeout protection and better error handling
      const budgetsWithSpent = await Promise.all(
        budgets.map(async (budget) => {
          try {
            // Create a promise with timeout
            const queryPromise = Transaction.aggregate([
              {
                $match: {
                  budgetId: budget._id,
                  status: 'COMPLETED',
                  type: 'DEBIT',
                  createdAt: {
                    $gte: budget.startDate,
                    $lte: budget.endDate
                  }
                }
              },
              {
                $group: {
                  _id: null,
                  total: { $sum: '$amount' }
                }
              }
            ]).allowDiskUse(true);

            // Add a 3-second timeout per budget query
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Query timeout')), 3000);
            });

            const spent = await Promise.race([queryPromise, timeoutPromise]) as any[];

            const spentAmount = spent.length > 0 ? spent[0].total : 0;

            return {
              ...budget,
              spentAmount,
              progress: budget.totalAmount > 0
                ? Math.min(100, Math.round((spentAmount / budget.totalAmount) * 100))
                : 0,
              remainingAmount: Math.max(0, budget.totalAmount - spentAmount)
            };
          } catch (error: any) {
            // If query times out or fails, use 0 as spent amount and log the error
            logger.warn(`Failed to calculate spent amount for budget ${budget._id}:`, error.message || error);
            return {
              ...budget,
              spentAmount: 0,
              progress: 0,
              remainingAmount: budget.totalAmount
            };
          }
        })
      );

      const duration = Date.now() - startTime;
      logger.info(`Successfully retrieved ${budgetsWithSpent.length} budgets in ${duration}ms`);
      
      return {
        budgets: budgetsWithSpent as IBudgetDocument[],
        total,
        page,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Error getting user budgets after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Create a new budget
   */
  static async createBudget(
    userId: string,
    accountId: string,
    budgetData: {
      name: string;
      category: string;
      totalAmount: number;
      period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<IBudgetDocument> {
    try {
      let startDate: Date;
      let endDate: Date;

      if (budgetData.startDate && budgetData.endDate) {
        startDate = budgetData.startDate;
        endDate = budgetData.endDate;
      } else {
        const calculatedDates = this.calculatePeriodDates(budgetData.period);
        startDate = calculatedDates.startDate;
        endDate = calculatedDates.endDate;
      }

      const budget = new Budget({
        userId,
        accountId,
        name: budgetData.name,
        category: budgetData.category,
        totalAmount: budgetData.totalAmount,
        spentAmount: 0,
        period: budgetData.period,
        startDate,
        endDate,
        isActive: true
      });

      await budget.save();
      return budget;
    } catch (error) {
      logger.error('Error creating budget:', error);
      throw error;
    }
  }

  /**
   * Calculate period dates based on period type
   */
  private static calculatePeriodDates(period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'): {
    startDate: Date;
    endDate: Date;
  } {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let endDate: Date;

    switch (period) {
      case 'DAILY':
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        break;
      case 'WEEKLY':
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);
        break;
      case 'MONTHLY':
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'YEARLY':
        endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
      default:
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
    }

    return { startDate, endDate };
  }

  /**
   * Update budget spent amount
   */
  static async updateBudgetSpent(
    budgetId: string,
    amount: number,
    operation: 'ADD' | 'SUBTRACT'
  ): Promise<void> {
    try {
      const budget = await Budget.findById(budgetId);
      if (!budget) {
        throw new Error('Budget not found');
      }

      if (operation === 'ADD') {
        budget.spentAmount += amount;
      } else {
        budget.spentAmount = Math.max(0, budget.spentAmount - amount);
      }

      await budget.save();
    } catch (error) {
      logger.error('Error updating budget spent:', error);
      throw error;
    }
  }
}

