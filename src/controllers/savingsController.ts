import { Response } from 'express';
import { IAuthRequest } from '../types';
import { SavingsService } from '../services/savingsService';
import logger from '../lib/log/winston.log';

export const listGoals = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const data = await SavingsService.listGoals(userId);
    res.status(200).json({
      success: true,
      message: 'Savings goals retrieved successfully',
      data,
    });
  } catch (error) {
    logger.error('List savings goals error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getGoal = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const goal = await SavingsService.getGoal(userId, req.params.id);
    if (!goal) {
      res.status(404).json({ success: false, message: 'Savings goal not found' });
      return;
    }
    res.status(200).json({
      success: true,
      message: 'Savings goal retrieved successfully',
      data: { goal },
    });
  } catch (error) {
    logger.error('Get savings goal error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createGoal = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const {
      name,
      targetAmount,
      description,
      targetDate,
      savingType,
      frequency,
      installmentAmount,
      maturityDate,
      sourceType,
      linkedAccountId,
    } = req.body;

    if (!name || !String(name).trim()) {
      res.status(400).json({ success: false, message: 'Goal name is required' });
      return;
    }
    if (!targetAmount || Number(targetAmount) <= 0) {
      res.status(400).json({ success: false, message: 'Target amount must be greater than 0' });
      return;
    }
    if (!['ONE_TIME', 'RECURRING'].includes(savingType)) {
      res.status(400).json({ success: false, message: 'Saving type must be ONE_TIME or RECURRING' });
      return;
    }
    if (savingType === 'RECURRING' && !['DAILY', 'WEEKLY', 'MONTHLY'].includes(frequency)) {
      res.status(400).json({ success: false, message: 'Frequency is required for recurring savings' });
      return;
    }
    if (!installmentAmount || Number(installmentAmount) <= 0) {
      res.status(400).json({ success: false, message: 'Save amount must be greater than 0' });
      return;
    }
    if (!['PAYGENIUS', 'LINKED_ACCOUNT'].includes(sourceType)) {
      res.status(400).json({ success: false, message: 'Source type is required' });
      return;
    }

    const goal = await SavingsService.createGoal(userId, {
      name,
      targetAmount: Number(targetAmount),
      description,
      targetDate,
      savingType,
      frequency,
      installmentAmount: Number(installmentAmount),
      maturityDate,
      sourceType,
      linkedAccountId,
    });

    res.status(201).json({
      success: true,
      message: 'Savings goal created successfully',
      data: { goal },
    });
  } catch (error) {
    logger.error('Create savings goal error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateGoal = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const goal = await SavingsService.updateGoal(userId, req.params.id, {
      description: req.body.description,
    });
    if (!goal) {
      res.status(404).json({ success: false, message: 'Savings goal not found' });
      return;
    }
    res.status(200).json({
      success: true,
      message: 'Savings goal updated successfully',
      data: { goal },
    });
  } catch (error) {
    logger.error('Update savings goal error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const depositGoal = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
      return;
    }
    const goal = await SavingsService.deposit(userId, req.params.id, amount);
    if (!goal) {
      res.status(404).json({ success: false, message: 'Savings goal not found' });
      return;
    }
    res.status(200).json({
      success: true,
      message: 'Deposit successful',
      data: { goal },
    });
  } catch (error) {
    logger.error('Deposit savings goal error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const listCards = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const cards = await SavingsService.listCards(userId);
    res.status(200).json({
      success: true,
      message: 'Linked accounts retrieved successfully',
      data: { cards },
    });
  } catch (error) {
    logger.error('List linked accounts error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const addCard = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const { accountName, accountNumber, bankCode, cardNumber, expiryMonth, expiryYear } = req.body;

    if (!accountNumber || !bankCode || !cardNumber || !expiryMonth || !expiryYear) {
      res.status(400).json({ success: false, message: 'Bank, account number, card number, and expiry are required' });
      return;
    }

    const card = await SavingsService.addCard(userId, {
      accountName,
      accountNumber,
      bankCode,
      cardNumber,
      expiryMonth,
      expiryYear,
    });

    res.status(201).json({
      success: true,
      message: 'Account linked successfully',
      data: { card },
    });
  } catch (error: any) {
    if (error?.status) {
      res.status(error.status).json({ success: false, message: error.message });
      return;
    }
    logger.error('Add linked account error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteCard = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const card = await SavingsService.deleteCard(userId, req.params.id);
    if (!card) {
      res.status(404).json({ success: false, message: 'Linked account not found' });
      return;
    }
    res.status(200).json({
      success: true,
      message: 'Linked account removed successfully',
      data: { card },
    });
  } catch (error) {
    logger.error('Delete linked account error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
