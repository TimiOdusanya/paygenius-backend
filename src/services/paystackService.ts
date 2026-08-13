import axios from 'axios';
import logger from '../lib/log/winston.log';

interface PaystackConfig {
  secretKey: string;
  publicKey: string;
  baseUrl: string;
}

interface CreateDedicatedAccountRequest {
  customer: {
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
  };
  preferred_bank?: string;
  currency?: string;
}

interface PaystackDedicatedAccountResponse {
  status: boolean;
  message: string;
  data: {
    customer: {
      id: number;
      first_name: string;
      last_name: string;
      email: string;
      phone: string | null;
    };
    dedicated_account: {
      bank: {
        name: string;
        slug: string;
        id: number;
      };
      account_name: string;
      account_number: string;
      assigned: boolean;
      currency: string;
      active: boolean;
      id: number;
      created_at: string;
      updated_at: string;
      assignment: {
        integration: number;
        assignee_id: number;
        assignee_type: string;
        expired: boolean;
        account_type: string;
        assigned_at: string;
        expired_at: string | null;
      };
    };
  };
}

interface PaystackErrorResponse {
  status: boolean;
  message: string;
}

class PaystackService {
  private config: PaystackConfig;

  constructor() {
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    const publicKey = process.env.PAYSTACK_PUBLIC_KEY;

    if (!secretKey) {
      throw new Error('PAYSTACK_SECRET_KEY is required');
    }

    if (!publicKey) {
      throw new Error('PAYSTACK_PUBLIC_KEY is required');
    }

    this.config = {
      secretKey,
      publicKey,
      baseUrl: process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co',
    };
  }

