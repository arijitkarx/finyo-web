import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { afterEach, vi } from 'vitest';

afterEach(() => {
    cleanup();
});

vi.stubGlobal(
    'confirm',
    vi.fn(() => true)
);
