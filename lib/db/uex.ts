// =============================================================================
// uexcorp.space API client — single source of truth for all UEX HTTP.
// =============================================================================
//
// All requests are server-side only (called from the admin catalog actions in
// api/actions/catalog.ts). The Bearer token from `process.env.UEX_API_KEY` never
// leaves the server.
//
// Quota (per UEX docs as of 2026-05): 172,800 requests/day, 120 req/min.
// Default delay of 600ms between requests keeps us comfortably under the
// per-minute cap (~100 req/min) without serializing too aggressively.
//
// Failure model: per-category items fetches are tolerated individually so
// one bad category never aborts a full-catalog sync.
// =============================================================================

import { log as baseLog } from '../log.js';
import { stripHtmlSingleLine } from '../textSanitize.js';

// Third-party UEX/wiki catalog strings are stored verbatim and rendered across
// the app, so strip markup + length-cap the DISPLAY free-text on ingest — a
// compromised/typo'd upstream record can't plant markup. Identifier/slug/
// code-shape fields are left exact (slugify constrains slugs; codes are matched,
// not rendered as markup).
const cat = (v: unknown, n = 200): string | null => stripHtmlSingleLine(v, n) || null;

const log = baseLog.child({ module: 'db.uex' });

const UEX_BASE = 'https://api.uexcorp.space/2.0';

const DEFAULT_DELAY_MS = 600;
function getDelayMs(): number {
    const raw = process.env.UEX_REQUEST_DELAY_MS;
    if (!raw) return DEFAULT_DELAY_MS;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DELAY_MS;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let lastRequestAt = 0;
async function throttle(): Promise<void> {
    const delay = getDelayMs();
    if (delay <= 0) return;
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < delay) await sleep(delay - elapsed);
    lastRequestAt = Date.now();
}

/**
 * Authenticated GET against the UEX API. Returns the parsed `data` field of
 * the response. Throws on missing API key, network error, non-2xx status, or
 * `status !== 'ok'` in the body.
 */
async function uexFetch<T = unknown>(path: string): Promise<T> {
    const key = process.env.UEX_API_KEY;
    if (!key) {
        throw new Error('UEX_API_KEY environment variable is not set. Register an app at https://uexcorp.space/api and set the Bearer token.');
    }
    await throttle();
    const url = `${UEX_BASE}${path}`;
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${key}`,
            'Accept': 'application/json',
        },
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`UEX API ${path} returned ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = await res.json() as { status?: string; data?: T; message?: string };
    if (json.status && json.status !== 'ok') {
        throw new Error(`UEX API ${path} status=${json.status}: ${json.message || ''}`);
    }
    return (json.data ?? []) as T;
}

// ---------------------------------------------------------------------------
// Public types — narrow shapes, only the fields we actually consume.
// ---------------------------------------------------------------------------

export interface UexCategory {
    id: number;
    name: string;
    type: string;       // 'item' | 'service' | 'contract' | ...
    section?: string | null;
    is_mining?: number;
}

export interface UexItem {
    id: number;
    id_parent?: number | null;
    id_category?: number | null;
    id_company?: number | null;
    id_vehicle?: number | null;
    name: string;
    section?: string | null;
    category?: string | null;
    company_name?: string | null;
    vehicle_name?: string | null;
    slug: string;
    size?: string | null;
    uuid?: string | null;
    color?: string | null;
    color2?: string | null;
    url_store?: string | null;
    quality?: number | null;
    is_exclusive_pledge?: number;
    is_exclusive_subscriber?: number;
    is_exclusive_concierge?: number;
    is_commodity?: number;
    is_harvestable?: number;
    screenshot?: string | null;
    game_version?: string | null;
    date_added?: number;
    date_modified?: number;
}

export interface UexCommodity {
    id: number;
    id_parent?: number | null;
    name: string;
    code?: string | null;
    slug: string;
    kind?: string | null;
    weight_scu?: number | null;
    price_buy?: number | null;
    price_sell?: number | null;
    is_available?: number;
    is_available_live?: number;
    is_visible?: number;
    is_extractable?: number;
    is_mineral?: number;
    is_raw?: number;
    is_pure?: number;
    is_refined?: number;
    is_refinable?: number;
    is_harvestable?: number;
    is_buyable?: number;
    is_sellable?: number;
    is_temporary?: number;
    is_illegal?: number;
    is_volatile_qt?: number;
    is_volatile_time?: number;
    is_inert?: number;
    is_explosive?: number;
    is_buggy?: number;
    is_fuel?: number;
    wiki?: string | null;
    date_added?: number;
    date_modified?: number;
}

