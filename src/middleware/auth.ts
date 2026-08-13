import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { verifyToken } from '../utils/jwt';
import { IAuthRequest } from '../types';

export const authenticate = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Access token required'
      });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    const user = await User.findById(decoded.userId).select('-password -transactionPin').lean();
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    if ((user as any).deletedAt) {
      res.status(401).json({
        success: false,
        message: 'Account has been deleted'
      });
      return;
    }

    if ((user as any).deactivatedAt) {
      res.status(403).json({
        success: false,
        message: 'This account is deactivated. Contact support to restore it.'
      });
      return;
    }

    // Fetch wallet if it exists
    const { WalletService } = await import('../services/walletService');
    const wallet = await WalletService.getWalletByUserId(decoded.userId);

    req.user = {
      ...user,
      wallet: wallet ? wallet.toJSON() : undefined
    } as any;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

export const optionalAuth = async (req: IAuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    
    const user = await User.findById(decoded.userId).select('-password -transactionPin');
    
    if (user) {
      req.user = user.toJSON();
    }
    
    next();
  } catch (error) {
    next();
  }
};
