# PayGenius Backend API

A comprehensive fintech backend API built with Node.js, TypeScript, and Express.js. PayGenius provides secure authentication, wallet management, budget tracking, payment processing, and identity verification services.

## 🚀 Features

### Authentication & Security
- **Phone Number Authentication**: SMS-based verification using Twilio
- **OAuth Integration**: Google and Apple Sign-In support
- **Biometric Authentication**: Secure biometric login support
- **JWT Token Management**: Secure token-based authentication
- **Transaction PIN**: Additional security layer for financial operations
- **Rate Limiting**: Protection against brute force attacks
- **Helmet Security**: HTTP security headers

### Wallet & Payments
- **Digital Wallet**: Create and manage user wallets
- **Paystack Integration**: Seamless payment processing
- **Virtual Accounts**: Generate virtual bank accounts
- **Transaction History**: Track all financial transactions
- **Webhook Support**: Real-time payment event handling

### Budget Management
- **Budget Creation**: Create and manage personal budgets
- **Budget Tracking**: Monitor spending against budgets
- **Budget Analytics**: Get insights into budget performance

### Identity Verification
- **BVN Verification**: Bank Verification Number validation
- **NIN Verification**: National Identification Number validation
- **Address Verification**: Physical address confirmation
- **Selfie Upload**: Identity document verification
- **Multi-Provider Support**: Dojah, Mono, and Youverify integration

### User Profile
- **Profile Management**: Complete user profile setup
- **Profile Verification**: Multi-step KYC process
- **Dashboard**: Comprehensive user dashboard with account overview

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT, Google OAuth, Apple Sign-In
- **SMS**: Twilio
- **Payments**: Paystack
- **Email**: Mailjet
- **Security**: Helmet, CORS, Rate Limiting
- **Logging**: Winston, Morgan
- **Validation**: Express Validator

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **MongoDB** (local or Atlas connection string)
- **TypeScript** (installed as dev dependency)

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd paygenius-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` and fill in all required configuration values (see [Environment Variables](#-environment-variables) section).

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

   Or use the startup script:
   ```bash
   chmod +x start.sh
   ./start.sh
   ```

The API will be available at `http://localhost:5000` (or your configured PORT).

## 🔐 Environment Variables

Create a `.env` file in the root directory with the following variables:

### Required Variables

```env
# Database
MONGODB_URI=mongo-uri

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development

# CORS
FRONTEND_URL=http://localhost:8081
```

### Optional Variables

```env
# Twilio SMS (for phone verification)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number

# Google OAuth
GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-web-client-secret

# Apple OAuth
APPLE_CLIENT_ID=your-apple-client-id
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY=your-apple-private-key

# Mailjet (for emails)
MAILJET_API_KEY=your-mailjet-api-key
MAILJET_API_SECRET=your-mailjet-api-secret

# Paystack (for payments)
PAYSTACK_SECRET_KEY=your-paystack-secret-key
PAYSTACK_PUBLIC_KEY=your-paystack-public-key
PAYSTACK_BASE_URL=https://api.paystack.co

# Identity Verification (Dojah/Mono/Youverify)
VERIFICATION_PROVIDER=dojah
VERIFICATION_API_KEY=your-verification-api-key
VERIFICATION_API_URL=https://api.dojah.io
DOJAH_APP_ID=your-dojah-app-id
```

See `env.example` for a complete template with detailed descriptions.

## 📜 Available Scripts

- `npm run dev` - Start development server with hot reload (nodemon)
- `npm run build` - Build TypeScript to JavaScript
- `npm run build:watch` - Watch mode for building
- `npm start` - Start production server (requires build first)

## 📡 API Endpoints

### Health Check
- `GET /health` - API health status

### Authentication (`/api/auth`)
- `POST /api/auth/send-verification` - Send phone verification code
- `POST /api/auth/verify-phone` - Verify phone number
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with phone number
- `POST /api/auth/login-biometric` - Login with biometric
- `POST /api/auth/google` - Google OAuth authentication
- `POST /api/auth/google-code` - Google OAuth with code
- `POST /api/auth/apple` - Apple Sign-In
- `GET /api/auth/me` - Get current user (protected)

### Profile (`/api/profile`)
- `GET /api/profile` - Get user profile (protected)
- `POST /api/profile/setup` - Setup user profile (protected)
- `POST /api/profile/verify-identity` - Verify BVN/NIN (protected)
- `POST /api/profile/verify-address` - Verify address (protected)
- `POST /api/profile/upload-selfie` - Upload selfie for verification (protected)
- `POST /api/profile/setup-pin` - Setup transaction PIN (protected)
- `POST /api/profile/enable-biometric` - Enable biometric auth (protected)