// ---------------------------------------------------------------------------
// Categories — module-level cache (1hr TTL). Items sync calls this once and
// loops the result; cache keeps repeat syncs in the same hour cheap.
// ---------------------------------------------------------------------------

const CATEGORY_CACHE_TTL_MS = 60 * 60 * 1000;
let categoryCache: { fetchedAt: number; data: UexCategory[] } | null = null;

export async function fetchUexCategories(force = false): Promise<UexCategory[]> {
    if (!force && categoryCache && Date.now() - categoryCache.fetchedAt < CATEGORY_CACHE_TTL_MS) {
        return categoryCache.data;
    }
    const data = await uexFetch<UexCategory[]>('/categories');
    categoryCache = { fetchedAt: Date.now(), data };
    return data;
}

export async function fetchUexItemsForCategory(categoryId: number): Promise<UexItem[]> {
    return await uexFetch<UexItem[]>(`/items?id_category=${categoryId}`);
}

export async function fetchUexCommodities(): Promise<UexCommodity[]> {
    return await uexFetch<UexCommodity[]>('/commodities');
}

// ---------------------------------------------------------------------------
// Location endpoints — used by the platform location catalog sync.
// All single-call (no required query params; returns full list per kind).
// Daily UEX cache TTL is 1 day per endpoint.
// ---------------------------------------------------------------------------

export interface UexStarSystem {
    id: number;
    id_faction?: number | null;
    id_jurisdiction?: number | null;
    name: string;
    code?: string | null;
    is_available?: number;
    is_available_live?: number;
    is_visible?: number;
    is_default?: number;
    wiki?: string | null;
    date_added?: number;
    date_modified?: number;
    faction_name?: string | null;
    jurisdiction_name?: string | null;
}

export interface UexOrbit {
    id: number;
    id_star_system: number;
    id_faction?: number | null;
    id_jurisdiction?: number | null;
    name: string;
    name_origin?: string | null;
    code?: string | null;
    is_available?: number;
    is_available_live?: number;
    is_visible?: number;
    is_default?: number;
    is_lagrange?: number;
    is_man_made?: number;
    is_asteroid?: number;
    is_planet?: number;
    is_star?: number;
    is_jump_point?: number;
    date_added?: number;
    date_modified?: number;
    star_system_name?: string | null;
    faction_name?: string | null;
    jurisdiction_name?: string | null;
}

export interface UexPlanet {
    id: number;
    id_star_system: number;
    id_faction?: number | null;
    id_jurisdiction?: number | null;
    name: string;
    name_origin?: string | null;
    code?: string | null;
    is_available?: number;
    is_available_live?: number;
    is_visible?: number;
    is_default?: number;
    is_lagrange?: number;
    date_added?: number;
    date_modified?: number;
    star_system_name?: string | null;
    faction_name?: string | null;
    jurisdiction_name?: string | null;
}

export interface UexMoon {
    id: number;
    id_star_system: number;
    id_planet?: number | null;
    id_orbit?: number | null;
    id_faction?: number | null;
    id_jurisdiction?: number | null;
    name: string;
    name_origin?: string | null;
    code?: string | null;
    is_available?: number;
    is_available_live?: number;
    is_visible?: number;
    is_default?: number;
    date_added?: number;
    date_modified?: number;
    star_system_name?: string | null;
    planet_name?: string | null;
    orbit_name?: string | null;
    faction_name?: string | null;
    jurisdiction_name?: string | null;
}

// Shared shape for places that sit "in" the universe (stations, cities,
// outposts, POIs). All carry the same parent FK columns + amenities flags.
export interface UexPlaceCommon {
    id: number;
    id_star_system: number;
    id_planet?: number | null;
    id_orbit?: number | null;
    id_moon?: number | null;
    id_faction?: number | null;
    id_jurisdiction?: number | null;
    name: string;
    nickname?: string | null;
    is_available?: number;
    is_available_live?: number;
    is_visible?: number;
    is_default?: number;
    is_monitored?: number;
    is_armistice?: number;
    is_landable?: number;
    is_decommissioned?: number;
    has_quantum_marker?: number;
    has_trade_terminal?: number;
    has_habitation?: number;
    has_refinery?: number;
    has_cargo_center?: number;
    has_clinic?: number;
    has_food?: number;
    has_shops?: number;
    has_refuel?: number;
    has_repair?: number;
    has_gravity?: number;
    has_loading_dock?: number;
    has_docking_port?: number;
    has_freight_elevator?: number;
    pad_types?: string | null;
    date_added?: number;
    date_modified?: number;
    star_system_name?: string | null;
    planet_name?: string | null;
    orbit_name?: string | null;
    moon_name?: string | null;
    faction_name?: string | null;
    jurisdiction_name?: string | null;
}

