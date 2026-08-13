import SupportMessage from '../models/SupportMessage';
import AppReview from '../models/AppReview';

export const FAQS = [
  {
    id: 'wallet-fund',
    question: 'How do I fund my PayGenius wallet?',
    answer:
      'Open Wallet and copy your PayGenius virtual account number. Transfer from any Nigerian bank to that account. Incoming transfers are credited automatically, usually within a few minutes.',
  },
  {
    id: 'pay-bills',
    question: 'How do I buy airtime, data, or pay electricity and TV bills?',
    answer:
      'Go to Pay Bills, choose Airtime, Data, Electricity, or Television, pick your provider, enter the phone, meter, or smartcard number, then confirm with your 4-digit PIN or biometrics. Payments debit your wallet or a selected budget.',
  },
  {
    id: 'transaction-pin',
    question: 'What is my transaction PIN and how do I change it?',
    answer:
      'Your 4-digit PIN authorizes bill payments and other money-out actions. Set it during security setup. To change it later, open Settings and use Change PIN. You will need your current PIN. Never share it with anyone, including support.',
  },
  {
    id: 'kyc',
    question: 'Why do I need to complete KYC (BVN/NIN, selfie, and address)?',
    answer:
      'Nigerian regulations require identity verification before we can keep your wallet active and raise limits. Complete BVN or NIN, a live selfie, and your residential address in Profile. This also helps recover your account if you lose access.',
  },
  {
    id: 'cards',
    question: 'How do I add a debit card?',
    answer:
      'Open Wallet or Savings and choose Add debit card. Enter the card number, expiry, and CVV. We verify the card through Paystack. Your full card number is not stored on PayGenius devices.',
  },
  {
    id: 'failed-payment',
    question: 'A bill payment failed but my wallet was debited. What should I do?',
    answer:
      'Open the receipt from Bills or Transactions and note the reference. If the provider did not deliver airtime, data, or a token, contact support with the reference. Pending payments are retried automatically; failed ones are reversed to your wallet.',
  },
  {
    id: 'limits',
    question: 'What are my daily spend and transfer limits?',
    answer:
      'New accounts start with a ₦500,000 daily spend limit and a ₦200,000 daily transfer limit. You can review or adjust these in Settings after KYC. Limits protect your account if a device is lost or stolen.',
  },
  {
    id: 'face-id',
    question: 'How do I turn on Face ID or fingerprint?',
    answer:
      'Enable biometrics in Settings after you have set a transaction PIN. Face ID or fingerprint can then confirm payments on this device. You can turn this off anytime from Settings.',
  },
  {
    id: 'referrals',
    question: 'How do referrals work?',
    answer:
      'Share your unique referral code from Settings. When a friend signs up with your code and completes verification, you both receive ₦5,000. The reward is credited to your PayGenius wallet.',
  },
  {
    id: 'delete-account',
    question: 'How do I delete my account?',
    answer:
      'Go to Settings and choose Delete account. If you signed up with a password, you will need to confirm it. Deletion is permanent: your phone and email are released so they can be used on a new account.',
  },
];

export const ABOUT = {
  appName: 'PayGenius',
  version: '1.0.0',
  email: 'paygenius@gmail.com',
  phone: '+2348000000000',
  legal: {
    terms:
      'By using PayGenius you agree to use the wallet, bill payments, savings, and related services lawfully. You are responsible for keeping your PIN, password, and device secure. PayGenius may suspend accounts that fail KYC, show suspected fraud, or violate these terms.',
    privacy:
      'We collect the information needed to create your account, verify your identity, process payments, and keep your wallet secure. We do not sell your personal data. Transaction and device details may be shared with licensed partners such as Paystack and VTpass only to complete a request you initiated.',
  },
};

const SUPPORT_REPLIES: Record<string, string> = {
  failed_transaction:
    'Sorry the payment did not go through. Please send the transaction reference from your receipt. If the provider did not deliver, we will retry or reverse the debit to your PayGenius wallet.',
  card_request:
    'You can add a debit card from Wallet or Savings. If a card request is still pending, confirm the card details and that your bank allows online payments. Tell us the last 4 digits if you need us to check it.',
  account_issue:
    'We can help with login, KYC, or profile issues. Confirm the phone or email on the account and describe what you see. Do not share your PIN or OTP with anyone, including people claiming to be support.',
  esims:
    'eSIM purchases are not available in PayGenius yet. You can buy airtime and mobile data for MTN, Airtel, Glo, and 9mobile from Pay Bills.',
  overdraft:
    'PayGenius does not offer overdrafts. Spend is limited to your wallet or budget balance. If a debit failed for insufficient funds, fund your virtual account and try again.',
  gift_cards:
    'Gift cards are not sold in the app today. You can still pay bills, save toward a goal, or move money from your funded wallet.',
  savings:
    'Open Save to create a goal, set how much to put aside, and choose PayGenius wallet or a linked card. You can track progress and share a goal from the savings hub.',
  invest:
    'Investment products are not live yet. For now you can use Savings goals and keep funds in your PayGenius wallet while we expand those features.',
  general:
    'Thanks for reaching out. Tell us a bit more about what you need — a failed payment, KYC, PIN, card, or something else — and we will point you to the next step.',
};

function replyForTopic(topic?: string) {
  const key = String(topic ?? 'general').trim().toLowerCase();
  return SUPPORT_REPLIES[key] || SUPPORT_REPLIES.general;
}

function toJson(doc: any) {
  return typeof doc?.toJSON === 'function' ? doc.toJSON() : doc;
}

export class SupportService {
  static getFaqs() {
    return FAQS;
  }

  static getAbout() {
    return ABOUT;
  }

  static getContact() {
    return { email: ABOUT.email, phone: ABOUT.phone };
  }

  static async listChat(userId: string) {
    const messages = await SupportMessage.find({ userId }).sort({ createdAt: 1 });
    return messages.map(toJson);
  }

  static async sendChat(userId: string, body: string, topic?: string) {
    const text = String(body ?? '').trim();
    if (!text) {
      throw Object.assign(new Error('Message body is required'), { status: 400 });
    }

    const userMessage = await SupportMessage.create({
      userId,
      role: 'user',
      topic,
      body: text,
    });

    const supportMessage = await SupportMessage.create({
      userId,
      role: 'support',
      topic,
      body: replyForTopic(topic),
    });

    return {
      userMessage: toJson(userMessage),
      supportMessage: toJson(supportMessage),
    };
  }

  static async submitReview(
    userId: string,
    input: { rating: number; review?: string; enjoyed?: boolean }
  ) {
    const rating = Number(input.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw Object.assign(new Error('Rating must be a number from 1 to 5'), { status: 400 });
    }

    const review = await AppReview.create({
      userId,
      rating,
      review: input.review?.trim() || undefined,
      enjoyed: typeof input.enjoyed === 'boolean' ? input.enjoyed : undefined,
    });
    return toJson(review);
  }
}
