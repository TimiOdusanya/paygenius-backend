import mongoose, { Schema } from 'mongoose';

export interface IAppReview {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  rating: number;
  review?: string;
  enjoyed?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const AppReviewSchema = new Schema<IAppReview>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
      trim: true,
    },
    enjoyed: {
      type: Boolean,
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

AppReviewSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model<IAppReview>('AppReview', AppReviewSchema);
