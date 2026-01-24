import { Request, Response } from 'express';
import paystackService from '../services/paystackService';
import { WalletService } from '../services/walletService';
import logger from '../lib/log/winston.log';

/**
 * Paystack webhook handler
 * Handles events from Paystack, especially dedicated_account.credit
 */
export const handlePaystackWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get the signature from headers
    const signature = req.headers['x-paystack-signature'] as string;

    if (!signature) {
      logger.warn('Paystack webhook received without signature');
      res.status(400).json({ success: false, message: 'Missing signature' });
      return;
    }

    // Get raw body from request (stored by route handler)
    // Paystack docs: signature is HMAC SHA512 of JSON.stringify(req.body)
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    // Verify webhook signature
    const isValid = paystackService.verifyWebhookSignature(signature, rawBody);

    if (!isValid) {
      logger.warn('Invalid Paystack webhook signature', {
        receivedSignature: signature.substring(0, 20) + '...',
      });
      res.status(400).json({ success: false, message: 'Invalid signature' });
      return;
    }

    // Event is already parsed by route handler
    const event = req.body;

    logger.info('Paystack webhook received', {
      event: event.event,
      data: event.data,
    });

    // Handle different event types
    switch (event.event) {
      case 'charge.success':
        // Handle successful charge - check if it's a dedicated virtual account payment
        await handleChargeSuccess(event.data);
        break;

      case 'dedicatedaccount.assign.success':
        // Handle successful DVA assignment
        await handleDedicatedAccountAssignSuccess(event.data);
        break;

      case 'dedicatedaccount.assign.failed':
        // Handle failed DVA assignment
        logger.error('Dedicated account assignment failed', { data: event.data });
        break;

      case 'transfer.success':
        // Handle successful transfer (outgoing)
        logger.info('Transfer successful', { reference: event.data.reference });
        break;

      case 'transfer.failed':
        // Handle failed transfer
        logger.error('Transfer failed', { data: event.data });
        break;

      default:
        logger.info('Unhandled Paystack event', { event: event.event });
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ success: true, message: 'Webhook processed' });
  } catch (error: any) {
    logger.error('Error processing Paystack webhook:', {
      error: error.message,
      stack: error.stack,
    });
    // Still return 200 to prevent Paystack from retrying
    res.status(200).json({ success: false, message: 'Webhook processing error' });
  }
};

/**
 * Handle charge.success event
 * According to Paystack docs, bank transfers to DVAs trigger charge.success
 * with authorization.channel === 'dedicated_nuban'
 */
async function handleChargeSuccess(data: any): Promise<void> {
  try {
    // Check if this is a dedicated virtual account payment
    const authorization = data.authorization;
    
    if (!authorization || authorization.channel !== 'dedicated_nuban') {
      // Not a DVA payment, skip
      return;
    }

    const accountNumber = authorization.receiver_bank_account_number;
    const amount = data.amount; // Amount in kobo

    if (!accountNumber || !amount) {
      logger.error('Invalid charge.success data for DVA', { data });
      return;
    }

    logger.info('Processing DVA payment via charge.success', {
      accountNumber,
      amount,
      reference: data.reference,
    });

    // Credit the wallet
    const wallet = await WalletService.creditWallet(accountNumber, amount);

    if (!wallet) {
      logger.error('Wallet not found for account credit', { accountNumber });
      return;
    }

    logger.info('Wallet credited successfully via charge.success webhook', {
      accountNumber,
      amount: amount / 100,
      newBalance: wallet.totalBalance,
      reference: data.reference,
    });
  } catch (error: any) {
    logger.error('Error handling charge.success:', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Handle dedicatedaccount.assign.success event
 * This is triggered when a DVA is successfully created and assigned
 * Update the wallet with the actual account details
 */
async function handleDedicatedAccountAssignSuccess(data: any): Promise<void> {
  try {
    const dedicatedAccount = data.dedicated_account;
    const customer = data.customer;

    if (!dedicatedAccount || !customer) {
      logger.error('Invalid dedicatedaccount.assign.success data', { data });
      return;
    }

    logger.info('Dedicated account assigned successfully', {
      accountNumber: dedicatedAccount.account_number,
      accountName: dedicatedAccount.account_name,
      customerEmail: customer.email,
      customerId: customer.id,
    });

    // Find wallet by customer email (since we don't have account number yet)
    // We'll search by userId via User model
    const User = (await import('../models/User')).default;
    const Wallet = (await import('../models/Wallet')).default;
    
    const user = await User.findOne({ email: customer.email });
    if (!user) {
      logger.warn('User not found for assigned account', {
        customerEmail: customer.email,
      });
      return;
    }

    // Update wallet with actual account details
    const wallet = await Wallet.findOne({ userId: user._id });
    if (wallet) {
      wallet.virtualAccountNumber = dedicatedAccount.account_number;
      wallet.bankName = dedicatedAccount.bank.name;
      wallet.accountName = dedicatedAccount.account_name;
      wallet.paystackCustomerId = customer.id.toString();
      wallet.paystackDedicatedAccountId = dedicatedAccount.id.toString();
      wallet.isActive = true;
      await wallet.save();

      logger.info('Wallet updated with dedicated account details', {
        userId: user._id.toString(),
        accountNumber: dedicatedAccount.account_number,
      });
    } else {
      logger.warn('Wallet not found for user - creating new wallet', {
        userId: user._id.toString(),
        customerEmail: customer.email,
      });

      // Create wallet if it doesn't exist
      const { WalletService } = await import('../services/walletService');
      await WalletService.createWalletFromWebhook(
        user._id.toString(),
        {
          accountNumber: dedicatedAccount.account_number,
          bankName: dedicatedAccount.bank.name,
          accountName: dedicatedAccount.account_name,
          paystackCustomerId: customer.id.toString(),
          paystackDedicatedAccountId: dedicatedAccount.id.toString(),
        }
      );
    }
  } catch (error: any) {
    logger.error('Error handling dedicatedaccount.assign.success:', {
      error: error.message,
      stack: error.stack,
    });
    // Don't throw - this is just for logging/confirmation
  }
}
