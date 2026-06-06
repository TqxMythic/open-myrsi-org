import { createHash } from 'node:crypto';

// Salt for opaque public IDs. Sourced from explicit config (PUBLIC_SALT) or the
// session secret — there is deliberately NO baked-in default: a predictable salt
// would make opaque IDs guessable/reversible. JWT_SECRET is required + validated
// at server startup, so this is always present in a real deployment.
const SALT = process.env.PUBLIC_SALT || process.env.JWT_SECRET;

export function opaqueId(internalId: string | number): string {
    if (!SALT) throw new Error('PUBLIC_SALT or JWT_SECRET must be set to derive opaque public IDs.');
    return createHash('sha256').update(`${internalId}::${SALT}`).digest('hex').slice(0, 12);
}
