import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  addCard,
  createGoal,
  deleteCard,
  depositGoal,
  getGoal,
  listCards,
  listGoals,
  updateGoal,
} from '../controllers/savingsController';

const router = Router();

router.use(authenticate);

router.get('/', listGoals);
router.post('/', createGoal);
router.get('/cards', listCards);
router.post('/cards', addCard);
router.delete('/cards/:id', deleteCard);
router.get('/:id', getGoal);
router.patch('/:id', updateGoal);
router.post('/:id/deposit', depositGoal);

export default router;
