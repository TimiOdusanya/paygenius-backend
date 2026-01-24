import { parsePhoneNumber, isValidPhoneNumber, CountryCode } from 'libphonenumber-js';

/**
 * Formats a phone number to E.164 format (required by Twilio)
 * @param phoneNumber - The phone number to format (can be in any format)
 * @param defaultCountry - Optional default country code (e.g., 'NG' for Nigeria, 'US' for USA)
 * @returns Formatted phone number in E.164 format (e.g., +2341234567890) or null if invalid
 */
export const formatPhoneNumberForTwilio = (
  phoneNumber: string,
  defaultCountry?: CountryCode
): string | null => {
  try {
    // Remove any whitespace, dashes, parentheses, etc.
    const cleaned = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');

    // If already in E.164 format, validate and return
    if (cleaned.startsWith('+')) {
      if (isValidPhoneNumber(cleaned)) {
        const parsed = parsePhoneNumber(cleaned);
        return parsed.format('E.164');
      }
      return null;
    }

    // Try adding + prefix first (for numbers already in international format like 2348146414524)
    const withPlus = `+${cleaned}`;
    if (isValidPhoneNumber(withPlus)) {
      const parsed = parsePhoneNumber(withPlus);
      return parsed.format('E.164');
    }

    // Try to parse with default country if provided (for local numbers like 08146414524)
    if (defaultCountry) {
      if (isValidPhoneNumber(cleaned, defaultCountry)) {
        const parsed = parsePhoneNumber(cleaned, defaultCountry);
        return parsed.format('E.164');
      }
    }

    return null;
  } catch (error) {
    console.error('Error formatting phone number:', error);
    return null;
  }
};

/**
 * Validates if a phone number is valid
 * @param phoneNumber - The phone number to validate
 * @param defaultCountry - Optional default country code
 * @returns true if valid, false otherwise
 */
export const isValidPhone = (
  phoneNumber: string,
  defaultCountry?: CountryCode
): boolean => {
  try {
    const cleaned = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');
    return isValidPhoneNumber(cleaned, defaultCountry);
  } catch {
    return false;
  }
};

/**
 * Formats a phone number for display (e.g., +234 123 456 7890)
 * @param phoneNumber - The phone number to format
 * @param defaultCountry - Optional default country code
 * @returns Formatted phone number for display or null if invalid
 */
export const formatPhoneNumberForDisplay = (
  phoneNumber: string,
  defaultCountry?: CountryCode
): string | null => {
  try {
    const formatted = formatPhoneNumberForTwilio(phoneNumber, defaultCountry);
    if (!formatted) return null;

    const parsed = parsePhoneNumber(formatted);
    return parsed.formatInternational();
  } catch {
    return null;
  }
};

