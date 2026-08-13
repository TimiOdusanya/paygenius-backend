import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  deleteNotification,
  getPreferences,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  registerDevice,
  unregisterDevice,
  updatePreferences,
} from '../controllers/notificationController';

const router = Router();

router.use(authenticate);

router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.get('/preferences', getPreferences);
router.patch('/preferences', updatePreferences);
router.post('/read-all', markAllNotificationsRead);
router.post('/devices', registerDevice);
router.delete('/devices', unregisterDevice);
router.patch('/:id/read', markNotificationRead);
router.delete('/:id', deleteNotification);

export default router;
