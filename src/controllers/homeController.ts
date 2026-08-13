import { Response } from 'express';
import { IAuthRequest, IHomeDashboardResponse } from '../types';
import { AccountService } from '../services/accountService';
import { BudgetService } from '../services/budgetService';
import { TransactionService } from '../services/transactionService';
import logger from '../lib/log/winston.log';

export class HomeController {
  /**
   * Get home dashboard data
   * GET /api/home/dashboard
   */
  static async getDashboard(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized. Please login.',
          error: 'UNAUTHORIZED'
        } as IHomeDashboardResponse);
        return;
      }

      // Get primary account
      let account = await AccountService.getPrimaryAccount(userId.toString());

      // If no primary account, get first active account or create one
      if (!account) {
        const accounts = await AccountService.getUserAccounts(userId.toString());
        if (accounts.length > 0) {
          account = accounts[0];
        } else {
          // Create a default wallet account
          account = await AccountService.createAccount(userId.toString(), {
            accountType: 'WALLET',
            currency: 'NGN',
            isPrimary: true
          });
        }
      }

      // Get active budgets (limit to 10 for home page, latest first)
      const budgetsResult = await BudgetService.getUserBudgets(
        userId.toString(),
        account._id.toString(),
        1, // page
        10 // limit
      );
      
      // Extract budgets array from pagination result
      const budgets = budgetsResult.budgets || [];

      // Get recent transactions (limit to 10)
      const recentTransactions = await TransactionService.getRecentTransactions(
        userId.toString(),
        account._id.toString(),
        10
      );

      // Get transaction summary
      const summary = await TransactionService.getTransactionSummary(
        userId.toString(),
        account._id.toString()
      );

      res.status(200).json({
        success: true,
        message: 'Dashboard data retrieved successfully',
        data: {
          account: account.toJSON(),
          budgets: Array.isArray(budgets) ? budgets.map(b => ({
            ...b,
            progress: b.progress || 0,
            remainingAmount: b.remainingAmount || 0
          })) : [],
          recentTransactions: recentTransactions.map(t => t.toJSON()),
          summary
        }
      } as IHomeDashboardResponse);
    } catch (error: any) {
      logger.error('Error getting dashboard data:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve dashboard data',
        error: 'INTERNAL_SERVER_ERROR'
      } as IHomeDashboardResponse);
    }
  }

  /**
   * Get paginated transactions for a calendar month
   * GET /api/home/transactions?month=7&year=2025
   */
  static async getTransactions(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized. Please login.', error: 'UNAUTHORIZED' });
        return;
      }

      const now = new Date();
      const month = req.query.month ? Number(req.query.month) : now.getMonth();
      const year = req.query.year ? Number(req.query.year) : now.getFullYear();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

      const { transactions, total } = await TransactionService.getTransactions(userId.toString(), {
        startDate,
        endDate,
        limit: 100
      });

      const summary = await TransactionService.getTransactionSummary(
        userId.toString(),
        undefined,
        startDate,
        endDate
      );

      res.status(200).json({
        success: true,
        message: 'Transactions retrieved successfully',
        data: {
          transactions: transactions.map((t) => t),
          total,
          month,
          year,
          amountIn: summary.totalIncome,
          amountOut: summary.totalExpenses
        }
      });
    } catch (error: any) {
      logger.error('Error getting transactions:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve transactions',
        error: 'INTERNAL_SERVER_ERROR'
      });
    }
  }

  /**
   * Expense log analytics for a calendar month
   * GET /api/home/analytics?month=7&year=2025
   */
  static async getAnalytics(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id;
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized. Please login.', error: 'UNAUTHORIZED' });
        return;
      }

      const now = new Date();
      const month = req.query.month ? Number(req.query.month) : now.getMonth();
      const year = req.query.year ? Number(req.query.year) : now.getFullYear();

      const analytics = await TransactionService.getExpenseAnalytics(
        userId.toString(),
        month,
        year
      );

      res.status(200).json({
        success: true,
        message: 'Analytics retrieved successfully',
        data: { month, year, ...analytics }
      });
    } catch (error: any) {
      logger.error('Error getting analytics:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve analytics',
        error: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
}

