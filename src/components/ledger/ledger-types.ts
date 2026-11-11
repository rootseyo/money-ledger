export interface Transaction {
  fixedExpenseId?: string | null;
  scheduledFor?: string | null;
  id: string;
  sourceApp: string;
  type: string;
  amount: number;
  merchant: string | null;
  category: string | null;
  title: string;
  content: string;
  balance: number | null;
  cardOrAccount: string | null;
  packageName: string | null;
  notifiedAt: string;
  isReported: boolean;
  reportedAt: string | null;
  createdAt: string;
  updatedAt?: string;
  _count?: { receipts: number };
  duesPayment?: { memberId: string; month: string; member?: { name: string } } | null;
  rawData?: any;
}

