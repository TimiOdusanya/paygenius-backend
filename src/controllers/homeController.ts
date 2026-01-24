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
}

