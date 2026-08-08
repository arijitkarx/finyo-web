import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { jsonResponse, parseBody, stubFetch } from '../test/helpers';
import {
    accountsStore,
    addBucketAllocation,
    authStore,
    budgetAlertsStore,
    budgetSummariesStore,
    bucketBalancesStore,
    currentViewStore,
    dailyAllowanceStore,
    fetchBucketBalance,
    fetchBudgetSummaries,
    fetchCurrentUser,
    fetchFinancialState,
    fetchRecurringUpcoming,
    logout,
    recurringUpcomingStore,
    runAutoFund,
    safeToSpendStore,
    testRule,
    transactionsStore,
} from './stores';
import type { Account, Transaction } from './types';

const tx = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    userId: 'u1',
    from: null,
    to: null,
    fromUserId: null,
    toUserId: null,
    secondPartyId: null,
    amount: 350,
    type: 'expense',
    transactionType: 'expense',
    direction: 'debit',
    mode: 'UPI',
    source: 'sms',
    category: 'Food',
    categoryId: null,
    bucketId: null,
    notes: null,
    tags: [],
    createdAt: '2026-08-08T10:00:00.000Z',
    updatedAt: '2026-08-08T10:00:00.000Z',
    date: '2026-08-08T10:00:00.000Z',
    accountId: null,
    merchantId: null,
    rawDescription: null,
    normalizedDescription: null,
    sourceTransactionId: null,
    sourceHash: null,
    classificationStatus: 'classified',
    classificationConfidence: 0.98,
    metadata: {},
    transferId: null,
    ...overrides,
} as Transaction);

describe('transactionsStore', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        transactionsStore.set([]);
        fetchMock = stubFetch();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('fetches the paged list and stores transactions + pagination', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                transactions: [tx({ id: 8 })],
                pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
            })
        );

        await transactionsStore.fetchTransactions({ page: 1, limit: 50 });

        expect(get(transactionsStore)).toHaveLength(1);
        expect(get(transactionsStore)[0].id).toBe(8);
        expect(get(transactionsStore.pagination)).toEqual({ page: 1, limit: 50, total: 1, totalPages: 1 });
        expect(String(fetchMock.mock.calls[0][0])).toContain('/api/transactions/transactions?page=1&limit=50');
    });

    it('sends date/tag/match filters as query params', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ transactions: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } }));

        await transactionsStore.fetchTransactions({ startDate: '2026-08-01', endDate: '2026-08-08', tags: 'lunch, office', match: 'all' });

        const url = String(fetchMock.mock.calls[0][0]);
        expect(url).toContain('startDate=2026-08-01');
        expect(url).toContain('endDate=2026-08-08');
        expect(url).toContain('tags=lunch%2C+office');
        expect(url).toContain('match=all');
    });

    it('prepends created transactions', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(tx({ id: 2, type: 'income', direction: 'credit' }), 201));

        await transactionsStore.addTransaction({ amount: 5000, type: 'income' });

        expect(get(transactionsStore)[0].id).toBe(2);
        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/transactions');
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    });

    it('maps updated transactions in place', async () => {
        transactionsStore.set([tx({ id: 1, category: 'Food' })]);
        fetchMock.mockResolvedValueOnce(jsonResponse(tx({ id: 1, category: 'Travel' })));

        await transactionsStore.updateTransaction(1, { category: 'Travel' });

        expect(get(transactionsStore)[0].category).toBe('Travel');
        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/transactions/1');
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'PUT' });
    });

    it('removes deleted transactions', async () => {
        transactionsStore.set([tx({ id: 1 }), tx({ id: 2 })]);
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'deleted' }));

        await transactionsStore.deleteTransaction(1);

        expect(get(transactionsStore)).toHaveLength(1);
        expect(get(transactionsStore)[0].id).toBe(2);
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
    });

    it('posts transfers with source manual', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ from: tx(), to: tx({ id: 2, direction: 'credit' }) }, 201));

        await transactionsStore.transfer({ fromAccountId: 'a1', toAccountId: 'a2', amount: 2000, notes: 'savings' });

        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/transactions/transfer');
        const body = parseBody(fetchMock.mock.calls[0][1] as RequestInit);
        expect(body).toMatchObject({ fromAccountId: 'a1', toAccountId: 'a2', amount: 2000, source: 'manual', notes: 'savings' });
    });
});

describe('accountsStore (generic CRUD)', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        accountsStore.set([]);
        fetchMock = stubFetch();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const account = (overrides: Record<string, unknown> = {}) => ({
        id: 'acc-1',
        userId: 'u1',
        name: 'HDFC',
        institution: 'hdfc',
        accountType: 'bank',
        currency: 'INR',
        sourceType: 'manual',
        externalAccountId: null,
        currentBalance: 25000,
        lastBalanceUpdatedAt: null,
        isActive: true,
        createdAt: '2026-08-08T10:00:00.000Z',
        updatedAt: '2026-08-08T10:00:00.000Z',
        ...overrides,
    } as Account);

    it('fetches and stores the list', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse([account()]));

        await accountsStore.fetchAll();

        expect(get(accountsStore)).toHaveLength(1);
        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/accounts');
    });

    it('creates and prepends', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(account({ id: 'acc-2', name: 'Cash' }), 201));

        await accountsStore.create({ name: 'Cash', accountType: 'cash' });

        expect(get(accountsStore)).toHaveLength(1);
        expect(get(accountsStore)[0].name).toBe('Cash');
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    });

    it('updates in place', async () => {
        accountsStore.set([account()]);
        fetchMock.mockResolvedValueOnce(jsonResponse(account({ name: 'HDFC Premium' })));

        await accountsStore.updateItem('acc-1', { name: 'HDFC Premium' });

        expect(get(accountsStore)[0].name).toBe('HDFC Premium');
        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/accounts/acc-1');
    });

    it('removes by id', async () => {
        accountsStore.set([account(), account({ id: 'acc-2' })]);
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'deleted' }));

        await accountsStore.remove('acc-1');

        expect(get(accountsStore)).toHaveLength(1);
        expect(get(accountsStore)[0].id).toBe('acc-2');
    });
});

