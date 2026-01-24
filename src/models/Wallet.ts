import mongoose, { Document, Schema } from 'mongoose';
import { IWalletDocument } from '../types';

const WalletSchema = new Schema<IWalletDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    totalBalance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    availableBalance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    virtualAccountNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    bankName: {
      type: String,
      required: true,
      trim: true,
    },
    accountName: {
      type: String,
      required: true,
      trim: true,
    },
    paystackCustomerId: {
      type: String,
      required: true,
      trim: true,
    },
    paystackDedicatedAccountId: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

// Indexes for efficient queries
// Note: userId and virtualAccountNumber already have unique indexes from unique: true
WalletSchema.index({ paystackCustomerId: 1 });

// Ensure availableBalance never exceeds totalBalance
WalletSchema.pre('save', function (next) {
  if (this.availableBalance > this.totalBalance) {
    return next(new Error('Available balance cannot exceed total balance'));
  }
  next();
});

export default mongoose.model<IWalletDocument>('Wallet', WalletSchema);
