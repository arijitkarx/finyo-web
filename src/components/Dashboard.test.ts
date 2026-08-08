import { render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard.svelte';
import { jsonResponse, stubFetch } from '../test/helpers';

describe('Dashboard', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        fetchMock = stubFetch();
        fetchMock.mockImplementation(url => {
            const u = String(url);
            if (u === '/api/transactions/dashboard') {
                return Promise.resolve(
                    jsonResponse({
                        totalSpent: 800,
                        totalIncome: 50000,
                        netAmount: 49200,
                        savingsRate: 98.4,
                        topCategory: 'Food',
                        topExpenseCategory: 'Food',
                        topIncomeCategory: '',
                        categoryData: {},
                        expenseCategoryData: { Food: 450, Travel: 350 },
                        incomeCategoryData: {},
                        topPaymentMethods: ['UPI'],
                        paymentMethodData: { UPI: 3 },
                        monthlyData: [],
                        totalTransactions: 8,
                        expenseCount: 4,
                        incomeCount: 1,
                        avgExpense: 200,
                        avgIncome: 50000,
                    })
                );
            }
            if (u === '/api/financial/safe-to-spend') {
                return Promise.resolve(
                    jsonResponse({
                        safeToSpend: 4200,
                        currency: 'INR',
                        components: {
                            availableCash: 5000,
                            reservedMoney: 300,
                            earmarkedMoney: 200,
                            upcomingRequiredExpenses: 300,
                            protectedSavings: 0,
                        },
                    })
                );
            }
            if (u === '/api/financial/daily-allowance') {
                return Promise.resolve(jsonResponse({ overall: 300, categories: { 'Food budget': 150, 'Travel budget': 100 } }));
            }
            return Promise.resolve(jsonResponse({}));
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('renders safe-to-spend and its components', async () => {
        render(Dashboard);

        expect(await screen.findByText('Safe to spend')).toBeInTheDocument();
        expect(await screen.findByText('₹4,200')).toBeInTheDocument();
        expect(screen.getByText('Available cash')).toBeInTheDocument();
        expect(await screen.findByText('₹5,000')).toBeInTheDocument();
        expect(await screen.findByText('Upcoming required expenses')).toBeInTheDocument();
    });

    it('renders the daily allowance breakdown', async () => {
        render(Dashboard);

        expect(await screen.findByText('Daily allowance')).toBeInTheDocument();
        expect((await screen.findAllByText('₹300')).length).toBeGreaterThan(0);
        expect(await screen.findByText('Food budget')).toBeInTheDocument();
        expect(await screen.findByText('Travel budget')).toBeInTheDocument();
        expect(await screen.findByText('₹150')).toBeInTheDocument();
    });

    it('renders dashboard stats and category breakdown', async () => {
        render(Dashboard);

        expect(await screen.findByText('Total Spent')).toBeInTheDocument();
        expect(await screen.findByText('₹800')).toBeInTheDocument();
        expect(await screen.findByText('₹50,000')).toBeInTheDocument();
        expect(await screen.findByText('98.4%')).toBeInTheDocument();
        expect(await screen.findByText('Top Expense Categories')).toBeInTheDocument();
        expect(await screen.findByText('UPI')).toBeInTheDocument();
    });
});
