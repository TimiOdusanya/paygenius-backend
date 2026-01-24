import mongoose, { Document, Schema } from 'mongoose';
import { ITransaction, ITransactionDocument } from '../types';

const TransactionSchema = new Schema<ITransactionDocument>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  accountId: {
    type: Schema.Types.ObjectId,
    ref: 'Account',
    required: true
  },
  budgetId: {
    type: Schema.Types.ObjectId,
    ref: 'Budget'
  },
  type: {
    type: String,
    enum: ['DEBIT', 'CREDIT', 'TRANSFER'],
    required: true
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  subCategory: {
    type: String,
    trim: true,
    maxlength: 50
  },
  merchant: {
    type: String,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'NGN',
    enum: ['NGN', 'USD'],
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'COMPLETED',
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['CARD', 'BANK_TRANSFER', 'WALLET', 'BILL_PAYMENT', 'OTHER'],
    default: 'WALLET'
  },
  reference: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  icon: {
    type: String,
    trim: true
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete (ret as any).__v;
      return ret;
    }
  }
});

// Indexes for efficient queries
TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ accountId: 1, createdAt: -1 });
TransactionSchema.index({ budgetId: 1 });
// Compound index for budget spent amount queries (budgetId, status, type, createdAt)
TransactionSchema.index({ budgetId: 1, status: 1, type: 1, createdAt: 1 });
TransactionSchema.index({ category: 1 });
TransactionSchema.index({ type: 1 });
TransactionSchema.index({ status: 1 });
// Note: reference already has unique index from unique: true

export default mongoose.model<ITransactionDocument>('Transaction', TransactionSchema);