export interface UexSpaceStation extends UexPlaceCommon {
    id_city?: number | null;
    is_lagrange?: number;
    is_jump_point?: number;
    city_name?: string | null;
    code?: string | null;
}

export interface UexCity extends UexPlaceCommon {
    code?: string | null;
    wiki?: string | null;
}

export interface UexOutpost extends UexPlaceCommon {
    // Outposts use the common shape verbatim — no extra fields.
}

export interface UexPoi extends UexPlaceCommon {
    id_space_station?: number | null;
    id_city?: number | null;
    id_outpost?: number | null;
    space_station_name?: string | null;
    city_name?: string | null;
    outpost_name?: string | null;
}

export async function fetchUexStarSystems(): Promise<UexStarSystem[]> {
    return await uexFetch<UexStarSystem[]>('/star_systems');
}

export async function fetchUexOrbits(): Promise<UexOrbit[]> {
    return await uexFetch<UexOrbit[]>('/orbits');
}

export async function fetchUexPlanets(): Promise<UexPlanet[]> {
    return await uexFetch<UexPlanet[]>('/planets');
}

export async function fetchUexMoons(): Promise<UexMoon[]> {
    return await uexFetch<UexMoon[]>('/moons');
}

export async function fetchUexSpaceStations(): Promise<UexSpaceStation[]> {
    return await uexFetch<UexSpaceStation[]>('/space_stations');
}

export async function fetchUexCities(): Promise<UexCity[]> {
    return await uexFetch<UexCity[]>('/cities');
}

export async function fetchUexOutposts(): Promise<UexOutpost[]> {
    return await uexFetch<UexOutpost[]>('/outposts');
}

export async function fetchUexPois(): Promise<UexPoi[]> {
    return await uexFetch<UexPoi[]>('/poi');
}

/**
 * Fetches every item across every UEX item-category. Per-category errors are
 * captured in the `errors` array rather than thrown — one bad category should
 * never abort an otherwise-successful sync.
 */
export async function fetchAllUexItems(): Promise<{
    categories: UexCategory[];
    items: UexItem[];
    errors: Array<{ categoryId: number; categoryName: string; message: string }>;
}> {
    const allCategories = await fetchUexCategories();
    const itemCategories = allCategories.filter(c => c.type === 'item');

    const items: UexItem[] = [];
    const errors: Array<{ categoryId: number; categoryName: string; message: string }> = [];
    // Bound total ingest — UEX is a trusted fixed host, but an upstream bug /
    // spoofed response shouldn't drive an unbounded insert loop.
    const MAX_UEX_ITEMS = 50_000;

    for (const cat of itemCategories) {
        if (items.length >= MAX_UEX_ITEMS) {
            log.warn('uex item ceiling reached — truncating', { cap: MAX_UEX_ITEMS, fetched: items.length });
            break;
        }
        try {
            const batch = await fetchUexItemsForCategory(cat.id);
            items.push(...batch);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            errors.push({ categoryId: cat.id, categoryName: cat.name, message: msg });
            log.warn('item category fetch failed', { categoryId: cat.id, categoryName: cat.name, message: msg });
        }
    }

    log.info('fetched all uex items', { itemCount: items.length, categoryCount: itemCategories.length, errorCount: errors.length });
    return { categories: itemCategories, items, errors };
}

// ---------------------------------------------------------------------------
// Mappers — UEX shape → DB row shape.
// ---------------------------------------------------------------------------

/**
 * The legacy `category` column on quartermaster_catalog has a CHECK constraint:
 * IN ('weapon', 'armor', 'component', 'consumable', 'misc'). UEX has many
 * more categories, so we collapse them via section/category text. The new
 * platform_category_id FK is the real classification — this is purely to
 * satisfy the legacy CHECK so existing tenant queries keep working.
 */
