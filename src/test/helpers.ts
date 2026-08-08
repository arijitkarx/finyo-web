import { vi } from 'vitest';

export function jsonResponse(body: unknown, status = 200) {
    if (status === 204) {
        return new Response(null, { status, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export type FetchMock = ReturnType<typeof vi.fn>;

export function stubFetch(): FetchMock {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

export function parseBody(init?: RequestInit): Record<string, unknown> {
    return JSON.parse(init?.body as string);
}