describe('financial state', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        safeToSpendStore.set(null);
        dailyAllowanceStore.set(null);
        fetchMock = stubFetch();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('loads safe-to-spend and daily allowance', async () => {
        fetchMock
            .mockResolvedValueOnce(
                jsonResponse({
                    safeToSpend: 4200,
                    currency: 'INR',
                    components: { availableCash: 5000, reservedMoney: 300, earmarkedMoney: 200, upcomingRequiredExpenses: 300, protectedSavings: 0 },
                })
            )
            .mockResolvedValueOnce(jsonResponse({ overall: 300, categories: { 'Food budget': 150 } }));

        await fetchFinancialState();

        expect(get(safeToSpendStore)?.safeToSpend).toBe(4200);
        expect(get(dailyAllowanceStore)?.overall).toBe(300);
        expect(get(dailyAllowanceStore)?.categories['Food budget']).toBe(150);
    });

    it('loads bucket balances into the balances map', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ bucketId: 'b1', balance: 1200 }));

        const balance = await fetchBucketBalance('b1');

        expect(balance).toBe(1200);
        expect(get(bucketBalancesStore)).toEqual({ b1: 1200 });
        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/buckets/b1/balance');
    });

    it('posts allocations and refreshes the balance', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse({ id: 1, bucketId: 'b1', amount: 500, allocationType: 'funding' }, 201))
            .mockResolvedValueOnce(jsonResponse({ bucketId: 'b1', balance: 1700 }));

        await addBucketAllocation('b1', { amount: 500, allocationType: 'funding' });

        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/buckets/b1/allocations');
        const body = parseBody(fetchMock.mock.calls[0][1] as RequestInit);
        expect(body).toMatchObject({ amount: 500, allocationType: 'funding' });
        expect(get(bucketBalancesStore)).toEqual({ b1: 1700 });
    });
});

describe('budgets', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        budgetSummariesStore.set([]);
        budgetAlertsStore.set([]);
        fetchMock = stubFetch();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('loads summaries and alerts', async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse([{ id: 'p1', name: 'Food', limit: 8000, spent: 6400, remaining: 1600, percentage: 80 }]))
            .mockResolvedValueOnce(jsonResponse([{ category: 'Food', percentage: 80, spent: 6400, limit: 8000, severity: 'medium' }]));

        const { summaries, alerts } = await fetchBudgetSummaries();

        expect(summaries).toHaveLength(1);
        expect(alerts).toHaveLength(1);
        expect(get(budgetSummariesStore)[0].percentage).toBe(80);
        expect(get(budgetAlertsStore)[0].severity).toBe('medium');
        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/budgets/summary');
        expect(String(fetchMock.mock.calls[1][0])).toBe('/api/budgets/alerts');
    });
});

describe('recurring plans', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        recurringUpcomingStore.set([]);
        fetchMock = stubFetch();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('loads upcoming obligations', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse([{ name: 'Mobile Recharge', amount: 900, dueDate: '2026-10-01', funded: 600, remainingFunding: 300 }]));

        await fetchRecurringUpcoming();

        expect(get(recurringUpcomingStore)).toHaveLength(1);
        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/recurring/upcoming');
    });

    it('runs auto-fund and returns the funded count', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ funded: 2 }));

        const funded = await runAutoFund();

        expect(funded).toBe(2);
        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/recurring/auto-fund');
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    });
});

describe('rules', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        fetchMock = stubFetch();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('dry-runs a rule test', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ matches: true }));

        const matches = await testRule('r1', { merchantName: 'swiggy' });

        expect(matches).toBe(true);
        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/rules/r1/test');
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    });
});

describe('auth flows', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        authStore.set({ token: null, user: null, isLoggedIn: false });
        currentViewStore.set('landing');
        fetchMock = stubFetch();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('fetches the current user and marks the session active', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ user: { id: 'u1', email: 'a@b.c', username: 'arijit' } }));

        const user = await fetchCurrentUser();

        expect(user?.username).toBe('arijit');
        expect(get(authStore).isLoggedIn).toBe(true);
        expect(get(authStore).user?.email).toBe('a@b.c');
        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/auth/me');
    });

    it('logout calls the endpoint and clears local state', async () => {
        authStore.set({ token: 't', user: { id: 'u1', email: 'a@b.c' }, isLoggedIn: true });
        currentViewStore.set('dashboard');
        localStorage.setItem('authToken', 't');
        localStorage.setItem('refreshToken', 'rt');
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Logged out' }));

        await logout();

        expect(String(fetchMock.mock.calls[0][0])).toBe('/api/auth/logout');
        expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
        expect(get(authStore).token).toBeNull();
        expect(get(authStore).isLoggedIn).toBe(false);
        expect(get(currentViewStore)).toBe('landing');
        expect(localStorage.getItem('authToken')).toBeNull();
        expect(localStorage.getItem('refreshToken')).toBeNull();
    });
});
