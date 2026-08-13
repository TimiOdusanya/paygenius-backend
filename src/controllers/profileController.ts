import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { IAuthRequest, IProfileResponse, IProfileSetupData, IAddressData, IIdentityVerificationData, ISelfieData, ITransactionPinData } from '../types';
import { identityVerificationService } from '../services/identityVerificationService';
import { biometricService } from '../services/biometricService';

// Setup user profile
export const setupProfile = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const profileData: IProfileSetupData = req.body;

    // Check if username is already taken
    if (profileData.username) {
      const existingUser = await User.findOne({ 
        username: profileData.username,
        _id: { $ne: userId }
      });
      
      if (existingUser) {
        res.status(400).json({
          success: false,
          message: 'Username already taken'
        } as IProfileResponse);
        return;
      }
    }

    // Update user profile
    const user = await User.findByIdAndUpdate(
      userId,
      {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        username: profileData.username,
        dateOfBirth: new Date(profileData.dateOfBirth),
        profilePicture: profileData.profilePicture,
        isProfileComplete: true
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      } as IProfileResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Profile setup completed successfully',
      data: { user: user.toJSON() }
    } as IProfileResponse);

  } catch (error) {
    console.error('Setup profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as IProfileResponse);
  }
};

// Verify address
export const verifyAddress = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const addressData: IAddressData = req.body;

    // Update user address
    const user = await User.findByIdAndUpdate(
      userId,
      {
        address: {
          houseNumber: addressData.houseNumber,
          streetName: addressData.streetName,
          city: addressData.city,
          state: addressData.state,
          localGovernmentArea: addressData.localGovernmentArea
        },
        isAddressVerified: true
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      } as IProfileResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Address verified successfully',
      data: { user: user.toJSON() }
    } as IProfileResponse);

  } catch (error) {
    console.error('Verify address error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as IProfileResponse);
  }
};

// Verify identity (BVN/NIN)
export const verifyIdentity = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const identityData: IIdentityVerificationData = req.body;


    let verificationResult;

    if (identityData.type === 'BVN') {
      if (!identityData.phoneNumber) {
        res.status(400).json({
          success: false,
          message: 'Phone number is required for BVN verification'
        } as IProfileResponse);
        return;
      }

      verificationResult = await identityVerificationService.verifyBVN({
        bvn: identityData.number,
        phoneNumber: identityData.phoneNumber,
      });
    } else {
      // For NIN, we now use VNIN (Virtual NIN) verification
      // VNIN is a 16-character alphanumeric code (e.g., AB012345678910YZ)
      verificationResult = await identityVerificationService.verifyVNIN({
        vnin: identityData.number,
      });
    }

    if (!verificationResult.verified) {
      res.status(400).json({
        success: false,
        message: verificationResult.message || 'Identity verification failed'
      } as IProfileResponse);
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        identityVerification: {
          type: identityData.type,
          number: identityData.number,
          verified: true,
          verifiedAt: new Date()
        },
        isIdentityVerified: true,
        ...(verificationResult.data && {
          firstName: verificationResult.data.firstName || req.user!.firstName,
          lastName: verificationResult.data.lastName || req.user!.lastName,
        })
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      } as IProfileResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Identity verified successfully',
      data: { user: user.toJSON() }
    } as IProfileResponse);

  } catch (error) {
    console.error('Verify identity error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as IProfileResponse);
  }
};

