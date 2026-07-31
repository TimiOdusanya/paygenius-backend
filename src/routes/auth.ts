import { Router } from 'express';
import {
    appleAuth,
    getCurrentUser,
    googleAuth,
    googleAuthCode,
    loginWithBiometric,
    loginWithPhone,
    registerWithPhone,
    sendPhoneVerification,
    verifyPhoneNumber
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import {
    validateLogin,
    validatePassword,
    validatePhoneNumber,
    validateVerificationCode
} from '../middleware/validation';

const router = Router();

// Phone verification routes
router.post('/send-verification', validatePhoneNumber, sendPhoneVerification);
router.post('/verify-phone', validateVerificationCode, verifyPhoneNumber);

// Registration routes
router.post('/register', validatePhoneNumber, validatePassword, registerWithPhone);

// Login routes
router.post('/login', validateLogin, loginWithPhone);
router.post('/login-biometric', validatePhoneNumber, loginWithBiometric);

// OAuth routes
router.post('/google', googleAuth);
router.post('/google-code', (req, res, next) => {
  console.log('📥 Route handler: POST /api/auth/google-code hit');
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);
  console.log('Request body keys:', Object.keys(req.body || {}));
  next();
}, googleAuthCode);
router.post('/apple', appleAuth);

// User routes
router.get('/me', authenticate, getCurrentUser);

export default router;
