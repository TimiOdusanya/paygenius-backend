import mongoose, { Document, Schema } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { IUser, IUserDocument } from '../types';

const UserSchema = new Schema<IUserDocument>({
  phoneNumber: {
    type: String,
    required: function(this: IUserDocument) {
      // Phone number is required only if user doesn't have Google or Apple ID
      return !this.googleId && !this.appleId;
    },
    unique: true,
    sparse: true, // Allows multiple null/undefined values
    trim: true,
    match: /^\+?[1-9]\d{1,14}$/
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  password: {
    type: String,
    minlength: 8,
    select: false
  },
  firstName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: 50
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: /^[a-zA-Z0-9_]+$/
  },
  dateOfBirth: {
    type: Date,
    validate: {
      validator: function(date: Date) {
        return date < new Date() && date > new Date('1900-01-01');
      },
      message: 'Date of birth must be valid and before today'
    }
  },
  profilePicture: {
    type: String,
    trim: true
  },
  address: {
    houseNumber: {
      type: String,
      trim: true,
      maxlength: 20
    },
    streetName: {
      type: String,
      trim: true,
      maxlength: 100
    },
    city: {
      type: String,
      trim: true,
      maxlength: 100
    },
    state: {
      type: String,
      trim: true,
      maxlength: 50
    },
    localGovernmentArea: {
      type: String,
      trim: true,
      maxlength: 50
    }
  },
  identityVerification: {
    type: {
      type: String,
      enum: ['BVN', 'NIN'],
      required: false
    },
    number: {
      type: String,
      trim: true,
      maxlength: 20
    },
    verified: {
      type: Boolean,
      default: false
    },
    verifiedAt: {
      type: Date
    }
  },
  selfieImages: [{
    type: String,
    trim: true
  }],
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isProfileComplete: {
    type: Boolean,
    default: false
  },
  isIdentityVerified: {
    type: Boolean,
    default: false
  },
  isAddressVerified: {
    type: Boolean,
    default: false
  },
  isBiometricSetup: {
    type: Boolean,
    default: false
  },
  setTransactionPin: {
    type: Boolean,
    default: false
  },
  transactionPin: {
    type: String,
    select: false
  },
  biometricEnabled: {
    type: Boolean,
    default: false
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  appleId: {
    type: String,
    unique: true,
    sparse: true
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true
  },
  referredBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  dailySpendLimit: {
    type: Number,
    default: 500000,
    min: 0
  },
  dailyTransferLimit: {
    type: Number,
    default: 200000,
    min: 0
  },
  faceIdEnabled: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  deactivatedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.transactionPin;
      delete (ret as any).__v;
      return ret;
    }
  }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Hash transaction PIN before saving (create / save)
UserSchema.pre('save', async function(next) {
  if (!this.isModified('transactionPin') || !this.transactionPin) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.transactionPin = await bcrypt.hash(this.transactionPin, salt);
    // Ensure the flag is set whenever a PIN is set or changed
    (this as any).setTransactionPin = true;
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Hash transaction PIN on findOneAndUpdate (e.g. findByIdAndUpdate)
UserSchema.pre('findOneAndUpdate', async function(next) {
  const update: any = this.getUpdate();

  if (!update) {
    return next();
  }

  // Support both direct `transactionPin` and `$set.transactionPin`
  const pin =
    update.transactionPin ??
    (update.$set && update.$set.transactionPin);

  if (!pin) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(pin, salt);

    if (update.transactionPin) {
      update.transactionPin = hashed;
    }
    if (update.$set && update.$set.transactionPin) {
      update.$set.transactionPin = hashed;
    }

    // Ensure the flag is set when updating PIN
    if (update.$set) {
      update.$set.setTransactionPin = true;
    } else {
      update.setTransactionPin = true;
    }

    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Hash password method
UserSchema.methods.hashPassword = async function(): Promise<void> {
  if (this.password) {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
  }
};

export default mongoose.model<IUserDocument>('User', UserSchema);
