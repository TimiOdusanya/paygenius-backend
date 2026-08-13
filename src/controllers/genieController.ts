import { Response } from 'express';
import { IAuthRequest } from '../types';
import { GenieService } from '../services/genieService';
import logger from '../lib/log/winston.log';

export class GenieController {
  static async getProfile(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized. Please login.', error: 'UNAUTHORIZED' });
        return;
      }
      const profile = await GenieService.getProfile(userId);
      res.status(200).json({
        success: true,
        message: 'Genie profile retrieved',
        data: { profile, onboardingCompleted: profile?.onboardingCompleted ?? false }
      });
    } catch (error: any) {
      logger.error('Error getting genie profile:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to get profile', error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  static async saveProfile(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized. Please login.', error: 'UNAUTHORIZED' });
        return;
      }
      const profile = await GenieService.upsertProfile(userId, req.body || {});
      res.status(200).json({
        success: true,
        message: 'Genie profile saved',
        data: { profile, onboardingCompleted: profile.onboardingCompleted }
      });
    } catch (error: any) {
      logger.error('Error saving genie profile:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to save profile', error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  static async listChats(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized. Please login.', error: 'UNAUTHORIZED' });
        return;
      }
      const chats = await GenieService.listChats(userId);
      res.status(200).json({
        success: true,
        message: 'Chats retrieved',
        data: {
          chats: chats.map((c) => ({
            _id: c._id,
            title: c.title,
            updatedAt: (c as any).updatedAt,
            preview: c.messages[c.messages.length - 1]?.content
          }))
        }
      });
    } catch (error: any) {
      logger.error('Error listing genie chats:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to list chats', error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  static async getChat(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized. Please login.', error: 'UNAUTHORIZED' });
        return;
      }
      const chatId = req.params.id;
      const chat = chatId === 'active'
        ? await GenieService.getLatestChat(userId)
        : await GenieService.getChat(userId, chatId);
      if (!chat) {
        res.status(200).json({ success: true, message: 'No chat yet', data: { chat: null } });
        return;
      }
      res.status(200).json({ success: true, message: 'Chat retrieved', data: { chat } });
    } catch (error: any) {
      logger.error('Error getting genie chat:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to get chat', error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  static async createChat(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized. Please login.', error: 'UNAUTHORIZED' });
        return;
      }
      const chat = await GenieService.createChat(userId, req.body?.title);
      res.status(201).json({ success: true, message: 'Chat created', data: { chat } });
    } catch (error: any) {
      logger.error('Error creating genie chat:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to create chat', error: 'INTERNAL_SERVER_ERROR' });
    }
  }

  static async sendMessage(req: IAuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?._id?.toString();
      if (!userId) {
        res.status(401).json({ success: false, message: 'Unauthorized. Please login.', error: 'UNAUTHORIZED' });
        return;
      }
      const content = String(req.body?.content || '').trim();
      const image = req.body?.image;
      const audio = req.body?.audio;
      if (!content && !image?.uri && !audio?.uri) {
        res.status(400).json({
          success: false,
          message: 'Send a message, photo, or voice note.',
          error: 'VALIDATION_ERROR',
        });
        return;
      }
      const chat = await GenieService.sendMessage(userId, req.params.id, {
        content,
        image: image?.uri ? { uri: String(image.uri), mimeType: image.mimeType } : undefined,
        audio: audio?.uri
          ? {
              uri: String(audio.uri),
              mimeType: audio.mimeType,
              durationMs: audio.durationMs ? Number(audio.durationMs) : undefined,
            }
          : undefined,
      });
      res.status(200).json({ success: true, message: 'Message sent', data: { chat } });
    } catch (error: any) {
      logger.error('Error sending genie message:', error);
      const status = error.status || 500;
      res.status(status).json({
        success: false,
        message: error.message || 'Failed to send message',
        error: status === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR'
      });
    }
  }
}
