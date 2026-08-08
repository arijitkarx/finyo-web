import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import AuthPanel from './AuthPanel.svelte';
import { jsonResponse, parseBody, stubFetch } from '../test/helpers';
import { authStore, currentViewStore } from '$lib/stores';

describe('AuthPanel', () => {
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

    it('logs in, persists tokens, and navigates to the dashboard', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse({
                token: 'access-123',
                refreshToken: 'refresh-123',
                user: { id: 'u1', email: 'arijit@example.com', username: 'arijit' },
            })
        );

        const { container } = render(AuthPanel, { props: { mode: 'login' } });

        await fireEvent.input(screen.getByPlaceholderText('Email'), { target: { value: 'arijit@example.com' } });
        await fireEvent.input(screen.getByPlaceholderText('Password'), { target: { value: 'secret' } });
        await fireEvent.submit(container.querySelector('form') as HTMLFormElement);

        await waitFor(() => {
            expect(String(fetchMock.mock.calls[0][0])).toContain('/api/auth/login');
            const body = parseBody(fetchMock.mock.calls[0][1] as RequestInit);
            expect(body).toEqual({ email: 'arijit@example.com', password: 'secret' });
            expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
        });

        await waitFor(() => {
            expect(get(authStore).token).toBe('access-123');
            expect(get(authStore).isLoggedIn).toBe(true);
            expect(get(authStore).user?.username).toBe('arijit');
            expect(get(currentViewStore)).toBe('dashboard');
        });

        expect(localStorage.getItem('authToken')).toBe('access-123');
        expect(localStorage.getItem('refreshToken')).toBe('refresh-123');
    });

    it('shows the backend error message on failed login', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Invalid credentials' }, 401));

        const { container } = render(AuthPanel, { props: { mode: 'login' } });

        await fireEvent.input(screen.getByPlaceholderText('Email'), { target: { value: 'a@b.c' } });
        await fireEvent.input(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } });
        await fireEvent.submit(container.querySelector('form') as HTMLFormElement);

        await waitFor(() => {
            expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
        });
        expect(get(authStore).token).toBeNull();
        expect(get(currentViewStore)).toBe('landing');
    });

    it('registers a new account and persists the returned tokens', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(
                {
                    token: 'access-456',
                    refreshToken: 'refresh-456',
                    user: { id: 'u2', email: 'new@example.com', username: 'newbie' },
                },
                201
            )
        );

        const { container } = render(AuthPanel, { props: { mode: 'signup' } });

        await fireEvent.input(screen.getByPlaceholderText('Username'), { target: { value: 'newbie' } });
        await fireEvent.input(screen.getByPlaceholderText('Email'), { target: { value: 'new@example.com' } });
        await fireEvent.input(screen.getByPlaceholderText('Password'), { target: { value: 'secret' } });
        await fireEvent.submit(container.querySelector('form') as HTMLFormElement);

        await waitFor(() => {
            expect(String(fetchMock.mock.calls[0][0])).toContain('/api/auth/register');
            const body = parseBody(fetchMock.mock.calls[0][1] as RequestInit);
            expect(body).toEqual({ email: 'new@example.com', password: 'secret', username: 'newbie' });
        });

        await waitFor(() => {
            expect(get(authStore).token).toBe('access-456');
            expect(get(currentViewStore)).toBe('dashboard');
        });
    });

    it('requests a Google OAuth URL and redirects', async () => {
        Object.defineProperty(window, 'location', {
            configurable: true,
            writable: true,
            value: { href: 'http://localhost:3000/' },
        });
        fetchMock.mockResolvedValueOnce(jsonResponse({ url: 'https://example.com/oauth/google' }));

        render(AuthPanel, { props: { mode: 'login' } });

        await fireEvent.click(screen.getByRole('button', { name: /Continue with Google/i }));

        await waitFor(() => {
            expect(String(fetchMock.mock.calls[0][0])).toContain('/api/auth/oauth/google');
        });
        await waitFor(() => {
            expect(window.location.href).toContain('https://example.com/oauth/google');
        });
    });
});
