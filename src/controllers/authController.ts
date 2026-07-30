import { NextFunction, Request, Response } from 'express';
import PhoneVerification from '../models/PhoneVerification';
import User from '../models/User';
import { exchangeAuthCodeForTokens, verifyGoogleToken } from '../services/googleAuthService';
import { sendVerificationCode, sendWelcomeMessage } from '../services/smsService';
import { WalletService } from '../services/walletService';
import logger from '../lib/log/winston.log';
import { IAuthRequest, IAuthResponse, IProfileResponse } from '../types';
import { generatePhoneVerificationCode, generateRefreshToken, generateToken } from '../utils/jwt';

// Send phone verification code
export const sendPhoneVerification = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'Phone number already registered'
      } as IAuthResponse);
      return;
    }

    // Generate verification code
    const code = generatePhoneVerificationCode();

    // Delete any existing verification codes for this phone number
    await PhoneVerification.deleteMany({ phoneNumber });

    // Save new verification code
    const phoneVerification = new PhoneVerification({
      phoneNumber,
      code
    });
    await phoneVerification.save();

    // Send SMS
    const smsSent = await sendVerificationCode(phoneNumber, code);
    
    if (!smsSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to send verification code'
      } as IAuthResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Verification code sent successfully',
      // Expose code in non-production for easy testing (Twilio may not be configured)
      ...(process.env.NODE_ENV !== 'production' && { devCode: code }),
    } as IAuthResponse);

  } catch (error) {
    console.error('Send phone verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as IAuthResponse);
  }
};

// Verify phone number
export const verifyPhoneNumber = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber, code } = req.body;

    // Find verification record
    const verification = await PhoneVerification.findOne({
      phoneNumber,
      code,
      expiresAt: { $gt: new Date() }
    });

    if (!verification) {
      res.status(400).json({
        success: false,
        message: 'Invalid or expired verification code'
      } as IAuthResponse);
      return;
    }

    // Check attempts
    if (verification.attempts >= 5) {
      res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new code.'
      } as IAuthResponse);
      return;
    }

    // Increment attempts
    verification.attempts += 1;
    await verification.save();

    // Delete verification record
    await PhoneVerification.deleteOne({ _id: verification._id });

    res.status(200).json({
      success: true,
      message: 'Phone number verified successfully'
    } as IAuthResponse);

  } catch (error) {
    console.error('Verify phone number error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as IAuthResponse);
  }
};

// Register with phone number
export const registerWithPhone = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ phoneNumber });
    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'Phone number already registered'
      } as IAuthResponse);
      return;
    }

    // Create new user
    const user = new User({
      phoneNumber,
      password,
      isPhoneVerified: true
    });

    await user.save();

    // Create Paystack virtual account (wallet) for the user
    try {
      // Generate a temporary email if user doesn't have one
      const userEmail = user.email || `${phoneNumber.replace(/[^0-9]/g, '')}@paygenius.temp`;
      
      await WalletService.createWallet(user._id.toString(), {
        email: userEmail,
        firstName: user.firstName || 'User',
        lastName: user.lastName || '',
        phone: phoneNumber,
      });

      logger.info('Wallet created for new user', { userId: user._id.toString() });
    } catch (walletError: any) {
      // Log error but don't fail registration - wallet can be created later
      logger.error('Failed to create wallet during registration', {
        error: walletError.message,
        userId: user._id.toString(),
      });
      // Continue with registration even if wallet creation fails
    }

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Fetch wallet if it was created
    const wallet = await WalletService.getWalletByUserId(user._id.toString());

    // Send welcome message
    await sendWelcomeMessage(phoneNumber, user.firstName || 'User');

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          ...user.toJSON(),
          wallet: wallet ? (wallet.toJSON() as any) : null
        },
        token,
        refreshToken
      }
    } as IAuthResponse);

  } catch (error) {
    logger.error('Register with phone error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as IAuthResponse);
  }
};

