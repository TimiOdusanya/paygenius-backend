import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { listBanks, resolveAccount, resolveCardBin } from '../controllers/verifyController';

const router = Router();

router.use(authenticate);

router.get('/banks', listBanks);
router.get('/account', resolveAccount);
router.get('/card-bin/:bin', resolveCardBin);

export default router;
