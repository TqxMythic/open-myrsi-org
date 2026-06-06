
import * as db from '../../lib/db.js';
import { WikiExportBundle, WikiImportMode, User } from '../../types.js';

// Shape of the page payload sent to create/update. Mirrors the fields read by
// lib/db/wiki.ts (createWikiPage / updateWikiPage). `content` is Tiptap JSON,
// passed through sanitizeTiptapJson without being read here.
interface WikiPageData {
    title?: string;
    parentPageId?: string | null;
    content?: unknown;
    classificationLevel?: number;
    menuStructureLocked?: boolean;
    markerIds?: number[];
}

interface CreateWikiPagePayload {
    data: WikiPageData;
    userId: number;
    // Injected server-side by the dispatcher — used for the write-side
    // clearance ceiling (the author can't classify above their own clearance).
    user?: User;
}

interface UpdateWikiPagePayload {
    id: string;
    data: WikiPageData;
    userId: number;
    user?: User;
}

interface DeleteWikiPagePayload {
    id: string;
}

interface ReorderWikiPagesPayload {
    pages: { id: string; sortOrder: number }[];
}

interface ImportWikiPagesPayload {
    bundle: WikiExportBundle;
    mode: WikiImportMode;
    importHomeConfig?: boolean;
    userId: number;
    // Dispatcher-injected actor — used for the clearance clamp +
    // overwrite-visibility guard (import must not bypass createWikiPage's gates).
    user?: User;
}

export const wikiActions = {
    'wiki:create_page': ({ data, userId, user }: CreateWikiPagePayload) => db.createWikiPage(data, userId, user),
    'wiki:update_page': ({ id, data, userId, user }: UpdateWikiPagePayload) => db.updateWikiPage(id, data, userId, user),
    'wiki:delete_page': ({ id }: DeleteWikiPagePayload) => db.deleteWikiPage(id),
    'wiki:reorder_pages': ({ pages }: ReorderWikiPagesPayload) => db.reorderWikiPages(pages),
    'wiki:export_pages': () => db.exportWikiPages(),
    'wiki:import_pages': ({ bundle, mode, importHomeConfig, userId, user }: ImportWikiPagesPayload) =>
        db.importWikiPages(bundle, mode, !!importHomeConfig, userId, user),
};