  /**
   * Create a customer in Paystack
   * @param customerData - Customer information
   * @returns Customer details with customer ID
   */
  async createCustomer(
    customerData: {
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
    }
  ): Promise<{ id: number; customer_code: string; email: string }> {
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/customer`,
        {
          email: customerData.email,
          first_name: customerData.firstName || 'User',
          last_name: customerData.lastName || '',
          ...(customerData.phone && { phone: customerData.phone }),
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data.status) {
        throw new Error(response.data.message || 'Failed to create customer');
      }

      return response.data.data;
    } catch (error: any) {
      logger.error('Error creating customer:', {
        error: error.message,
        response: error.response?.data,
      });

      if (error.response?.data) {
        const paystackError = error.response.data as PaystackErrorResponse;
        throw new Error(paystackError.message || 'Failed to create customer');
      }

      throw new Error('Failed to create customer. Please try again.');
    }
  }

  /**
   * Create a dedicated virtual account (NUBAN) for an existing customer
   * Uses multi-step approach: customer must exist first
   * @param customerId - Paystack customer ID or code
   * @param customerData - Customer information (for updating if needed)
   * @returns Dedicated account details
   */
  async createDedicatedAccount(
    customerId: string | number,
    customerData?: {
      firstName?: string;
      lastName?: string;
      phone?: string;
    }
  ): Promise<PaystackDedicatedAccountResponse['data']> {
    try {
      const requestData: any = {
        customer: customerId,
        preferred_bank: process.env.PAYSTACK_PREFERRED_BANK || 'test-bank', // Use test-bank for testing
      };

      // Optionally update customer details if provided
      if (customerData) {
        if (customerData.firstName) requestData.first_name = customerData.firstName;
        if (customerData.lastName) requestData.last_name = customerData.lastName;
        if (customerData.phone) requestData.phone = customerData.phone;
      }

      const response = await axios.post<PaystackDedicatedAccountResponse>(
        `${this.config.baseUrl}/dedicated_account`,
        requestData,
        {
          headers: {
            Authorization: `Bearer ${this.config.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data.status) {
        throw new Error(response.data.message || 'Failed to create dedicated account');
      }

      logger.info('Dedicated account created successfully', {
        accountNumber: response.data.data.dedicated_account.account_number,
        accountName: response.data.data.dedicated_account.account_name,
        customerId: customerId,
      });

      return response.data.data;
    } catch (error: any) {
      logger.error('Error creating dedicated account:', {
        error: error.message,
        response: error.response?.data,
        customerId: customerId,
      });

      if (error.response?.data) {
        const paystackError = error.response.data as PaystackErrorResponse;
        throw new Error(paystackError.message || 'Failed to create dedicated account');
      }

      throw new Error('Failed to create dedicated account. Please try again.');
    }
  }

  /**
   * Verify webhook signature
   * According to Paystack docs: HMAC SHA512 of JSON.stringify(req.body) signed with secret key
   * @param signature - X-Paystack-Signature header
   * @param body - Raw request body (string)
   * @returns boolean indicating if signature is valid
   */
  verifyWebhookSignature(signature: string, body: string): boolean {
    const crypto = require('crypto');
    // Paystack docs: hash = HMAC SHA512 of JSON.stringify(req.body)
    const hash = crypto
      .createHmac('sha512', this.config.secretKey)
      .update(body)
      .digest('hex');

    return hash === signature;
  }

  /**
   * Get account details by account number
   * @param accountNumber - The virtual account number
   * @returns Account details
   */
  async listBanks(country = 'nigeria'): Promise<
    Array<{ name: string; code: string; slug: string; active: boolean }>
  > {
    try {
      const response = await axios.get(`${this.config.baseUrl}/bank`, {
        params: { country, perPage: 100 },
        headers: {
          Authorization: `Bearer ${this.config.secretKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.data.status) {
        throw new Error(response.data.message || 'Failed to list banks');
      }
      return (response.data.data ?? [])
        .filter((bank: any) => bank.active && !bank.is_deleted)
        .map((bank: any) => ({
          name: bank.name,
          code: bank.code,
          slug: bank.slug,
          active: Boolean(bank.active),
        }));
    } catch (error: any) {
      logger.error('Error listing banks:', { error: error.message, response: error.response?.data });
      throw new Error(error.response?.data?.message || 'Failed to list banks');
    }
  }

  async resolveAccount(accountNumber: string, bankCode: string): Promise<{
    accountNumber: string;
    accountName: string;
  }> {
    try {
      const response = await axios.get(`${this.config.baseUrl}/bank/resolve`, {
        params: { account_number: accountNumber, bank_code: bankCode },
        headers: {
          Authorization: `Bearer ${this.config.secretKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.data.status) {
        throw Object.assign(new Error(response.data.message || 'Account could not be resolved'), {
          status: 400,
        });
      }
      return {
        accountNumber: response.data.data.account_number,
        accountName: response.data.data.account_name,
      };
    } catch (error: any) {
      logger.error('Error resolving account:', {
        error: error.message,
        response: error.response?.data,
      });
      throw Object.assign(
        new Error(error.response?.data?.message || 'This account number is not valid for the selected bank'),
        { status: error.response?.status === 400 ? 400 : 502 }
      );
    }
  }

  async resolveCardBin(bin: string): Promise<{
    bin: string;
    brand: string;
    cardType: string;
    bank: string;
    countryCode: string;
  }> {
    try {
      const response = await axios.get(`${this.config.baseUrl}/decision/bin/${bin}`, {
        headers: {
          Authorization: `Bearer ${this.config.secretKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.data.status) {
        throw Object.assign(new Error(response.data.message || 'Card could not be verified'), {
          status: 400,
        });
      }
      const data = response.data.data;
      return {
        bin: data.bin,
        brand: data.brand,
        cardType: data.card_type,
        bank: data.bank,
        countryCode: data.country_code,
      };
    } catch (error: any) {
      logger.error('Error resolving card BIN:', {
        error: error.message,
        response: error.response?.data,
      });
      throw Object.assign(
        new Error(error.response?.data?.message || 'This card number is not valid'),
        { status: 400 }
      );
    }
  }

  async createTransferRecipient(input: {
    name: string;
    accountNumber: string;
    bankCode: string;
  }): Promise<{ recipientCode: string; name: string }> {
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/transferrecipient`,
        {
          type: 'nuban',
          name: input.name,
          account_number: input.accountNumber,
          bank_code: input.bankCode,
          currency: 'NGN',
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!response.data.status) {
        throw new Error(response.data.message || 'Could not create transfer recipient');
      }
      return {
        recipientCode: response.data.data.recipient_code,
        name: response.data.data.name || input.name,
      };
    } catch (error: any) {
      logger.error('Error creating transfer recipient:', {
        error: error.message,
        response: error.response?.data,
      });
      throw Object.assign(
        new Error(error.response?.data?.message || 'Could not create a bank recipient'),
        { status: error.response?.status === 400 ? 400 : 502 }
      );
    }
  }

  async initiateTransfer(input: {
    amount: number;
    recipientCode: string;
    reason?: string;
    reference: string;
  }): Promise<{ reference: string; transferCode?: string; status: string }> {
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/transfer`,
        {
          source: 'balance',
          amount: Math.round(input.amount * 100),
          recipient: input.recipientCode,
          reason: input.reason || 'PayGenius transfer',
          reference: input.reference,
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!response.data.status) {
        throw new Error(response.data.message || 'Transfer could not be initiated');
      }
      return {
        reference: response.data.data.reference || input.reference,
        transferCode: response.data.data.transfer_code,
        status: response.data.data.status || 'success',
      };
    } catch (error: any) {
      logger.error('Error initiating Paystack transfer:', {
        error: error.message,
        response: error.response?.data,
      });
      throw Object.assign(
        new Error(error.response?.data?.message || 'Bank transfer could not be completed'),
        { status: error.response?.status === 400 ? 400 : 502 }
      );
    }
  }

  async getDedicatedAccount(accountNumber: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.config.baseUrl}/dedicated_account/${accountNumber}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data.status) {
        throw new Error(response.data.message || 'Failed to get dedicated account');
      }

      return response.data.data;
    } catch (error: any) {
      logger.error('Error getting dedicated account:', {
        error: error.message,
        accountNumber,
      });

      if (error.response?.data) {
        const paystackError = error.response.data as PaystackErrorResponse;
        throw new Error(paystackError.message || 'Failed to get dedicated account');
      }

      throw new Error('Failed to get dedicated account');
    }
  }
}

// Export singleton instance
export const paystackService = new PaystackService();
export default paystackService;
