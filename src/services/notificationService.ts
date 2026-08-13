import Notification, { INotification, NotificationType } from '../models/Notification';
import NotificationPreference, { INotificationPreference } from '../models/NotificationPreference';
import DeviceToken, { DevicePlatform } from '../models/DeviceToken';
import { emitToUser } from './socketService';
import { sendExpoPush } from './pushService';

export type CreateNotificationInput = {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any>;
};

export type PreferenceUpdates = Partial<
  Pick<
    INotificationPreference,
    | 'transactionAlerts'
    | 'promotions'
    | 'securityAlerts'
    | 'genieUpdates'
    | 'hideBalance'
    | 'requireFaceId'
  >
>;

const TYPE_PREF_KEY: Record<NotificationType, keyof INotificationPreference | null> = {
  TRANSACTION: 'transactionAlerts',
  PROMOTION: 'promotions',
  SECURITY: 'securityAlerts',
  GENIE: 'genieUpdates',
  SYSTEM: null,
};

const AMOUNT_PATTERN = /₦\s*[\d,]+(?:\.\d+)?/g;

function redactAmounts(value: string) {
  return value.replace(AMOUNT_PATTERN, '₦••••');
}

function toJson(doc: INotification) {
  return typeof (doc as any).toJSON === 'function' ? (doc as any).toJSON() : doc;
}

export class NotificationService {
  static async getOrCreatePreferences(userId: string) {
    let preferences = await NotificationPreference.findOne({ userId });
    if (!preferences) {
      preferences = await NotificationPreference.create({ userId });
    }
    return preferences;
  }

  static async createAndDispatch(userId: string, input: CreateNotificationInput) {
    const preferences = await this.getOrCreatePreferences(userId);
    const prefKey = TYPE_PREF_KEY[input.type];
    if (prefKey && preferences[prefKey] === false) {
      return null;
    }

    let title = input.title;
    let body = input.body;
    if (preferences.hideBalance) {
      title = redactAmounts(title);
      body = redactAmounts(body);
    }

    const notification = await Notification.create({
      userId,
      type: input.type,
      title,
      body,
      data: input.data,
    });

    const unread = await this.unreadCount(userId);
    emitToUser(userId, 'notification:new', toJson(notification));
    emitToUser(userId, 'notification:unread-count', { count: unread });

    const devices = await DeviceToken.find({ userId });
    const tokens = devices.map((device) => device.token);
    void sendExpoPush(tokens, title, body, {
      type: input.type,
      notificationId: notification._id.toString(),
      ...(input.data ?? {}),
    });

    return toJson(notification);
  }

  static async list(userId: string, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [notifications, total] = await Promise.all([
      Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(safeLimit),
      Notification.countDocuments({ userId }),
    ]);

    return {
      notifications: notifications.map(toJson),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 0,
      },
    };
  }

  static async unreadCount(userId: string) {
    return Notification.countDocuments({ userId, readAt: { $exists: false } });
  }

  static async markRead(userId: string, id: string) {
    const notification = await Notification.findOne({ _id: id, userId });
    if (!notification) {
      throw Object.assign(new Error('Notification not found'), { status: 404 });
    }
    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }
    return toJson(notification);
  }

  static async markAllRead(userId: string) {
    const result = await Notification.updateMany(
      { userId, readAt: { $exists: false } },
      { $set: { readAt: new Date() } }
    );
    return { updated: result.modifiedCount, modified: result.modifiedCount };
  }

  static async remove(userId: string, id: string) {
    const notification = await Notification.findOneAndDelete({ _id: id, userId });
    if (!notification) {
      throw Object.assign(new Error('Notification not found'), { status: 404 });
    }
    return toJson(notification);
  }

  static async getPreferences(userId: string) {
    const preferences = await this.getOrCreatePreferences(userId);
    return typeof (preferences as any).toJSON === 'function'
      ? (preferences as any).toJSON()
      : preferences;
  }

  static async updatePreferences(userId: string, updates: PreferenceUpdates) {
    const allowed: (keyof PreferenceUpdates)[] = [
      'transactionAlerts',
      'promotions',
      'securityAlerts',
      'genieUpdates',
      'hideBalance',
      'requireFaceId',
    ];
    const $set: PreferenceUpdates = {};
    for (const key of allowed) {
      if (typeof updates[key] === 'boolean') {
        $set[key] = updates[key];
      }
    }

    const preferences = await NotificationPreference.findOneAndUpdate(
      { userId },
      { $set },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return typeof (preferences as any)?.toJSON === 'function'
      ? (preferences as any).toJSON()
      : preferences;
  }

  static async registerDevice(userId: string, token: string, platform: DevicePlatform) {
    if (!token?.trim()) {
      throw Object.assign(new Error('Device token is required'), { status: 400 });
    }
    if (!['ios', 'android', 'web'].includes(platform)) {
      throw Object.assign(new Error('Platform must be ios, android, or web'), { status: 400 });
    }

    const device = await DeviceToken.findOneAndUpdate(
      { token: token.trim() },
      { userId, token: token.trim(), platform },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return typeof (device as any)?.toJSON === 'function' ? (device as any).toJSON() : device;
  }

  static async unregisterDevice(userId: string, token: string) {
    if (!token?.trim()) {
      throw Object.assign(new Error('Device token is required'), { status: 400 });
    }
    const device = await DeviceToken.findOneAndDelete({ userId, token: token.trim() });
    if (!device) {
      throw Object.assign(new Error('Device token not found'), { status: 404 });
    }
    return typeof (device as any).toJSON === 'function' ? (device as any).toJSON() : device;
  }
}
