import { describe, it, expect, vi, beforeEach } from 'vitest';

// L7 pinning: the UNAUTHENTICATED public org page re-validates link schemes +
// image URLs on the READ projection (not only at the admin write gate). A
// revert that emits stored config verbatim would re-expose javascript:/private
// -host URLs to anonymous visitors with every other test still green.

const h = vi.hoisted(() => ({ settings: {} as Record<string, any> }));
vi.mock('../lib/db/common', () => ({ supabase: {}, handleSupabaseError: () => {} }));
vi.mock('../lib/db/system', () => ({ getAllSettings: async () => h.settings }));

import { getPublicPageData } from '../lib/db/public';

beforeEach(() => { h.settings = {}; });

describe('getPublicPageData read re-validation (L7)', () => {
    it('drops unsafe links + nulls an unsafe hero image; keeps the safe ones', async () => {
        h.settings = {
            publicPageConfig: {
                enabled: true,
                heroImageUrl: 'javascript:alert(1)',
                profileImageUrl: 'https://cdn.example/avatar.png',
                links: [
                    { id: '1', label: 'evil', url: 'javascript:alert(1)' },
                    { id: '2', label: 'internal', url: 'http://10.0.0.5/x' },
                    { id: '3', label: 'ok', url: 'https://ally.example/page' },
                ],
            },
            brandingConfig: { name: 'Org', iconUrl: '' },
        };
        const res = await getPublicPageData('org');
        expect(res).not.toBeNull();
        expect(res!.heroImageUrl).toBe('');                                 // javascript: image rejected
        expect(res!.profileImageUrl).toBe('https://cdn.example/avatar.png'); // valid https image kept
        expect(res!.links.map(l => l.url)).toEqual(['https://ally.example/page']); // only the safe https link survives
    });
});