export function uexSectionToQmLegacy(section: string | null | undefined, category: string | null | undefined): 'weapon' | 'armor' | 'component' | 'consumable' | 'misc' {
    const s = (section || '').toLowerCase();
    const c = (category || '').toLowerCase();
    const all = `${s} ${c}`;
    if (/(weapon|gun|rifle|pistol|missile|cannon|launcher|grenade|knife|sword)/.test(all)) return 'weapon';
    if (/(armor|armour|helmet|undersuit|gloves|backpack|chest|legs|core)/.test(all)) return 'armor';
    if (/(component|module|cooler|shield|quantum|power plant|thruster|qed|coupler|generator|reactor|engine|qdrive|propulsion|paint)/.test(all)) return 'component';
    if (/(food|drink|medical|consumable|stim|medpen)/.test(all)) return 'consumable';
    return 'misc';
}

export function slugify(input: string, maxLen = 80): string {
    return (input || '').trim().toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, maxLen) || 'unknown';
}

/**
 * Build a quartermaster_catalog row from a UEX item. The caller passes a
 * `categoryFkLookup` map of `uex_category_id -> platform_category_row.id`
 * built during the sync.
 */
export function mapUexItemToQmRow(
    item: UexItem,
    categoryFkLookup: Map<number, number>
): Record<string, unknown> | null {
    if (!item.uuid) return null; // skip items without a stable uuid
    const platformCategoryId = item.id_category ? categoryFkLookup.get(item.id_category) ?? null : null;
    return {
        slug: item.slug || slugify(item.name),
        name: cat(item.name) || 'Unknown',
        category: uexSectionToQmLegacy(item.section, item.category),
        subcategory: cat(item.category || item.section),
        attributes: {},
        source: 'platform',
        thumbnail_url: item.screenshot || null,
        wiki_url: null,
        external_uuid: item.uuid,
        external_id: item.id || null,
        is_vehicle_item: !!(item.id_vehicle || item.vehicle_name),
        is_commodity: !!item.is_commodity,
        is_harvestable: !!item.is_harvestable,
        screenshot_url: item.screenshot || null,
        store_url: item.url_store || null,
        company_name: cat(item.company_name),
        vehicle_name: cat(item.vehicle_name),
        quality: typeof item.quality === 'number' ? item.quality : null,
        size_label: item.size || null,
        color: item.color || null,
        color2: item.color2 || null,
        game_version: item.game_version || null,
        platform_category_id: platformCategoryId,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}

/**
 * Build a warehouse_platform_commodities row from a UEX commodity. Caller
 * passes a `categoryFkLookup` map of `uex_kind_slug -> platform_category_row.id`.
 */
export function mapUexCommodityToWarehouseRow(
    commodity: UexCommodity,
    categoryFkLookup: Map<string, number>
): Record<string, unknown> {
    const kindSlug = commodity.kind ? slugify(commodity.kind) : '';
    const platformCategoryId = kindSlug ? categoryFkLookup.get(kindSlug) ?? null : null;
    const num = (v: number | null | undefined) => (typeof v === 'number' ? v : null);
    const bool = (v: number | undefined) => (typeof v === 'number' ? v === 1 : null);
    return {
        external_id: commodity.id,
        external_uuid: null,
        slug: commodity.slug || slugify(commodity.name),
        name: cat(commodity.name) || 'Unknown',
        code: cat(commodity.code, 60),
        kind: cat(commodity.kind, 80),
        weight_scu: num(commodity.weight_scu),
        price_buy: num(commodity.price_buy),
        price_sell: num(commodity.price_sell),
        is_available: bool(commodity.is_available),
        is_available_live: bool(commodity.is_available_live),
        is_visible: bool(commodity.is_visible),
        is_extractable: bool(commodity.is_extractable),
        is_mineral: bool(commodity.is_mineral),
        is_raw: bool(commodity.is_raw),
        is_pure: bool(commodity.is_pure),
        is_refined: bool(commodity.is_refined),
        is_refinable: bool(commodity.is_refinable),
        is_harvestable: bool(commodity.is_harvestable),
        is_buyable: bool(commodity.is_buyable),
        is_sellable: bool(commodity.is_sellable),
        is_temporary: bool(commodity.is_temporary),
        is_illegal: bool(commodity.is_illegal),
        is_volatile_qt: bool(commodity.is_volatile_qt),
        is_volatile_time: bool(commodity.is_volatile_time),
        is_inert: bool(commodity.is_inert),
        is_explosive: bool(commodity.is_explosive),
        is_buggy: bool(commodity.is_buggy),
        is_fuel: bool(commodity.is_fuel),
        wiki_url: commodity.wiki || null,
        platform_category_id: platformCategoryId,
        uex_date_added: typeof commodity.date_added === 'number' ? commodity.date_added : null,
        uex_date_modified: typeof commodity.date_modified === 'number' ? commodity.date_modified : null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    };
}
