import { describe, it, expect } from 'vitest';
import { sanitizeTiptapJson, tiptapJsonToSafeHtml, isEmptyTiptapDoc } from '../lib/tiptapValidate';

// The sanitize / emit / empty-detect walks over a TipTap JSON document are
// recursive; without a depth cap a deeply-nested doc exhausts the stack and
// throws a RangeError (a single-request 500 reachable by any author). The
// MAX_DEPTH cap means a pathologically deep doc is sanitized, emitted, and
// empty-checked without throwing and with bounded output, while a normal-depth
// doc is left byte-for-byte unchanged.

// Build an iteratively-nested doc so constructing the fixture itself never
// recurses (otherwise the test harness, not the code under test, would throw).
// Each level wraps the previous in a blockquote whose only child is the level
// below; the innermost node carries visible text so empty-detection has to
// descend the whole chain to (try to) find it.
function buildDeepDoc(levels: number): any {
    let node: any = {
        type: 'blockquote',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'deep' }] }],
    };
    for (let i = 0; i < levels; i++) {
        node = { type: 'blockquote', content: [node] };
    }
    return { type: 'doc', content: [node] };
}

// Count the structural depth of a sanitized doc (how far .content chains).
function measureDepth(node: any): number {
    let depth = 0;
    let cur = node;
    while (cur && Array.isArray(cur.content) && cur.content.length > 0) {
        depth++;
        cur = cur.content[0];
    }
    return depth;
}

describe('tiptap recursion depth cap (input-injection#1)', () => {
    // Far beyond any plausible MAX_DEPTH but small enough to construct quickly.
    // Native recursion over a chain this deep reliably exhausts the V8 stack.
    const DEEP = 20000;

    it('sanitizes a pathologically deep doc without throwing, with bounded output', () => {
        const doc = buildDeepDoc(DEEP);
        let cleaned: any;
        expect(() => { cleaned = sanitizeTiptapJson(doc, 'wiki'); }).not.toThrow();
        expect(cleaned).toBeTruthy();
        expect(cleaned.type).toBe('doc');
        // The cap must have truncated the chain well short of the input depth.
        expect(measureDepth(cleaned)).toBeLessThan(DEEP);
        expect(measureDepth(cleaned)).toBeLessThanOrEqual(200);
    });

    it('emits a pathologically deep doc to HTML without throwing, with bounded output', () => {
        const doc = buildDeepDoc(DEEP);
        let html = '';
        expect(() => { html = tiptapJsonToSafeHtml(doc, 'wiki'); }).not.toThrow();
        expect(typeof html).toBe('string');
        // Truncated subtree => far fewer tags than the input nesting depth.
        const openTags = (html.match(/<blockquote>/g) || []).length;
        expect(openTags).toBeLessThan(DEEP);
        expect(openTags).toBeLessThanOrEqual(200);
    });

    it('empty-detects a pathologically deep doc without throwing', () => {
        const doc = buildDeepDoc(DEEP);
        let result: boolean | undefined;
        expect(() => { result = isEmptyTiptapDoc(doc); }).not.toThrow();
        // Text lives below the depth cap, so the walk can't reach it and the
        // doc is reported empty — fail closed, and crucially no RangeError.
        expect(result).toBe(true);
    });
});

describe('tiptap depth cap leaves normal-depth docs unchanged', () => {
    // Realistic nested doc: a bullet list with a nested list and a table — the
    // deepest structures a real wiki author produces, nowhere near the cap.
    const normalDoc = {
        type: 'doc',
        content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world', marks: [{ type: 'bold' }] }] },
            {
                type: 'bulletList',
                content: [
                    {
                        type: 'listItem',
                        content: [
                            { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
                            {
                                type: 'bulletList',
                                content: [
                                    { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'nested' }] }] },
                                ],
                            },
                        ],
                    },
                ],
            },
            {
                type: 'table',
                content: [
                    {
                        type: 'tableRow',
                        content: [
                            { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'cell' }] }] },
                        ],
                    },
                ],
            },
        ],
    };

    it('sanitize output is identical with the cap in place', () => {
        const expected = {
            type: 'doc',
            content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world', marks: [{ type: 'bold' }] }] },
                {
                    type: 'bulletList',
                    content: [
                        {
                            type: 'listItem',
                            content: [
                                { type: 'paragraph', content: [{ type: 'text', text: 'one' }] },
                                {
                                    type: 'bulletList',
                                    content: [
                                        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'nested' }] }] },
                                    ],
                                },
                            ],
                        },
                    ],
                },
                {
                    type: 'table',
                    content: [
                        {
                            type: 'tableRow',
                            content: [
                                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'cell' }] }] },
                            ],
                        },
                    ],
                },
            ],
        };
        expect(sanitizeTiptapJson(normalDoc, 'wiki')).toEqual(expected);
    });

    it('emit output is unchanged with the cap in place', () => {
        const html = tiptapJsonToSafeHtml(normalDoc, 'wiki');
        expect(html).toBe(
            '<p>Hello <strong>world</strong></p>' +
            '<ul><li><p>one</p><ul><li><p>nested</p></li></ul></li></ul>' +
            '<table><tr><td><p>cell</p></td></tr></table>',
        );
    });

    it('empty-detect is unchanged for normal docs', () => {
        expect(isEmptyTiptapDoc(normalDoc)).toBe(false);
        expect(isEmptyTiptapDoc({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(true);
    });
});
