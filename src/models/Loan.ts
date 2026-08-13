import mongoose, { Schema } from 'mongoose';

export type LoanFrequency = 'WEEK' | 'MONTH';
export type LoanHealth = 'HEALTHY' | 'UNHEALTHY';

export interface ILoan {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  providerName: string;
  providerCode: string;
  accountName: string;
  accountLast4: string;
  principalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  dueDate: Date;
  automate: boolean;
  repaymentFrequency?: LoanFrequency;
  reminderEnabled: boolean;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const LoanSchema = new Schema<ILoan>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    providerName: { type: String, required: true, trim: true },
    providerCode: { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    accountLast4: { type: String, required: true, trim: true, maxlength: 4 },
    principalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, required: true, default: 0, min: 0 },
    outstandingAmount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date, required: true },
    automate: { type: Boolean, default: false },
    repaymentFrequency: { type: String, enum: ['WEEK', 'MONTH'] },
    reminderEnabled: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

LoanSchema.index({ userId: 1, isActive: 1 });

LoanSchema.virtual('progress').get(function () {
  if (this.principalAmount === 0) return 0;
  return Math.min(100, (this.paidAmount / this.principalAmount) * 100);
});

LoanSchema.virtual('health').get(function (): LoanHealth {
  if (this.principalAmount === 0) return 'UNHEALTHY';
  return this.paidAmount / this.principalAmount >= 0.5 ? 'HEALTHY' : 'UNHEALTHY';
});

export default mongoose.model<ILoan>('Loan', LoanSchema);
