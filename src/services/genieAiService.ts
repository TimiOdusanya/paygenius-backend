import axios from 'axios';
import User from '../models/User';
import { IGenieMessage } from '../models/GenieChat';
import GenieProfile, { IGenieProfile as Profile } from '../models/GenieProfile';
import { TransactionService } from './transactionService';
import { BudgetService } from './budgetService';
import { WalletService } from './walletService';
import { SavingsService } from './savingsService';
import { LoanService } from './loanService';
import logger from '../lib/log/winston.log';

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const DEFAULT_BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

function formatMoney(amount: number, currency = 'NGN'): string {
  const symbol = currency === 'USD' ? '$' : '₦';
  return `${symbol}${Number(amount || 0).toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function peekAllowed(profile?: Profile | null): boolean {
  const raw = String((profile as any)?.allowPeek ?? '').toLowerCase();
  if (!raw) return true;
  return !/(no|never|don't|do not|off|false)/.test(raw);
}

export type MoneySnapshot = {
  firstName: string;
  peekAllowed: boolean;
  walletBalance: number;
  currency: string;
  totalIncome: number;
  totalExpenses: number;
  monthlySpending: number;
  recent: Array<{
    label: string;
    amount: number;
    type: string;
    category?: string;
    date?: string;
  }>;
  budgets: Array<{ name: string; remaining: number; spent: number; total: number }>;
  savings: Array<{ name: string; current: number; target: number; progress: number }>;
  loans: Array<{ provider: string; outstanding: number }>;
  profile: Partial<Profile> | null;
  dailySpendLimit?: number;
  dailyTransferLimit?: number;
};

export async function loadMoneySnapshot(userId: string): Promise<MoneySnapshot> {
  const [user, summary, wallet, budgetsResult, savingsResult, loansResult, profile] =
    await Promise.all([
      User.findById(userId).select('firstName dailySpendLimit dailyTransferLimit'),
      TransactionService.getTransactionSummary(userId).catch(() => ({
        totalIncome: 0,
        totalExpenses: 0,
        monthlySpending: 0,
      })),
      WalletService.getWalletByUserId(userId).catch(() => null),
      BudgetService.getUserBudgets(userId, undefined, 1, 8).catch(() => ({ budgets: [] })),
      SavingsService.listGoals(userId).catch(() => ({ goals: [] })),
      LoanService.listLoans(userId).catch(() => ({ loans: [] })),
      GenieProfile.findOne({ userId }).catch(() => null),
    ]);

  const recent = await TransactionService.getRecentTransactions(userId, undefined, 8).catch(
    () => []
  );

  const budgets = ((budgetsResult as any)?.budgets || []).map((b: any) => ({
    name: b.name,
    remaining: Number(b.remainingAmount ?? (b.totalAmount || 0) - (b.spentAmount || 0)),
    spent: Number(b.spentAmount || 0),
    total: Number(b.totalAmount || 0),
  }));

  return {
    firstName: user?.firstName || 'there',
    peekAllowed: peekAllowed(profile),
    walletBalance: Number((wallet as any)?.availableBalance ?? (wallet as any)?.balance ?? 0),
    currency: (wallet as any)?.currency || 'NGN',
    totalIncome: Number(summary.totalIncome || 0),
    totalExpenses: Number(summary.totalExpenses || 0),
    monthlySpending: Number(summary.monthlySpending || 0),
    recent: recent.map((tx: any) => ({
      label: tx.merchant || tx.description || tx.category || 'Transaction',
      amount: Number(tx.amount || 0),
      type: tx.type,
      category: tx.category,
      date: tx.createdAt ? new Date(tx.createdAt).toISOString().slice(0, 10) : undefined,
    })),
    budgets,
    savings: ((savingsResult as any)?.goals || []).map((g: any) => ({
      name: g.name,
      current: Number(g.currentAmount || 0),
      target: Number(g.targetAmount || 0),
      progress: Number(g.progress || 0),
    })),
    loans: ((loansResult as any)?.loans || []).map((loan: any) => ({
      provider: loan.providerName || 'Loan',
      outstanding: Number(loan.outstandingAmount || 0),
    })),
    profile: profile
      ? {
          occupation: profile.occupation,
          payFrequency: profile.payFrequency,
          monthlyIncome: profile.monthlyIncome,
          topSpends: profile.topSpends,
          trackingHabit: profile.trackingHabit,
          spendingStyle: profile.spendingStyle,
          goals: profile.goals,
          goalTimeline: profile.goalTimeline,
          helpFocus: profile.helpFocus,
          checkInPreference: profile.checkInPreference,
          allowPeek: profile.allowPeek,
        }
      : null,
    dailySpendLimit: user?.dailySpendLimit,
    dailyTransferLimit: user?.dailyTransferLimit,
  };
}

function snapshotForPrompt(snapshot: MoneySnapshot) {
  if (!snapshot.peekAllowed) {
    return {
      firstName: snapshot.firstName,
      peekAllowed: false,
      note: 'User asked Genie not to peek at balances. Do not quote naira amounts unless they explicitly ask in this message.',
      profile: snapshot.profile,
      budgetNames: snapshot.budgets.map((b) => b.name),
      savingsNames: snapshot.savings.map((s) => s.name),
      loanProviders: snapshot.loans.map((l) => l.provider),
    };
  }

  return {
    firstName: snapshot.firstName,
    wallet: formatMoney(snapshot.walletBalance, snapshot.currency),
    incomeAllTime: formatMoney(snapshot.totalIncome, snapshot.currency),
    expensesAllTime: formatMoney(snapshot.totalExpenses, snapshot.currency),
    spentThisMonth: formatMoney(snapshot.monthlySpending, snapshot.currency),
    recent: snapshot.recent.map((tx) => ({
      ...tx,
      amount: formatMoney(tx.amount, snapshot.currency),
    })),
    budgets: snapshot.budgets.map((b) => ({
      name: b.name,
      remaining: formatMoney(b.remaining, snapshot.currency),
      spent: formatMoney(b.spent, snapshot.currency),
      total: formatMoney(b.total, snapshot.currency),
    })),
    savings: snapshot.savings.map((s) => ({
      name: s.name,
      current: formatMoney(s.current, snapshot.currency),
      target: formatMoney(s.target, snapshot.currency),
      progress: `${s.progress}%`,
    })),
    loans: snapshot.loans.map((l) => ({
      provider: l.provider,
      outstanding: formatMoney(l.outstanding, snapshot.currency),
    })),
    dailySpendLimit: snapshot.dailySpendLimit
      ? formatMoney(snapshot.dailySpendLimit, snapshot.currency)
      : undefined,
    dailyTransferLimit: snapshot.dailyTransferLimit
      ? formatMoney(snapshot.dailyTransferLimit, snapshot.currency)
      : undefined,
    profile: snapshot.profile,
  };
}

function systemPrompt(snapshot: MoneySnapshot): string {
  return [
    'You are Genie, the in-app money coach for PayGenius Microfinance Bank in Nigeria.',
    'Speak like a sharp, warm friend: clear, specific, and useful. Use short paragraphs and occasional bullets.',
    'Reply in the same language the user used. Default to natural Nigerian English.',
    'Use only the live account snapshot below. Never invent balances, transactions, budgets, or loan figures.',
    'If a number is missing, say you do not have it yet and tell them how to create it in the app (Pay Bills, Save, Budget, Lend, Settings).',
    'You cannot move money, pay bills, or change settings yourself. Guide them to the right screen.',
    'Do not give licensed investment, tax, or legal advice. Frame ideas as suggestions.',
    'Keep replies mobile-friendly: usually 40–120 words unless they ask for a deep breakdown.',
    'Address the user by first name when it feels natural.',
    '',
    'Live account snapshot (JSON):',
    JSON.stringify(snapshotForPrompt(snapshot)),
  ].join('\n');
}

export function fallbackReply(snapshot: MoneySnapshot, message: string): string {
  const text = message.toLowerCase();
  const name = snapshot.firstName;
  const money = (n: number) => formatMoney(n, snapshot.currency);
  const canPeek = snapshot.peekAllowed;

  if (/(balance|wallet|how much)/.test(text)) {
    if (!canPeek) {
      return `Hey ${name}, you asked me not to peek at balances. Say “show my balance” if you want the number this time.`;
    }
    return `Your available wallet balance is ${money(snapshot.walletBalance)}. This month you’ve spent ${money(snapshot.monthlySpending)}. Want me to break that down by category?`;
  }

  if (/(spend|expense|transaction|outflow)/.test(text)) {
    if (!canPeek) {
      return `${name}, I can talk through spending habits without amounts. Open Statement in Settings if you want the full log, or tell me I can peek.`;
    }
    const recent = snapshot.recent
      .slice(0, 3)
      .map((tx) => `${tx.label} (${money(tx.amount)})`)
      .join(', ');
    return `You’ve spent ${money(snapshot.monthlySpending)} this month. Latest moves: ${recent || 'none yet'}. I can help you trim the biggest category if you want.`;
  }

  if (/(save|saving|goal)/.test(text)) {
    if (!snapshot.savings.length) {
      return `You don’t have an active savings goal yet, ${name}. Open Save, pick a target, and I can help you size a weekly amount.`;
    }
    const top = snapshot.savings[0];
    return canPeek
      ? `${top.name} is at ${money(top.current)} of ${money(top.target)} (${top.progress}%). Want a plan to finish it faster?`
      : `${top.name} is already set up. Open Save to see progress, or let me peek if you want numbers here.`;
  }

  if (/(budget)/.test(text)) {
    if (!snapshot.budgets.length) {
      return `No active budget yet. Create one from Home or Budget so I can warn you before a category runs dry.`;
    }
    const names = snapshot.budgets
      .slice(0, 3)
      .map((b) => (canPeek ? `${b.name} (${money(b.remaining)} left)` : b.name))
      .join(', ');
    return `Here’s your budget pulse: ${names}.`;
  }

  if (/(loan|lend|debt)/.test(text)) {
    if (!snapshot.loans.length) {
      return `No linked loans on PayGenius yet. You can add one from Lend if you want me to track repayments.`;
    }
    const first = snapshot.loans[0];
    return canPeek
      ? `${first.provider} still has ${money(first.outstanding)} outstanding. I can help you plan the next payment.`
      : `You have a ${first.provider} loan linked. Open Lend for the balance, or let me peek.`;
  }

  if (/(goal|plan)/.test(text) && snapshot.profile?.goals?.length) {
    return `You’re focused on ${snapshot.profile.goals.join(' and ')}${
      snapshot.profile.goalTimeline ? ` — aiming for ${snapshot.profile.goalTimeline}` : ''
    }. I can keep that front and center whenever you check in.`;
  }

  const focus = snapshot.profile?.helpFocus
    ? ` I’ll lean into ${String(snapshot.profile.helpFocus).toLowerCase()}.`
    : '';
  return `Hey ${name}. I can check spending, budgets, savings, loans, or just keep you honest about your money vibe.${focus} What should we look at first?`;
}

function parseDataUri(uri: string): { mime: string; buffer: Buffer } | null {
  const match = String(uri || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
}

export async function transcribeAudio(dataUri: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return '';
  const parsed = parseDataUri(dataUri);
  if (!parsed) return '';

  const ext = parsed.mime.includes('wav')
    ? 'wav'
    : parsed.mime.includes('mpeg') || parsed.mime.includes('mp3')
      ? 'mp3'
      : 'm4a';
  const form = new FormData();
  form.append('file', new Blob([parsed.buffer], { type: parsed.mime }), `voice.${ext}`);
  form.append('model', 'whisper-1');

  const response = await axios.post(`${DEFAULT_BASE_URL}/audio/transcriptions`, form, {
    timeout: 28000,
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  return String(response.data?.text ?? '').trim();
}

export async function generateGenieReply(
  snapshot: MoneySnapshot,
  history: IGenieMessage[],
  latestUserMessage: string,
  imageDataUri?: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    logger.warn('OPENAI_API_KEY is not set — Genie using contextual fallback replies');
    return fallbackReply(snapshot, latestUserMessage);
  }

  const prior = history
    .slice(-16)
    .filter((m) => m.content?.trim())
    .map((m) => ({
      role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: m.content.slice(0, 2000),
    }));

  const promptText =
    latestUserMessage.slice(0, 2000) ||
    (imageDataUri
      ? 'I sent a photo. Look at it and help me with anything money-related you can see — receipts, bills, balances, or notes.'
      : 'Help me with this.');

  const userContent = imageDataUri
    ? [
        { type: 'text' as const, text: promptText },
        { type: 'image_url' as const, image_url: { url: imageDataUri } },
      ]
    : promptText;

  try {
    const response = await axios.post(
      `${DEFAULT_BASE_URL}/chat/completions`,
      {
        model: DEFAULT_MODEL,
        temperature: 0.6,
        max_tokens: 420,
        messages: [
          { role: 'system', content: systemPrompt(snapshot) },
          ...prior,
          { role: 'user', content: userContent },
        ],
      },
      {
        timeout: 28000,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const text = String(response.data?.choices?.[0]?.message?.content ?? '').trim();
    if (!text) {
      return fallbackReply(snapshot, latestUserMessage);
    }
    return text.slice(0, 4000);
  } catch (error: any) {
    logger.error('Genie LLM error:', error?.response?.data || error?.message || error);
    return fallbackReply(snapshot, latestUserMessage);
  }
}
