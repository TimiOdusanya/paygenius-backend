import express from 'express';
import { HomeController } from '../controllers/homeController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

/**
 * @route   GET /api/home/dashboard
 * @desc    Get home dashboard data (account, budgets, transactions)
 * @access  Private
 */
router.get('/dashboard', authenticate, HomeController.getDashboard);
router.get('/transactions', authenticate, HomeController.getTransactions);
router.get('/analytics', authenticate, HomeController.getAnalytics);

export default router;

