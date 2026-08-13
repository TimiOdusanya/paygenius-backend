import mongoose, { Schema } from 'mongoose';

export type SupportRole = 'user' | 'support';

export interface ISupportMessage {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: SupportRole;
  topic?: string;
  body: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const SupportMessageSchema = new Schema<ISupportMessage>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'support'],
      required: true,
    },
    topic: {
      type: String,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
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

SupportMessageSchema.index({ userId: 1, createdAt: 1 });

export default mongoose.model<ISupportMessage>('SupportMessage', SupportMessageSchema);
