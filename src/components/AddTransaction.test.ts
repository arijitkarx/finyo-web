import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AddTransaction from './AddTransaction.svelte';
import { jsonResponse, parseBody, stubFetch } from '../test/helpers';

const accounts = [
    { id: 'a1', name: 'HDFC', institution: 'hdfc', isActive: true },
    { id: 'a2', name: 'Cash', institution: null, isActive: true },
];

describe('AddTransaction', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        fetchMock = stubFetch();
        fetchMock.mockImplementation(url => {
            const u = String(url);
            if (u === '/api/accounts') return Promise.resolve(jsonResponse(accounts));
            if (u === '/api/categories') return Promise.resolve(jsonResponse([{ id: 'c1', name: 'Food', isSystem: true }]));
            if (u === '/api/buckets') return Promise.resolve(jsonResponse([]));
            if (u === '/api/merchants') return Promise.resolve(jsonResponse([]));
            return Promise.resolve(jsonResponse({}));
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('creates an expense transaction with the new optional-field payload', async () => {
        const { container } = render(AddTransaction, { props: { mode: 'create', transaction: null } });

        await screen.findByText('Food');

        await fireEvent.input(screen.getByPlaceholderText('0.00'), { target: { value: '450' } });
        await fireEvent.input(screen.getByPlaceholderText('e.g., lunch, office (comma separated)'), {
            target: { value: 'lunch, office' },
        });
        await fireEvent.submit(container.querySelector('form') as HTMLFormElement);

        await waitFor(() => {
            expect(String(fetchMock.mock.calls.find(c => c[1]?.method === 'POST')?.[0])).toBe('/api/transactions');
        });

        const postCall = fetchMock.mock.calls.find(c => c[1]?.method === 'POST') as [string, RequestInit];
        const body = parseBody(postCall[1]);
        expect(body.amount).toBe(450);
        expect(body.type).toBe('expense');
        expect(body.direction).toBe('debit');
        expect(body.source).toBe('manual');
        expect(body.mode).toBe('UPI');
        expect(body.tags).toEqual(['lunch', 'office']);
    });

    it('submits a transfer between two accounts', async () => {
        const { container } = render(AddTransaction, { props: { mode: 'create', transaction: null } });

        await screen.findByText('Food');

        await fireEvent.click(screen.getByRole('radio', { name: /transfer/i }));

        await fireEvent.change(screen.getByLabelText(/From account/i), { target: { value: 'a1' } });
        await fireEvent.change(screen.getByLabelText(/To account/i), { target: { value: 'a2' } });
        await fireEvent.input(screen.getByPlaceholderText('0.00'), { target: { value: '2000' } });
        await fireEvent.submit(container.querySelector('form') as HTMLFormElement);

        await waitFor(() => {
            const postCall = fetchMock.mock.calls.find(c => String(c[0]).includes('/api/transactions/transfer')) as [string, RequestInit] | undefined;
            expect(postCall).toBeDefined();
            const body = parseBody((postCall as [string, RequestInit])[1]);
            expect(body).toMatchObject({ fromAccountId: 'a1', toAccountId: 'a2', amount: 2000, source: 'manual' });
        });
    });

    it('rejects a transfer where both accounts are the same', async () => {
        const { container } = render(AddTransaction, { props: { mode: 'create', transaction: null } });

        await screen.findByText('Food');

        await fireEvent.click(screen.getByRole('radio', { name: /transfer/i }));
        await fireEvent.change(screen.getByLabelText(/From account/i), { target: { value: 'a1' } });
        await fireEvent.change(screen.getByLabelText(/To account/i), { target: { value: 'a1' } });
        await fireEvent.input(screen.getByPlaceholderText('0.00'), { target: { value: '100' } });
        await fireEvent.submit(container.querySelector('form') as HTMLFormElement);

        await waitFor(() => {
            expect(screen.getByText(/From and to accounts must be different/i)).toBeInTheDocument();
        });

        const transferCalls = fetchMock.mock.calls.filter(c => String(c[0]).includes('/api/transactions/transfer'));
        expect(transferCalls).toHaveLength(0);
    });
});
