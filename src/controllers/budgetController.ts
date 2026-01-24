import { NextFunction, Request, Response } from 'express';
import { BudgetService } from '../services/budgetService';
import { IAuthRequest, IBudgetResponse } from '../types';
import { BudgetCategory } from '../utils/enums';
import Account from '../models/Account';
import logger from '../lib/log/winston.log';

/**
 * Create a new budget
 */
export const createBudget = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const { accountId, name, category, totalAmount, period, selectedDate } = req.body;

    // Validation
    if (!accountId) {
      res.status(400).json({
        success: false,
        message: 'Account ID is required'
      } as IBudgetResponse);
      return;
    }

    if (!name || name.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Budget name is required'
      } as IBudgetResponse);
      return;
    }

    if (!category || !Object.values(BudgetCategory).includes(category)) {
      res.status(400).json({
        success: false,
        message: 'Valid category is required'
      } as IBudgetResponse);
      return;
    }

    if (!totalAmount || totalAmount <= 0) {
      res.status(400).json({
        success: false,
        message: 'Total amount must be greater than 0'
      } as IBudgetResponse);
      return;
    }

    if (!period || !['WEEKLY', 'MONTHLY'].includes(period)) {
      res.status(400).json({
        success: false,
        message: 'Period must be WEEKLY or MONTHLY'
      } as IBudgetResponse);
      return;
    }

    // Verify account belongs to user
    const account = await Account.findOne({ _id: accountId, userId });
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found'
      } as IBudgetResponse);
      return;
    }

    // Calculate start and end dates based on period and selected date
    const { startDate, endDate } = calculatePeriodDates(period, selectedDate);

    const budget = await BudgetService.createBudget(userId, accountId, {
      name: name.trim(),
      category,
      totalAmount: Number(totalAmount),
      period: period as 'WEEKLY' | 'MONTHLY',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    res.status(201).json({
      success: true,
      message: 'Budget created successfully',
      data: {
        budget: budget.toJSON()
      }
    } as IBudgetResponse);
  } catch (error) {
    logger.error('Create budget error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as IBudgetResponse);
  }
};

/**
 * Get all budgets for the authenticated user with pagination
 */
export const getUserBudgets = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const { accountId, page, limit } = req.query;

    const pageNumber = page ? parseInt(page as string) : 1;
    const limitNumber = limit ? parseInt(limit as string) : 10;

    const result = await BudgetService.getUserBudgets(
      userId.toString(),
      accountId as string | undefined,
      pageNumber,
      limitNumber
    );

    res.status(200).json({
      success: true,
      message: 'Budgets retrieved successfully',
      data: {
        budgets: result.budgets.map(budget => ({
          ...budget,
          progress: budget.totalAmount > 0
            ? Math.min(100, Math.round((budget.spentAmount / budget.totalAmount) * 100))
            : 0,
          remainingAmount: Math.max(0, budget.totalAmount - budget.spentAmount)
        })),
        pagination: {
          page: result.page,
          limit: limitNumber,
          total: result.total,
          totalPages: result.totalPages
        }
      }
    } as IBudgetResponse);
  } catch (error) {
    logger.error('Get user budgets error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as IBudgetResponse);
  }
};

/**
 * Calculate period dates based on period type and selected date
 */
function calculatePeriodDates(
  period: 'WEEKLY' | 'MONTHLY',
  selectedDate?: string
): { startDate: Date; endDate: Date } {
  let startDate: Date;

  if (selectedDate) {
    // Parse selected date (format: "DD MMMM YYYY" e.g., "18 June 2025")
    const dateParts = selectedDate.trim().split(' ');
    if (dateParts.length >= 3) {
      const day = parseInt(dateParts[0]);
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const month = monthNames.indexOf(dateParts[1]);
      const year = parseInt(dateParts[2]);
      
      if (month === -1 || isNaN(day) || isNaN(year)) {
        // Invalid date, use current date
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate = new Date(year, month, day);
        startDate.setHours(0, 0, 0, 0);
      }
    } else {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
    }
  } else {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  }

  let endDate: Date;

  if (period === 'WEEKLY') {
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);
  } else {
    // MONTHLY
    endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
  }

  return { startDate, endDate };
}
