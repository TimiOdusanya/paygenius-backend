import mongoose, { Schema } from 'mongoose';

export type DevicePlatform = 'ios' | 'android' | 'web';

export interface IDeviceToken {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  token: string;
  platform: DevicePlatform;
  createdAt?: Date;
  updatedAt?: Date;
}

const DeviceTokenSchema = new Schema<IDeviceToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web'],
      required: true,
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

DeviceTokenSchema.index({ userId: 1 });

export default mongoose.model<IDeviceToken>('DeviceToken', DeviceTokenSchema);
