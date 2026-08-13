import { Response } from 'express';
import { IAuthRequest } from '../types';
import { NotificationService } from '../services/notificationService';
import { DevicePlatform } from '../models/DeviceToken';
import logger from '../lib/log/winston.log';

function sendServiceError(res: Response, error: any, logLabel: string) {
  if (error?.status) {
    res.status(error.status).json({ success: false, message: error.message });
    return;
  }
  logger.error(logLabel, error);
  res.status(500).json({ success: false, message: 'Internal server error' });
}

export const listNotifications = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!._id.toString();
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const data = await NotificationService.list(userId, page, limit);
    res.status(200).json({
      success: true,
      message: 'Notifications retrieved successfully',
      data,
    });
  } catch (error: any) {
    sendServiceError(res, error, 'List notifications error:');
  }
};

export const getUnreadCount = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const count = await NotificationService.unreadCount(req.user!._id.toString());
    res.status(200).json({
      success: true,
      message: 'Unread count retrieved successfully',
      data: { count },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Unread count error:');
  }
};

export const getPreferences = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const preferences = await NotificationService.getPreferences(req.user!._id.toString());
    res.status(200).json({
      success: true,
      message: 'Notification preferences retrieved successfully',
      data: { preferences },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Get notification preferences error:');
  }
};

export const updatePreferences = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const preferences = await NotificationService.updatePreferences(
      req.user!._id.toString(),
      req.body ?? {}
    );
    res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully',
      data: { preferences },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Update notification preferences error:');
  }
};

export const markNotificationRead = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const notification = await NotificationService.markRead(
      req.user!._id.toString(),
      req.params.id
    );
    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: { notification },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Mark notification read error:');
  }
};

export const markAllNotificationsRead = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const data = await NotificationService.markAllRead(req.user!._id.toString());
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data,
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Mark all notifications read error:');
  }
};

export const deleteNotification = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const notification = await NotificationService.remove(
      req.user!._id.toString(),
      req.params.id
    );
    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully',
      data: { notification },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Delete notification error:');
  }
};

export const registerDevice = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const device = await NotificationService.registerDevice(
      req.user!._id.toString(),
      String(req.body?.token ?? ''),
      String(req.body?.platform ?? '') as DevicePlatform
    );
    res.status(200).json({
      success: true,
      message: 'Device registered successfully',
      data: { device },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Register device error:');
  }
};

export const unregisterDevice = async (req: IAuthRequest, res: Response): Promise<void> => {
  try {
    const token = String(req.body?.token ?? req.query.token ?? '');
    const device = await NotificationService.unregisterDevice(req.user!._id.toString(), token);
    res.status(200).json({
      success: true,
      message: 'Device unregistered successfully',
      data: { device },
    });
  } catch (error: any) {
    sendServiceError(res, error, 'Unregister device error:');
  }
};
