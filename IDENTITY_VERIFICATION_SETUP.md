# Identity Verification Setup Guide

## Overview
PayGenius uses third-party services to verify BVN (Bank Verification Number) and NIN (National Identification Number) for Nigerian users.

## Supported Providers

### 1. **Dojah** (Recommended)
- Website: https://dojah.io
- Pricing: Pay-as-you-go
- Features: BVN, NIN, Phone, Address verification
- Setup:
  1. Sign up at https://dojah.io
  2. Get API key and App ID from dashboard
  3. Add to `.env`:
     ```
     VERIFICATION_PROVIDER=dojah
     VERIFICATION_API_KEY=your_dojah_api_key
     VERIFICATION_API_URL=https://api.dojah.io
     DOJAH_APP_ID=your_app_id
     ```

### 2. **Youverify**
- Website: https://youverify.co
- Pricing: Enterprise plans
- Features: Comprehensive KYC services
- Setup:
  1. Sign up at https://youverify.co
  2. Get API token from dashboard
  3. Add to `.env`:
     ```
     VERIFICATION_PROVIDER=youverify
     VERIFICATION_API_KEY=your_youverify_token
     VERIFICATION_API_URL=https://api.youverify.co
     ```

### 3. **Mono**
- Website: https://mono.co
- Pricing: Pay-as-you-go
- Features: BVN verification, bank data access
- Setup:
  1. Sign up at https://mono.co
  2. Get secret key from dashboard
  3. Add to `.env`:
     ```
     VERIFICATION_PROVIDER=mono
     VERIFICATION_API_KEY=your_mono_secret_key
     VERIFICATION_API_URL=https://api.withmono.com
     ```

## Development Mode

In development (`NODE_ENV=development`), the service uses mock verification:
- **BVN**: Any 11-digit number passes
- **NIN**: Any 11-digit number passes
- Phone number matching is simulated

## Production Setup

1. Choose a provider (Dojah recommended for startups)
2. Sign up and get API credentials
3. Add credentials to `.env` file
4. Set `NODE_ENV=production`
5. Test with real BVN/NIN numbers

## API Endpoints

### Verify BVN
```typescript
POST /api/profile/verify-identity
{
  "type": "BVN",
  "number": "22123456789",
  "phoneNumber": "2348012345678"
}
```

### Verify NIN
```typescript
POST /api/profile/verify-identity
{
  "type": "NIN",
  "number": "12345678901",
  "phoneNumber": ""
}
```

## Response
```typescript
{
  "success": true,
  "message": "Identity verified successfully",
  "data": {
    "user": {
      "identityVerification": {
        "type": "BVN",
        "number": "22123456789",
        "verified": true
      },
      "isIdentityVerified": true
    }
  }
}
```

## Security Notes

1. **Never log or store full BVN/NIN** in plain text logs
2. **Encrypt sensitive data** in database
3. **Use HTTPS** for all API calls
4. **Rate limit** verification endpoints
5. **Audit log** all verification attempts

## Cost Estimation

- **Dojah**: ₦50-100 per verification
- **Youverify**: Contact for pricing
- **Mono**: ₦100-150 per verification

## Testing

Use these test numbers in development:
- **BVN**: `22334455667` with phone `2348012345678`
- **NIN**: `12345678901`

## Support

For integration issues:
- Dojah: support@dojah.io
- Youverify: support@youverify.co
- Mono: hello@mono.co

