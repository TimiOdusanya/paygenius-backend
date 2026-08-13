import { Response } from 'express';
import { IAuthRequest } from '../types';
import { paystackService } from '../services/paystackService';
import { withBankLogos } from '../lib/bankLogos';
import logger from '../lib/log/winston.log';

function sendServiceError(res: Response, error: any, logLabel: string) {
  if (error?.status) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  logger.error(logLabel, error);
  res.status(500).json({ success: false, message: 'Internal server error' });
}

export const listBanks = async (_req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const banks = await withBankLogos(await paystackService.listBanks('nigeria'));
    res.status(200).json({
      success: true,
      message: 'Banks retrieved successfully',
      data: { banks },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'List banks error:');
  }
};

export const resolveAccount = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const accountNumber = String(req.query.accountNumber ?? '').replace(/\D/g, '');
    const bankCode = String(req.query.bankCode ?? '').trim();
    if (accountNumber.length !== 10) {
      res.status(400).json({ success: false, message: 'Enter a valid 10-digit account number' });
      return;
    }
    if (!bankCode) {
      res.status(400).json({ success: false, message: 'Select a bank' });
      return;
    }
    const account = await paystackService.resolveAccount(accountNumber, bankCode);
    res.status(200).json({
      success: true,
      message: 'Account resolved successfully',
      data: { account },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Resolve account error:');
  }
};

export const resolveCardBin = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const bin = String(req.params.bin ?? '').replace(/\D/g, '').slice(0, 6);
    if (bin.length < 6) {
      res.status(400).json({ success: false, message: 'Enter at least the first 6 digits of the card' });
      return;
    }
    const card = await paystackService.resolveCardBin(bin);
    res.status(200).json({
      success: true,
      message: 'Card verified successfully',
      data: { card },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Resolve card BIN error:');
  }
};
