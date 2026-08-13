import * as express from 'express';
import { Document } from 'mongoose';

export interface IUser {
  _id: string;
  phoneNumber: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  dateOfBirth?: Date;
  profilePicture?: string;
  address?: {
    houseNumber: string;
    streetName: string;
    city: string;
    state: string;
    localGovernmentArea: string;
  };
  identityVerification?: {
    type: 'BVN' | 'NIN';
    number: string;
    verified: boolean;
    verifiedAt?: Date;
  };
  selfieImages?: string[];
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  isProfileComplete: boolean;
  isIdentityVerified: boolean;
  isAddressVerified: boolean;
  isBiometricSetup: boolean;
  setTransactionPin?: boolean;
  transactionPin?: string;
  biometricEnabled: boolean;
  googleId?: string;
  appleId?: string;
  referralCode?: string;
  referredBy?: string;
  dailySpendLimit?: number;
  dailyTransferLimit?: number;
  faceIdEnabled?: boolean;
  deletedAt?: Date;
  deactivatedAt?: Date;
  wallet?: IWallet; // Virtual account wallet
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserDocument {
  _id: any;
  phoneNumber: string;
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  dateOfBirth?: Date;
  profilePicture?: string;
  address?: {
    houseNumber: string;
    streetName: string;
    city: string;
    state: string;
    localGovernmentArea: string;
  };
  identityVerification?: {
    type: 'BVN' | 'NIN';
    number: string;
    verified: boolean;
    verifiedAt?: Date;
  };
  selfieImages?: string[];
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  isProfileComplete: boolean;
  isIdentityVerified: boolean;
  isAddressVerified: boolean;
  isBiometricSetup: boolean;
  setTransactionPin?: boolean;
  transactionPin?: string;
  biometricEnabled: boolean;
  googleId?: string;
  appleId?: string;
  referralCode?: string;
  referredBy?: any;
  dailySpendLimit?: number;
  dailyTransferLimit?: number;
  faceIdEnabled?: boolean;
  deletedAt?: Date;
  deactivatedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  toJSON(): IUser;
  comparePassword(candidatePassword: string): Promise<boolean>;
  hashPassword(): Promise<void>;
}

export interface IAuthRequest extends express.Request {
  user?: IUser;
}

export interface IPhoneVerification {
  phoneNumber: string;
  code: string;
  expiresAt: Date;
  attempts: number;
}

export interface IGoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface IAppleUser {
  id: string;
  email: string;
  name?: string;
}

export interface IAuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: IUser;
    token: string;
    refreshToken?: string;
  };
  error?: string;
}

export interface IProfileResponse {
  success: boolean;
  message: string;
  data?: {
    user: IUser;
  };
  error?: string;
}

export interface IProfileSetupData {
  firstName: string;
  lastName: string;
  username: string;
  dateOfBirth: string;
  profilePicture?: string;
}

export interface IAddressData {
  houseNumber: string;
  streetName: string;
  city: string;
  state: string;
  localGovernmentArea: string;
}

export interface IIdentityVerificationData {
  type: 'BVN' | 'NIN';
  number: string;
  phoneNumber: string;
}

export interface ISelfieData {
  selfieImages: string[];
}

export interface ITransactionPinData {
  pin: string;
  confirmPin: string;
}

// Wallet Types (Paystack Virtual Account)
export interface IWallet {
  _id: string;
  userId: string;
  totalBalance: number;
  availableBalance: number;
  virtualAccountNumber: string;
  bankName: string;
  accountName: string;
  paystackCustomerId: string;
  paystackDedicatedAccountId: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IWalletDocument extends Document {
  _id: any;
  userId: any;
  totalBalance: number;
  availableBalance: number;
  virtualAccountNumber: string;
  bankName: string;
  accountName: string;
  paystackCustomerId: string;
  paystackDedicatedAccountId: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Account Types
export interface IAccount {
  _id: string;
  userId: string;
  accountNumber: string;
  accountType: 'WALLET' | 'SAVINGS' | 'CURRENT';
  balance: number;
  currency: 'NGN' | 'USD';
  isActive: boolean;
  isPrimary: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAccountDocument {
  _id: any;
  userId: any;
  accountNumber: string;
  accountType: 'WALLET' | 'SAVINGS' | 'CURRENT';
  balance: number;
  currency: 'NGN' | 'USD';
  isActive: boolean;
  isPrimary: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  toJSON(): IAccount;
}

// Budget Types
export interface IBudget {
  _id: string;
  userId: string;
  accountId: string;
  name: string;
  category: string;
  totalAmount: number;
  spentAmount: number;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  startDate: Date;
  endDate: Date;
  backgroundColor?: string;
  progressColor?: string;
  isActive: boolean;
  progress?: number;
  remainingAmount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IBudgetDocument {
  _id: any;
  userId: any;
  accountId: any;
  name: string;
  category: string;
  totalAmount: number;
  spentAmount: number;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  progress?: number;
  remainingAmount?: number;
  createdAt?: Date;
  updatedAt?: Date;
  toJSON(): IBudget;
}

// Transaction Types
export interface ITransaction {
  _id: string;
  userId: string;
  accountId: string;
  budgetId?: string;
  type: 'DEBIT' | 'CREDIT' | 'TRANSFER';
  category: string;
  subCategory?: string;
  merchant?: string;
  description?: string;
  amount: number;
  currency: 'NGN' | 'USD';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  paymentMethod: 'CARD' | 'BANK_TRANSFER' | 'WALLET' | 'BILL_PAYMENT' | 'OTHER';
  reference?: string;
  icon?: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ITransactionDocument {
  _id: any;
  userId: any;
  accountId: any;
  budgetId?: any;
  type: 'DEBIT' | 'CREDIT' | 'TRANSFER';
  category: string;
  subCategory?: string;
  merchant?: string;
  description?: string;
  amount: number;
  currency: 'NGN' | 'USD';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  paymentMethod: 'CARD' | 'BANK_TRANSFER' | 'WALLET' | 'BILL_PAYMENT' | 'OTHER';
  reference?: string;
  icon?: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
  toJSON(): ITransaction;
}

// Budget Response Types
export interface IBudgetResponse {
  success: boolean;
  message: string;
  data?: {
    budget?: IBudget;
    budgets?: IBudget[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
  error?: string;
}

// Home Dashboard Response Types
export interface IHomeDashboardResponse {
  success: boolean;
  message: string;
  data?: {
    account: IAccount;
    budgets: IBudget[];
    recentTransactions: ITransaction[];
    summary?: {
      totalIncome: number;
      totalExpenses: number;
      monthlySpending: number;
    };
  };
  error?: string;
}
