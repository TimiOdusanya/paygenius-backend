import mongoose, { Schema } from 'mongoose';

export interface ILinkedAccount {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  accountName: string;
  accountNumber: string;
  last4: string;
  brand: string;
  bankCode?: string;
  bankName?: string;
  expiryMonth: string;
  expiryYear: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const LinkedAccountSchema = new Schema<ILinkedAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    accountName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    last4: { type: String, required: true, trim: true, maxlength: 4 },
    brand: { type: String, default: 'VISA', trim: true },
    bankCode: { type: String, trim: true },
    bankName: { type: String, trim: true },
    expiryMonth: { type: String, required: true },
    expiryYear: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

LinkedAccountSchema.index({ userId: 1, isActive: 1 });

export default mongoose.model<ILinkedAccount>('LinkedAccount', LinkedAccountSchema);
