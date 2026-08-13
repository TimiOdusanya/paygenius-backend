import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getAbout,
  getContact,
  getFaqs,
  listChat,
  sendChat,
} from '../controllers/supportController';

const router = Router();

router.use(authenticate);

router.get('/faqs', getFaqs);
router.get('/about', getAbout);
router.get('/chat', listChat);
router.post('/chat', sendChat);
router.get('/contact', getContact);

export default router;
