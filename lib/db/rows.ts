import type { Database } from '../database.types.js';

/** Flat Row type for a public table, keyed by table name. */
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];

/** Postgres enum union type, keyed by enum name. */
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];

/**
 * Type-level helper: rewrite every `null` in a row's column types to `undefined`.
 * Lets mappers feed DB Row types (nullable columns are `T | null`) into domain
 * fields typed `T | undefined` without tripping strict-null checks — purely a
 * type assertion, no runtime change. Use ONLY for mappers whose domain fields
 * are `| undefined` optionals; mappers that preserve `| null` keep the raw Row.
 */
export type NullToUndefined<T> = {
    [K in keyof T]: null extends T[K] ? Exclude<T[K], null> | undefined : T[K];
};
