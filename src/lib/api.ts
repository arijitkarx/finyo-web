import { safeLocalStorageGet, safeLocalStorageSet } from './storage';

function getApiBase(): string {
    return import.meta.env.VITE_API_BASE_URL || '';
}

function getSupabaseUrl(): string {
    return import.meta.env.VITE_SUPABASE_URL || '';
}

function getSupabaseAnonKey(): string {
    return import.meta.env.VITE_SUPABASE_ANON_KEY || '';
}

export interface ApiIssue {
    code: string;
    values?: unknown[];
    path: (string | number)[];
    message: string;
}

export class ApiError extends Error {
    status: number;
    issues?: ApiIssue[];

    constructor(message: string, status: number, issues?: ApiIssue[]) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.issues = issues;
    }
}

let onAuthFailure: () => void = () => {};
export function setAuthFailureHandler(handler: () => void) {
    onAuthFailure = handler;
}

export function persistAuthTokens(accessToken: string | null, refreshToken: string | null) {
    if (accessToken) {
        safeLocalStorageSet('authToken', accessToken);
    } else {
        safeLocalStorageRemoveLocal('authToken');
    }

    if (refreshToken) {
        safeLocalStorageSet('refreshToken', refreshToken);
    } else {
        safeLocalStorageRemoveLocal('refreshToken');
    }
}

function safeLocalStorageRemoveLocal(key: string) {
    if (typeof localStorage === 'undefined') {
        return;
    }

    localStorage.removeItem(key);
}

export function consumeOAuthSession(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token')) {
        return false;
    }

    const params = new URLSearchParams(hash.slice(1));
    const accessToken = params.get('access_token');
    if (!accessToken) {
        return false;
    }

    persistAuthTokens(accessToken, params.get('refresh_token'));
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    return true;
}

export async function refreshSession(): Promise<boolean> {
    const refreshToken = safeLocalStorageGet('refreshToken');
    const supabaseUrl = getSupabaseUrl();
    const anonKey = getSupabaseAnonKey();
    if (!refreshToken || !supabaseUrl || !anonKey) {
        return false;
    }    try {
        const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: anonKey,
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        if (!data.access_token) {
            return false;
        }

        persistAuthTokens(data.access_token, data.refresh_token || refreshToken);
        return true;
    } catch (error) {
        console.error('Token refresh failed:', error);
        return false;
    }
}

let refreshing: Promise<boolean> | null = null;

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}, allowRetry = true): Promise<T> {
    const headers: Record<string, string> = {
        ...(init.headers as Record<string, string> | undefined),
    };

    const token = safeLocalStorageGet('authToken');
    if (token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    if (init.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    let response: Response;
    try {
        response = await fetch(`${getApiBase()}${path}`, {
            ...init,
            credentials: 'include',
            headers,
        });
    } catch (error) {
        throw new ApiError('Network error — is the backend running?', 0);
    }

    if ((response.status === 401 || response.status === 403) && allowRetry) {
        if (!refreshing) {
            refreshing = refreshSession().finally(() => {
                refreshing = null;
            });
        }

        const refreshed = await refreshing;
        if (refreshed) {
            return apiFetch<T>(path, init, false);
        }

        onAuthFailure();
        throw new ApiError('Session expired, please sign in again.', response.status);
    }

    const text = await response.text();
    let data: unknown = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
    }

    if (!response.ok) {
        const payload = data as { message?: string; issues?: ApiIssue[] } | null;
        throw new ApiError(
            payload?.message || `Request failed with status ${response.status}`,
            response.status,
            payload?.issues
        );
    }

    return data as T;
}
