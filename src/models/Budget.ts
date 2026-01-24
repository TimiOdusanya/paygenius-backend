import mongoose, { Document, Schema } from 'mongoose';
import { IBudget, IBudgetDocument } from '../types';
import { BudgetCategory, BUDGET_CATEGORIES } from '../utils/enums';

const BudgetSchema = new Schema<IBudgetDocument>({
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
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  category: {
    type: String,
    enum: BUDGET_CATEGORIES,
    required: true,
    trim: true
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  spentAmount: {
    type: Number,
    required: true,
    default: 0,
    min: 0
  },
  period: {
    type: String,
    enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'],
    default: 'MONTHLY',
    required: true
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
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
BudgetSchema.index({ userId: 1, isActive: 1 });
BudgetSchema.index({ accountId: 1 });
BudgetSchema.index({ startDate: 1, endDate: 1 });

// Virtual for progress percentage
BudgetSchema.virtual('progress').get(function() {
  if (this.totalAmount === 0) return 0;
  return Math.min(100, Math.round((this.spentAmount / this.totalAmount) * 100));
});

// Virtual for remaining amount
BudgetSchema.virtual('remainingAmount').get(function() {
  return Math.max(0, this.totalAmount - this.spentAmount);
});

export default mongoose.model<IBudgetDocument>('Budget', BudgetSchema);

