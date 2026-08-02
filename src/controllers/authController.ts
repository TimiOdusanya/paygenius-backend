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

/**
 * Normalise a phone-number string to E.164 format (+XXXXXXXXXXX).
 * Handles common Nigerian entry patterns so users never have to think
 * about country codes:
 *   08146414524  →  +2348146414524  (11-digit local with leading 0)
 *   8146414524   →  +2348146414524  (10-digit local, no leading 0)
 *   +2348146414524 → +2348146414524 (already normalised)
 *   2348146414524  → +2348146414524 (international without +)
 */
function normalisePhone(raw: string): string {
  // Strip spaces, dashes, parentheses
  let digits = raw.replace(/[\s\-()\+]/g, '');

  // Nigerian local format: 11 digits starting with 0  →  +234XXXXXXXXXX
  if (/^0\d{10}$/.test(digits)) return `+234${digits.slice(1)}`;

  // 10 digits (no leading 0, no country code) → assume Nigeria
  if (/^\d{10}$/.test(digits)) return `+234${digits}`;

  // 13 digits starting with 234 (no +) → add +
  if (/^234\d{10}$/.test(digits)) return `+${digits}`;

  // Anything else: add + if it's purely numeric
  if (/^\d{7,15}$/.test(digits)) return `+${digits}`;

  return raw; // Not a phone – return as-is (email / username caller handles this)
}

// Login with phone number / email / username + password
export const loginWithPhone = async (req: Request, res: Response): Promise<void> => {
  try {
    // Accept either `identifier` (new) or `phoneNumber` (legacy) for backward compat
    const raw: string = ((req.body.identifier ?? req.body.phoneNumber) as string | undefined ?? '').trim();
    const { password } = req.body;

    if (!raw) {
      res.status(400).json({ success: false, message: 'Phone number, email, or username is required' } as IAuthResponse);
      return;
    }

    // Detect type and find user accordingly
    let user = null;
    if (raw.includes('@')) {
      // Email
      user = await User.findOne({ email: raw }).select('+password');
    } else if (/^[\+\d][\d\s\-()]{6,}$/.test(raw) || /^0\d{9,}$/.test(raw)) {
      // Looks like a phone – normalise to E.164 then search.
      // Also try the raw value so edge-cases stored in non-standard form still match.
      const normalised = normalisePhone(raw);
      user = await User.findOne({
        $or: [{ phoneNumber: normalised }, { phoneNumber: raw }],
      }).select('+password');
    } else {
      // Username
      user = await User.findOne({ username: raw }).select('+password');
    }

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'No account found with that phone number, email, or username',
      } as IAuthResponse);
      return;
    }

    if (!user.password) {
      res.status(401).json({
        success: false,
        message: 'This account uses social login (Google/Apple). Please sign in with the original method.',
      } as IAuthResponse);
      return;
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Incorrect password. Please try again.',
      } as IAuthResponse);
      return;
    }

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: { user: user.toJSON(), token, refreshToken },
    } as IAuthResponse);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' } as IAuthResponse);
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
    // Frontend sends { identityToken, fullName } where fullName is a string like "John Doe"
    const { identityToken, fullName } = req.body;

    if (!identityToken) {
      res.status(400).json({ success: false, message: 'Identity token is required' } as IAuthResponse);
      return;
    }

    // Decode JWT payload to extract stable Apple user ID (sub) and email
    // Note: in production you should also verify the token signature against Apple's public keys
    let appleId: string;
    let appleEmail: string | undefined;
    try {
      const payloadB64 = identityToken.split('.')[1];
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
      appleId = payload.sub as string; // stable per-app user ID
      appleEmail = payload.email as string | undefined;
    } catch {
      // Fallback: use a hash of the token as the identifier (avoids storing the full JWT)
      const crypto = await import('crypto');
      appleId = crypto.createHash('sha256').update(identityToken).digest('hex');
    }

    // Parse full name (Apple only provides it on first sign-in)
    const nameParts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts[0] ?? '';
    const lastName = nameParts.slice(1).join(' ');

    let user = await User.findOne({
      $or: [
        { appleId },
        ...(appleEmail ? [{ email: appleEmail }] : []),
      ],
    });

    const isNewUser = !user;

    if (user) {
      // Link Apple ID if this is an email match with a pre-existing account
      if (!user.appleId) {
        user.appleId = appleId;
        await user.save();
      }
    } else {
      user = new User({
        appleId,
        email: appleEmail,
        firstName,
        lastName,
        isEmailVerified: !!appleEmail,
        isPhoneVerified: false,
        isProfileComplete: false,
      });

      await user.save();

      // Create wallet for new Apple user
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

    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);
    const wallet = await WalletService.getWalletByUserId(user._id.toString());

    res.status(200).json({
      success: true,
      message: isNewUser ? 'Account created successfully with Apple' : 'Apple authentication successful',
      data: {
        user: { ...user.toJSON(), wallet: wallet ? (wallet.toJSON() as any) : null },
        token,
        refreshToken,
        isNewUser,
      },
    } as IAuthResponse);

  } catch (error) {
    console.error('Apple auth error:', error);
    res.status(500).json({ success: false, message: 'Apple authentication failed' } as IAuthResponse);
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