// Upload selfie images
export const uploadSelfie = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const selfieData: ISelfieData = req.body;
    if (!selfieData.selfieImages || !selfieData.selfieImages.length) {
      res.status(400).json({
        success: false,
        message: 'Selfie image is required'
      } as IProfileResponse);
      return;
    }

    const rawImage = selfieData.selfieImages[0];
    const base64 =
      typeof rawImage === 'string' && rawImage.startsWith('data:')
        ? rawImage.split(',')[1]
        : rawImage;

    const liveness = await biometricService.checkLiveness(base64);

    if (!liveness.success) {
      res.status(400).json({
        success: false,
        message: liveness.message || 'Face liveness check failed'
      } as IProfileResponse);
      return;
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        selfieImages: selfieData.selfieImages,
        isBiometricSetup: true
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      } as IProfileResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: `Face verified successfully${typeof liveness.livenessProbability === 'number' ? `` : ''}`,
      data: { user: user.toJSON() }
    } as IProfileResponse);

  } catch (error) {
    console.error('Upload selfie error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as IProfileResponse);
  }
};

// Setup transaction PIN
export const setupTransactionPin = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const pinData: ITransactionPinData = req.body;

    // Update user transaction PIN
    const user = await User.findByIdAndUpdate(
      userId,
      {
        transactionPin: pinData.pin,
        isBiometricSetup: true
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      } as IProfileResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Transaction PIN setup completed successfully',
      data: { user: user.toJSON() }
    } as IProfileResponse);

  } catch (error) {
    console.error('Setup transaction PIN error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as IProfileResponse);
  }
};

// Enable biometric authentication
export const enableBiometric = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;

    // Update user biometric settings
    const user = await User.findByIdAndUpdate(
      userId,
      {
        biometricEnabled: true
      },
      { new: true, runValidators: true }
    );

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      } as IProfileResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Biometric authentication enabled successfully',
      data: { user: user.toJSON() }
    } as IProfileResponse);

  } catch (error) {
    console.error('Enable biometric error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as IProfileResponse);
  }
};

// Get user profile
export const updateProfile = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const { username, profilePicture } = req.body as {
      username?: string;
      profilePicture?: string;
    };

    const updates: Record<string, string> = {};

    if (typeof username === 'string') {
      const normalized = username.trim().replace(/^@/, '');
      if (normalized.length < 3 || normalized.length > 30) {
        res.status(400).json({
          success: false,
          message: 'Username must be between 3 and 30 characters',
        } as IProfileResponse);
        return;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(normalized)) {
        res.status(400).json({
          success: false,
          message: 'Username can only contain letters, numbers, and underscores',
        } as IProfileResponse);
        return;
      }
      const existingUser = await User.findOne({
        username: normalized,
        _id: { $ne: userId },
      });
      if (existingUser) {
        res.status(400).json({
          success: false,
          message: 'Username already taken',
        } as IProfileResponse);
        return;
      }
      updates.username = normalized;
    }

    if (typeof profilePicture === 'string' && profilePicture.trim()) {
      updates.profilePicture = profilePicture.trim();
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        message: 'No profile fields to update',
      } as IProfileResponse);
      return;
    }

    const user = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      } as IProfileResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user: user.toJSON() },
    } as IProfileResponse);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    } as IProfileResponse);
  }
};

export const getUserProfile = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      } as IProfileResponse);
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Profile retrieved successfully',
      data: { user }
    } as IProfileResponse);

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    } as IProfileResponse);
  }
};
// Check if a username is available
export const checkUsername = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id;
    const raw = String(req.query.username ?? '').trim().replace(/^@/, '');

    if (!raw) {
      res.status(400).json({
        success: false,
        message: 'Username is required',
      });
      return;
    }

    if (raw.length < 3 || raw.length > 30 || !/^[a-zA-Z0-9_]+$/.test(raw)) {
      res.status(200).json({
        success: true,
        message: 'Invalid username format',
        data: {
          username: raw,
          available: false,
          reason: 'invalid',
        },
      });
      return;
    }

    const existingUser = await User.findOne({
      username: raw,
      _id: { $ne: userId },
    }).select('_id');

    const available = !existingUser;

    res.status(200).json({
      success: true,
      message: available ? 'Username is available' : 'Username already taken',
      data: {
        username: raw,
        available,
        reason: available ? 'available' : 'taken',
      },
    });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