### Wallet (`/api/wallet`)
- `GET /api/wallet` - Get user wallet (protected)

### Budget (`/api/budget`)
- `GET /api/budget` - Get user budgets (protected)
- `POST /api/budget` - Create new budget (protected)

### Home Dashboard (`/api/home`)
- `GET /api/home/dashboard` - Get dashboard data (protected)

### Paystack Webhook (`/api/paystack`)
- `POST /api/paystack/webhook` - Paystack webhook endpoint

## 📁 Project Structure

```
paygenius-backend/
├── src/
│   ├── controllers/      # Request handlers
│   │   ├── authController.ts
│   │   ├── profileController.ts
│   │   ├── walletController.ts
│   │   ├── budgetController.ts
│   │   ├── homeController.ts
│   │   └── paystackWebhookController.ts
│   ├── services/         # Business logic
│   │   ├── smsService.ts
│   │   ├── googleAuthService.ts
│   │   ├── walletService.ts
│   │   ├── paystackService.ts
│   │   ├── budgetService.ts
│   │   └── identityVerificationService.ts
│   ├── models/           # Mongoose models
│   │   ├── User.ts
│   │   ├── Wallet.ts
│   │   ├── Transaction.ts
│   │   ├── Budget.ts
│   │   └── Account.ts
│   ├── routes/           # API routes
│   │   ├── auth.ts
│   │   ├── profile.ts
│   │   ├── wallet.ts
│   │   ├── budget.ts
│   │   ├── home.ts
│   │   └── paystack.ts
│   ├── middleware/       # Express middleware
│   │   ├── auth.ts
│   │   └── validation.ts
│   ├── utils/            # Utility functions
│   │   ├── jwt.ts
│   │   ├── enums.ts
│   │   └── phoneNumber.ts
│   ├── lib/              # Third-party integrations
│   │   └── log/
│   │       ├── winston.log.ts
│   │       └── morgan.log.ts
│   ├── db/               # Database configuration
│   │   └── db.ts
│   ├── types/            # TypeScript type definitions
│   │   └── index.ts
│   └── index.ts          # Application entry point
├── dist/                 # Compiled JavaScript (generated)
├── logs/                 # Application logs
├── .env                  # Environment variables (not in git)
├── .gitignore
├── env.example           # Environment variables template
├── package.json
├── tsconfig.json
├── nodemon.json
├── start.sh              # Startup script
└── README.md
```

## 🔒 Security Features

- **Helmet.js**: Sets various HTTP headers for security
- **CORS**: Configurable Cross-Origin Resource Sharing
- **Rate Limiting**: Prevents abuse and DDoS attacks
- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcryptjs for password encryption
- **Input Validation**: Express Validator for request validation
- **Environment Variables**: Sensitive data stored securely
- **HTTPS Enforcement**: Configurable in production

## 🧪 Development

### Running in Development Mode

```bash
npm run dev
```

This starts the server with:
- Hot reload via nodemon
- TypeScript compilation on the fly
- Detailed error messages
- Request logging

### Building for Production

```bash
npm run build
npm start
```

## 📝 Logging

The application uses Winston for structured logging and Morgan for HTTP request logging. Logs are written to:
- Console (development)
- `logs/all-logs.log` (file)

## 🔄 Webhooks

### Paystack Webhook

The Paystack webhook endpoint (`/api/paystack/webhook`) handles payment events:
- Transaction success/failure
- Transfer events
- Virtual account events

**Important**: The webhook endpoint uses raw body parsing for signature verification. Do not modify the middleware order.

## 🌍 CORS Configuration

The API is configured to work with:
- React Native/Expo apps (development)
- Web applications (production)
- Mobile apps without traditional origins

In development, all origins are allowed. In production, configure `FRONTEND_URL` in your `.env` file.

## 🐛 Error Handling

The API uses a centralized error handling middleware that:
- Logs errors to Winston
- Returns consistent error responses
- Includes stack traces in development mode
- Handles uncaught exceptions and unhandled rejections

## 📚 Additional Documentation

- [Identity Verification Setup](./IDENTITY_VERIFICATION_SETUP.md) - Guide for setting up BVN/NIN verification


---

**Note**: Make sure to never commit your `.env` file or expose sensitive credentials. Always use `env.example` as a template for required environment variables.
