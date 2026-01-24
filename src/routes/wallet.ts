import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getWallet } from '../controllers/walletController';

const router = Router();

// All wallet routes require authentication
router.use(authenticate);

// Get current user's wallet
router.get('/', getWallet);

export default router;
