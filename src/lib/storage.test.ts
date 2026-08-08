import { afterEach, describe, expect, it } from 'vitest';
import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from './storage';

describe('storage helpers', () => {
    afterEach(() => {
        localStorage.clear();
    });

    it('sets and gets values', () => {
        safeLocalStorageSet('key', 'value');
        expect(safeLocalStorageGet('key')).toBe('value');
    });

    it('returns null for missing keys', () => {
        expect(safeLocalStorageGet('missing')).toBeNull();
    });

    it('removes values', () => {
        safeLocalStorageSet('key', 'value');
        safeLocalStorageRemove('key');
        expect(safeLocalStorageGet('key')).toBeNull();
    });

    it('is idempotent for removal of missing keys', () => {
        safeLocalStorageRemove('missing');
        expect(safeLocalStorageGet('missing')).toBeNull();
    });
});
