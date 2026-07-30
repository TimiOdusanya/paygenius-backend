import twilio from 'twilio';
import { CountryCode } from 'libphonenumber-js';
import { formatPhoneNumberForTwilio } from '../utils/phoneNumber';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const defaultCountryCode = (process.env.DEFAULT_COUNTRY_CODE || 'NG') as CountryCode;

if (!accountSid || !authToken || !twilioPhoneNumber) {
  console.warn('Twilio credentials not found. SMS service will be disabled.');
}

// Use Twilio whenever credentials are present (including development)
const client =
  accountSid &&
  authToken &&
  !accountSid.startsWith('your-') &&
  accountSid.startsWith('AC')
    ? twilio(accountSid, authToken)
    : null;

/** Best-effort E.164 for Twilio when libphonenumber rejects a valid-looking number */
const toE164 = (phoneNumber: string): string | null => {
  const formatted = formatPhoneNumberForTwilio(phoneNumber, defaultCountryCode);
  if (formatted) return formatted;

  const cleaned = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(cleaned)) {
    console.warn(
      `[SMS Service] libphonenumber rejected ${cleaned}; sending as-is (E.164 shape)`
    );
    return cleaned;
  }
  return null;
};

export const sendVerificationCode = async (
  phoneNumber: string,
  code: string
): Promise<boolean> => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[SMS Service] Verification code for ${phoneNumber}: ${code}`);
    return true;
  }

  if (!client || !twilioPhoneNumber) {
    console.warn('[SMS Service] Twilio not configured — code logged only, SMS not sent');
    return true;
  }

  const formattedPhoneNumber = toE164(phoneNumber);
  if (!formattedPhoneNumber) {
    console.error(`Invalid phone number format: ${phoneNumber}`);
    return false;
  }

  try {
    const message = await client.messages.create({
      body: `Your PayGenius verification code is: ${code}. This code expires in 5 minutes.`,
      from: twilioPhoneNumber,
      to: formattedPhoneNumber,
    });

    console.log(`SMS sent successfully to ${formattedPhoneNumber}: ${message.sid}`);
    return true;
  } catch (error) {
    console.error('Error sending SMS:', error);
    // Still allow the flow in development so OTP can be tested from logs
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[SMS Service] Twilio send failed — using logged code for development');
      return true;
    }
    return false;
  }
};

export const sendWelcomeMessage = async (
  phoneNumber: string,
  firstName: string
): Promise<boolean> => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[SMS Service] Welcome message for ${firstName} (${phoneNumber})`);
    return true;
  }

  const formattedPhoneNumber = toE164(phoneNumber);

  if (!formattedPhoneNumber) {
    console.error(`Invalid phone number format: ${phoneNumber}`);
    return false;
  }

  if (!client || !twilioPhoneNumber) {
    console.log(`[SMS Service] Welcome message for ${firstName} (${formattedPhoneNumber})`);
    return true;
  }

  try {
    const message = await client.messages.create({
      body: `Welcome to PayGenius, ${firstName}! Your account has been successfully created!.`,
      from: twilioPhoneNumber,
      to: formattedPhoneNumber,
    });

    console.log(`Welcome SMS sent successfully: ${message.sid}`);
    return true;
  } catch (error) {
    console.error('Error sending welcome SMS:', error);
    return process.env.NODE_ENV !== 'production';
  }
};
