import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { GenieController } from '../controllers/genieController';

const router = Router();

router.use(authenticate);

router.get('/profile', GenieController.getProfile);
router.put('/profile', GenieController.saveProfile);
router.get('/chats', GenieController.listChats);
router.post('/chats', GenieController.createChat);
router.get('/chats/:id', GenieController.getChat);
router.post('/chats/:id/messages', GenieController.sendMessage);

export default router;
