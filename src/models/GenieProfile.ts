import mongoose, { Schema } from 'mongoose';

export interface IGenieProfile {
  userId: mongoose.Types.ObjectId;
  occupation?: string;
  payFrequency?: string;
  monthlyIncome?: string;
  topSpends?: string[];
  trackingHabit?: string;
  spendingStyle?: string;
  goals?: string[];
  goalTimeline?: string;
  helpFocus?: string;
  checkInPreference?: string;
  allowPeek?: string;
  onboardingCompleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const GenieProfileSchema = new Schema<IGenieProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    occupation: { type: String, trim: true },
    payFrequency: { type: String, trim: true },
    monthlyIncome: { type: String, trim: true },
    topSpends: [{ type: String, trim: true }],
    trackingHabit: { type: String, trim: true },
    spendingStyle: { type: String, trim: true },
    goals: [{ type: String, trim: true }],
    goalTimeline: { type: String, trim: true },
    helpFocus: { type: String, trim: true },
    checkInPreference: { type: String, trim: true },
    allowPeek: { type: String, trim: true },
    onboardingCompleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model<IGenieProfile>('GenieProfile', GenieProfileSchema);
