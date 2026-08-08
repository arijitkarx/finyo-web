import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, consumeOAuthSession, refreshSession, setAuthFailureHandler } from './api';
import { jsonResponse, parseBody, stubFetch } from '../test/helpers';

describe('apiFetch', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
        fetchMock = stubFetch();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('parses successful JSON responses', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ hello: 'world' }));

        const data = await apiFetch<{ hello: string }>('/api/test');

        expect(data).toEqual({ hello: 'world' });
        expect(fetchMock).toHaveBeenCalledWith('/api/test', expect.objectContaining({ credentials: 'include' }));
    });

    it('returns undefined for empty responses', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse(null, 204));

        const data = await apiFetch('/api/empty');
        expect(data).toBeNull();
    });

    it('throws ApiError with message and status for error responses', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'Not found' }, 404));

        const error = (await apiFetch('/api/missing').catch((e: unknown) => e)) as ApiError;

        expect(error).toBeInstanceOf(ApiError);
        expect(error.status).toBe(404);
        expect(error.message).toBe('Not found');
    });

    it('surfaces zod validation issues', async () => {
        fetchMock.mockResolvedValueOnce(
            jsonResponse(
                {
                    message: 'Validation failed',
                    issues: [{ code: 'invalid_value', path: ['accountType'], message: 'invalid' }],
                },
                400
            )
        );

        const error = (await apiFetch('/api/accounts').catch((e: unknown) => e)) as ApiError;

        expect(error.status).toBe(400);
        expect(error.issues?.length).toBe(1);
        expect(error.issues?.[0].path).toEqual(['accountType']);
    });

    it('falls back to a generic message when the payload has none', async () => {
        fetchMock.mockResolvedValueOnce(jsonResponse({}, 500));

        const error = (await apiFetch('/api/boom').catch((e: unknown) => e)) as ApiError;
        expect(error.message).toContain('500');
    });

    it('throws ApiError with status 0 on network errors', async () => {
        fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));

        const error = (await apiFetch('/api/test').catch((e: unknown) => e)) as ApiError;

        expect(error).toBeInstanceOf(ApiError);
        expect(error.status).toBe(0);
        expect(error.message).toContain('Network error');
    });

    it('refreshes the session once on 401 and retries the original request', async () => {
        localStorage.setItem('refreshToken', 'rt-123');

        fetchMock
            .mockResolvedValueOnce(jsonResponse({ message: 'invalid token' }, 401))
            .mockResolvedValueOnce(jsonResponse({ access_token: 'new-access', refresh_token: 'new-refresh' }))
            .mockResolvedValueOnce(jsonResponse({ ok: true }));

        const data = await apiFetch('/api/secure');

        expect(data).toEqual({ ok: true });
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(String(fetchMock.mock.calls[1][0])).toContain('grant_type=refresh_token');
        expect(parseBody(fetchMock.mock.calls[1][1] as RequestInit)).toEqual({ refresh_token: 'rt-123' });
        expect(localStorage.getItem('authToken')).toBe('new-access');
        expect(localStorage.getItem('refreshToken')).toBe('new-refresh');
    });

    it('refreshes on 403 as well', async () => {
        localStorage.setItem('refreshToken', 'rt-123');

        fetchMock
            .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 403))
            .mockResolvedValueOnce(jsonResponse({ access_token: 'new-access' }))
            .mockResolvedValueOnce(jsonResponse({ ok: true }));

        const data = await apiFetch('/api/secure');
        expect(data).toEqual({ ok: true });
    });

    it('calls the auth failure handler and throws when refresh fails', async () => {
        localStorage.setItem('refreshToken', 'rt-123');
        const handler = vi.fn();
        setAuthFailureHandler(handler);

        fetchMock
            .mockResolvedValueOnce(jsonResponse({ message: 'invalid token' }, 401))
            .mockResolvedValueOnce(jsonResponse({ error: 'invalid_grant' }, 400));

        const error = (await apiFetch('/api/secure').catch((e: unknown) => e)) as ApiError;

        expect(error.message).toContain('Session expired');
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does not retry twice for the same failing request', async () => {
        localStorage.setItem('refreshToken', 'rt-123');

        fetchMock
            .mockResolvedValueOnce(jsonResponse({ message: 'invalid token' }, 401))
            .mockResolvedValueOnce(jsonResponse({ access_token: 'new-access' }))
            .mockResolvedValueOnce(jsonResponse({ message: 'still invalid' }, 401));

        const error = (await apiFetch('/api/secure').catch((e: unknown) => e)) as ApiError;

        expect(error.status).toBe(401);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });
});

describe('refreshSession', () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
        vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');
        fetchMock = stubFetch();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns false without a stored refresh token', async () => {
        expect(await refreshSession()).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns false when the Supabase refresh call fails', async () => {
        localStorage.setItem('refreshToken', 'rt-123');
        fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'invalid_grant' }, 400));

        expect(await refreshSession()).toBe(false);
    });

    it('persists the new tokens on success', async () => {
        localStorage.setItem('refreshToken', 'rt-123');
        fetchMock.mockResolvedValueOnce(jsonResponse({ access_token: 'a2', refresh_token: 'r2' }));

        expect(await refreshSession()).toBe(true);
        expect(localStorage.getItem('authToken')).toBe('a2');
        expect(localStorage.getItem('refreshToken')).toBe('r2');
    });
});

describe('consumeOAuthSession', () => {
    beforeEach(() => {
        localStorage.clear();
        window.location.hash = '';
    });

    it('persists tokens from the URL hash and clears it', () => {
        window.location.hash = '#access_token=oauth-at&refresh_token=oauth-rt';

        expect(consumeOAuthSession()).toBe(true);
        expect(localStorage.getItem('authToken')).toBe('oauth-at');
        expect(localStorage.getItem('refreshToken')).toBe('oauth-rt');
        expect(window.location.hash).toBe('');
    });

    it('ignores hashes without an access token', () => {
        window.location.hash = '#error=access_denied';

        expect(consumeOAuthSession()).toBe(false);
        expect(localStorage.getItem('authToken')).toBeNull();
        expect(window.location.hash).toBe('#error=access_denied');
    });
});
