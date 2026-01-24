import mongoose, { Document, Schema } from 'mongoose';
import { IAccount, IAccountDocument } from '../types';

const AccountSchema = new Schema<IAccountDocument>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  accountNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  accountType: {
    type: String,
    enum: ['WALLET', 'SAVINGS', 'CURRENT'],
    default: 'WALLET',
    required: true
  },
  balance: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'NGN',
    enum: ['NGN', 'USD'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPrimary: {
    type: Boolean,
    default: false
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

// Index for efficient queries
AccountSchema.index({ userId: 1, isPrimary: 1 });
// Note: accountNumber already has unique index from unique: true

export default mongoose.model<IAccountDocument>('Account', AccountSchema);

