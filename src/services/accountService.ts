import Account from '../models/Account';
import { IAccount, IAccountDocument } from '../types';
import logger from '../lib/log/winston.log';

export class AccountService {
  /**
   * Get primary account for a user
   */
  static async getPrimaryAccount(userId: string): Promise<IAccountDocument | null> {
    try {
      const account = await Account.findOne({
        userId,
        isPrimary: true,
        isActive: true
      });

      return account;
    } catch (error) {
      logger.error('Error getting primary account:', error);
      throw error;
    }
  }

  /**
   * Get all accounts for a user
   */
  static async getUserAccounts(userId: string): Promise<IAccountDocument[]> {
    try {
      const accounts = await Account.find({
        userId,
        isActive: true
      }).sort({ isPrimary: -1, createdAt: -1 });

      return accounts;
    } catch (error) {
      logger.error('Error getting user accounts:', error);
      throw error;
    }
  }

  /**
   * Get account by ID
   */
  static async getAccountById(accountId: string, userId: string): Promise<IAccountDocument | null> {
    try {
      const account = await Account.findOne({
        _id: accountId,
        userId,
        isActive: true
      });

      return account;
    } catch (error) {
      logger.error('Error getting account by ID:', error);
      throw error;
    }
  }

  /**
   * Create a new account
   */
  static async createAccount(
    userId: string,
    accountData: {
      accountType: 'WALLET' | 'SAVINGS' | 'CURRENT';
      currency?: 'NGN' | 'USD';
      isPrimary?: boolean;
    }
  ): Promise<IAccountDocument> {
    try {
      // Generate unique account number
      const accountNumber = await this.generateAccountNumber();

      // If this is set as primary, unset other primary accounts
      if (accountData.isPrimary) {
        await Account.updateMany(
          { userId, isPrimary: true },
          { isPrimary: false }
        );
      }

      const account = new Account({
        userId,
        accountNumber,
        accountType: accountData.accountType,
        currency: accountData.currency || 'NGN',
        balance: 0,
        isPrimary: accountData.isPrimary || false,
        isActive: true
      });

      await account.save();
      return account;
    } catch (error) {
      logger.error('Error creating account:', error);
      throw error;
    }
  }

  /**
   * Generate unique account number
   */
  private static async generateAccountNumber(): Promise<string> {
    const prefix = 'UAE';
    let accountNumber: string;
    let exists = true;

    while (exists) {
      const randomNum = Math.floor(1000000000 + Math.random() * 9000000000);
      accountNumber = `${prefix}${randomNum}`;
      const account = await Account.findOne({ accountNumber });
      exists = !!account;
    }

    return accountNumber;
  }

  /**
   * Update account balance
   */
  static async updateBalance(
    accountId: string,
    amount: number,
    operation: 'ADD' | 'SUBTRACT'
  ): Promise<IAccountDocument | null> {
    try {
      const account = await Account.findById(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      if (operation === 'ADD') {
        account.balance += amount;
      } else {
        if (account.balance < amount) {
          throw new Error('Insufficient balance');
        }
        account.balance -= amount;
      }

      await account.save();
      return account;
    } catch (error) {
      logger.error('Error updating account balance:', error);
      throw error;
    }
  }
}

