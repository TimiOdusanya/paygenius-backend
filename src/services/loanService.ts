import Loan, { ILoan, LoanFrequency } from '../models/Loan';

export const LOAN_PROVIDERS = [
  { code: 'access', name: 'Access Bank plc' },
  { code: 'alpha-morgan', name: 'Alpha Morgan Bank Limited' },
  { code: 'alternative', name: 'Alternative Bank Limited' },
  { code: 'abbey', name: 'Abbey Mortgage Bank Plc' },
  { code: 'boa', name: 'Bank of Agriculture' },
  { code: 'boi', name: 'Bank of Industry' },
  { code: 'citi', name: 'Citibank Nigeria Ltd' },
  { code: 'coronation', name: 'Coronation Merchant Bank Nigeria Ltd' },
  { code: 'fairmoney', name: 'Fair Money' },
  { code: 'carbon', name: 'Carbon' },
  { code: 'branch', name: 'Branch' },
  { code: 'palmpay', name: 'PalmPay' },
];

export type LinkLoanInput = {
  providerCode: string;
  providerName: string;
  accountName: string;
  accountNumber: string;
  bvn: string;
};

function defaultDueDate() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  return date;
}

function toLoanJson(loan: ILoan) {
  const json = typeof (loan as any).toJSON === 'function' ? (loan as any).toJSON() : loan;
  const principal = json.principalAmount || 0;
  const paid = json.paidAmount || 0;
  const progress = principal > 0 ? Math.min(100, (paid / principal) * 100) : 0;
  const health = progress >= 50 ? 'HEALTHY' : 'UNHEALTHY';
  return { ...json, progress, health };
}

export class LoanService {
  static listProviders(query?: string) {
    const q = (query ?? '').trim().toLowerCase();
    if (!q) return LOAN_PROVIDERS;
    return LOAN_PROVIDERS.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    );
  }

  static async listLoans(userId: string) {
    const loans = await Loan.find({ userId, isActive: true }).sort({ createdAt: -1 });
    const mapped = loans.map((loan) => toLoanJson(loan));
    const totalOutstanding = mapped.reduce(
      (sum, loan) => sum + (loan.outstandingAmount || 0),
      0
    );
    return { loans: mapped, totalOutstanding };
  }

  static async getLoan(userId: string, id: string) {
    const loan = await Loan.findOne({ _id: id, userId, isActive: true });
    return loan ? toLoanJson(loan) : null;
  }

  static async linkLoan(userId: string, input: LinkLoanInput) {
    const provider =
      LOAN_PROVIDERS.find((p) => p.code === input.providerCode) ??
      LOAN_PROVIDERS.find(
        (p) => p.name.toLowerCase() === input.providerName.trim().toLowerCase()
      );

    const digits = String(input.accountNumber ?? '').replace(/\D/g, '');
    const last4 = digits.slice(-4) || '0000';
    const principalAmount = 300000;
    const paidAmount = 0;

    const loan = await Loan.create({
      userId,
      providerName: provider?.name ?? input.providerName.trim(),
      providerCode: provider?.code ?? input.providerCode,
      accountName: input.accountName.trim(),
      accountLast4: last4,
      principalAmount,
      paidAmount,
      outstandingAmount: principalAmount - paidAmount,
      dueDate: defaultDueDate(),
      automate: false,
      reminderEnabled: true,
      isActive: true,
    });

    return toLoanJson(loan);
  }

  static async updateLoan(
    userId: string,
    id: string,
    updates: {
      automate?: boolean;
      repaymentFrequency?: LoanFrequency | null;
      reminderEnabled?: boolean;
    }
  ) {
    const loan = await Loan.findOne({ _id: id, userId, isActive: true });
    if (!loan) return null;

    if (typeof updates.automate === 'boolean') {
      loan.automate = updates.automate;
      if (!updates.automate) {
        loan.repaymentFrequency = undefined;
      }
    }
    if (updates.repaymentFrequency === 'WEEK' || updates.repaymentFrequency === 'MONTH') {
      loan.repaymentFrequency = updates.repaymentFrequency;
      loan.automate = true;
    }
    if (updates.repaymentFrequency === null) {
      loan.repaymentFrequency = undefined;
    }
    if (typeof updates.reminderEnabled === 'boolean') {
      loan.reminderEnabled = updates.reminderEnabled;
    }

    await loan.save();
    return toLoanJson(loan);
  }
}
