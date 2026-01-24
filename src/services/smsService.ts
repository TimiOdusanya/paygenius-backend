import twilio from 'twilio';
import { CountryCode } from 'libphonenumber-js';
import { formatPhoneNumberForTwilio } from '../utils/phoneNumber';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE as CountryCode | undefined;

if (!accountSid || !authToken || !twilioPhoneNumber) {
  console.warn('Twilio credentials not found. SMS service will be disabled.');
}

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export const sendVerificationCode = async (phoneNumber: string, code: string): Promise<boolean> => {

  console.log('accountSid', accountSid);
console.log('authToken', authToken);
console.log('twilioPhoneNumber', twilioPhoneNumber);

  
  // Format phone number for Twilio (E.164 format)
  const formattedPhoneNumber = formatPhoneNumberForTwilio(phoneNumber, defaultCountryCode);

  console.log('phoneNumber', phoneNumber);
  console.log('code', code);
  console.log('formattedPhoneNumber', formattedPhoneNumber);
  
  if (!formattedPhoneNumber) {
    console.error(`Invalid phone number format: ${phoneNumber}`);
    return false;
  }
  
  console.log('formattedPhoneNumber', formattedPhoneNumber);
  
  if (!client) {
    console.log(`[SMS Service] Verification code for ${formattedPhoneNumber}: ${code}`);
    return true; // Return true for development
  }

  try {
    const message = await client.messages.create({
      body: `Your PayGenius verification code is: ${code}. This code expires in 5 minutes.`,
      from: twilioPhoneNumber,
      to: formattedPhoneNumber
    });

    console.log(`SMS sent successfully: ${message.sid}`);
    return true;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
};

export const sendWelcomeMessage = async (phoneNumber: string, firstName: string): Promise<boolean> => {
  // Format phone number for Twilio (E.164 format)
  const formattedPhoneNumber = formatPhoneNumberForTwilio(phoneNumber, defaultCountryCode);
  
  if (!formattedPhoneNumber) {
    console.error(`Invalid phone number format: ${phoneNumber}`);
    return false;
  }
  
  if (!client) {
    console.log(`[SMS Service] Welcome message for ${firstName} (${formattedPhoneNumber})`);
    return true;
  }

  try {
    const message = await client.messages.create({
      body: `Welcome to PayGenius, ${firstName}! Your account has been successfully created!.`,
      from: twilioPhoneNumber,
      to: formattedPhoneNumber
    });

    console.log(`Welcome SMS sent successfully: ${message.sid}`);
    return true;
  } catch (error) {
    console.error('Error sending welcome SMS:', error);
    return false;
  }
};
