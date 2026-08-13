import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import connectDB from './db/db';
import logger from './lib/log/winston.log';
import httpLogger from './lib/log/morgan.log';
import { initSocket } from './services/socketService';

// Import routes
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import homeRoutes from './routes/home';
import budgetRoutes from './routes/budget';
import walletRoutes from './routes/wallet';
import paystackRoutes from './routes/paystack';
import genieRoutes from './routes/genie';
import savingsRoutes from './routes/savings';
import loanRoutes from './routes/loans';
import billRoutes from './routes/bills';
import verifyRoutes from './routes/verify';
import notificationRoutes from './routes/notifications';
import settingsRoutes from './routes/settings';
import supportRoutes from './routes/support';
import transferRoutes from './routes/transfer';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Security middleware
// Configure helmet to work better with React Native/Expo
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
// For React Native/Expo, allow all origins in development
// React Native apps don't have a traditional "origin" like web browsers
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // In development, allow all origins for React Native
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // In production, only allow specific origins
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'https://your-production-frontend.com',
    ].filter(Boolean);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Authorization'],
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});

app.use(limiter);

// Paystack webhook route (needs raw body for signature verification)
// Must be before JSON body parser
app.post('/api/paystack/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Keep raw body for signature verification, but also parse for handler
    const rawBody = req.body.toString('utf8');
    const parsedBody = JSON.parse(rawBody);
    
    // Store both raw and parsed
    (req as any).rawBody = rawBody;
    req.body = parsedBody;
    
    // Import and call the webhook handler
    const { handlePaystackWebhook } = await import('./controllers/paystackWebhookController');
    await handlePaystackWebhook(req, res);
  } catch (error) {
    logger.error('Error in Paystack webhook route:', error);
    res.status(200).json({ success: false, message: 'Webhook processing error' });
  }
});

// Body parsing middleware
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// Disable ETags for dynamic API endpoints (prevents 304 Not Modified)
// ETags are useful for static resources but problematic for dynamic API data
app.set('etag', false);

// Disable caching for API routes only (not static resources)
// This ensures fresh data for dynamic endpoints like budgets, transactions, etc.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Logging middleware
app.use(httpLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'PayGenius API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/genie', genieRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/loans', loanRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/transfers', transferRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Global error handler:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const port = PORT;

initSocket(server);

server.listen(port, async () => {
  logger.info(`🚀 PayGenius API server running on port ${port}`);
  logger.info(`📱 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:8081'}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  try {
    await connectDB();
  } catch (error) {
    logger.error("Database connection failed. Exiting...");
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('There was an uncaught error', err);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
});

export default app;
