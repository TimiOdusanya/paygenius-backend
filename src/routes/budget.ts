import { Router } from 'express';
import { createBudget, getUserBudgets } from '../controllers/budgetController';
import { authenticate } from '../middleware/auth';
import { validateCreateBudget } from '../middleware/validation';

const router = Router();

// All budget routes require authentication
router.use(authenticate);

// Create a new budget
router.post('/', validateCreateBudget, createBudget);

// Get user budgets
router.get('/', getUserBudgets);

export default router;
