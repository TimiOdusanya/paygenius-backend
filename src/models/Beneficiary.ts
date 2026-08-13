import mongoose, { Schema } from 'mongoose';

export type TransferRail = 'PAYGENIUS' | 'BANK';

export interface IBeneficiary {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  rail: TransferRail;
  name: string;
  handle?: string;
  recipientUserId?: mongoose.Types.ObjectId;
  accountNumber?: string;
  bankCode?: string;
  bankName?: string;
  avatarColor?: string;
  lastUsedAt?: Date;
}

const BeneficiarySchema = new Schema<IBeneficiary>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rail: { type: String, enum: ['PAYGENIUS', 'BANK'], required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    handle: { type: String, trim: true, maxlength: 40 },
    recipientUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    accountNumber: { type: String, trim: true },
    bankCode: { type: String, trim: true },
    bankName: { type: String, trim: true },
    avatarColor: { type: String, trim: true },
    lastUsedAt: { type: Date },
  },
  { timestamps: true }
);

BeneficiarySchema.index({ userId: 1, recipientUserId: 1 }, { sparse: true });
BeneficiarySchema.index({ userId: 1, accountNumber: 1, bankCode: 1 }, { sparse: true });

export default mongoose.model<IBeneficiary>('Beneficiary', BeneficiarySchema);
