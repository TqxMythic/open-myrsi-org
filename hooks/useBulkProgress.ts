import { useCallback, useRef, useState } from 'react';

export interface BulkResult {
    updated: number;
    skipped: number;
    [k: string]: any;
}

export type BulkState = 'idle' | 'running' | 'cancelled' | 'done' | 'error';

export interface UseBulkProgressReturn<T> {
    state: BulkState;
    /** Number of target ids dispatched so far (sum across chunks). */
    processed: number;
    total: number;
    /** Running totals merged from server responses. */
    aggregate: BulkResult;
    error?: string;
    run: (
        targetIds: T[],
        dispatch: (chunk: T[]) => Promise<BulkResult>,
    ) => Promise<BulkResult>;
    cancel: () => void;
    reset: () => void;
}

interface Options {
    /** Users per RPC call. Default 25. */
    chunkSize?: number;
    /** Delay between chunks in ms. Default 150. Prevents API hot-spotting and gives the user a Cancel window. */
    interChunkDelayMs?: number;
}

const DEFAULT_OPTIONS: Required<Options> = {
    chunkSize: 25,
    interChunkDelayMs: 150,
};

/**
 * Splits a bulk operation into client-side chunks and dispatches them
 * sequentially. Each chunk's response is merged into a running aggregate.
 * Cancellation stops scheduling further chunks but doesn't roll back
 * already-committed ones (server-side writes have happened) — the final
 * aggregate reflects what actually got applied.
 */
export function useBulkProgress<T = number>(options: Options = {}): UseBulkProgressReturn<T> {
    const { chunkSize, interChunkDelayMs } = { ...DEFAULT_OPTIONS, ...options };

    const [state, setState] = useState<BulkState>('idle');
    const [processed, setProcessed] = useState(0);
    const [total, setTotal] = useState(0);
    const [aggregate, setAggregate] = useState<BulkResult>({ updated: 0, skipped: 0 });
    const [error, setError] = useState<string | undefined>(undefined);

    const cancelRef = useRef(false);

    const cancel = useCallback(() => {
        cancelRef.current = true;
    }, []);

    const reset = useCallback(() => {
        cancelRef.current = false;
        setState('idle');
        setProcessed(0);
        setTotal(0);
        setAggregate({ updated: 0, skipped: 0 });
        setError(undefined);
    }, []);

    const run = useCallback(async (
        targetIds: T[],
        dispatch: (chunk: T[]) => Promise<BulkResult>,
    ): Promise<BulkResult> => {
        cancelRef.current = false;
        setState('running');
        setProcessed(0);
        setTotal(targetIds.length);
        setAggregate({ updated: 0, skipped: 0 });
        setError(undefined);

        const running: BulkResult = { updated: 0, skipped: 0 };
        const chunks: T[][] = [];
        for (let i = 0; i < targetIds.length; i += chunkSize) {
            chunks.push(targetIds.slice(i, i + chunkSize));
        }

        for (let i = 0; i < chunks.length; i++) {
            if (cancelRef.current) {
                setState('cancelled');
                return running;
            }
            try {
                const chunkResult = await dispatch(chunks[i]);
                running.updated += chunkResult.updated || 0;
                running.skipped += chunkResult.skipped || 0;
                setAggregate({ ...running });
                setProcessed((p) => p + chunks[i].length);
            } catch (e: any) {
                console.error('[useBulkProgress] chunk failed:', e);
                setError(e?.message || 'Bulk action failed');
                setState('error');
                return running;
            }
            // Inter-chunk pause — skip on last chunk so the user isn't waiting
            // an extra 150ms for nothing.
            if (i < chunks.length - 1 && interChunkDelayMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, interChunkDelayMs));
                if (cancelRef.current) {
                    setState('cancelled');
                    return running;
                }
            }
        }

        setState('done');
        return running;
    }, [chunkSize, interChunkDelayMs]);

    return { state, processed, total, aggregate, error, run, cancel, reset };
}
