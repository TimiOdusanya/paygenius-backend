import { NextFunction, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
    return;
  }
  
  next();
};

export const validatePhoneNumber = [
  body('phoneNumber')
    .isMobilePhone('any')
    .withMessage('Please provide a valid phone number'),
  handleValidationErrors
];

export const validateVerificationCode = [
  body('code')
    .isLength({ min: 4, max: 4 })
    .isNumeric()
    .withMessage('Verification code must be 4 digits'),
  handleValidationErrors
];

export const validatePassword = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  handleValidationErrors
];

export const validateProfileSetup = [
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be less than 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be less than 50 characters'),
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
  body('dateOfBirth')
    .isISO8601()
    .withMessage('Date of birth must be a valid date'),
  handleValidationErrors
];

export const validateAddress = [
  body('houseNumber')
    .trim()
    .isLength({ min: 1, max: 20 })
    .withMessage('House number is required'),
  body('streetName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Street name is required'),
  body('state')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('State is required'),
  body('localGovernmentArea')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Local government area is required'),
  handleValidationErrors
];

export const validateIdentityVerification = [
  body('type')
    .isIn(['BVN', 'NIN'])
    .withMessage('Identity type must be either BVN or NIN'),
  body('number')
    .trim()
    .custom((value, { req }) => {
      if (req.body.type === 'BVN') {
        // BVN must be 10-20 digits
        if (!/^\d{10,20}$/.test(value)) {
          throw new Error('BVN must be 10-20 digits');
        }
      } else if (req.body.type === 'NIN') {
        // VNIN must be exactly 16 characters: 2 letters + 12 digits + 2 letters
        if (!/^[A-Z]{2}\d{12}[A-Z]{2}$/i.test(value)) {
          throw new Error('VNIN must be 16 characters (e.g., AB012345678910YZ)');
        }
      }
      return true;
    }),
  body('phoneNumber')
    .custom((value, { req }) => {
      // Phone number is required only for BVN verification
      if (req.body.type === 'BVN') {
        if (!value) {
          throw new Error('Phone number is required for BVN verification');
        }
        // Validate it's a mobile phone
        const mobilePhoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!mobilePhoneRegex.test(value)) {
          throw new Error('Please provide a valid phone number');
        }
      }
      // For NIN (VNIN), phoneNumber is optional
      return true;
    }),
  handleValidationErrors
];

export const validateTransactionPin = [
  body('pin')
    .isLength({ min: 4, max: 6 })
    .isNumeric()
    .withMessage('Transaction PIN must be 4-6 digits'),
  body('confirmPin')
    .custom((value, { req }) => {
      if (value !== req.body.pin) {
        throw new Error('PIN confirmation does not match');
      }
      return true;
    }),
  handleValidationErrors
];

export const validateCreateBudget = [
  body('accountId')
    .notEmpty()
    .withMessage('Account ID is required')
    .isMongoId()
    .withMessage('Invalid account ID format'),
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Budget name is required and must be less than 100 characters'),
  body('category')
    .isIn(['GROCERIES', 'DATA', 'UTILITY', 'CLOTHES', 'GIFTS', 'TRAVEL', 'RENT', 'KIDS', 'OTHERS'])
    .withMessage('Invalid budget category'),
  body('totalAmount')
    .isFloat({ min: 0.01 })
    .withMessage('Total amount must be greater than 0'),
  body('period')
    .isIn(['WEEKLY', 'MONTHLY'])
    .withMessage('Period must be either WEEKLY or MONTHLY'),
  body('selectedDate')
    .optional()
    .isString()
    .withMessage('Selected date must be a string'),
  handleValidationErrors
];
