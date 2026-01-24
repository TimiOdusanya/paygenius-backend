import { Router } from 'express';
import { handlePaystackWebhook } from '../controllers/paystackWebhookController';

const router = Router();

// Paystack webhook endpoint
// Note: This endpoint should NOT use body-parser JSON middleware
// Paystack requires raw body for signature verification
router.post('/webhook', handlePaystackWebhook);

export default router;
