import Wallet from '../models/Wallet';
import { IWallet, IWalletDocument } from '../types';
import paystackService from './paystackService';
import logger from '../lib/log/winston.log';

export class WalletService {
  /**
   * Create a wallet with Paystack virtual account for a new user
   * @param userId - User ID
   * @param userData - User information for Paystack
   * @returns Created wallet
   */
  static async createWallet(
    userId: string,
    userData: {
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    }
  ): Promise<IWalletDocument> {
    try {
      // Check if wallet already exists
      const existingWallet = await Wallet.findOne({ userId });
      if (existingWallet) {
        logger.warn('Wallet already exists for user', { userId });
        return existingWallet as IWalletDocument;
      }

      // Step 1: Create customer in Paystack
      const paystackCustomer = await paystackService.createCustomer({
        email: userData.email,
        firstName: userData.firstName || 'User',
        lastName: userData.lastName || '',
        phone: userData.phone,
      });

      // Step 2: Create dedicated virtual account for the customer
      const paystackData = await paystackService.createDedicatedAccount(
        paystackCustomer.id,
        {
          firstName: userData.firstName || 'User',
          lastName: userData.lastName || '',
          phone: userData.phone,
        }
      );

      // Create wallet with actual account details
      const wallet = new Wallet({
        userId,
        totalBalance: 0,
        availableBalance: 0,
        virtualAccountNumber: paystackData.dedicated_account.account_number,
        bankName: paystackData.dedicated_account.bank.name,
        accountName: paystackData.dedicated_account.account_name,
        paystackCustomerId: paystackData.customer.id.toString(),
        paystackDedicatedAccountId: paystackData.dedicated_account.id.toString(),
        isActive: true,
      });

      await wallet.save();

      logger.info('Wallet created successfully', {
        userId,
        accountNumber: wallet.virtualAccountNumber,
      });

      return wallet as IWalletDocument;
    } catch (error: any) {
      logger.error('Error creating wallet:', {
        error: error.message,
        userId,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get wallet by user ID
   * @param userId - User ID
   * @returns Wallet or null
   */
  static async getWalletByUserId(userId: string): Promise<IWalletDocument | null> {
    try {
      const wallet = await Wallet.findOne({ userId, isActive: true });
      return wallet as IWalletDocument | null;
    } catch (error) {
      logger.error('Error getting wallet by user ID:', error);
      throw error;
    }
  }

  /**
   * Get wallet by virtual account number
   * @param accountNumber - Virtual account number
   * @returns Wallet or null
   */
  static async getWalletByAccountNumber(
    accountNumber: string
  ): Promise<IWalletDocument | null> {
    try {
      const wallet = await Wallet.findOne({
        virtualAccountNumber: accountNumber,
        isActive: true,
      });
      return wallet as IWalletDocument | null;
    } catch (error) {
      logger.error('Error getting wallet by account number:', error);
      throw error;
    }
  }

  /**
   * Credit wallet (when money is received via Paystack)
   * @param accountNumber - Virtual account number
   * @param amount - Amount to credit (in kobo, will be converted to Naira)
   * @returns Updated wallet
   */
  static async creditWallet(
    accountNumber: string,
    amount: number
  ): Promise<IWalletDocument | null> {
    try {
      // Paystack sends amount in kobo, convert to Naira
      const amountInNaira = amount / 100;

      const wallet = await Wallet.findOne({
        virtualAccountNumber: accountNumber,
        isActive: true,
      });

      if (!wallet) {
        logger.error('Wallet not found for account number', { accountNumber });
        return null;
      }

      wallet.totalBalance += amountInNaira;
      wallet.availableBalance += amountInNaira;

      await wallet.save();

      logger.info('Wallet credited successfully', {
        accountNumber,
        amount: amountInNaira,
        newBalance: wallet.totalBalance,
      });

      return wallet as IWalletDocument;
    } catch (error) {
      logger.error('Error crediting wallet:', error);
      throw error;
    }
  }

  /**
   * Update wallet balances (for budget allocations, etc.)
   * @param userId - User ID
   * @param updates - Balance updates
   * @returns Updated wallet
   */
  static async updateWalletBalances(
    userId: string,
    updates: {
      totalBalance?: number;
      availableBalance?: number;
    }
  ): Promise<IWalletDocument | null> {
    try {
      const wallet = await Wallet.findOne({ userId, isActive: true });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      if (updates.totalBalance !== undefined) {
        wallet.totalBalance = updates.totalBalance;
      }

      if (updates.availableBalance !== undefined) {
        if (updates.availableBalance > wallet.totalBalance) {
          throw new Error('Available balance cannot exceed total balance');
        }
        wallet.availableBalance = updates.availableBalance;
      }

      await wallet.save();

      return wallet as IWalletDocument;
    } catch (error) {
      logger.error('Error updating wallet balances:', error);
      throw error;
    }
  }

  /**
   * Create wallet from webhook data (when DVA assignment is confirmed)
   * @param userId - User ID
   * @param accountData - Account details from Paystack webhook
   * @returns Created wallet
   */
  static async createWalletFromWebhook(
    userId: string,
    accountData: {
      accountNumber: string;
      bankName: string;
      accountName: string;
      paystackCustomerId: string;
      paystackDedicatedAccountId: string;
    }
  ): Promise<IWalletDocument> {
    try {
      // Check if wallet already exists
      const existingWallet = await Wallet.findOne({ userId });
      if (existingWallet) {
        // Update existing wallet
        existingWallet.virtualAccountNumber = accountData.accountNumber;
        existingWallet.bankName = accountData.bankName;
        existingWallet.accountName = accountData.accountName;
        existingWallet.paystackCustomerId = accountData.paystackCustomerId;
        existingWallet.paystackDedicatedAccountId = accountData.paystackDedicatedAccountId;
        existingWallet.isActive = true;
        await existingWallet.save();
        return existingWallet as IWalletDocument;
      }

      // Create new wallet
      const wallet = new Wallet({
        userId,
        totalBalance: 0,
        availableBalance: 0,
        virtualAccountNumber: accountData.accountNumber,
        bankName: accountData.bankName,
        accountName: accountData.accountName,
        paystackCustomerId: accountData.paystackCustomerId,
        paystackDedicatedAccountId: accountData.paystackDedicatedAccountId,
        isActive: true,
      });

      await wallet.save();

      logger.info('Wallet created from webhook', {
        userId,
        accountNumber: wallet.virtualAccountNumber,
      });

      return wallet as IWalletDocument;
    } catch (error: any) {
      logger.error('Error creating wallet from webhook:', {
        error: error.message,
        userId,
        stack: error.stack,
      });
      throw error;
    }
  }
}
