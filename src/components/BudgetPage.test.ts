import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BudgetPage from './BudgetPage.svelte';
import { jsonResponse, parseBody, stubFetch } from '../test/helpers';

describe('BudgetPage', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        fetchMock = stubFetch();
        fetchMock.mockImplementation(url => {
            const u = String(url);
            if (u === '/api/budgets/summary') {
                return Promise.resolve(
                    jsonResponse([
                        { id: 'p1', name: 'Food budget', category: 'Food', categoryId: 'c1', bucketId: null, limit: 8000, spent: 6400, remaining: 1600, percentage: 80 },
                    ])
                );
            }
            if (u === '/api/budgets/alerts') {
                return Promise.resolve(jsonResponse([{ category: 'Food', percentage: 80, spent: 6400, limit: 8000, severity: 'medium' }]));
            }
            if (u === '/api/budgets/plans') {
                return Promise.resolve(jsonResponse([]));
            }
            if (u === '/api/categories') {
                return Promise.resolve(jsonResponse([{ id: 'c1', name: 'Food', isSystem: true }]));
            }
            if (u === '/api/buckets') {
                return Promise.resolve(jsonResponse([]));
            }
            return Promise.resolve(jsonResponse({}));
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('renders plan summaries and alerts', async () => {
        render(BudgetPage);

        expect(await screen.findByText('Food budget')).toBeInTheDocument();
        expect(await screen.findByText('₹8000')).toBeInTheDocument();
        expect(await screen.findByText('80%')).toBeInTheDocument();
        expect(await screen.findByText(/medium/i)).toBeInTheDocument();
        expect(await screen.findByText(/6400 of ₹8000/i)).toBeInTheDocument();
    });

    it('creates a plan via the modal and refreshes', async () => {
        render(BudgetPage);

        await screen.findByText('Food budget');

        await fireEvent.click(screen.getByRole('button', { name: /New Budget/i }));

        await fireEvent.input(screen.getByPlaceholderText('Plan name, e.g. Food budget'), { target: { value: 'Travel budget' } });
        await fireEvent.input(screen.getByPlaceholderText('Limit amount'), { target: { value: '12000' } });
        await fireEvent.click(screen.getByRole('button', { name: 'Save plan' }));

        await waitFor(() => {
            const postCall = fetchMock.mock.calls.find(c => c[1]?.method === 'POST') as [string, RequestInit] | undefined;
            expect(postCall).toBeDefined();
            expect(String((postCall as [string, RequestInit])[0])).toBe('/api/budgets/plans');
            const body = parseBody((postCall as [string, RequestInit])[1]);
            expect(body).toMatchObject({ name: 'Travel budget', limitAmount: 12000, periodType: 'monthly' });
        });
    });
});
