import { Response } from 'express';
import { IAuthRequest } from '../types';
import { LoanService } from '../services/loanService';
import logger from '../lib/log/winston.log';

export const listProviders = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const providers = LoanService.listProviders(q);
    res.status(200).json({
      success: true,
      message: 'Loan providers retrieved successfully',
      data: { providers },
    });
  } catch (error) {
    logger.error('List loan providers error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const listLoans = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const data = await LoanService.listLoans(userId);
    res.status(200).json({
      success: true,
      message: 'Loans retrieved successfully',
      data,
    });
  } catch (error) {
    logger.error('List loans error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getLoan = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const loan = await LoanService.getLoan(userId, req.params.id);
    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan not found' });
      return;
    }
    res.status(200).json({
      success: true,
      message: 'Loan retrieved successfully',
      data: { loan },
    });
  } catch (error) {
    logger.error('Get loan error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const linkLoan = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const { providerCode, providerName, accountName, accountNumber, bvn } = req.body;

    if (!providerName || !String(providerName).trim()) {
      res.status(400).json({ success: false, message: 'Provider is required' });
      return;
    }
    if (!accountName || !String(accountName).trim()) {
      res.status(400).json({ success: false, message: 'Account name is required' });
      return;
    }
    if (!accountNumber || String(accountNumber).replace(/\D/g, '').length < 8) {
      res.status(400).json({ success: false, message: 'A valid account number is required' });
      return;
    }
    if (!bvn || String(bvn).replace(/\D/g, '').length < 10) {
      res.status(400).json({ success: false, message: 'A valid BVN is required' });
      return;
    }

    const loan = await LoanService.linkLoan(userId, {
      providerCode: providerCode ?? '',
      providerName,
      accountName,
      accountNumber,
      bvn,
    });

    res.status(201).json({
      success: true,
      message: 'Loan provider linked successfully',
      data: { loan },
    });
  } catch (error) {
    logger.error('Link loan error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateLoan = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const { automate, repaymentFrequency, reminderEnabled } = req.body;
    const loan = await LoanService.updateLoan(userId, req.params.id, {
      automate,
      repaymentFrequency,
      reminderEnabled,
    });
    if (!loan) {
      res.status(404).json({ success: false, message: 'Loan not found' });
      return;
    }
    res.status(200).json({
      success: true,
      message: 'Loan updated successfully',
      data: { loan },
    });
  } catch (error) {
    logger.error('Update loan error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
