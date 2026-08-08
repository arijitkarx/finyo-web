import { writable } from 'svelte/store';
import { apiFetch, setAuthFailureHandler } from './api';
import { safeLocalStorageGet, safeLocalStorageRemove } from './storage';
import type {
    Account,
    BudgetAlert,
    BudgetPlan,
    BudgetSummary,
    Bucket,
    BucketAllocation,
    BucketBalance,
    Category,
    DailyAllowance,
    DashboardData,
    Merchant,
    PaginatedTransactions,
    Pagination,
    RecurringPlan,
    RecurringUpcoming,
    Rule,
    SafeToSpend,
    Transaction,
    User,
} from './types';

function getCookie(name: string): string | null {
    if (typeof document === 'undefined') {
        return null;
    }

    const match = document.cookie.split('; ').find(cookie => cookie.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
}

export const darkModeStore = writable<boolean>(safeLocalStorageGet('finyo-theme') === 'dark');

export function persistTheme(isDark: boolean) {
    if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', isDark);
    }

    if (typeof localStorage !== 'undefined') {
        localStorage.setItem('finyo-theme', isDark ? 'dark' : 'light');
    }
}

// Current View Store
export type View =
    | 'landing'
    | 'login'
    | 'signup'
    | 'forgot'
    | 'dashboard'
    | 'transactions'
    | 'budgets'
    | 'accounts'
    | 'buckets'
    | 'recurring'
    | 'rules'
    | 'profile';

export const currentViewStore = writable<View>('landing');

// Auth Store
export interface AuthState {
    token: string | null;
    user: User | null;
    isLoggedIn: boolean;
}

export const authStore = writable<AuthState>({
    token: safeLocalStorageGet('authToken'),
    user: null,
    isLoggedIn: getCookie('isLoggedIn') === 'true',
});

export function clearAuth() {
    authStore.set({ token: null, user: null, isLoggedIn: false });
    safeLocalStorageRemove('authToken');
    safeLocalStorageRemove('refreshToken');
    currentViewStore.set('landing');
}

export async function logout() {
    try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
        console.error('Logout request failed:', error);
    }

    clearAuth();
}

export async function fetchCurrentUser(): Promise<User | null> {
    try {
        const data = await apiFetch<{ user: User }>('/api/auth/me');
        authStore.update(current => ({ ...current, user: data.user, isLoggedIn: true }));
        return data.user;
    } catch (error) {
        return null;
    }
}

setAuthFailureHandler(() => {
    clearAuth();
});

// Transactions Store
export interface TransactionFilters {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    tags?: string;
    match?: 'any' | 'all';
}

function createTransactionsStore() {
    const { subscribe, set, update } = writable<Transaction[]>([]);
    const pagination = writable<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 1 });

    return {
        subscribe,
        set,
        pagination: { subscribe: pagination.subscribe },
        fetchTransactions: async (filters: TransactionFilters = {}) => {
            const params = new URLSearchParams();
            params.set('page', String(filters.page || 1));
            params.set('limit', String(filters.limit || 50));
            if (filters.startDate) params.set('startDate', filters.startDate);
            if (filters.endDate) params.set('endDate', filters.endDate);
            if (filters.tags) params.set('tags', filters.tags);
            if (filters.match) params.set('match', filters.match);

            const data = await apiFetch<PaginatedTransactions>(`/api/transactions/transactions?${params}`);
            set(data.transactions || []);
            pagination.set(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 });
            return data;
        },
        addTransaction: async (transaction: Partial<Transaction>) => {
            const created = await apiFetch<Transaction>('/api/transactions', {
                method: 'POST',
                body: JSON.stringify(transaction),
            });
            update(transactions => [created, ...transactions]);
            return created;
        },
        updateTransaction: async (id: number, transaction: Partial<Transaction>) => {
            const updated = await apiFetch<Transaction>(`/api/transactions/${id}`, {
                method: 'PUT',
                body: JSON.stringify(transaction),
            });
            update(transactions => transactions.map(t => (t.id === id ? updated : t)));
            return updated;
        },
        deleteTransaction: async (id: number) => {
            await apiFetch(`/api/transactions/${id}`, { method: 'DELETE' });
            update(transactions => transactions.filter(t => t.id !== id));
        },
        transfer: async (payload: {
            fromAccountId: string;
            toAccountId: string;
            amount: number;
            occurredAt?: string;
            notes?: string;
            source?: string;
        }) => {
            const data = await apiFetch<{ from: Transaction; to: Transaction }>('/api/transactions/transfer', {
                method: 'POST',
                body: JSON.stringify({ source: 'manual', ...payload }),
            });
            return data;
        },
    };
}

export const transactionsStore = createTransactionsStore();

// Dashboard Store
export const dashboardStore = writable<DashboardData>({
    totalSpent: 0,
    totalIncome: 0,
    netAmount: 0,
    savingsRate: 0,
    topCategory: '',
    topExpenseCategory: '',
    topIncomeCategory: '',
    categoryData: {},
    expenseCategoryData: {},
    incomeCategoryData: {},
    topPaymentMethods: [],
    paymentMethodData: {},
    monthlyData: [],
    totalTransactions: 0,
    expenseCount: 0,
    incomeCount: 0,
    avgExpense: 0,
    avgIncome: 0,
});