// Login with phone number and password
export const loginWithPhone = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber, password } = req.body;

    // Find user with password
    const user = await User.findOne({ phoneNumber }).select('+password');
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid user'
      } as IAuthResponse);
      return;
    }

    if (!user.password) {
      res.status(401).json({
        success: false,
        message: 'Invalid password'
      } as IAuthResponse);
      return;
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid password'
      } as IAuthResponse);
      return;
    }

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toJSON(),
        token,
        refreshToken
      }
    } as IAuthResponse);

  } catch (error) {
    console.error('Login with phone error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as IAuthResponse);
  }
};

// Login with biometric authentication
export const loginWithBiometric = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      res.status(400).json({
        success: false,
        message: 'Phone number is required'
      } as IAuthResponse);
      return;
    }

    // Find user
    const user = await User.findOne({ phoneNumber });
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found'
      } as IAuthResponse);
      return;
    }

    // Check if biometric is enabled for this user
    if (!user.biometricEnabled) {
      res.status(403).json({
        success: false,
        message: 'Biometric authentication is not enabled for this account'
      } as IAuthResponse);
      return;
    }

    // Check if biometric is set up
    if (!user.isBiometricSetup) {
      res.status(403).json({
        success: false,
        message: 'Biometric authentication is not set up for this account'
      } as IAuthResponse);
      return;
    }

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(200).json({
      success: true,
      message: 'Biometric login successful',
      data: {
        user: user.toJSON(),
        token,
        refreshToken
      }
    } as IAuthResponse);

  } catch (error) {
    console.error('Biometric login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as IAuthResponse);
  }
};

// Exchange Google authorization code for ID token and authenticate
export const googleAuthCode = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('📥 POST /api/auth/google-code - Request received');
    console.log('Request body:', { 
      hasCode: !!req.body.code, 
      codeLength: req.body.code?.length,
      redirectUri: req.body.redirectUri 
    });

    const { code, redirectUri } = req.body;

    if (!code) {
      console.log('❌ Missing authorization code');
      res.status(400).json({
        success: false,
        message: 'Authorization code is required'
      } as IAuthResponse);
      return;
    }

    if (!redirectUri) {
      console.log('❌ Missing redirect URI');
      res.status(400).json({
        success: false,
        message: 'Redirect URI is required'
      } as IAuthResponse);
      return;
    }

    console.log('🔐 Exchanging Google authorization code...');
    console.log('Redirect URI:', redirectUri);

    // Exchange authorization code for tokens using google-auth-library
    const googleUser = await exchangeAuthCodeForTokens(code, redirectUri);

    console.log('✅ Successfully verified Google user:', googleUser.email);

    // Check if user exists
    let user = await User.findOne({ 
      $or: [
        { googleId: googleUser.id },
        { email: googleUser.email }
      ]
    });

    const isNewUser = !user;

    if (user) {
      // Update Google ID if not set
      if (!user.googleId) {
        user.googleId = googleUser.id;
        user.profilePicture = user.profilePicture || googleUser.picture;
        await user.save();
      }
    } else {
      // Create new user with Google info
      // Phone number is optional for Google-authenticated users
      // They can add it later during profile completion
      user = new User({
        googleId: googleUser.id,
        email: googleUser.email,
        firstName: googleUser.name?.split(' ')[0] || 'User',
        lastName: googleUser.name?.split(' ').slice(1).join(' ') || '',
        profilePicture: googleUser.picture,
        // phoneNumber is not set - optional for Google users
        isEmailVerified: true,
        isPhoneVerified: false,
        isProfileComplete: false
      });

      await user.save();
      console.log('✅ Created new user from Google account');
    }

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(200).json({
      success: true,
      message: isNewUser 
        ? 'Account created successfully with Google' 
        : 'Google authentication successful',
      data: {
        user: user.toJSON(),
        token,
        refreshToken,
        isNewUser
      }
    } as IAuthResponse);

  } catch (error: any) {
    console.error('Google auth code error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to authenticate with Google'
    } as IAuthResponse);
  }
};

