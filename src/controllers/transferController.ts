import { Response } from 'express';
import { IAuthRequest } from '../types';
import { TransferService } from '../services/transferService';
import logger from '../lib/log/winston.log';

export class TransferController {
  static async lookup(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized. Please login.', error: 'UNAUTHORIZED' });
        return;
      }
      const users = await TransferService.lookupUsers(userId, String(req.query.q || ''));
      res.status(200).json({ success: true, message: 'Users found', data: { users } });
    } catch (error: any) {
      logger.error('Transfer lookup failed:', error);
      res.status(500).json({ success: false, message: error.message || 'Lookup failed', error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  static async resolve(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized. Please login.', error: 'UNAUTHORIZED' });
        return;
      }
      const rail = req.query.rail === 'BANK' || req.query.rail === 'PAYGENIUS' ? req.query.rail : undefined;
      const account = await TransferService.resolveRecipient(userId, {
        rail,
        accountNumber: String(req.query.accountNumber || ''),
        bankCode: req.query.bankCode ? String(req.query.bankCode) : undefined,
        bankName: req.query.bankName ? String(req.query.bankName) : undefined,
      });
      res.status(200).json({ success: true, message: 'Account resolved', data: { account } });
    } catch (error: any) {
      logger.error('Transfer resolve failed:', error);
      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Could not resolve account',
        error: error.status === 400 ? 'VALIDATION_ERROR' : error.status === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  static async listBeneficiaries(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized. Please login.', error: 'UNAUTHORIZED' });
        return;
      }
      const rail = req.query.rail === 'BANK' || req.query.rail === 'PAYGENIUS' ? req.query.rail : undefined;
      const beneficiaries = await TransferService.listBeneficiaries(userId, rail);
      res.status(200).json({ success: true, message: 'Beneficiaries retrieved', data: { beneficiaries } });
    } catch (error: any) {
      logger.error('List beneficiaries failed:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to list beneficiaries', error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  static async createBeneficiary(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized. Please login.', error: 'UNAUTHORIZED' });
        return;
      }
      const beneficiary = await TransferService.saveBeneficiary(userId, req.body || {});
      res.status(201).json({ success: true, message: 'Beneficiary saved', data: { beneficiary } });
    } catch (error: any) {
      logger.error('Save beneficiary failed:', error);
      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to save beneficiary',
        error: 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  static async deleteBeneficiary(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized. Please login.', error: 'UNAUTHORIZED' });
        return;
      }
      await TransferService.deleteBeneficiary(userId, req.params.id);
      res.status(200).json({ success: true, message: 'Beneficiary removed' });
    } catch (error: any) {
      logger.error('Delete beneficiary failed:', error);
      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Failed to remove beneficiary',
        error: error.status === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  static async send(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized. Please login.', error: 'UNAUTHORIZED' });
        return;
      }
      const transfer = await TransferService.send(userId, req.body || {});
      res.status(200).json({ success: true, message: 'Transfer successful', data: { transfer } });
    } catch (error: any) {
      logger.error('Transfer send failed:', error);
      const status = error.status || 500;
      res.status(status).json({
        success: false,
        message: error.message || 'Transfer failed',
        error: status === 401 ? 'UNAUTHORIZED' : status === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_SERVER_ERROR',
      });
    }
  }

  static async getOne(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized. Please login.', error: 'UNAUTHORIZED' });
        return;
      }
      const transfer = await TransferService.getTransfer(userId, req.params.id);
      res.status(200).json({ success: true, message: 'Transfer retrieved', data: { transfer } });
    } catch (error: any) {
      logger.error('Get transfer failed:', error);
      res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Transfer not found',
        error: error.status === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR',
      });
    }
  }
}
