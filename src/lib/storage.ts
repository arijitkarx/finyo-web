export function safeLocalStorageGet(key: string): string | null {
    if (typeof localStorage === 'undefined') {
        return null;
    }

    return localStorage.getItem(key);
}

export function safeLocalStorageSet(key: string, value: string) {
    if (typeof localStorage === 'undefined') {
        return;
    }

    localStorage.setItem(key, value);
}

export function safeLocalStorageRemove(key: string) {
    if (typeof localStorage === 'undefined') {
        return;
    }

    localStorage.removeItem(key);
}
