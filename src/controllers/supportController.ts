import { Response } from 'express';
import { IAuthRequest } from '../types';
import { SupportService } from '../services/supportService';
import logger from '../lib/log/winston.log';

function sendServiceError(res: Response, error: any, logLabel: string) {
  if (error?.status) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  logger.error(logLabel, error);
  res.status(500).json({ success: false, message: 'Internal server error' });
}

export const getFaqs = async (_req: IAuthRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      message: 'FAQs retrieved successfully',
      data: { faqs: SupportService.getFaqs() },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Get FAQs error:');
  }
};

export const getAbout = async (_req: IAuthRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      message: 'About retrieved successfully',
      data: SupportService.getAbout(),
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Get about error:');
  }
};

export const getContact = async (_req: IAuthRequest, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      message: 'Contact details retrieved successfully',
      data: SupportService.getContact(),
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Get contact error:');
  }
};

export const listChat = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const messages = await SupportService.listChat(req.user!._id.toString());
    res.status(200).json({
      success: true,
      message: 'Support chat retrieved successfully',
      data: { messages },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'List support chat error:');
  }
};

export const sendChat = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const data = await SupportService.sendChat(
      req.user!._id.toString(),
      String(req.body?.body ?? req.body?.message ?? ''),
      req.body?.topic
    );
    res.status(200).json({
      success: true,
      message: 'Message sent successfully',
      data,
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Send support chat error:');
  }
};
