import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  changePassword,
  changePin,
  deactivateAccount,
  deleteAccount,
  getReferrals,
  getSettings,
  setBiometric,
  submitReview,
  updateSettings,
} from '../controllers/settingsController';

const router = Router();

router.use(authenticate);

router.get('/', getSettings);
router.patch('/', updateSettings);
router.post('/change-password', changePassword);
router.post('/change-pin', changePin);
router.post('/biometric', setBiometric);
router.post('/account/deactivate', deactivateAccount);
router.delete('/account', deleteAccount);
router.get('/referrals', getReferrals);
router.post('/rate', submitReview);

export default router;
