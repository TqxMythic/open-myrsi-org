// First-boot install hook for the single-org self-hosted build.
//
// On server start we check whether any Admin user exists. If not, this is a
// fresh install: we seed default structural data (roles, ranks, units,
// permissions, locations, settings) and mint a one-time admin setup code,
// which is printed to the server console/logs. The operator logs in with
// Discord and redeems the code (state = `admin_setup:<code>`) to claim the
// single Admin seat. The code is single-use and rate-limited (see
// api/actions/auth.ts validateClaimCode).

import { randomBytes } from 'node:crypto';
import { supabase, getSystemRoles } from './db/common.js';
import { seedInstall } from './db/seeder.js';
import { log as baseLog } from './log.js';

const log = baseLog.child({ module: 'lib.firstBoot' });

/** True when at least one non-deleted Admin user exists. Exported so the
 *  org-claim / setup-code redemption paths can refuse self-promotion once an
 *  admin is established — the setup code is first-admin-only. */
export async function adminExists(): Promise<boolean> {
    const roles = await getSystemRoles();
    if (!roles.admin) return false; // roles not seeded yet → definitely no admin
    const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role_id', roles.admin.id)
        .is('deleted_at', null);
    if (error) {
        log.error('admin existence check failed', { err: error });
        // Fail closed: assume an admin exists so we never overwrite a live install
        // or spam setup codes on a transient DB error.
        return true;
    }
    return (count ?? 0) > 0;
}

/** Generate, persist, and console-print a one-time admin setup code. */
async function mintSetupCode(): Promise<string> {
    const code = `SETUP-${randomBytes(4).toString('hex').toUpperCase()}`;
    const { error } = await supabase.from('settings').upsert(
        { key: 'admin_setup_code', value: { code, created_at: new Date().toISOString(), failed_attempts: 0 } },
        { onConflict: 'key' },
    );
    if (error) {
        log.error('failed to persist admin setup code', { err: error });
        throw error;
    }
    printSetupCodeBanner(code);
    return code;
}

/** Loud, log-aggregator-friendly banner so the operator can't miss the code. */
function printSetupCodeBanner(code: string): void {
    const line = '='.repeat(66);
    // Plain console.log (not the JSON logger) so it's copy-pasteable from a raw
    // terminal or Coolify log pane regardless of LOG_LEVEL.
    console.log('');
    console.log(line);
    console.log('  OPEN MYRSI.ORG  —  FIRST-BOOT SETUP');
    console.log(line);
    console.log('  Greetings from Jenk0 — thanks for self-hosting Open MyRSI.org! 🫡');
    console.log('  The in-app setup wizard will guide you through the rest; first,');
    console.log('  claim your Admin seat with the one-time code below.');
    console.log('');
    console.log('  YOUR ONE-TIME ADMIN CLAIM CODE:');
    console.log('');
    console.log(`      >>>   ${code}   <<<`);
    console.log('');
    console.log('  Enter it in the app when prompted. Single-use; restart the server');
    console.log('  to regenerate it if lost.');
    console.log(line);
    console.log('');
    // The code is a redeemable admin credential — do NOT persist it to
    // structured/JSON log storage. The console banner above is the intended
    // operator-facing output (transient terminal/boot log); the structured line
    // only records that a code was generated, never its value.
    log.warn('admin setup code generated (first boot) — see console banner for the one-time code');
}

/**
 * Run once at server startup. If this is a fresh install (no Admin user),
 * seed defaults and print a one-time setup code. Idempotent and best-effort:
 * any failure is logged but never aborts boot (the server must still come up
 * so the operator can investigate).
 */
export async function runFirstBootCheck(): Promise<void> {
    try {
        if (await adminExists()) {
            log.info('first-boot check: admin present, skipping install seed');
            // Backfill: an instance that already has an admin but predates the
            // onboarding wizard must never show it — mark setup complete if unset.
            try {
                const { data } = await supabase.from('settings').select('value').eq('key', 'setup_completed').maybeSingle();
                if (data?.value !== true) {
                    await supabase.from('settings').upsert({ key: 'setup_completed', value: true }, { onConflict: 'key' });
                    log.info('backfilled setup_completed=true for existing-admin instance');
                }
            } catch (err) {
                log.warn('setup_completed backfill failed (non-fatal)', { err });
            }
            return;
        }

        log.info('first-boot check: no admin found, running install seed');
        await seedInstall(); // idempotent (upserts) — safe even if partially seeded

        // Re-check after seeding in case an admin was created concurrently
        // (e.g. another instance redeemed a code mid-seed).
        if (await adminExists()) {
            log.info('admin appeared during seed; not minting setup code');
            return;
        }

        // Don't clobber an unredeemed code from a previous boot.
        const { data: existing } = await supabase
            .from('settings').select('value').eq('key', 'admin_setup_code').maybeSingle();
        if (existing?.value) {
            const code = typeof existing.value === 'string' ? existing.value : (existing.value as { code?: string }).code;
            log.info('reusing existing unredeemed admin setup code');
            if (code) printSetupCodeBanner(code);
            return;
        }

        await mintSetupCode();
    } catch (err) {
        log.error('first-boot check failed (continuing startup)', { err });
    }
}
