/**
 * Server-side resolution and multi-scope search dispatch for granted extra knowledge scopes (CT-3).
 *
 * All extra knowledge scopes are resolved strictly from persisted, audience-filtered `SpaceGrant`
 * records using batched `RunView` (`ResultType: 'simple'`) queries — never from client-supplied
 * scope IDs — and authorized against `MJ: Search Scopes` and `MJ: Search Scope Permissions`
 * before entering `ExecuteAgentParams.SearchScopeIDs` or turn-level search dispatch.
 */
import { LogError, RunView, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import { UUIDsEqual } from '@memberjunction/global';
import {
    type ChatAudience,
    type EffectiveGrant,
    type EffectiveSpaceConfiguration,
    type KnowledgeSourceGrantSettings,
    normalizeReceiptUuid,
    normalizeScopeName,
    type SourceReceiptBand,
    stripRecordKeyPrefix,
    type ValidatedSuppliedSourceCandidate,
} from '@mj-biz-apps/collaboration-core';
import {
    clampRetrievalTopK,
    estimateTokenCount,
    MAX_TOKENS_PER_SOURCE_CEILING,
    type SearchEngineLike,
    type SearchEngineSearchParams,
    type SearchEngineSearchResultItem,
    tryLoadHostSearchEngine,
} from './space-agent-retrieval-ranking.js';
import { COLLABORATION_SPACE_SCOPE_ID } from './turn-tools.js';

export const COLLABORATION_SPACE_SCOPE_NAME = 'Collaboration Space Scope';

const CONTENT_SOURCES_ENTITY = 'MJ: Content Sources';
const SEARCH_SCOPES_ENTITY = 'MJ: Search Scopes';
const SEARCH_SCOPE_ENTITIES_ENTITY = 'MJ: Search Scope Entities';
const SEARCH_SCOPE_PERMISSIONS_ENTITY = 'MJ: Search Scope Permissions';

const UUID_EXTRACT_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const DEFAULT_MAX_MULTI_SCOPE_RESULTS = 20;
const MAX_SNIPPET_CHARS = 800;

interface ContentSourceBatchRow {
    ID: string;
    Name: string | null;
    Configuration?: string | null;
}

interface SearchScopeEntityBatchRow {
    ID: string;
    SearchScopeID: string;
    EntityID: string;
    ExtraFilter: string | null;
}

interface SearchScopeBatchRow {
    ID: string;
    Name: string | null;
    Status: string | null;
    IsGlobal?: boolean | null;
    StartAt?: Date | string | null;
    EndAt?: Date | string | null;
    OwnerUserID?: string | null;
    ScopeConfig?: string | null;
}

interface SearchScopePermissionBatchRow {
    ID: string;
    SearchScopeID: string;
    UserID: string | null;
    RoleID: string | null;
    PermissionLevel: string | null;
    PrimaryScopeRecordID?: string | null;
}

interface ParsedContentSourceConfig {
    SearchScopeID?: string;
    searchScopeId?: string;
    SearchScopeIDs?: string[];
    searchScopeIds?: string[];
}

interface ParsedSearchScopeConfig {
    ContentSourceID?: string;
    contentSourceId?: string;
    ContentSourceIDs?: string[];
    contentSourceIds?: string[];
}

export interface ResolvedKnowledgeScope {
    scopeId: string;
    scopeName: string;
    maxBand: SourceReceiptBand;
    contentSourceIds: string[];
    contentSourceNamesById: ReadonlyMap<string, string>;
    sequence: number;
}

export interface RejectedKnowledgeScope {
    scopeId: string;
    scopeName: string | null;
    reason: string;
}

export interface GrantedKnowledgeScopeSearchHit {
    contentSourceId: string;
    contentSourceName: string;
    band: SourceReceiptBand;
    scopeId: string;
    scopeName: string;
    entityName: string;
    recordId: string;
    title: string;
    snippet: string;
    score: number | null;
    rank: number;
    rankingMode: 'vector' | 'lexical';
    targetEntityId: string | null;
}

export interface ResolvedTurnKnowledgeScopesResult {
    nativeScope: {
        scopeId: string;
        scopeName: string;
    };
    grantedScopes: ResolvedKnowledgeScope[];
    searchScopeIds: string[];
    scopeById: ReadonlyMap<string, ResolvedKnowledgeScope>;
    scopeByContentSourceId: ReadonlyMap<string, ResolvedKnowledgeScope>;
    contentSourceNamesById: ReadonlyMap<string, string>;
    maxBandByContentSourceId: ReadonlyMap<string, SourceReceiptBand>;
    rejectedScopes: RejectedKnowledgeScope[];
}

export interface ResolveTurnKnowledgeScopesParams {
    provider: IMetadataProvider;
    systemUser: UserInfo;
    contextUser: UserInfo;
    configuration: EffectiveSpaceConfiguration;
    audience: ChatAudience;
    audienceUsers?: readonly UserInfo[];
    primaryScopeRecordId?: string | null;
    now?: Date;
}

export interface MultiScopeTurnSearchDispatchInput {
    query: string;
    spaceId: string;
    spaceChatId?: string;
    maxResults: number;
    nativeScope: { scopeId: string; scopeName: string };
    grantedScopes: readonly ResolvedKnowledgeScope[];
    scopeById: ReadonlyMap<string, ResolvedKnowledgeScope>;
    scopeByContentSourceId: ReadonlyMap<string, ResolvedKnowledgeScope>;
    contentSourceNamesById: ReadonlyMap<string, string>;
    maxBandByContentSourceId: ReadonlyMap<string, SourceReceiptBand>;
    searchScopeIds: readonly string[];
    audienceUsers?: readonly UserInfo[];
    contextUser: UserInfo;
    provider: IMetadataProvider;
}

export type MultiScopeTurnSearchDispatcher = (
    params: SearchEngineSearchParams,
    contextUser: UserInfo,
) => Promise<{
    Success: boolean;
    Results: SearchEngineSearchResultItem[];
    ErrorMessage?: string;
}>;

export interface DispatchMultiScopeTurnSearchResult {
    extraKnowledgeCandidates: ValidatedSuppliedSourceCandidate[];
    grantedKnowledgeHits: GrantedKnowledgeScopeSearchHit[];
    nativeToolHits: SearchEngineSearchResultItem[];
}

/** Escapes SQL single quotes safely for dynamic IN (...) or LIKE predicates. */
export function escapeSqlLiteral(value: string): string {
    return value.replace(/'/g, "''");
}

function buildSqlInClause(normalizedUuids: readonly string[]): string {
    return normalizedUuids.map((id) => `'${escapeSqlLiteral(id)}'`).join(', ');
}

function collectUuidsFromJsonField(
    target: Set<string>,
    singleA: string | undefined,
    singleB: string | undefined,
    listA: string[] | undefined,
    listB: string[] | undefined,
): void {
    for (const candidate of [singleA, singleB, ...(listA ?? []), ...(listB ?? [])]) {
        const clean = normalizeReceiptUuid(candidate);
        if (clean) target.add(clean);
    }
}

function parseGrantSettingsScopes(grant: EffectiveGrant): string[] {
    const raw = grant.Settings;
    if (!raw || typeof raw !== 'object') return [];
    const ks = raw as KnowledgeSourceGrantSettings;
    const out = new Set<string>();
    collectUuidsFromJsonField(out, ks.SearchScopeID, undefined, ks.SearchScopeIDs, undefined);
    return Array.from(out);
}

function parseContentSourceConfigScopes(rawConfig: string | null | undefined): string[] {
    if (typeof rawConfig !== 'string' || !rawConfig.trim()) return [];
    try {
        const parsed = JSON.parse(rawConfig) as ParsedContentSourceConfig | null;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
        const out = new Set<string>();
        collectUuidsFromJsonField(
            out,
            parsed.SearchScopeID,
            parsed.searchScopeId,
            parsed.SearchScopeIDs,
            parsed.searchScopeIds,
        );
        return Array.from(out);
    } catch {
        return [];
    }
}

function parseScopeConfigContentSources(rawConfig: string | null | undefined): string[] {
    if (typeof rawConfig !== 'string' || !rawConfig.trim()) return [];
    try {
        const parsed = JSON.parse(rawConfig) as ParsedSearchScopeConfig | null;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
        const out = new Set<string>();
        collectUuidsFromJsonField(
            out,
            parsed.ContentSourceID,
            parsed.contentSourceId,
            parsed.ContentSourceIDs,
            parsed.contentSourceIds,
        );
        return Array.from(out);
    } catch {
        return [];
    }
}

function extractNormalizedUuidsFromText(text: string | null | undefined): string[] {
    if (typeof text !== 'string' || !text.trim()) return [];
    const matches = text.match(UUID_EXTRACT_REGEX);
    if (!matches) return [];
    const out = new Set<string>();
    for (const m of matches) {
        const norm = normalizeReceiptUuid(m);
        if (norm) out.add(norm);
    }
    return Array.from(out);
}

function parseDateValue(raw: Date | string | null | undefined): Date | null {
    if (!raw) return null;
    if (raw instanceof Date) {
        return Number.isNaN(raw.getTime()) ? null : raw;
    }
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
}

function isScopeWithinActiveWindow(row: SearchScopeBatchRow, now: Date): string | null {
    const status = (row.Status ?? '').trim();
    if (status !== 'Active') {
        return `Scope status is '${status || 'unknown'}' rather than 'Active'`;
    }
    if (row.IsGlobal === true) {
        return 'Global search scopes cannot be auto-granted as extra knowledge scopes';
    }
    const startAt = parseDateValue(row.StartAt);
    if (startAt && startAt.getTime() > now.getTime()) {
        return `Scope is not active until ${startAt.toISOString()}`;
    }
    const endAt = parseDateValue(row.EndAt);
    if (endAt && endAt.getTime() < now.getTime()) {
        return `Scope expired at ${endAt.toISOString()}`;
    }
    return null;
}

function evaluateUserScopeSearchPermission(
    user: UserInfo,
    scopeId: string,
    ownerUserId: string | null | undefined,
    permRows: readonly SearchScopePermissionBatchRow[],
    primaryScopeRecordId: string | null,
): boolean {
    const cleanUserId = normalizeReceiptUuid(user.ID);
    if (!cleanUserId) return false;

    const cleanOwnerId = normalizeReceiptUuid(ownerUserId);

    const userRoleIds = new Set<string>();
    for (const ur of user.UserRoles ?? []) {
        const rid = normalizeReceiptUuid(ur?.RoleID);
        if (rid) userRoleIds.add(rid);
    }

    let directLevel: 'None' | 'Read' | 'Search' | 'Manage' | null = null;
    let roleHasSearch = false;

    for (const row of permRows) {
        if (!UUIDsEqual(row.SearchScopeID, scopeId)) continue;
        const rowTenantId = normalizeReceiptUuid(row.PrimaryScopeRecordID);
        if (rowTenantId && (!primaryScopeRecordId || !UUIDsEqual(rowTenantId, primaryScopeRecordId))) {
            continue;
        }
        const level = (row.PermissionLevel ?? '').trim();
        const rowUserId = normalizeReceiptUuid(row.UserID);
        if (rowUserId && UUIDsEqual(rowUserId, cleanUserId)) {
            if (level === 'None') {
                return false;
            }
            if (level === 'Manage') {
                directLevel = 'Manage';
            } else if (level === 'Search' && directLevel !== 'Manage') {
                directLevel = 'Search';
            } else if (level === 'Read' && directLevel === null) {
                directLevel = 'Read';
            }
        }
        const rowRoleId = normalizeReceiptUuid(row.RoleID);
        if (rowRoleId && userRoleIds.has(rowRoleId)) {
            if (level === 'Search' || level === 'Manage') {
                roleHasSearch = true;
            }
        }
    }

    if (directLevel === 'Search' || directLevel === 'Manage') {
        return true;
    }
    if (roleHasSearch) {
        return true;
    }
    // Personal scope owned by the user themselves without explicit deny
    if (cleanOwnerId && UUIDsEqual(cleanOwnerId, cleanUserId)) {
        return true;
    }
    return false;
}

/**
 * Resolves the turn's native space scope and all authorized granted extra knowledge scopes
 * strictly from persisted `SpaceGrant` (`Kind = 'KnowledgeSource'`) records for `audience`
 * using batched `RunView` (`ResultType: 'simple'`, escaped batched `ExtraFilter`) queries.
 */
export async function resolveTurnKnowledgeScopes(
    params: ResolveTurnKnowledgeScopesParams,
): Promise<ResolvedTurnKnowledgeScopesResult> {
    const rv = RunView.FromMetadataProvider(params.provider);
    const nativeScopeId = normalizeReceiptUuid(COLLABORATION_SPACE_SCOPE_ID)!;
    const now = params.now ?? new Date();

    // Align effective band precedence per ContentSourceID with ResolveSpaceConfiguration /
    // resolveEffectiveKnowledgeSourceBandsBySpace and SQL fnEffectiveKnowledgeSourceGrants
    // (last/highest-sequence grant in effective order wins).
    const effectiveBandByContentSourceId = new Map<string, SourceReceiptBand>();
    for (const grant of params.configuration.Grants.KnowledgeSource) {
        const csId = normalizeReceiptUuid(stripRecordKeyPrefix(grant.TargetRecordID));
        if (!csId) continue;
        const grantBand: SourceReceiptBand = grant.Band === 'Team' ? 'Team' : 'Shared';
        effectiveBandByContentSourceId.set(csId, grantBand);
    }

    const inForceGrants = params.configuration.Grants.KnowledgeSource.filter((grant) => {
        const csId = normalizeReceiptUuid(stripRecordKeyPrefix(grant.TargetRecordID));
        if (!csId) return false;
        const effectiveBand = effectiveBandByContentSourceId.get(csId) ?? (grant.Band === 'Team' ? 'Team' : 'Shared');
        return params.audience === 'Team' || effectiveBand === 'Shared';
    });

    const grantedContentSourceIds: string[] = [];
    const grantedContentSourceSet = new Set<string>();
    const maxBandByContentSourceId = new Map<string, SourceReceiptBand>();
    const grantSequenceByContentSourceId = new Map<string, number>();
    const explicitScopeIdsByContentSource = new Map<string, Set<string>>();

    for (const grant of inForceGrants) {
        const csId = normalizeReceiptUuid(stripRecordKeyPrefix(grant.TargetRecordID));
        if (!csId) continue;

        const effectiveBand = effectiveBandByContentSourceId.get(csId) ?? (grant.Band === 'Team' ? 'Team' : 'Shared');
        maxBandByContentSourceId.set(csId, effectiveBand);
        if (!grantSequenceByContentSourceId.has(csId)) {
            grantSequenceByContentSourceId.set(csId, grant.Sequence ?? 0);
        }

        if (!grantedContentSourceSet.has(csId)) {
            grantedContentSourceSet.add(csId);
            grantedContentSourceIds.push(csId);
        }

        const settingsScopes = parseGrantSettingsScopes(grant);
        if (settingsScopes.length > 0) {
            const existing = explicitScopeIdsByContentSource.get(csId) ?? new Set<string>();
            for (const sid of settingsScopes) {
                if (sid !== nativeScopeId) {
                    existing.add(sid);
                }
            }
            explicitScopeIdsByContentSource.set(csId, existing);
        }
    }

    const contentSourceNamesById = new Map<string, string>();
    const candidateScopeIdsByContentSource = new Map<string, Set<string>>();
    const contentSourceIdsByCandidateScope = new Map<string, Set<string>>();
    const registerScopeLink = (csId: string, scopeId: string): void => {
        if (scopeId === nativeScopeId) return;
        const scopeSet = candidateScopeIdsByContentSource.get(csId) ?? new Set<string>();
        scopeSet.add(scopeId);
        candidateScopeIdsByContentSource.set(csId, scopeSet);

        const csSet = contentSourceIdsByCandidateScope.get(scopeId) ?? new Set<string>();
        csSet.add(csId);
        contentSourceIdsByCandidateScope.set(scopeId, csSet);
    };

    for (const [csId, scopeSet] of explicitScopeIdsByContentSource.entries()) {
        for (const scopeId of scopeSet) {
            registerScopeLink(csId, scopeId);
        }
    }

    if (grantedContentSourceIds.length > 0) {
        const csInClause = buildSqlInClause(grantedContentSourceIds);
        const likeClauses = grantedContentSourceIds
            .map((id) => `ExtraFilter LIKE '%${escapeSqlLiteral(id)}%'`)
            .join(' OR ');

        const [csRes, scopeEntitiesRes] = await Promise.all([
            rv.RunView<ContentSourceBatchRow>(
                {
                    EntityName: CONTENT_SOURCES_ENTITY,
                    ExtraFilter: `ID IN (${csInClause})`,
                    Fields: ['ID', 'Name', 'Configuration'],
                    ResultType: 'simple',
                    // row-cap-ok: bounded by granted KnowledgeSource IDs in one space configuration
                    MaxRows: 500,
                },
                params.systemUser,
            ),
            rv.RunView<SearchScopeEntityBatchRow>(
                {
                    EntityName: SEARCH_SCOPE_ENTITIES_ENTITY,
                    ExtraFilter: likeClauses,
                    Fields: ['ID', 'SearchScopeID', 'EntityID', 'ExtraFilter'],
                    ResultType: 'simple',
                    // row-cap-ok: bounded by SearchScopeEntity lanes matching granted ContentSource UUIDs
                    MaxRows: 500,
                },
                params.systemUser,
            ),
        ]);

        if (csRes?.Success && csRes.Results) {
            for (const row of csRes.Results) {
                const csId = normalizeReceiptUuid(row.ID);
                if (!csId) continue;
                if (typeof row.Name === 'string' && row.Name.trim()) {
                    contentSourceNamesById.set(csId, row.Name.trim());
                }
                for (const cfgScopeId of parseContentSourceConfigScopes(row.Configuration)) {
                    registerScopeLink(csId, cfgScopeId);
                }
            }
        } else if (csRes && !csRes.Success) {
            LogError(`resolveTurnKnowledgeScopes: batched Content Sources read failed: ${csRes.ErrorMessage ?? 'unknown error'}`);
        }

        if (scopeEntitiesRes?.Success && scopeEntitiesRes.Results) {
            for (const row of scopeEntitiesRes.Results) {
                const scopeId = normalizeReceiptUuid(row.SearchScopeID);
                if (!scopeId || scopeId === nativeScopeId) continue;
                for (const foundUuid of extractNormalizedUuidsFromText(row.ExtraFilter)) {
                    if (grantedContentSourceSet.has(foundUuid)) {
                        registerScopeLink(foundUuid, scopeId);
                    }
                }
            }
        }
    }

    const allCandidateScopeIds = [nativeScopeId, ...Array.from(contentSourceIdsByCandidateScope.keys())];
    const scopeInClause = buildSqlInClause(allCandidateScopeIds);
    const scopeConfigLikes =
        grantedContentSourceIds.length > 0
            ? grantedContentSourceIds
                  .map((id) => `ScopeConfig LIKE '%${escapeSqlLiteral(id)}%'`)
                  .join(' OR ')
            : '';
    const scopesFilter = scopeConfigLikes
        ? `(ID IN (${scopeInClause}) OR ${scopeConfigLikes})`
        : `ID IN (${scopeInClause})`;

    let nativeScopeName = COLLABORATION_SPACE_SCOPE_NAME;
    const activeExtraScopeRows = new Map<string, SearchScopeBatchRow>();
    const rejectedScopes: RejectedKnowledgeScope[] = [];

    const scopesRes = await rv.RunView<SearchScopeBatchRow>(
        {
            EntityName: SEARCH_SCOPES_ENTITY,
            ExtraFilter: scopesFilter,
            Fields: ['ID', 'Name', 'Status', 'IsGlobal', 'StartAt', 'EndAt', 'OwnerUserID', 'ScopeConfig'],
            ResultType: 'simple',
            // row-cap-ok: bounded by native scope plus granted knowledge scopes for one turn
            MaxRows: 500,
        },
        params.systemUser,
    );

    if (scopesRes?.Success && scopesRes.Results) {
        for (const row of scopesRes.Results) {
            const sid = normalizeReceiptUuid(row.ID);
            if (!sid) continue;
            if (sid === nativeScopeId) {
                nativeScopeName = normalizeScopeName(row.Name) ?? COLLABORATION_SPACE_SCOPE_NAME;
                continue;
            }
            for (const linkedCsId of parseScopeConfigContentSources(row.ScopeConfig)) {
                if (grantedContentSourceSet.has(linkedCsId)) {
                    registerScopeLink(linkedCsId, sid);
                }
            }
            if (!contentSourceIdsByCandidateScope.has(sid)) {
                continue;
            }
            const windowError = isScopeWithinActiveWindow(row, now);
            if (windowError) {
                rejectedScopes.push({
                    scopeId: sid,
                    scopeName: normalizeScopeName(row.Name),
                    reason: windowError,
                });
                continue;
            }
            activeExtraScopeRows.set(sid, row);
        }
    } else if (scopesRes && !scopesRes.Success) {
        LogError(`resolveTurnKnowledgeScopes: batched Search Scopes read failed: ${scopesRes.ErrorMessage ?? 'unknown error'}`);
    }

    // Track explicit scope IDs that did not resolve to any active scope row
    for (const candidateId of contentSourceIdsByCandidateScope.keys()) {
        if (!activeExtraScopeRows.has(candidateId) && !rejectedScopes.some((r) => r.scopeId === candidateId)) {
            rejectedScopes.push({
                scopeId: candidateId,
                scopeName: null,
                reason: 'Search Scope record was not found or is inactive',
            });
        }
    }

    const activeExtraScopeIds = Array.from(activeExtraScopeRows.keys());
    const readers: UserInfo[] = [params.contextUser];
    const seenReaderIds = new Set<string>();
    const contextUid = normalizeReceiptUuid(params.contextUser.ID);
    if (contextUid) seenReaderIds.add(contextUid);
    for (const r of params.audienceUsers ?? []) {
        const rid = normalizeReceiptUuid(r?.ID);
        if (rid && !seenReaderIds.has(rid)) {
            seenReaderIds.add(rid);
            readers.push(r);
        }
    }

    const authorizedScopeIds = new Set<string>();
    if (activeExtraScopeIds.length > 0) {
        const permRes = await rv.RunView<SearchScopePermissionBatchRow>(
            {
                EntityName: SEARCH_SCOPE_PERMISSIONS_ENTITY,
                ExtraFilter: `SearchScopeID IN (${buildSqlInClause(activeExtraScopeIds)})`,
                Fields: ['ID', 'SearchScopeID', 'UserID', 'RoleID', 'PermissionLevel', 'PrimaryScopeRecordID'],
                ResultType: 'simple',
                // row-cap-ok: bounded by Search Scope Permission rows for granted scopes of one turn
                MaxRows: 2000,
            },
            params.systemUser,
        );

        if (!permRes?.Success) {
            for (const [sid, scopeRow] of activeExtraScopeRows.entries()) {
                rejectedScopes.push({
                    scopeId: sid,
                    scopeName: normalizeScopeName(scopeRow.Name),
                    reason: 'Failed closed because Search Scope Permissions could not be verified',
                });
            }
        } else {
            const permRows = permRes.Results ?? [];
            const cleanPrimaryId = normalizeReceiptUuid(params.primaryScopeRecordId);
            for (const [sid, scopeRow] of activeExtraScopeRows.entries()) {
                let allPermitted = true;
                for (const reader of readers) {
                    if (!evaluateUserScopeSearchPermission(reader, sid, scopeRow.OwnerUserID, permRows, cleanPrimaryId)) {
                        allPermitted = false;
                        break;
                    }
                }
                if (allPermitted) {
                    authorizedScopeIds.add(sid);
                } else {
                    rejectedScopes.push({
                        scopeId: sid,
                        scopeName: normalizeScopeName(scopeRow.Name),
                        reason: 'Caller or conversation audience lacks Search permission on this scope',
                    });
                }
            }
        }
    }

    const grantedScopes: ResolvedKnowledgeScope[] = [];
    const scopeById = new Map<string, ResolvedKnowledgeScope>();
    const scopeByContentSourceId = new Map<string, ResolvedKnowledgeScope>();

    for (const sid of authorizedScopeIds) {
        const scopeRow = activeExtraScopeRows.get(sid);
        if (!scopeRow) continue;
        const linkedCsIds = Array.from(contentSourceIdsByCandidateScope.get(sid) ?? []);
        const validCsIds = linkedCsIds.filter((csId) => {
            const csExists = contentSourceNamesById.size === 0 || contentSourceNamesById.has(csId);
            return csExists;
        });
        const effectiveCsIds = validCsIds.length > 0 ? validCsIds : linkedCsIds;
        if (effectiveCsIds.length === 0) continue;

        let maxBand: SourceReceiptBand = 'Shared';
        let minSequence = Number.MAX_SAFE_INTEGER;
        const localNames = new Map<string, string>();
        for (const csId of effectiveCsIds) {
            const b = maxBandByContentSourceId.get(csId) ?? 'Shared';
            if (b === 'Team') {
                maxBand = 'Team';
            }
            const seq = grantSequenceByContentSourceId.get(csId) ?? 0;
            if (seq < minSequence) {
                minSequence = seq;
            }
            const csName = contentSourceNamesById.get(csId);
            if (csName) {
                localNames.set(csId, csName);
            }
        }

        const resolved: ResolvedKnowledgeScope = {
            scopeId: sid,
            scopeName: normalizeScopeName(scopeRow.Name) ?? `Search Scope ${sid.slice(0, 8)}`,
            maxBand,
            contentSourceIds: effectiveCsIds,
            contentSourceNamesById: localNames,
            sequence: minSequence === Number.MAX_SAFE_INTEGER ? 0 : minSequence,
        };
        grantedScopes.push(resolved);
        scopeById.set(sid, resolved);
    }

    grantedScopes.sort((a, b) => (a.sequence !== b.sequence ? a.sequence - b.sequence : a.scopeId.localeCompare(b.scopeId)));

    for (const scope of grantedScopes) {
        for (const csId of scope.contentSourceIds) {
            if (!scopeByContentSourceId.has(csId)) {
                scopeByContentSourceId.set(csId, scope);
            }
        }
    }

    const searchScopeIds = [COLLABORATION_SPACE_SCOPE_ID, ...grantedScopes.map((s) => s.scopeId)];

    return {
        nativeScope: {
            scopeId: COLLABORATION_SPACE_SCOPE_ID,
            scopeName: nativeScopeName,
        },
        grantedScopes,
        searchScopeIds,
        scopeById,
        scopeByContentSourceId,
        contentSourceNamesById,
        maxBandByContentSourceId,
        rejectedScopes,
    };
}

function readRawMetaField(
    rawMetadata: string | Record<string, string | number | boolean | null> | undefined,
    key: string,
): string | null {
    if (!rawMetadata) return null;
    if (typeof rawMetadata === 'string') {
        try {
            const parsed = JSON.parse(rawMetadata) as Record<string, string | number | boolean | null>;
            const val = parsed[key];
            return typeof val === 'string' ? val : null;
        } catch {
            return null;
        }
    }
    const val = rawMetadata[key];
    return typeof val === 'string' ? val : null;
}

function clampSnippetText(raw: string | null | undefined): string {
    if (typeof raw !== 'string') return '';
    const collapsed = raw.replace(/\s+/g, ' ').trim();
    if (!collapsed) return '';
    const maxChars = Math.min(MAX_SNIPPET_CHARS, MAX_TOKENS_PER_SOURCE_CEILING * 4);
    return collapsed.length <= maxChars ? collapsed : `${collapsed.slice(0, maxChars - 3).trimEnd()}...`;
}

/**
 * Executes a bounded multi-scope search across the space's native scope and all authorized
 * granted extra knowledge scopes, attributing exact `OriginatingScopeID` and
 * `OriginatingScopeName` onto every returned hit and emitted source candidate.
 */
export async function dispatchMultiScopeTurnSearch(
    input: MultiScopeTurnSearchDispatchInput,
    dispatcher?: MultiScopeTurnSearchDispatcher,
): Promise<DispatchMultiScopeTurnSearchResult> {
    const cleanQuery = input.query.trim();
    if (!cleanQuery || (input.grantedScopes.length === 0 && !dispatcher)) {
        return {
            extraKnowledgeCandidates: [],
            grantedKnowledgeHits: [],
            nativeToolHits: [],
        };
    }

    let searchFn: MultiScopeTurnSearchDispatcher | null = dispatcher ?? null;
    if (!searchFn) {
        const engine: SearchEngineLike | null = tryLoadHostSearchEngine();
        if (!engine) {
            return {
                extraKnowledgeCandidates: [],
                grantedKnowledgeHits: [],
                nativeToolHits: [],
            };
        }
        try {
            if (engine.IsConfigured === false || engine.IsConfigured === undefined) {
                await engine.Config({}, input.contextUser);
            }
        } catch {
            return {
                extraKnowledgeCandidates: [],
                grantedKnowledgeHits: [],
                nativeToolHits: [],
            };
        }
        searchFn = (searchParams, contextUser) => engine.Search(searchParams, contextUser);
    }

    const boundedTopK = Math.min(clampRetrievalTopK(input.maxResults), DEFAULT_MAX_MULTI_SCOPE_RESULTS);
    let searchRes: { Success: boolean; Results: SearchEngineSearchResultItem[]; ErrorMessage?: string };
    try {
        searchRes = await searchFn(
            {
                Query: cleanQuery,
                MaxResults: boundedTopK,
                ScopeIDs: [...input.searchScopeIds],
                ...(input.spaceChatId
                    ? {
                          SearchContext: {
                              PrimaryScopeEntityName: 'MJ_BizApps_Collaboration: Space Chats',
                              PrimaryScopeRecordID: input.spaceChatId,
                          },
                      }
                    : {}),
                ...(input.audienceUsers && input.audienceUsers.length > 0
                    ? { Audience: { Readers: [...input.audienceUsers] } }
                    : {}),
            },
            input.contextUser,
        );
    } catch (err) {
        LogError(`dispatchMultiScopeTurnSearch warning: ${err instanceof Error ? err.message : String(err)}`);
        return {
            extraKnowledgeCandidates: [],
            grantedKnowledgeHits: [],
            nativeToolHits: [],
        };
    }

    if (!searchRes.Success || !Array.isArray(searchRes.Results)) {
        return {
            extraKnowledgeCandidates: [],
            grantedKnowledgeHits: [],
            nativeToolHits: [],
        };
    }

    const nativeId = normalizeReceiptUuid(input.nativeScope.scopeId)!;
    const cleanSpaceId = normalizeReceiptUuid(input.spaceId);
    const contentSourceEntityId =
        typeof input.provider.EntityByName === 'function'
            ? normalizeReceiptUuid(input.provider.EntityByName(CONTENT_SOURCES_ENTITY)?.ID)
            : null;

    const grantedKnowledgeHits: GrantedKnowledgeScopeSearchHit[] = [];
    const extraKnowledgeCandidates: ValidatedSuppliedSourceCandidate[] = [];
    const nativeToolHits: SearchEngineSearchResultItem[] = [];
    const seenContentSourceIds = new Set<string>();

    let extraRank = 0;
    for (const item of searchRes.Results) {
        const hitScopeId = normalizeReceiptUuid(item.OriginatingScopeID) ?? nativeId;
        if (hitScopeId === nativeId) {
            nativeToolHits.push({
                ...item,
                OriginatingScopeID: nativeId,
                OriginatingScopeName: normalizeScopeName(item.OriginatingScopeName) ?? input.nativeScope.scopeName,
            });
            continue;
        }

        // Fail closed: reject any hit whose scope ID is not one of the turn's authorized granted scopes
        const grantedScope = input.scopeById.get(hitScopeId);
        if (!grantedScope || !cleanSpaceId) {
            continue;
        }

        const rawCsId = normalizeReceiptUuid(stripRecordKeyPrefix(readRawMetaField(item.RawMetadata, 'ContentSourceID')));
        const resolvedCsId =
            (rawCsId && grantedScope.contentSourceIds.includes(rawCsId) ? rawCsId : null) ??
            grantedScope.contentSourceIds[0] ??
            null;
        if (!resolvedCsId) {
            continue;
        }

        const band = input.maxBandByContentSourceId.get(resolvedCsId) ?? grantedScope.maxBand;
        const scopeName = normalizeScopeName(item.OriginatingScopeName) ?? grantedScope.scopeName;
        const contentSourceName =
            input.contentSourceNamesById.get(resolvedCsId) ??
            grantedScope.contentSourceNamesById.get(resolvedCsId) ??
            scopeName;
        const hitTitle =
            (typeof item.Title === 'string' && item.Title.trim()) ||
            (typeof item.RecordName === 'string' && item.RecordName.trim()) ||
            contentSourceName;
        const snippet = clampSnippetText(item.Snippet);
        const rankingMode: 'vector' | 'lexical' = item.SourceType === 'vector' ? 'vector' : 'lexical';
        const score = typeof item.Score === 'number' && Number.isFinite(item.Score) ? item.Score : null;

        extraRank += 1;
        grantedKnowledgeHits.push({
            contentSourceId: resolvedCsId,
            contentSourceName,
            band,
            scopeId: grantedScope.scopeId,
            scopeName,
            entityName: item.EntityName,
            recordId: item.RecordID,
            title: hitTitle,
            snippet,
            score,
            rank: extraRank,
            rankingMode,
            targetEntityId: contentSourceEntityId,
        });

        if (!seenContentSourceIds.has(resolvedCsId)) {
            seenContentSourceIds.add(resolvedCsId);
            extraKnowledgeCandidates.push({
                sourceKind: 'KnowledgeSource',
                spaceId: cleanSpaceId,
                spaceItemId: null,
                contentSourceId: resolvedCsId,
                targetEntityId: contentSourceEntityId,
                targetRecordId: resolvedCsId,
                sourceTitle: contentSourceName,
                band,
                retrievalRank: extraRank,
                relevanceScore: score,
                rankingMode,
                estimatedTokens: estimateTokenCount(`${hitTitle} ${snippet}`),
                wasTruncated: false,
                originatingScopeId: grantedScope.scopeId,
                originatingScopeName: scopeName,
            });
        }
    }

    return {
        extraKnowledgeCandidates,
        grantedKnowledgeHits,
        nativeToolHits,
    };
}
