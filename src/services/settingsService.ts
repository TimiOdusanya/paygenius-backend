import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User';

const DEFAULT_SPEND_LIMIT = 500000;
const DEFAULT_TRANSFER_LIMIT = 200000;
const REFERRAL_REWARD = 5000;
const REFERRAL_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function generateReferralCode() {
  const length = 8 + Math.floor(Math.random() * 3);
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => REFERRAL_ALPHABET[byte % REFERRAL_ALPHABET.length]).join('');
}

async function ensureReferralCode(user: { referralCode?: string; save: () => Promise<unknown> }) {
  if (user.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateReferralCode();
    const taken = await User.exists({ referralCode: code });
    if (taken) continue;
    user.referralCode = code;
    await user.save();
    return code;
  }

  throw Object.assign(new Error('Could not generate a referral code'), { status: 500 });
}

function serviceError(message: string, status: number) {
  return Object.assign(new Error(message), { status });
}

export class SettingsService {
  static async getSettings(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw serviceError('User not found', 404);

    const referralCode = await ensureReferralCode(user);
    return {
      dailySpendLimit: user.dailySpendLimit ?? DEFAULT_SPEND_LIMIT,
      dailyTransferLimit: user.dailyTransferLimit ?? DEFAULT_TRANSFER_LIMIT,
      faceIdEnabled: Boolean(user.faceIdEnabled),
      biometricEnabled: Boolean(user.biometricEnabled),
      setTransactionPin: Boolean(user.setTransactionPin),
      referralCode,
    };
  }

  static async updateSettings(
    userId: string,
    updates: {
      dailySpendLimit?: number;
      dailyTransferLimit?: number;
      faceIdEnabled?: boolean;
    }
  ) {
    const user = await User.findById(userId);
    if (!user) throw serviceError('User not found', 404);

    if (updates.dailySpendLimit !== undefined) {
      const value = Number(updates.dailySpendLimit);
      if (!Number.isFinite(value) || value < 0) {
        throw serviceError('Daily spend limit must be a positive number', 400);
      }
      user.dailySpendLimit = value;
    }
    if (updates.dailyTransferLimit !== undefined) {
      const value = Number(updates.dailyTransferLimit);
      if (!Number.isFinite(value) || value < 0) {
        throw serviceError('Daily transfer limit must be a positive number', 400);
      }
      user.dailyTransferLimit = value;
    }
    if (typeof updates.faceIdEnabled === 'boolean') {
      user.faceIdEnabled = updates.faceIdEnabled;
    }

    await user.save();
    return this.getSettings(userId);
  }

  static async changePassword(userId: string, current: string, next: string) {
    if (!current || !next) {
      throw serviceError('Current and new password are required', 400);
    }
    if (next.length < 8) {
      throw serviceError('New password must be at least 8 characters', 400);
    }

    const user = await User.findById(userId).select('+password');
    if (!user) throw serviceError('User not found', 404);
    if (!user.password) {
      throw serviceError('This account does not have a password set', 400);
    }

    const matches = await user.comparePassword(current);
    if (!matches) {
      throw serviceError('Current password is incorrect', 401);
    }

    user.password = next;
    await user.save();
    return { changed: true };
  }

  static async changePin(userId: string, currentPin: string, newPin: string) {
    if (!/^\d{4}$/.test(newPin)) {
      throw serviceError('New PIN must be a 4-digit number', 400);
    }

    const user = await User.findById(userId).select('+transactionPin');
    if (!user) throw serviceError('User not found', 404);

    if (!user.transactionPin) {
      user.transactionPin = newPin;
      await user.save();
      return { changed: true, created: true };
    }

    if (!currentPin) {
      throw serviceError('Current PIN is required', 400);
    }

    const matches = await bcrypt.compare(currentPin, user.transactionPin);
    if (!matches) {
      throw serviceError('Current PIN is incorrect', 401);
    }

    user.transactionPin = newPin;
    await user.save();
    return { changed: true };
  }

  static async setBiometric(userId: string, enabled: boolean) {
    if (typeof enabled !== 'boolean') {
      throw serviceError('enabled must be a boolean', 400);
    }
    const user = await User.findById(userId);
    if (!user) throw serviceError('User not found', 404);
    user.biometricEnabled = enabled;
    if (enabled) {
      user.isBiometricSetup = true;
    }
    await user.save();
    return { biometricEnabled: user.biometricEnabled };
  }

  static async deactivateAccount(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw serviceError('User not found', 404);
    if (user.deletedAt) {
      throw serviceError('Account has already been deleted', 400);
    }
    if (user.deactivatedAt) {
      throw serviceError('Account is already deactivated', 400);
    }
    user.deactivatedAt = new Date();
    await user.save({ validateBeforeSave: false });
    return { deactivated: true };
  }

  static async deleteAccount(userId: string, password?: string) {
    const user = await User.findById(userId).select('+password');
    if (!user) throw serviceError('User not found', 404);
    if (user.deletedAt) {
      throw serviceError('Account has already been deleted', 400);
    }

    if (user.password) {
      if (!password) {
        throw serviceError('Password is required to delete this account', 400);
      }
      const matches = await user.comparePassword(password);
      if (!matches) {
        throw serviceError('Password is incorrect', 401);
      }
    }

    const suffix = `deleted_${user._id}_${Date.now()}`;
    if (user.phoneNumber) {
      user.phoneNumber = `${suffix}_${user.phoneNumber}`;
    }
    if (user.email) {
      user.email = `${suffix}_${user.email}`;
    }
    user.isPhoneVerified = false;
    user.deletedAt = new Date();
    await user.save({ validateBeforeSave: false });
    return { deleted: true };
  }

  static async getReferral(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw serviceError('User not found', 404);

    const code = await ensureReferralCode(user);
    return {
      code,
      rewardAmount: REFERRAL_REWARD,
      shareMessage: `Join PayGenius with my code ${code} and we both get ₦${REFERRAL_REWARD.toLocaleString('en-NG')} when you complete signup and verification.`,
    };
  }
}
