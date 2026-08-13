import GenieProfile, { IGenieProfile } from '../models/GenieProfile';
import GenieChat, { IGenieAttachment, IGenieChat } from '../models/GenieChat';
import { generateGenieReply, loadMoneySnapshot, transcribeAudio } from './genieAiService';
import logger from '../lib/log/winston.log';

export type GenieMessageInput = {
  content?: string;
  image?: { uri: string; mimeType?: string };
  audio?: { uri: string; mimeType?: string; durationMs?: number };
};

const MAX_IMAGE_URI = 2_800_000;
const MAX_AUDIO_URI = 4_500_000;

function isDataUri(uri: string, kind: 'image' | 'audio'): boolean {
  return new RegExp(`^data:${kind}/[a-zA-Z0-9.+-]+;base64,`).test(uri);
}

const PROFILE_FIELDS: Array<keyof IGenieProfile | 'onboardingCompleted'> = [
  'occupation',
  'payFrequency',
  'monthlyIncome',
  'topSpends',
  'trackingHabit',
  'spendingStyle',
  'goals',
  'goalTimeline',
  'helpFocus',
  'checkInPreference',
  'allowPeek',
  'onboardingCompleted',
];

function titleFromMessage(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New Chat';
  const firstLine = cleaned.split(/[.?!\n]/)[0]?.trim() || cleaned;
  if (firstLine.length <= 42) return firstLine;
  return `${firstLine.slice(0, 39).trimEnd()}…`;
}

export class GenieService {
  static async getProfile(userId: string): Promise<IGenieProfile | null> {
    return GenieProfile.findOne({ userId });
  }

  static async upsertProfile(
    userId: string,
    payload: Partial<IGenieProfile> & { onboardingCompleted?: boolean }
  ): Promise<IGenieProfile> {
    const next: Record<string, unknown> = { userId };
    for (const key of PROFILE_FIELDS) {
      if (payload[key as keyof typeof payload] !== undefined) {
        next[key] = payload[key as keyof typeof payload];
      }
    }
    const profile = await GenieProfile.findOneAndUpdate(
      { userId },
      { $set: next },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return profile;
  }

  static async listChats(userId: string): Promise<IGenieChat[]> {
    return GenieChat.find({ userId }).sort({ updatedAt: -1 }).limit(20);
  }

  static async getChat(userId: string, chatId: string): Promise<IGenieChat | null> {
    return GenieChat.findOne({ _id: chatId, userId });
  }

  static async createChat(userId: string, title?: string): Promise<IGenieChat> {
    const chat = await GenieChat.create({
      userId,
      title: title || 'New Chat',
      messages: []
    });
    return chat;
  }

  static async getLatestChat(userId: string): Promise<IGenieChat | null> {
    return GenieChat.findOne({ userId }).sort({ updatedAt: -1 });
  }

  static async getOrCreateActiveChat(userId: string): Promise<IGenieChat> {
    const existing = await this.getLatestChat(userId);
    if (existing) return existing;
    return this.createChat(userId);
  }

  static async sendMessage(
    userId: string,
    chatId: string,
    input: GenieMessageInput
  ): Promise<IGenieChat> {
    const chat = await GenieChat.findOne({ _id: chatId, userId });
    if (!chat) {
      throw Object.assign(new Error('Chat not found'), { status: 404 });
    }

    const text = String(input.content || '').trim();
    const attachments: IGenieAttachment[] = [];
    let transcript = '';
    let imageUri: string | undefined;

    if (input.image?.uri) {
      if (!isDataUri(input.image.uri, 'image') || input.image.uri.length > MAX_IMAGE_URI) {
        throw Object.assign(new Error('Image is too large or not a valid photo'), { status: 400 });
      }
      imageUri = input.image.uri;
      attachments.push({
        type: 'image',
        uri: input.image.uri,
        mimeType: input.image.mimeType || 'image/jpeg',
      });
    }

    if (input.audio?.uri) {
      if (!isDataUri(input.audio.uri, 'audio') || input.audio.uri.length > MAX_AUDIO_URI) {
        throw Object.assign(new Error('Voice note is too large or not valid audio'), { status: 400 });
      }
      attachments.push({
        type: 'audio',
        uri: input.audio.uri,
        mimeType: input.audio.mimeType || 'audio/m4a',
        durationMs: input.audio.durationMs,
      });
      try {
        transcript = await transcribeAudio(input.audio.uri);
      } catch (error) {
        logger.error('Genie transcription failed:', error);
      }
    }

    const prompt = [text, transcript].filter(Boolean).join('\n');
    const storedContent = text || transcript || (imageUri ? 'Photo' : attachments.length ? 'Voice note' : '');
    if (!storedContent) {
      throw Object.assign(new Error('Message content is required'), { status: 400 });
    }

    chat.messages.push({
      role: 'user',
      content: storedContent,
      transcript: transcript || undefined,
      attachments,
      createdAt: new Date(),
    });
    if (chat.messages.filter((m) => m.role === 'user').length === 1) {
      chat.title = titleFromMessage(storedContent);
    }

    const history = chat.messages.slice(0, -1);
    let reply: string;
    try {
      const snapshot = await loadMoneySnapshot(userId);
      reply = await generateGenieReply(snapshot, history, prompt || storedContent, imageUri);
    } catch (error) {
      logger.error('Genie reply failed:', error);
      reply = `I'm here. Ask me about your spending, budgets, or savings and I'll pull it from your account.`;
    }

    chat.messages.push({ role: 'assistant', content: reply, createdAt: new Date() });
    await chat.save();
    return chat;
  }
}
