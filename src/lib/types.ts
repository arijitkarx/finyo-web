export interface User {
    id: string;
    email: string;
    username?: string;
}

export type TransactionType = 'expense' | 'income' | 'transfer' | 'refund' | 'adjustment';
export type Direction = 'debit' | 'credit';
export type ClassificationStatus = 'classified' | 'needs_review' | 'ignored';

export interface Transaction {
    id: number;
    userId: string;
    from: string | null;
    to: string | null;
    fromUserId: string | null;
    toUserId: string | null;
    secondPartyId: string | null;
    amount: number;
    type: TransactionType;
    transactionType: TransactionType;
    direction: Direction;
    mode: string;
    source: string;
    category: string | null;
    categoryId: string | null;
    bucketId: string | null;
    notes: string | null;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    date: string;
    accountId: string | null;
    merchantId: string | null;
    rawDescription: string | null;
    normalizedDescription: string | null;
    sourceTransactionId: number | null;
    sourceHash: string | null;
    classificationStatus: ClassificationStatus;
    classificationConfidence: number | null;
    metadata: Record<string, unknown>;
    transferId: number | null;
}

export type AccountType = 'bank' | 'cash' | 'wallet' | 'card' | 'investment' | 'other';
export type AccountSourceType = 'manual' | 'sms' | 'notification' | 'aa' | 'api';

export interface Account {
    id: string;
    userId: string;
    name: string;
    institution: string | null;
    accountType: AccountType;
    currency: string;
    sourceType: AccountSourceType;
    externalAccountId: string | null;
    currentBalance: number;
    lastBalanceUpdatedAt: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Category {
    id: string;
    userId: string | null;
    parentId: string | null;
    name: string;
    slug: string;
    icon: string;
    isSystem: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface Merchant {
    id: string;
    canonicalName: string;
    displayName: string | null;
    aliases: string[];
    defaultCategoryId: string | null;
    createdAt: string;
    updatedAt: string;
}

export type BucketType = 'spending' | 'sinking_fund' | 'reserved' | 'savings' | 'earmarked';
export type AllocationType = 'funding' | 'spending' | 'release' | 'adjustment' | 'transfer';

export interface Bucket {
    id: string;
    userId: string;
    name: string;
    type: BucketType;
    targetAmount: number | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface BucketAllocation {
    id: number;
    userId: string;
    bucketId: string;
    amount: number;
    allocationType: AllocationType;
    referenceType: string | null;
    referenceId: number | null;
    occurredAt: string;
    createdAt: string;
}

export interface BucketBalance {
    bucketId: string;
    balance: number;
}

export type BudgetPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

export interface BudgetPlan {
    id: string;
    userId: string;
    name: string;
    categoryId: string | null;
    category: string | null;
    bucketId: string | null;
    periodType: BudgetPeriod;
    limitAmount: number;
    startDate: string | null;
    endDate: string | null;
    rolloverEnabled: boolean;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface BudgetSummary {
    id: string;
    name: string;
    category: string | null;
    categoryId: string | null;
    bucketId: string | null;
    limit: number;
    spent: number;
    remaining: number;
    percentage: number;
}

export interface BudgetAlert {
    category: string;
    percentage: number;
    spent: number;
    limit: number;
    severity: 'medium' | 'high';
}

export type RuleMatchType = 'merchant' | 'description' | 'amount' | 'account' | 'mode';
export type RuleMatchOperator = 'equals' | 'contains' | 'starts_with' | 'regex';
export type RuleActionType = 'category' | 'bucket' | 'ignore';

export interface Rule {
    id: string;
    userId: string;
    priority: number;
    enabled: boolean;
    matchType: RuleMatchType;
    matchOperator: RuleMatchOperator;
    matchValue: string;
    actionType: RuleActionType;
    actionValue: string | null;
    createdAt: string;
    updatedAt: string;
}

export type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringPlan {
    id: string;
    userId: string;
    name: string;
    amount: number;
    frequency: Frequency;
    nextDueDate: string;
    bucketId: string | null;
    autoFundAmount: number | null;
    fundingFrequency: Frequency | null;
    lastFundingDate: string | null;
    merchantId: string | null;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface RecurringUpcoming {
    name: string;
    amount: number;
    dueDate: string;
    funded: number;
    remainingFunding: number;
}

export interface SafeToSpend {
    safeToSpend: number;
    currency: string;
    components: {
        availableCash: number;
        reservedMoney: number;
        earmarkedMoney: number;
        upcomingRequiredExpenses: number;
        protectedSavings: number;
    };
}

export interface DailyAllowance {
    overall: number;
    categories: Record<string, number>;
}

export interface DashboardData {
    totalSpent: number;
    totalIncome: number;
    netAmount: number;
    savingsRate: number;
    topCategory: string;
    topExpenseCategory: string;
    topIncomeCategory: string;
    categoryData: Record<string, number>;
    expenseCategoryData: Record<string, number>;
    incomeCategoryData: Record<string, number>;
    topPaymentMethods: string[];
    paymentMethodData: Record<string, number>;
    monthlyData: Array<{
        month: string;
        amount: number;
        expenses: number;
        income: number;
        net: number;
    }>;
    totalTransactions: number;
    expenseCount: number;
    incomeCount: number;
    avgExpense: number;
    avgIncome: number;
}

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface PaginatedTransactions {
    transactions: Transaction[];
    pagination: Pagination;
}

export type IngestionSource = 'sms' | 'notification' | 'email' | 'csv' | 'manual' | 'aa';
export type IngestionStatus = 'received' | 'processed' | 'duplicate' | 'failed';

export interface IngestionEvent {
    id: number;
    userId: string;
    accountId: string | null;
    source: string;
    externalEventId: string | null;
    sourceHash: string;
    rawPayload: unknown;
    status: IngestionStatus;
    error: string | null;
    createdAt: string;
}

export interface IngestionStatusResponse {
    counts: {
        received: number;
        processed: number;
        duplicate: number;
        failed: number;
    };
    events: IngestionEvent[];
}
