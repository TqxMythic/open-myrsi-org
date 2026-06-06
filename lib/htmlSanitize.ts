// Conservative server-side strip of unambiguously-dangerous HTML constructs from
// operator-entered rich HTML (the branding `termsOfService`, rendered with
// dangerouslySetInnerHTML in TermsOfServiceView / DashboardView).
//
// Defense-in-depth applied on WRITE. The primary XSS control remains the
// render-time DOMPurify.sanitize() at both sinks; this write-side pass just
// ensures raw <script>/<style>/event-handlers/dangerous-scheme URLs are never
// PERSISTED, so a future non-DOMPurify consumer (email, OG card, a different
// render path) can't resurrect stored XSS. It is NOT a complete HTML parser/
// allow-list — it removes known-dangerous patterns only; do not rely on it as
// the sole sanitizer for an HTML sink.

const DANGEROUS_BLOCK_TAGS = /<\s*(script|style|iframe|object|embed|noscript|template)\b[\s\S]*?<\s*\/\s*\1\s*>/gi;
const DANGEROUS_VOID_TAGS = /<\s*\/?\s*(script|style|iframe|object|embed|noscript|template|link|meta|base|form)\b[^>]*>/gi;
const EVENT_HANDLER_ATTR = /\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
// Neutralise javascript:/vbscript: in any attribute value (the executable
// schemes); data:image is intentionally left alone (benign in <img>).
const DANGEROUS_SCHEME_ATTR = /(\s(?:href|src|xlink:href|formaction|action|data|poster)\s*=\s*)(["']?)\s*(?:javascript|vbscript)\s*:[^"'\s>]*/gi;

const MAX_LEN = 100_000;

/** Strip known-dangerous HTML constructs from operator-entered rich HTML.
 *  Defense-in-depth only (see file header). Non-string input → ''. */
export function sanitizeRichHtml(html: unknown): string {
    if (typeof html !== 'string' || !html) return '';
    return html
        .replace(DANGEROUS_BLOCK_TAGS, '')
        .replace(DANGEROUS_VOID_TAGS, '')
        .replace(EVENT_HANDLER_ATTR, '')
        .replace(DANGEROUS_SCHEME_ATTR, '$1$2#')
        .slice(0, MAX_LEN);
}