export async function fetchDashboard() {
    try {
        const data = await apiFetch<DashboardData>('/api/transactions/dashboard');
        dashboardStore.set(data);
    } catch (error) {
        console.error('Failed to fetch dashboard:', error);
    }
}

// Financial State Store
export const safeToSpendStore = writable<SafeToSpend | null>(null);
export const dailyAllowanceStore = writable<DailyAllowance | null>(null);

export async function fetchFinancialState() {
    try {
        const [sts, allowance] = await Promise.all([
            apiFetch<SafeToSpend>('/api/financial/safe-to-spend'),
            apiFetch<DailyAllowance>('/api/financial/daily-allowance'),
        ]);
        safeToSpendStore.set(sts);
        dailyAllowanceStore.set(allowance);
    } catch (error) {
        console.error('Failed to fetch financial state:', error);
    }
}

// Generic CRUD Store
function createCrudStore<T extends { id: string | number }>(resource: string) {
    const { subscribe, set, update } = writable<T[]>([]);

    return {
        subscribe,
        set,
        fetchAll: async () => {
            const data = await apiFetch<T[]>(resource);
            set(data || []);
            return data;
        },
        create: async (payload: Partial<T>) => {
            const created = await apiFetch<T>(resource, {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            update(items => [...items, created]);
            return created;
        },
        updateItem: async (id: string | number, payload: Partial<T>) => {
            const updated = await apiFetch<T>(`${resource}/${id}`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
            update(items => items.map(item => (item.id === id ? updated : item)));
            return updated;
        },
        remove: async (id: string | number) => {
            await apiFetch(`${resource}/${id}`, { method: 'DELETE' });
            update(items => items.filter(item => item.id !== id));
        },
    };
}

export const accountsStore = createCrudStore<Account>('/api/accounts');
export const categoriesStore = createCrudStore<Category>('/api/categories');
export const merchantsStore = createCrudStore<Merchant>('/api/merchants');
export const bucketsStore = createCrudStore<Bucket>('/api/buckets');
export const rulesStore = createCrudStore<Rule>('/api/rules');
export const recurringStore = createCrudStore<RecurringPlan>('/api/recurring');

// Buckets: extra endpoints (balance, allocations)
export const bucketBalancesStore = writable<Record<string, number>>({});

export async function fetchBucketBalance(bucketId: string) {
    try {
        const data = await apiFetch<BucketBalance>(`/api/buckets/${bucketId}/balance`);
        bucketBalancesStore.update(balances => ({ ...balances, [bucketId]: data.balance }));
        return data.balance;
    } catch (error) {
        console.error('Failed to fetch bucket balance:', error);
        return null;
    }
}

export async function addBucketAllocation(
    bucketId: string,
    payload: {
        amount: number;
        allocationType: BucketAllocation['allocationType'];
        occurredAt?: string;
        referenceType?: string | null;
        referenceId?: number | null;
    }
) {
    const created = await apiFetch<BucketAllocation>(`/api/buckets/${bucketId}/allocations`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    await fetchBucketBalance(bucketId);
    return created;
}

// Budget Plans
export const budgetSummariesStore = writable<BudgetSummary[]>([]);
export const budgetAlertsStore = writable<BudgetAlert[]>([]);
export const budgetPlansStore = createCrudStore<BudgetPlan>('/api/budgets/plans');

export async function fetchBudgetSummaries() {
    try {
        const [summaries, alerts] = await Promise.all([
            apiFetch<BudgetSummary[]>('/api/budgets/summary'),
            apiFetch<BudgetAlert[]>('/api/budgets/alerts'),
        ]);
        budgetSummariesStore.set(summaries || []);
        budgetAlertsStore.set(alerts || []);
        return { summaries, alerts };
    } catch (error) {
        console.error('Failed to fetch budget summaries:', error);
        return { summaries: [], alerts: [] };
    }
}

// Recurring: extra endpoints
export const recurringUpcomingStore = writable<RecurringUpcoming[]>([]);

export async function fetchRecurringUpcoming() {
    try {
        const data = await apiFetch<RecurringUpcoming[]>('/api/recurring/upcoming');
        recurringUpcomingStore.set(data || []);
        return data;
    } catch (error) {
        console.error('Failed to fetch recurring upcoming:', error);
        return [];
    }
}

export async function runAutoFund() {
    const data = await apiFetch<{ funded: number }>('/api/recurring/auto-fund', { method: 'POST' });
    return data.funded;
}

// Rules: dry-run test
export async function testRule(
    ruleId: string,
    payload: { merchantName?: string; description?: string; amount?: number; accountId?: string; mode?: string }
) {
    const data = await apiFetch<{ matches: boolean }>(`/api/rules/${ruleId}/test`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    return data.matches;
}
