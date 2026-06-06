import { useState, useCallback, Dispatch, SetStateAction } from 'react';

interface Options<T> {
    /** Custom serializer. Default JSON.stringify. */
    serialize?: (v: T) => string;
    /** Custom deserializer. Default JSON.parse. */
    deserialize?: (s: string) => T;
}

/**
 * useState wrapper that persists value changes to localStorage under `key`.
 * Lazy-initializes from the stored value if present and parsable; falls
 * back to `defaultValue` on parse error or unsupported environment (SSR,
 * sandbox, quota-exceeded).
 *
 * For non-JSON-native types (Set, Map, etc) pass `options.serialize` and
 * `options.deserialize`. Example for Set<number>:
 *   { serialize: v => JSON.stringify(Array.from(v)),
 *     deserialize: s => new Set(JSON.parse(s)) }
 */
export function usePersistentState<T>(
    key: string,
    defaultValue: T,
    options: Options<T> = {},
): [T, Dispatch<SetStateAction<T>>] {
    const serialize = options.serialize ?? (JSON.stringify as (v: T) => string);
    const deserialize = options.deserialize ?? (JSON.parse as (s: string) => T);

    const [value, setValueRaw] = useState<T>(() => {
        try {
            const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
            return stored != null ? deserialize(stored) : defaultValue;
        } catch {
            return defaultValue;
        }
    });

    const setValue: Dispatch<SetStateAction<T>> = useCallback((next) => {
        setValueRaw((prev) => {
            const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(key, serialize(resolved));
                }
            } catch {
                // ignore — quota exceeded, private browsing, etc. State still updates in-memory.
            }
            return resolved;
        });
    }, [key, serialize]);

    return [value, setValue];
}
