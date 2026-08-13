import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getPayment,
  listBillers,
  listPlans,
  payBill,
  validateCustomer,
} from '../controllers/billController';

const router = Router();

router.use(authenticate);

router.get('/billers', listBillers);
router.get('/plans', listPlans);
router.post('/validate', validateCustomer);
router.post('/pay', payBill);
router.get('/:id', getPayment);

export default router;
