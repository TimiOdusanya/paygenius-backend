import mongoose, { Schema } from 'mongoose';

export interface INotificationPreference {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  transactionAlerts: boolean;
  promotions: boolean;
  securityAlerts: boolean;
  genieUpdates: boolean;
  hideBalance: boolean;
  requireFaceId: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const NotificationPreferenceSchema = new Schema<INotificationPreference>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    transactionAlerts: {
      type: Boolean,
      default: true,
    },
    promotions: {
      type: Boolean,
      default: false,
    },
    securityAlerts: {
      type: Boolean,
      default: true,
    },
    genieUpdates: {
      type: Boolean,
      default: false,
    },
    hideBalance: {
      type: Boolean,
      default: false,
    },
    requireFaceId: {
      type: Boolean,
      default: false,
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

export default mongoose.model<INotificationPreference>(
  'NotificationPreference',
  NotificationPreferenceSchema
);
