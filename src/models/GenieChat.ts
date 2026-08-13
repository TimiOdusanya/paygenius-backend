import mongoose, { Schema } from 'mongoose';

export type GenieAttachmentType = 'image' | 'audio';

export interface IGenieAttachment {
  type: GenieAttachmentType;
  uri: string;
  mimeType?: string;
  durationMs?: number;
}

export interface IGenieMessage {
  role: 'user' | 'assistant';
  content: string;
  transcript?: string;
  attachments?: IGenieAttachment[];
  createdAt: Date;
}

export interface IGenieChat {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  messages: IGenieMessage[];
  createdAt?: Date;
  updatedAt?: Date;
}

const GenieAttachmentSchema = new Schema<IGenieAttachment>(
  {
    type: { type: String, enum: ['image', 'audio'], required: true },
    uri: { type: String, required: true },
    mimeType: { type: String, trim: true },
    durationMs: { type: Number }
  },
  { _id: false }
);

const GenieMessageSchema = new Schema<IGenieMessage>(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true, trim: true, maxlength: 4000 },
    transcript: { type: String, trim: true, maxlength: 4000 },
    attachments: { type: [GenieAttachmentSchema], default: [] },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const GenieChatSchema = new Schema<IGenieChat>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, trim: true, default: 'Finance Chat', maxlength: 80 },
    messages: { type: [GenieMessageSchema], default: [] }
  },
  { timestamps: true }
);

export default mongoose.model<IGenieChat>('GenieChat', GenieChatSchema);
