import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getLoan,
  linkLoan,
  listLoans,
  listProviders,
  updateLoan,
} from '../controllers/loanController';

const router = Router();

router.use(authenticate);

router.get('/providers', listProviders);
router.get('/', listLoans);
router.post('/', linkLoan);
router.get('/:id', getLoan);
router.patch('/:id', updateLoan);

export default router;
