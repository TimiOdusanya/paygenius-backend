import mongoose, { Schema } from 'mongoose';

export type SavingType = 'ONE_TIME' | 'RECURRING';
export type SavingFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type SavingSource = 'PAYGENIUS' | 'LINKED_ACCOUNT';
export type SavingAccent = 'navy' | 'green';

export interface ISavingsGoal {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  name: string;
  targetAmount: number;
  currentAmount: number;
  description?: string;
  targetDate?: Date;
  savingType: SavingType;
  frequency?: SavingFrequency;
  installmentAmount: number;
  maturityDate?: Date;
  sourceType: SavingSource;
  linkedAccountId?: mongoose.Types.ObjectId;
  shareSlug: string;
  accent: SavingAccent;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const SavingsGoalSchema = new Schema<ISavingsGoal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    targetAmount: { type: Number, required: true, min: 0 },
    currentAmount: { type: Number, required: true, default: 0, min: 0 },
    description: { type: String, trim: true, maxlength: 500 },
    targetDate: { type: Date },
    savingType: {
      type: String,
      enum: ['ONE_TIME', 'RECURRING'],
      required: true,
    },
    frequency: {
      type: String,
      enum: ['DAILY', 'WEEKLY', 'MONTHLY'],
    },
    installmentAmount: { type: Number, required: true, min: 0 },
    maturityDate: { type: Date },
    sourceType: {
      type: String,
      enum: ['PAYGENIUS', 'LINKED_ACCOUNT'],
      required: true,
    },
    linkedAccountId: { type: Schema.Types.ObjectId, ref: 'LinkedAccount' },
    shareSlug: { type: String, required: true, unique: true },
    accent: { type: String, enum: ['navy', 'green'], default: 'navy' },
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

SavingsGoalSchema.index({ userId: 1, isActive: 1 });
SavingsGoalSchema.index({ shareSlug: 1 }, { unique: true });

SavingsGoalSchema.virtual('progress').get(function () {
  if (this.targetAmount === 0) return 0;
  return Math.min(100, Math.round((this.currentAmount / this.targetAmount) * 100));
});

export default mongoose.model<ISavingsGoal>('SavingsGoal', SavingsGoalSchema);
