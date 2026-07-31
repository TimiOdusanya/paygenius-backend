import { Router } from 'express';
import {
  setupProfile,
  verifyAddress,
  verifyIdentity,
  uploadSelfie,
  setupTransactionPin,
  enableBiometric,
  getUserProfile,
  checkUsername,
} from '../controllers/profileController';
import {
  validateProfileSetup,
  validateAddress,
  validateIdentityVerification,
  validateTransactionPin
} from '../middleware/validation';
import { authenticate } from '../middleware/auth';

const router = Router();

// All profile routes require authentication
router.use(authenticate);

// Profile setup routes
router.post('/setup', validateProfileSetup, setupProfile);
router.post('/verify-address', validateAddress, verifyAddress);
router.post('/verify-identity', validateIdentityVerification, verifyIdentity);
router.post('/upload-selfie', uploadSelfie);
router.post('/setup-pin', validateTransactionPin, setupTransactionPin);
router.post('/enable-biometric', enableBiometric);

// Get profile
router.get('/', getUserProfile);
router.get('/check-username', checkUsername);

export default router;
