import mongoose, { Document, Schema } from 'mongoose';

export interface IPhoneVerificationDocument extends Document {
  phoneNumber: string;
  code: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const PhoneVerificationSchema = new Schema<IPhoneVerificationDocument>({
  phoneNumber: {
    type: String,
    required: true,
    trim: true,
    match: /^\+?[1-9]\d{1,14}$/
  },
  code: {
    type: String,
    required: true,
    length: 4
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
  },
  attempts: {
    type: Number,
    default: 0,
    max: 5
  }
}, {
  timestamps: true
});

// Index for faster queries
PhoneVerificationSchema.index({ phoneNumber: 1 });
PhoneVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Remove expired documents
PhoneVerificationSchema.pre('save', function(next) {
  if (this.isNew) {
    this.expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
  }
  next();
});

export default mongoose.model<IPhoneVerificationDocument>('PhoneVerification', PhoneVerificationSchema);
