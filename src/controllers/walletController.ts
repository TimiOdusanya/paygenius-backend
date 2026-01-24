import { Response } from 'express';
import { WalletService } from '../services/walletService';
import { IAuthRequest, IAuthResponse } from '../types';
import logger from '../lib/log/winston.log';

/**
 * Get current user's wallet information
 */
export const getWallet = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;

    const wallet = await WalletService.getWalletByUserId(userId);

    if (!wallet) {
      res.status(404).json({
        success: false,
        message: 'Wallet not found. Please contact support.',
      } as IAuthResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Wallet retrieved successfully',
      data: {
        wallet: wallet.toJSON(),
      },
    } as any);
  } catch (error) {
    logger.error('Get wallet error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    } as IAuthResponse);
  }
};