// Google OAuth login/register with ID token
export const googleAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body;

    // Verify Google token
    const googleUser = await verifyGoogleToken(idToken);

    // Check if user exists
    let user = await User.findOne({ 
      $or: [
        { googleId: googleUser.id },
        { email: googleUser.email }
      ]
    });

    if (user) {
      // Update Google ID if not set
      if (!user.googleId) {
        user.googleId = googleUser.id;
        await user.save();
      }
    } else {
      // Create new user with Google info
      // Phone number is optional for Google-authenticated users
      // They can add it later during profile completion
      user = new User({
        googleId: googleUser.id,
        email: googleUser.email,
        firstName: googleUser.name?.split(' ')[0] || '',
        lastName: googleUser.name?.split(' ').slice(1).join(' ') || '',
        profilePicture: googleUser.picture,
        // phoneNumber is not set - optional for Google users
        isEmailVerified: true,
        isPhoneVerified: false,
        isProfileComplete: false // User needs to complete profile (including phone number)
      });

      await user.save();

      // Create Paystack virtual account (wallet) for new Google user
      try {
        const userEmail = user.email || `${user._id}@paygenius.temp`;
        await WalletService.createWallet(user._id.toString(), {
          email: userEmail,
          firstName: user.firstName || 'User',
          lastName: user.lastName || '',
          phone: user.phoneNumber,
        });
        logger.info('Wallet created for new Google user', { userId: user._id.toString() });
      } catch (walletError: any) {
        logger.error('Failed to create wallet for Google user', {
          error: walletError.message,
          userId: user._id.toString(),
        });
      }
    }

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Fetch wallet if it exists
    const wallet = await WalletService.getWalletByUserId(user._id.toString());

    res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      data: {
        user: {
          ...user.toJSON(),
          wallet: wallet ? (wallet.toJSON() as any) : null
        },
        token,
        refreshToken
      }
    } as IAuthResponse);

  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Invalid Google token'
    } as IAuthResponse);
  }
};

// Apple OAuth login/register
export const appleAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { identityToken, user: appleUser } = req.body;

    // For now, we'll create a basic implementation
    // In production, you should verify the Apple identity token
    const appleId = identityToken; // This should be extracted from the token

    // Check if user exists
    let user = await User.findOne({ 
      $or: [
        { appleId },
        { email: appleUser?.email }
      ]
    });

    if (user) {
      // Update Apple ID if not set
      if (!user.appleId) {
        user.appleId = appleId;
        await user.save();
      }
    } else {
      // Create new user
      user = new User({
        appleId,
        email: appleUser?.email,
        firstName: appleUser?.name?.split(' ')[0] || '',
        lastName: appleUser?.name?.split(' ').slice(1).join(' ') || '',
        isEmailVerified: true,
        isPhoneVerified: false
      });

      await user.save();

      // Create Paystack virtual account (wallet) for new Apple user
      try {
        const userEmail = user.email || `${user._id}@paygenius.temp`;
        await WalletService.createWallet(user._id.toString(), {
          email: userEmail,
          firstName: user.firstName || 'User',
          lastName: user.lastName || '',
          phone: user.phoneNumber,
        });
        logger.info('Wallet created for new Apple user', { userId: user._id.toString() });
      } catch (walletError: any) {
        logger.error('Failed to create wallet for Apple user', {
          error: walletError.message,
          userId: user._id.toString(),
        });
      }
    }

    // Generate tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    // Fetch wallet if it exists
    const wallet = await WalletService.getWalletByUserId(user._id.toString());

    res.status(200).json({
      success: true,
      message: 'Apple authentication successful',
      data: {
        user: {
          ...user.toJSON(),
          wallet: wallet ? (wallet.toJSON() as any) : null
        },
        token,
        refreshToken
      }
    } as IAuthResponse);

  } catch (error) {
    console.error('Apple auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Invalid Apple token'
    } as IAuthResponse);
  }
};

// Get current user
export const getCurrentUser = async (req: IAuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!._id;
    
    // Fetch user with wallet
    const user = await User.findById(userId).select('-password -transactionPin').lean();
    
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      } as IAuthResponse);
      return;
    }

    // Fetch wallet
    const { WalletService } = await import('../services/walletService');
    const wallet = await WalletService.getWalletByUserId(userId);

    res.status(200).json({
      success: true,
      message: 'User retrieved successfully',
      data: { 
        user: {
          ...user,
          wallet: wallet ? (wallet.toJSON() as any) : null
        }
      }
    } as IProfileResponse);

  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as IAuthResponse);
  }
};
