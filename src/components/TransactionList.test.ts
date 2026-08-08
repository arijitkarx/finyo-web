import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import TransactionList from './TransactionList.svelte';
import { jsonResponse, stubFetch } from '../test/helpers';
import { transactionsStore } from '$lib/stores';

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
    classificationConfidence: null,
    metadata: {},
    transferId: null,
    ...overrides,
});

function pagedResponse(transactions: unknown[], page: number, total: number) {
    return jsonResponse({
        transactions,
        pagination: { page, limit: 50, total, totalPages: Math.ceil(total / 50) || 1 },
    });
}

describe('TransactionList', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        transactionsStore.set([]);
        fetchMock = stubFetch();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('renders transactions fetched from the paged endpoint', async () => {
        fetchMock.mockImplementation(url => {
            if (String(url).includes('/api/transactions/transactions')) {
                return Promise.resolve(pagedResponse([tx({ id: 1, category: 'Groceries' })], 1, 1));
            }
            return Promise.resolve(jsonResponse({}));
        });

        render(TransactionList);

        expect(await screen.findByText('Groceries')).toBeInTheDocument();
        await waitFor(() => {
            expect(String(fetchMock.mock.calls[0][0])).toContain('/api/transactions/transactions?page=1&limit=50');
        });
    });

    it('shows an empty state when there are no transactions', async () => {
        fetchMock.mockImplementation(url => {
            if (String(url).includes('/api/transactions/transactions')) {
                return Promise.resolve(pagedResponse([], 1, 0));
            }
            return Promise.resolve(jsonResponse({}));
        });

        render(TransactionList);

        expect(await screen.findByText(/No transactions match the current filters/i)).toBeInTheDocument();
    });

    it('filters rows client-side by type', async () => {
        fetchMock.mockImplementation(url => {
            if (String(url).includes('/api/transactions/transactions')) {
                return Promise.resolve(
                    pagedResponse(
                        [
                            tx({ id: 1, category: 'Groceries', type: 'expense' }),
                            tx({ id: 2, category: 'Salary', type: 'income', direction: 'credit', amount: 50000 }),
                        ],
                        1,
                        2
                    )
                );
            }
            return Promise.resolve(jsonResponse({}));
        });

        const { container } = render(TransactionList);

        await screen.findByText('Groceries');
        expect(screen.getByText('Salary')).toBeInTheDocument();

        await fireEvent.change(container.querySelector('select') as HTMLSelectElement, { target: { value: 'income' } });

        await waitFor(() => {
            expect(screen.queryByText('Groceries')).not.toBeInTheDocument();
        });
        expect(screen.getByText('Salary')).toBeInTheDocument();
    });

    it('paginates to the next page', async () => {
        fetchMock.mockImplementation(url => {
            if (String(url).includes('/api/transactions/transactions')) {
                const page = new URL(String(url), 'http://localhost').searchParams.get('page');
                if (page === '2') {
                    return Promise.resolve(
                        jsonResponse({
                            transactions: [tx({ id: 3, category: 'Travel' })],
                            pagination: { page: 2, limit: 50, total: 51, totalPages: 2 },
                        })
                    );
                }
                return Promise.resolve(
                    jsonResponse({
                        transactions: [tx({ id: 1, category: 'Groceries' })],
                        pagination: { page: 1, limit: 50, total: 51, totalPages: 2 },
                    })
                );
            }
            return Promise.resolve(jsonResponse({}));
        });

        render(TransactionList);

        await screen.findByText('Groceries');

        await fireEvent.click(screen.getByRole('button', { name: /Next/i }));

        expect(await screen.findByText('Travel')).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.queryByText('Groceries')).not.toBeInTheDocument();
        });
        expect(get(transactionsStore.pagination).page).toBe(2);
    });

    it('marks needs-review transactions', async () => {
        fetchMock.mockImplementation(url => {
            if (String(url).includes('/api/transactions/transactions')) {
                return Promise.resolve(pagedResponse([tx({ id: 1, category: 'Zomato', classificationStatus: 'needs_review' })], 1, 1));
            }
            return Promise.resolve(jsonResponse({}));
        });

        render(TransactionList);

        expect(await screen.findByText(/needs review/i)).toBeInTheDocument();
    });
});
