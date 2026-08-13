import { Response } from 'express';
import { IAuthRequest } from '../types';
import { SettingsService } from '../services/settingsService';
import { SupportService } from '../services/supportService';
import logger from '../lib/log/winston.log';

function sendServiceError(res: Response, error: any, logLabel: string) {
  if (error?.status) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  logger.error(logLabel, error);
  res.status(500).json({ success: false, message: 'Internal server error' });
}

export const getSettings = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await SettingsService.getSettings(req.user!._id.toString());
    res.status(200).json({
      success: true,
      message: 'Settings retrieved successfully',
      data: { settings },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Get settings error:');
  }
};

export const updateSettings = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const settings = await SettingsService.updateSettings(req.user!._id.toString(), {
      dailySpendLimit: req.body?.dailySpendLimit,
      dailyTransferLimit: req.body?.dailyTransferLimit,
      faceIdEnabled: req.body?.faceIdEnabled,
    });
    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: { settings },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Update settings error:');
  }
};

export const changePassword = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const data = await SettingsService.changePassword(
      req.user!._id.toString(),
      String(req.body?.currentPassword ?? req.body?.current ?? ''),
      String(req.body?.newPassword ?? req.body?.next ?? '')
    );
    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
      data,
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Change password error:');
  }
};

export const changePin = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const data = await SettingsService.changePin(
      req.user!._id.toString(),
      String(req.body?.currentPin ?? ''),
      String(req.body?.newPin ?? '')
    );
    res.status(200).json({
      success: true,
      message: 'PIN changed successfully',
      data,
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Change PIN error:');
  }
};

export const setBiometric = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    if (typeof req.body?.enabled !== 'boolean') {
      res.status(400).json({ success: false, message: 'enabled must be a boolean' });
      return;
    }
    const data = await SettingsService.setBiometric(
      req.user!._id.toString(),
      req.body.enabled
    );
    res.status(200).json({
      success: true,
      message: 'Biometric setting updated successfully',
      data,
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Set biometric error:');
  }
};

export const deactivateAccount = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const data = await SettingsService.deactivateAccount(req.user!._id.toString());
    res.status(200).json({
      success: true,
      message: 'Account deactivated successfully',
      data,
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Deactivate account error:');
  }
};

export const deleteAccount = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const password =
      typeof req.body?.password === 'string' ? req.body.password : undefined;
    const data = await SettingsService.deleteAccount(req.user!._id.toString(), password);
    res.status(200).json({
      success: true,
      message: 'Account deleted successfully',
      data,
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Delete account error:');
  }
};

export const getReferrals = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const data = await SettingsService.getReferral(req.user!._id.toString());
    res.status(200).json({
      success: true,
      message: 'Referral details retrieved successfully',
      data,
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Get referrals error:');
  }
};

export const submitReview = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const review = await SupportService.submitReview(req.user!._id.toString(), {
      rating: Number(req.body?.rating),
      review: req.body?.review,
      enjoyed: req.body?.enjoyed,
    });
    res.status(200).json({
      success: true,
      message: 'Review submitted successfully',
      data: { review },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Submit review error:');
  }
};
