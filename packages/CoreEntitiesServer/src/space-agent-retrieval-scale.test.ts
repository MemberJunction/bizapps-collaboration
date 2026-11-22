import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { AgentRunner } from '@memberjunction/ai-agents';
import type { ExecuteAgentParams, ExecuteAgentResult, MJAIAgentRunEntityExtended } from '@memberjunction/ai-core-plus';
import {
    WellKnownUserSource,
    type BaseEntity,
    type EntityInfo,
    type IEntityDataProvider,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';
import { BaseSpaceTypeServerDriver } from '../dist/base-space-type-server-driver.js';
import { executeSpaceChatTurn } from '../dist/execute-space-chat-turn.js';
import { ServerDriverRegistry } from '../dist/server-driver-registry.js';
import {
    DEFAULT_MAX_CONTEXT_TOKENS,
    DEFAULT_MAX_TOKENS_PER_SOURCE,
    DEFAULT_RETRIEVAL_TOP_K,
    HostSearchEngineVectorAdapter,
    MAX_CONTEXT_TOKENS_CEILING,
    MAX_RETRIEVAL_TOP_K,
    MAX_TOKENS_PER_SOURCE_CEILING,
    applyContextTokenBudget,
    estimateCandidateItemTokens,
    estimateTokenCount,
    renderCandidateItemPromptLine,
    resolveSpaceAgentRetrieval,
    setHostVectorSearchAdapter,
    type SearchEngineLike,
    type SearchEngineSearchParams,
    type SpaceAgentVectorHit,
    type SpaceAgentVectorSearchAdapter,
    type SpaceAgentVectorSearchQuery,
} from '../dist/space-agent-retrieval.js';
import { seedAppSettings } from './app-settings.test-support.ts';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const ROOT_SPACE_ID = 'AA000000-1111-4000-8000-000000000001';
const CHILD_SPACE_ID = 'AA000000-1111-4000-8000-000000000002';
const SIBLING_EXCLUDED_SPACE_ID = 'AA000000-1111-4000-8000-000000000003';
const CLOSED_EXCLUDED_SPACE_ID = 'AA000000-1111-4000-8000-000000000004';
const UNRELATED_SPACE_ID = 'AA000000-1111-4000-8000-000000000005';

const OWNER_ROLE_ID = 'BB000000-2222-4000-8000-000000000001';
const CLIENT_ROLE_ID = 'BB000000-2222-4000-8000-000000000002';

const ADA_ID = 'CC000000-3333-4000-8000-000000000001';
const BEA_ID = 'CC000000-3333-4000-8000-000000000002';

const FILES_ENTITY_ID = 'DD000000-4444-4000-8000-000000000001';
const TASKS_ENTITY_ID = 'DD000000-4444-4000-8000-000000000002';
const PEOPLE_ENTITY_ID = 'DD000000-4444-4000-8000-000000000003';
const SPACE_TYPE_ID = 'EE000000-4444-4000-8000-000000000001';
const CONVERSATION_ID = 'FF000000-4444-4000-8000-000000000001';
const SPACE_CHAT_ID = 'FF000000-4444-4000-8000-000000000002';
const USER_MESSAGE_ID = 'FF000000-5555-4000-8000-000000000001';
const REPLY_DETAIL_ID = 'FF000000-5555-4000-8000-000000000002';
const AGENT_RUN_ID = 'FF000000-6666-4000-8000-000000000001';
const ALLOWED_AGENT_ID = '9E6D761A-197A-40AF-995B-3D3DD9BD7B9E';

/** Reproducible latency ceiling for scoring and budgeting 50,000+ items on Node.js. */
const SCALE_BENCHMARK_LATENCY_THRESHOLD_MS = 5000;

interface SyntheticSpaceItem {
    [key: string]: string | number | boolean | null | Date;
    ID: string;
    SpaceID: string;
    EntityID: string;
    RecordID: string;
    Band: 'Shared' | 'Team';
}

interface SyntheticFileRow {
    [key: string]: string | number | boolean | null | Date;
    ID: string;
    Name: string;
    Description: string | null;
    ContentType: string;
}

interface SyntheticTaskRow {
    [key: string]: string | number | boolean | null | Date;
    ID: string;
    Name: string;
    Description: string | null;
    Status: string | null;
    Priority: string | null;
    DueAt: string | null;
    PercentComplete: number | null;
}

interface SyntheticTaskAssignmentRow {
    [key: string]: string | number | boolean | null | Date;
    ID: string;
    TaskID: string;
    AssigneeEntityID: string;
    AssigneeRecordID: string;
    Status: string;
    AssignedAt: string;
}

interface SyntheticPersonRow {
    [key: string]: string | number | boolean | null | Date;
    ID: string;
    DisplayName: string;
}

interface SyntheticWorld {
    items: SyntheticSpaceItem[];
    filesById: Map<string, SyntheticFileRow>;
    tasksById: Map<string, SyntheticTaskRow>;
    taskAssignments: SyntheticTaskAssignmentRow[];
    peopleById: Map<string, SyntheticPersonRow>;
    chunksByItemId: Map<string, string[]>;
    messageText?: string;
}

function makeUuid(prefix: string, n: number): string {
    return `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function parseQuotedIds(clause: string): Set<string> {
    const ids = new Set<string>();
    const matches = clause.matchAll(/'([^']+)'/g);
    for (const match of matches) {
        const raw = match[1].trim();
        const cleaned = raw.toLowerCase().startsWith('id|') ? raw.slice(3).trim() : raw;
        ids.add(cleaned.toLowerCase());
    }
    return ids;
}

function createScaleWorld(
    totalInScopeCount: number,
    options?: {
        oversizedItemIndex?: number;
        targetNeedleIndex?: number;
        targetMode?: 'file' | 'chunk-only' | 'assignee-only';
        needleToken?: string;
        assigneeDisplayName?: string;
    },
): SyntheticWorld {
    const items: SyntheticSpaceItem[] = [];
    const filesById = new Map<string, SyntheticFileRow>();
    const tasksById = new Map<string, SyntheticTaskRow>();
    const taskAssignments: SyntheticTaskAssignmentRow[] = [];
    const peopleById = new Map<string, SyntheticPersonRow>();
    const chunksByItemId = new Map<string, string[]>();

    const needleIndex = options?.targetNeedleIndex ?? Math.floor(totalInScopeCount * 0.72);
    const oversizedIndex = options?.oversizedItemIndex ?? -1;
    const targetMode = options?.targetMode ?? 'file';
    const needleToken = options?.needleToken ?? 'quantum telemetry calibration';
    const assigneeName = options?.assigneeDisplayName ?? 'Zephyr Nightwing';

    // Add out-of-scope items across Team band, sibling ExcludedFromParentScope, ExcludedEntirely, and unrelated space
    const outOfScopeSpecs: Array<{ spaceId: string; band: 'Shared' | 'Team'; name: string; desc: string }> = [
        {
            spaceId: CHILD_SPACE_ID,
            band: 'Team',
            name: 'secret-quantum-telemetry-team-only.pdf',
            desc: 'Confidential Team quantum telemetry forecast margin floor',
        },
        {
            spaceId: SIBLING_EXCLUDED_SPACE_ID,
            band: 'Shared',
            name: 'sibling-quantum-telemetry-excluded.pdf',
            desc: 'ExcludedFromParentScope quantum telemetry schedule',
        },
        {
            spaceId: CLOSED_EXCLUDED_SPACE_ID,
            band: 'Shared',
            name: 'closed-quantum-telemetry-archived.pdf',
            desc: 'ExcludedEntirely quantum telemetry archive',
        },
        {
            spaceId: UNRELATED_SPACE_ID,
            band: 'Shared',
            name: 'unrelated-quantum-telemetry-external.pdf',
            desc: 'Unrelated space quantum telemetry document',
        },
    ];

    let seq = 0;
    for (const spec of outOfScopeSpecs) {
        seq += 1;
        const itemId = makeUuid('E1000000', seq);
        const fileId = makeUuid('F1000000', seq);
        items.push({
            ID: itemId,
            SpaceID: spec.spaceId,
            EntityID: FILES_ENTITY_ID,
            RecordID: fileId,
            Band: spec.band,
        });
        filesById.set(fileId.toLowerCase(), {
            ID: fileId,
            Name: spec.name,
            Description: spec.desc,
            ContentType: 'application/pdf',
        });
        chunksByItemId.set(itemId.toLowerCase(), [`Chunk text for ${spec.name}: ${spec.desc}`]);
    }

    const assigneePersonId = makeUuid('A5519E00', 1);
    if (targetMode === 'assignee-only') {
        peopleById.set(assigneePersonId.toLowerCase(), {
            ID: assigneePersonId,
            DisplayName: assigneeName,
        });
    }

    for (let i = 0; i < totalInScopeCount; i++) {
        seq += 1;
        const itemId = makeUuid('E2000000', seq);
        const recId = makeUuid('F2000000', seq);
        const isNeedle = i === needleIndex;
        const isSecondaryNeedle = targetMode === 'file' && (i === needleIndex + 1 || i === needleIndex + 2);
        const isOversized = i === oversizedIndex;

        if (isNeedle && targetMode === 'assignee-only') {
            items.push({
                ID: itemId,
                SpaceID: i % 5 === 0 ? ROOT_SPACE_ID : CHILD_SPACE_ID,
                EntityID: TASKS_ENTITY_ID,
                RecordID: recId,
                Band: 'Shared',
            });
            tasksById.set(recId.toLowerCase(), {
                ID: recId,
                Name: `late-index-followup-workitem-${i}`,
                Description: `Generic checklist verification step #${i} without searchable name tokens.`,
                Status: 'Open',
                Priority: 'Normal',
                DueAt: '2026-12-15',
                PercentComplete: 25,
            });
            taskAssignments.push({
                ID: makeUuid('A5519A00', seq),
                TaskID: recId,
                AssigneeEntityID: PEOPLE_ENTITY_ID,
                AssigneeRecordID: assigneePersonId,
                Status: 'Active',
                AssignedAt: '2026-11-01T00:00:00Z',
            });
            continue;
        }

        const name = isNeedle
            ? targetMode === 'chunk-only'
                ? `late-index-generic-record-${i}.pdf`
                : 'quantum-telemetry-calibration-handbook.pdf'
            : isSecondaryNeedle
                ? `quantum-telemetry-appendix-${i}.md`
                : `operations-log-batch-${String(i).padStart(6, '0')}.txt`;
        let description: string;
        if (isOversized) {
            description = 'quantum telemetry calibration '.repeat(3500);
        } else if (isNeedle) {
            description =
                targetMode === 'chunk-only'
                    ? `Routine operations attachment #${i} with no needle keywords in title or description.`
                    : 'Primary reference for quantum telemetry bay calibration and sensor drift tolerances';
        } else if (isSecondaryNeedle) {
            description = 'Supporting telemetry calibration notes for dock sensor verification';
        } else {
            description = `Routine facility operations record #${i} covering daily shift handoff and checklist status.`;
        }

        items.push({
            ID: itemId,
            SpaceID: i % 5 === 0 ? ROOT_SPACE_ID : CHILD_SPACE_ID,
            EntityID: FILES_ENTITY_ID,
            RecordID: recId,
            Band: 'Shared',
        });
        filesById.set(recId.toLowerCase(), {
            ID: recId,
            Name: name,
            Description: description,
            ContentType: 'text/plain',
        });

        if (isNeedle && targetMode === 'chunk-only') {
            chunksByItemId.set(itemId.toLowerCase(), [
                `Deep archival chunk at index ${i}: ${needleToken} anomaly mitigation protocol.`,
            ]);
        } else if (isOversized) {
            chunksByItemId.set(
                itemId.toLowerCase(),
                Array.from({ length: 40 }, (_, chunkIdx) => `Oversized chunk ${chunkIdx} quantum telemetry `.repeat(80)),
            );
        }
    }

    // Sort items by ID ascending once so AfterKey keyset paging is O(log N) / slice-fast in the mock
    items.sort((a, b) => a.ID.localeCompare(b.ID));

    return { items, filesById, tasksById, taskAssignments, peopleById, chunksByItemId };
}

function createScaleProvider(world: SyntheticWorld): IMetadataProvider {
    const spacesRows = [
        { ID: ROOT_SPACE_ID, ParentID: null, InheritsMembership: true, OwnerID: ADA_ID, AgentRetrieval: 'Included', AllowParentAssignees: true, ClosedAt: null, SpaceTypeID: SPACE_TYPE_ID, Configuration: null },
        { ID: CHILD_SPACE_ID, ParentID: ROOT_SPACE_ID, InheritsMembership: true, OwnerID: ADA_ID, AgentRetrieval: 'Included', AllowParentAssignees: true, ClosedAt: null, SpaceTypeID: SPACE_TYPE_ID, Configuration: null },
        { ID: SIBLING_EXCLUDED_SPACE_ID, ParentID: ROOT_SPACE_ID, InheritsMembership: true, OwnerID: ADA_ID, AgentRetrieval: 'ExcludedFromParentScope', AllowParentAssignees: true, ClosedAt: null, SpaceTypeID: SPACE_TYPE_ID, Configuration: null },
        { ID: CLOSED_EXCLUDED_SPACE_ID, ParentID: ROOT_SPACE_ID, InheritsMembership: true, OwnerID: ADA_ID, AgentRetrieval: 'ExcludedEntirely', AllowParentAssignees: true, ClosedAt: null, SpaceTypeID: SPACE_TYPE_ID, Configuration: null },
        { ID: UNRELATED_SPACE_ID, ParentID: null, InheritsMembership: false, OwnerID: ADA_ID, AgentRetrieval: 'Included', AllowParentAssignees: false, ClosedAt: null, SpaceTypeID: SPACE_TYPE_ID, Configuration: null },
    ];
    const rolesRows = [
        { ID: OWNER_ROLE_ID, Level: 40, MaxGrantableLevel: 40, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true },
        { ID: CLIENT_ROLE_ID, Level: 10, MaxGrantableLevel: 10, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true },
    ];
    const memberRows = [
        { ID: '10000000-0000-4000-8000-000000000001', SpaceID: ROOT_SPACE_ID, UserID: ADA_ID, User: 'Ada', Status: 'Active', Band: 'Team', SpaceRoleTypeID: OWNER_ROLE_ID, __mj_CreatedAt: new Date('2026-01-01T00:00:00Z') },
        { ID: '10000000-0000-4000-8000-000000000002', SpaceID: CHILD_SPACE_ID, UserID: BEA_ID, User: 'Bea', Status: 'Active', Band: 'Shared', SpaceRoleTypeID: CLIENT_ROLE_ID, __mj_CreatedAt: new Date('2026-01-01T00:00:00Z') },
    ];

    // Pre-index items by SpaceID for fast SpaceID IN (...) filtering
    const itemsBySpace = new Map<string, SyntheticSpaceItem[]>();
    for (const item of world.items) {
        const key = item.SpaceID.toLowerCase();
        const list = itemsBySpace.get(key) ?? [];
        list.push(item);
        itemsBySpace.set(key, list);
    }

    function runViewSync(params: RunViewParams): RunViewResult<Record<string, string | number | boolean | null | Date>> {
        const entity = params.EntityName ?? '';
        const filter = typeof params.ExtraFilter === 'string' ? params.ExtraFilter : String(params.ExtraFilter ?? '');

        if (entity === 'MJ_BizApps_Collaboration: Spaces') {
            const onlySpace = /\bID = '([^']+)'/i.exec(filter)?.[1]?.toLowerCase();
            const matching = onlySpace
                ? spacesRows.filter((s) => s.ID.toLowerCase() === onlySpace)
                : spacesRows;
            return { Success: true, Results: matching, ErrorMessage: '', RowCount: matching.length, TotalRowCount: matching.length, ExecutionTime: 0 };
        }
        if (entity === 'MJ_BizApps_Collaboration: Space Role Types') {
            return { Success: true, Results: rolesRows, ErrorMessage: '', RowCount: rolesRows.length, TotalRowCount: rolesRows.length, ExecutionTime: 0 };
        }
        if (entity === 'MJ_BizApps_Collaboration: Space Members') {
            const onlyUser = /UserID = '([^']+)'/i.exec(filter)?.[1]?.toLowerCase();
            const matching = memberRows.filter((m) => !onlyUser || m.UserID.toLowerCase() === onlyUser);
            return { Success: true, Results: matching, ErrorMessage: '', RowCount: matching.length, TotalRowCount: matching.length, ExecutionTime: 0 };
        }
        if (entity === 'MJ_BizApps_Collaboration: Space Items') {
            const spaceClause = /SpaceID IN \(([^)]+)\)/i.exec(filter)?.[1] ?? '';
            const requestedSpaces = parseQuotedIds(spaceClause);
            const sharedOnly = filter.includes("Band = 'Shared'");
            const after = params.AfterKey ? String(params.AfterKey.GetValueByFieldName('ID')).toUpperCase() : '';

            const pool: SyntheticSpaceItem[] = [];
            for (const spaceId of requestedSpaces) {
                const spaceList = itemsBySpace.get(spaceId);
                if (!spaceList) continue;
                for (const item of spaceList) {
                    if (sharedOnly && item.Band !== 'Shared') continue;
                    pool.push(item);
                }
            }
            if (requestedSpaces.size > 1) {
                pool.sort((a, b) => a.ID.localeCompare(b.ID));
            }
            const afterUpper = after;
            const filtered = afterUpper ? pool.filter((item) => item.ID > afterUpper) : pool;
            const page = params.MaxRows ? filtered.slice(0, params.MaxRows) : filtered;
            return { Success: true, Results: page, ErrorMessage: '', RowCount: page.length, TotalRowCount: page.length, ExecutionTime: 0 };
        }
        if (entity === 'MJ: Files') {
            const idClause = /ID IN \(([^)]+)\)/i.exec(filter)?.[1] ?? '';
            const requestedIds = parseQuotedIds(idClause);
            const rows: SyntheticFileRow[] = [];
            for (const id of requestedIds) {
                const file = world.filesById.get(id);
                if (file) rows.push(file);
            }
            return { Success: true, Results: rows, ErrorMessage: '', RowCount: rows.length, TotalRowCount: rows.length, ExecutionTime: 0 };
        }
        if (entity === 'MJ: Tasks' || entity === 'MJ_BizApps_Tasks: Tasks') {
            const idClause = /ID IN \(([^)]+)\)/i.exec(filter)?.[1] ?? '';
            const requestedIds = parseQuotedIds(idClause);
            const rows: SyntheticTaskRow[] = [];
            for (const id of requestedIds) {
                const task = world.tasksById.get(id);
                if (task) rows.push(task);
            }
            return { Success: true, Results: rows, ErrorMessage: '', RowCount: rows.length, TotalRowCount: rows.length, ExecutionTime: 0 };
        }
        if (entity === 'MJ_BizApps_Tasks: Task Assignments') {
            const taskClause = /TaskID IN \(([^)]+)\)/i.exec(filter)?.[1] ?? '';
            const requestedTaskIds = parseQuotedIds(taskClause);
            const rows = world.taskAssignments.filter((a) => requestedTaskIds.has(a.TaskID.toLowerCase()));
            return { Success: true, Results: rows, ErrorMessage: '', RowCount: rows.length, TotalRowCount: rows.length, ExecutionTime: 0 };
        }
        if (entity === 'MJ_BizApps_Common: People') {
            const idClause = /ID IN \(([^)]+)\)/i.exec(filter)?.[1] ?? '';
            const requestedIds = parseQuotedIds(idClause);
            const rows: SyntheticPersonRow[] = [];
            for (const id of requestedIds) {
                const person = world.peopleById.get(id);
                if (person) rows.push(person);
            }
            return { Success: true, Results: rows, ErrorMessage: '', RowCount: rows.length, TotalRowCount: rows.length, ExecutionTime: 0 };
        }
        if (entity === 'MJ: Entity Record Documents') {
            const recIds = parseQuotedIds(filter);
            const rows: Array<{ ID: string; RecordID: string }> = [];
            for (const id of recIds) {
                if (world.chunksByItemId.has(id)) {
                    rows.push({ ID: id, RecordID: `ID|${id}` });
                }
            }
            return { Success: true, Results: rows, ErrorMessage: '', RowCount: rows.length, TotalRowCount: rows.length, ExecutionTime: 0 };
        }
        if (entity === 'MJ: Content Items') {
            const erdIds = parseQuotedIds(filter);
            const rows = Array.from(erdIds).map((id) => ({ ID: id, EntityRecordDocumentID: id, RootParentID: null }));
            return { Success: true, Results: rows, ErrorMessage: '', RowCount: rows.length, TotalRowCount: rows.length, ExecutionTime: 0 };
        }
        if (entity === 'MJ: Content Item Chunks') {
            const ciIds = parseQuotedIds(filter);
            const likeTokens = Array.from(filter.matchAll(/Text LIKE N'%([^%']+)%'/gi), (m) => m[1].toLowerCase());
            const rows: Array<{ ID: string; ContentItemID: string; Text: string; Sequence: number }> = [];
            for (const ciId of ciIds) {
                const chunks = world.chunksByItemId.get(ciId) ?? [];
                chunks.forEach((text, idx) => {
                    if (likeTokens.length > 0 && !likeTokens.some((tok) => text.toLowerCase().includes(tok))) {
                        return;
                    }
                    rows.push({ ID: `${ciId}-c-${idx}`, ContentItemID: ciId, Text: text, Sequence: idx });
                });
            }
            return { Success: true, Results: rows, ErrorMessage: '', RowCount: rows.length, TotalRowCount: rows.length, ExecutionTime: 0 };
        }
        if (entity === 'MJ_BizApps_Collaboration: Space Types') {
            return {
                Success: true,
                Results: [{
                    ID: SPACE_TYPE_ID,
                    DriverKey: null,
                    ServerDriverClass: null,
                    UIDriverClass: null,
                    AllowSubSpaces: true,
                    Configuration: JSON.stringify({
                        Chats: { WhoCanStart: 'Anyone', AgentReplyMode: 'MentionOrOneToOne', HistoryOnAdd: 'None' },
                        Agents: { ListMode: 'Extend' },
                    }),
                }],
                ErrorMessage: '',
                RowCount: 1,
                TotalRowCount: 1,
                ExecutionTime: 0,
            };
        }
        if (entity === 'MJ_BizApps_Collaboration: Space Chats') {
            return { Success: true, Results: [{ ID: SPACE_CHAT_ID, ConversationID: CONVERSATION_ID, Kind: 'General', Status: 'Active' }], ErrorMessage: '', RowCount: 1, TotalRowCount: 1, ExecutionTime: 0 };
        }
        if (entity === 'MJ_BizApps_Collaboration: Space Grants') {
            return {
                Success: true,
                Results: [{
                    ID: '10000000-0000-4000-8000-000000000099',
                    Kind: 'Agent',
                    Mode: 'Extend',
                    Band: 'Shared',
                    TargetEntityID: 'E-AGENTS',
                    Sequence: 0,
                    TargetRecordID: ALLOWED_AGENT_ID,
                    SpaceTypeID: null,
                    SpaceID: ROOT_SPACE_ID,
                    IsDefault: true,
                }],
                ErrorMessage: '',
                RowCount: 1,
                TotalRowCount: 1,
                ExecutionTime: 0,
            };
        }
        if (entity === 'MJ: AI Agents') {
            if (filter.includes('Name =')) return { Success: true, Results: [], ErrorMessage: '', RowCount: 0, TotalRowCount: 0, ExecutionTime: 0 };
            return { Success: true, Results: [{ ID: ALLOWED_AGENT_ID, Name: 'Sage' }], ErrorMessage: '', RowCount: 1, TotalRowCount: 1, ExecutionTime: 0 };
        }
        if (entity === 'MJ: Application Settings') {
            return {
                Success: true,
                Results: [{ ID: 'app-1', Name: 'Collaboration Settings', Value: JSON.stringify({ Chats: { WhoCanStart: 'Anyone', AgentReplyMode: 'MentionOrOneToOne', HistoryOnAdd: 'None' }, Agents: { ListMode: 'Extend' } }) }],
                ErrorMessage: '',
                RowCount: 1,
                TotalRowCount: 1,
                ExecutionTime: 0,
            };
        }
        return { Success: true, Results: [], ErrorMessage: '', RowCount: 0, TotalRowCount: 0, ExecutionTime: 0 };
    }

    const providerImpl: Partial<IMetadataProvider & IRunViewProvider & IEntityDataProvider> = {
        EntityByID(id: string): EntityInfo | undefined {
            const norm = id.toLowerCase();
            if (norm === FILES_ENTITY_ID.toLowerCase()) {
                return { ID: FILES_ENTITY_ID, Name: 'MJ: Files' } as Partial<EntityInfo> as EntityInfo;
            }
            if (norm === TASKS_ENTITY_ID.toLowerCase()) {
                return { ID: TASKS_ENTITY_ID, Name: 'MJ_BizApps_Tasks: Tasks' } as Partial<EntityInfo> as EntityInfo;
            }
            if (norm === PEOPLE_ENTITY_ID.toLowerCase()) {
                return { ID: PEOPLE_ENTITY_ID, Name: 'MJ_BizApps_Common: People' } as Partial<EntityInfo> as EntityInfo;
            }
            return undefined;
        },
        EntityByName(name: string): EntityInfo | undefined {
            if (
                name === 'MJ: Content Item Chunks' ||
                name === 'MJ_BizApps_Tasks: Tasks' ||
                name === 'MJ_BizApps_Tasks: Task Assignments' ||
                name === 'MJ_BizApps_Common: People' ||
                name === 'MJ: Users' ||
                name === 'MJ: AI Agents' ||
                name === 'MJ: Conversation Details'
            ) {
                return { Name: name } as Partial<EntityInfo> as EntityInfo;
            }
            return undefined;
        },
        async GetEntityObject<T extends BaseEntity = BaseEntity>(entityName: string): Promise<T> {
            if (entityName === 'MJ: Conversation Details') {
                const detail: Record<string, string | boolean | null | (() => void) | ((id: string) => Promise<boolean>) | (() => Promise<boolean>) | { CompleteMessage: string }> = {
                    ID: USER_MESSAGE_ID,
                    ConversationID: CONVERSATION_ID,
                    UserID: BEA_ID,
                    Role: 'User',
                    Message: world.messageText ?? `@{"type":"agent","id":"${ALLOWED_AGENT_ID}","name":"Sage"} quantum telemetry calibration`,
                    ParentID: null,
                    AgentID: null,
                    Status: 'Complete',
                    HiddenToUser: false,
                    IsPinned: false,
                    OriginalMessageChanged: false,
                    LatestResult: { CompleteMessage: '' },
                    NewRecord() {
                        detail['ID'] = REPLY_DETAIL_ID;
                    },
                    MarkServerAuthoredReply() {
                        return undefined;
                    },
                    async Load(id: string) {
                        return id.toLowerCase() === USER_MESSAGE_ID.toLowerCase();
                    },
                    async Save() {
                        return true;
                    },
                };
                return detail as Partial<T> as T;
            }
            if (entityName === 'MJ: AI Agents') {
                const agent: Record<string, string | (() => Promise<boolean>)> = {
                    ID: ALLOWED_AGENT_ID,
                    Name: 'Sage',
                    async Load() {
                        return true;
                    },
                };
                return agent as Partial<T> as T;
            }
            if (entityName === 'MJ: AI Agent Runs') {
                const run: Record<string, string | null | (() => Promise<boolean>)> = {
                    ID: AGENT_RUN_ID,
                    ExternalReferenceID: null,
                    async Load() {
                        return true;
                    },
                    async Save() {
                        return true;
                    },
                };
                return run as Partial<T> as T;
            }
            if (entityName === 'MJ_BizApps_Collaboration: Space Agent Source Receipts') {
                let seq = 0;
                const receipt: Record<string, string | number | boolean | null | (() => boolean) | (() => Promise<boolean>)> = {
                    ID: '',
                    NewRecord() {
                        seq += 1;
                        receipt['ID'] = makeUuid('A1000000', seq);
                        return true;
                    },
                    async Load() {
                        return true;
                    },
                    async Save() {
                        if (!receipt['ID']) {
                            seq += 1;
                            receipt['ID'] = makeUuid('A1000000', seq);
                        }
                        return true;
                    },
                };
                return receipt as Partial<T> as T;
            }
            return {
                RunViewProviderToUse: providerImpl as IRunViewProvider,
                ProviderToUse: providerImpl as IEntityDataProvider,
            } as Partial<BaseEntity> as T;
        },
        async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
            return runViewSync(params) as RunViewResult<T>;
        },
        async RunViews<T>(paramsList: RunViewParams[]): Promise<RunViewResult<T>[]> {
            return paramsList.map((p) => runViewSync(p) as RunViewResult<T>);
        },
    };

    return providerImpl as Partial<IMetadataProvider> as IMetadataProvider;
}

describe('space-agent-retrieval scale & ranked relevance (CT-4)', () => {
    const src = WellKnownUserSource.Instance;
    let origGetSystemUser: typeof src.GetSystemUser;
    let origResolveSpaceAndType: typeof ServerDriverRegistry.Instance.ResolveSpaceAndType;
    let origRunAgent: typeof AgentRunner.prototype.RunAgent;
    let restoreAppSettings: () => void = () => undefined;

    before(() => {
        origGetSystemUser = src.GetSystemUser.bind(src);
        src.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID, Name: 'System' } as UserInfo);
        origResolveSpaceAndType = ServerDriverRegistry.Instance.ResolveSpaceAndType.bind(ServerDriverRegistry.Instance);
        type ResolvedDriverResult = Awaited<ReturnType<typeof origResolveSpaceAndType>>;
        ServerDriverRegistry.Instance.ResolveSpaceAndType = (async () => ({
            space: {} as ResolvedDriverResult['space'],
            spaceType: {} as ResolvedDriverResult['spaceType'],
            driver: new BaseSpaceTypeServerDriver(),
        } as Partial<ResolvedDriverResult> as ResolvedDriverResult)) as typeof ServerDriverRegistry.Instance.ResolveSpaceAndType;
        restoreAppSettings = seedAppSettings();
        origRunAgent = AgentRunner.prototype.RunAgent;
    });

    after(() => {
        setHostVectorSearchAdapter(null);
        src.GetSystemUser = origGetSystemUser;
        ServerDriverRegistry.Instance.ResolveSpaceAndType = origResolveSpaceAndType;
        AgentRunner.prototype.RunAgent = origRunAgent;
        restoreAppSettings();
    });

    it('retrieves and ranks top-k relevant items over 50,000+ items without 2,000-item refusal, under latency threshold, with zero cross-scope leakage', async () => {
        const world = createScaleWorld(50_000, { targetNeedleIndex: 37_500 });
        const provider = createScaleProvider(world);
        const ada = { ID: ADA_ID, Name: 'Ada' } as UserInfo;

        const started = performance.now();
        const result = await resolveSpaceAgentRetrieval(provider, ada, ROOT_SPACE_ID, {
            conversationKind: 'General',
            rankingQuery: 'quantum telemetry bay calibration handbook',
            topK: 10,
            itemsPageSize: 2000,
        });
        const elapsedMs = performance.now() - started;

        assert.ok(result.stats, 'Retrieval stats returned');
        assert.equal(result.stats.totalInScopeCount, 50_000, 'All 50,000 in-scope items entered candidate ranking');
        assert.equal(result.stats.rankingMode, 'lexical', 'Automatically uses lexical BM25 fallback when no vector index is configured');
        assert.equal(result.stats.vectorSearchUsed, false);
        assert.equal(result.quotedItems.length, 10, 'Strictly capped to top-k = 10 items');
        assert.equal(result.suppliedSources?.length, 10, 'Structured suppliedSources matches top-k = 10');
        assert.equal(result.quotedItems[0]?.Name, 'quantum-telemetry-calibration-handbook.pdf', 'Exact relevant document ranked #1 out of 50,000 items');
        assert.ok(elapsedMs < SCALE_BENCHMARK_LATENCY_THRESHOLD_MS, `Expected 50k retrieval under ${SCALE_BENCHMARK_LATENCY_THRESHOLD_MS}ms, took ${elapsedMs.toFixed(1)}ms`);

        // Zero cross-scope leakage: out-of-scope items (Team band, ExcludedFromParentScope, ExcludedEntirely, Unrelated) must never appear
        const forbiddenNames = new Set([
            'secret-quantum-telemetry-team-only.pdf',
            'sibling-quantum-telemetry-excluded.pdf',
            'closed-quantum-telemetry-archived.pdf',
            'unrelated-quantum-telemetry-external.pdf',
        ]);
        for (const item of result.quotedItems) {
            assert.equal(item.Band, 'Shared', 'General room strictly enforces Shared band');
            assert.ok(!forbiddenNames.has(item.Name), `Out-of-scope item ${item.Name} must never leak into quotedItems`);
        }
        for (const srcEntry of result.suppliedSources ?? []) {
            assert.ok(!forbiddenNames.has(srcEntry.name), `Out-of-scope item ${srcEntry.name} must never leak into suppliedSources`);
        }
    });

    it('maintains constant O(k) prompt token usage across 500, 5,000, 25,000, and 50,000 items and caps oversized sources & excessive k', async () => {
        const ada = { ID: ADA_ID, Name: 'Ada' } as UserInfo;
        const sizes = [500, 5_000, 25_000, 50_000];
        const observedTokens: number[] = [];

        for (const size of sizes) {
            const world = createScaleWorld(size, { oversizedItemIndex: Math.floor(size * 0.5) });
            const provider = createScaleProvider(world);
            const res = await resolveSpaceAgentRetrieval(provider, ada, ROOT_SPACE_ID, {
                conversationKind: 'General',
                rankingQuery: 'quantum telemetry calibration',
                topK: 10,
                itemsPageSize: 2000,
            });
            assert.equal(res.quotedItems.length, 10, `Size ${size} returns exactly k=10 items`);
            const totalTokens = res.quotedItems.reduce((sum, item) => sum + estimateCandidateItemTokens(item), 0);
            observedTokens.push(totalTokens);
            assert.ok(totalTokens <= DEFAULT_MAX_CONTEXT_TOKENS, `Total tokens (${totalTokens}) must remain <= ${DEFAULT_MAX_CONTEXT_TOKENS}`);
            for (const item of res.quotedItems) {
                const itemTokens = estimateCandidateItemTokens(item);
                assert.ok(itemTokens <= DEFAULT_MAX_TOKENS_PER_SOURCE, `Single item tokens (${itemTokens}) must be <= ${DEFAULT_MAX_TOKENS_PER_SOURCE}`);
            }
        }

        // Token budget at 50,000 items must remain within a constant O(k) bound of the 500-item run (not scaling linearly with N)
        const minTokens = Math.min(...observedTokens);
        const maxTokens = Math.max(...observedTokens);
        assert.ok(maxTokens <= minTokens * 1.5 + 100, `Prompt tokens stayed O(k) across 100x library growth: ${observedTokens.join(', ')}`);

        // Excessive requested topK and custom limits are clamped to server ceilings
        const clampWorld = createScaleWorld(200, { oversizedItemIndex: 10 });
        const clampProvider = createScaleProvider(clampWorld);
        const clamped = await resolveSpaceAgentRetrieval(clampProvider, ada, ROOT_SPACE_ID, {
            conversationKind: 'General',
            rankingQuery: 'quantum telemetry calibration',
            topK: 10_000,
            maxTokensPerSource: 99_999,
            maxContextTokens: 999_999,
        });
        assert.equal(clamped.quotedItems.length, MAX_RETRIEVAL_TOP_K, `Excessive topK clamped to server ceiling ${MAX_RETRIEVAL_TOP_K}`);
        assert.equal(clamped.stats?.topKApplied, MAX_RETRIEVAL_TOP_K);
        assert.equal(clamped.stats?.maxTokensPerSource, MAX_TOKENS_PER_SOURCE_CEILING);
        assert.equal(clamped.stats?.maxContextTokens, MAX_CONTEXT_TOKENS_CEILING);
        assert.ok((clamped.stats?.estimatedContextTokens ?? 0) <= MAX_CONTEXT_TOKENS_CEILING);
    });

    it('uses configured host vector search with strict pre-filtered scope, rejects leaked vector hits, and falls back to lexical when unconfigured or failing', async () => {
        const world = createScaleWorld(120, { targetNeedleIndex: 40 });
        const provider = createScaleProvider(world);
        const ada = { ID: ADA_ID, Name: 'Ada' } as UserInfo;

        const outOfScopeTeamItem = world.items.find((i) => i.Band === 'Team');
        const outOfScopeSiblingItem = world.items.find((i) => i.SpaceID === SIBLING_EXCLUDED_SPACE_ID);
        const inScopeItems = world.items.filter((i) => i.Band === 'Shared' && (i.SpaceID === ROOT_SPACE_ID || i.SpaceID === CHILD_SPACE_ID));
        assert.ok(outOfScopeTeamItem && outOfScopeSiblingItem && inScopeItems.length >= 10);

        const capturedQueries: SpaceAgentVectorSearchQuery[] = [];
        const vectorAdapter: SpaceAgentVectorSearchAdapter = {
            name: 'test-vector-adapter',
            isConfigured() {
                return true;
            },
            async search(query: SpaceAgentVectorSearchQuery): Promise<readonly SpaceAgentVectorHit[]> {
                capturedQueries.push(query);
                return [
                    // Rogue out-of-scope hits injected to verify defense-in-depth post-filtering
                    { spaceItemId: outOfScopeTeamItem.ID, score: 0.99 },
                    { spaceItemId: outOfScopeSiblingItem.ID, score: 0.98 },
                    // Legitimate in-scope hits
                    { spaceItemId: inScopeItems[7].ID, score: 0.92 },
                    { spaceItemId: inScopeItems[3].ID, score: 0.85 },
                ];
            },
        };

        const vectorRes = await resolveSpaceAgentRetrieval(provider, ada, ROOT_SPACE_ID, {
            conversationKind: 'General',
            rankingQuery: 'semantic vector question',
            topK: 5,
            vectorSearch: vectorAdapter,
        });

        const capturedQuery = capturedQueries[0];
        assert.ok(capturedQuery, 'Vector adapter was called');
        assert.ok(!capturedQuery.allowedSpaceItemIds.has(outOfScopeTeamItem.ID.toLowerCase()), 'Team item excluded BEFORE vector query');
        assert.ok(!capturedQuery.allowedSpaceItemIds.has(outOfScopeSiblingItem.ID.toLowerCase()), 'ExcludedFromParentScope item excluded BEFORE vector query');
        assert.equal(capturedQuery.allowedSpaces.every((s) => s.maxBand === 'Shared'), true, 'Pre-filtered spaces enforce Shared band');
        assert.equal(vectorRes.stats?.rankingMode, 'vector');
        assert.equal(vectorRes.stats?.vectorSearchUsed, true);
        assert.deepEqual(
            vectorRes.quotedItems.map((i) => i.ID),
            [inScopeItems[7].ID, inScopeItems[3].ID],
            'Vector results ranked by similarity score with rogue out-of-scope hits stripped',
        );

        // Automatic fallback to lexical BM25 when adapter reports unconfigured or throws
        const unconfiguredAdapter: SpaceAgentVectorSearchAdapter = {
            isConfigured: () => false,
            async search() {
                throw new Error('Should not be called when unconfigured');
            },
        };
        const fallbackFromUnconfigured = await resolveSpaceAgentRetrieval(provider, ada, ROOT_SPACE_ID, {
            conversationKind: 'General',
            rankingQuery: 'quantum telemetry bay calibration handbook',
            topK: 5,
            vectorSearch: unconfiguredAdapter,
        });
        assert.equal(fallbackFromUnconfigured.stats?.rankingMode, 'lexical');
        assert.equal(fallbackFromUnconfigured.stats?.vectorSearchUsed, false);
        assert.equal(fallbackFromUnconfigured.quotedItems[0]?.Name, 'quantum-telemetry-calibration-handbook.pdf');

        const failingAdapter: SpaceAgentVectorSearchAdapter = {
            isConfigured: () => true,
            async search() {
                throw new Error('Vector service temporarily unreachable');
            },
        };
        const fallbackFromError = await resolveSpaceAgentRetrieval(provider, ada, ROOT_SPACE_ID, {
            conversationKind: 'General',
            rankingQuery: 'quantum telemetry bay calibration handbook',
            topK: 5,
            vectorSearch: failingAdapter,
        });
        assert.equal(fallbackFromError.stats?.rankingMode, 'lexical');
        assert.equal(fallbackFromError.quotedItems[0]?.Name, 'quantum-telemetry-calibration-handbook.pdf');
    });

    it('executeSpaceChatTurn injects bounded top-k allowedItems and returns structured suppliedSources and retrievalStats over 50,000 items', async () => {
        // Use needle index 12_346 (12346 % 5 !== 0) so the needle resides in CHILD_SPACE_ID while ROOT_SPACE_ID items stay excluded
        const world = createScaleWorld(50_000, { targetNeedleIndex: 12_346 });
        const provider = createScaleProvider(world);
        const bea = { ID: BEA_ID, Name: 'Bea' } as UserInfo;

        let capturedData: {
            allowedItems?: Array<{ Name: string }>;
            suppliedSources?: Array<{ spaceItemId: string; rank: number }>;
            retrievalStats?: { totalInScopeCount: number; suppliedCount: number; estimatedContextTokens: number };
        } | undefined;

        AgentRunner.prototype.RunAgent = async <C, R>(params: ExecuteAgentParams<C>): Promise<ExecuteAgentResult<R>> => {
            capturedData = params.data as typeof capturedData;
            if (typeof params.onAgentRunCreated === 'function') {
                await params.onAgentRunCreated(AGENT_RUN_ID);
            }
            return {
                success: true,
                agentRun: { ID: AGENT_RUN_ID, Message: 'Calibrated from handbook.' } as Partial<MJAIAgentRunEntityExtended> as MJAIAgentRunEntityExtended,
            };
        };

        const turnResult = await executeSpaceChatTurn(provider, bea, {
            spaceId: CHILD_SPACE_ID,
            conversationId: CONVERSATION_ID,
            userMessageId: USER_MESSAGE_ID,
            topK: 8,
            itemsPageSize: 2000,
        });

        assert.equal(turnResult.ok, true, turnResult.ok ? '' : turnResult.message);
        if (!turnResult.ok) return;

        assert.equal(turnResult.quotedCount, 8);
        assert.equal(turnResult.allowedItemNames?.length, 8);
        assert.equal(turnResult.citations?.length, 8);
        assert.equal(turnResult.sourceReceipts?.length, 8);
        assert.equal(turnResult.suppliedSources?.length, 8);
        assert.ok(turnResult.retrievalStats);
        assert.ok(turnResult.retrievalStats.totalInScopeCount >= 39_999);
        assert.equal(turnResult.retrievalStats.suppliedCount, 8);
        assert.ok(turnResult.retrievalStats.estimatedContextTokens <= DEFAULT_MAX_CONTEXT_TOKENS);

        assert.ok(capturedData);
        assert.equal(capturedData.allowedItems?.length, 8, 'Prompt data.allowedItems strictly bounded to top-k');
        assert.equal(capturedData.suppliedSources?.length, 8, 'Prompt data.suppliedSources tracks exact top-k items');
        assert.equal(capturedData.allowedItems?.[0]?.Name, 'quantum-telemetry-calibration-handbook.pdf', 'Mention markup stripped so exact handbook ranks #1');
        assert.equal(DEFAULT_RETRIEVAL_TOP_K, 30);
    });

    it('HostSearchEngineVectorAdapter passes SpaceChat scope, AllowedSpaceItemIDs, AllowedBandsBySpaceID, and SecondaryScopes pre-search across multi-space and Shared audience cases (CR-2)', async () => {
        const capturedCalls: SearchEngineSearchParams[] = [];
        const IN_REACH_ROOT_ID = makeUuid('E2000000', 10);
        const IN_REACH_CHILD_ID = makeUuid('E2000000', 11);
        const OUT_OF_REACH_TEAM_ID = makeUuid('E1000000', 99);

        const mockEngine: SearchEngineLike = {
            async Config() {
                return undefined;
            },
            GetAvailableProviders() {
                return [{ SourceType: 'vector', IsAvailable: true }];
            },
            async Search(params: SearchEngineSearchParams) {
                capturedCalls.push(params);
                return {
                    Success: true,
                    Results: [
                        {
                            EntityName: 'MJ_BizApps_Collaboration: Space Items',
                            RecordID: OUT_OF_REACH_TEAM_ID,
                            Score: 0.99,
                            SourceType: 'vector',
                        },
                        {
                            EntityName: 'MJ_BizApps_Collaboration: Space Items',
                            RecordID: IN_REACH_CHILD_ID,
                            Score: 0.91,
                            SourceType: 'vector',
                        },
                        {
                            EntityName: 'MJ_BizApps_Collaboration: Space Items',
                            RecordID: IN_REACH_ROOT_ID,
                            Score: 0.85,
                            SourceType: 'vector',
                        },
                    ],
                };
            },
        };

        const adapter = new HostSearchEngineVectorAdapter(mockEngine);
        const allowedSpaceItemIds = new Set([IN_REACH_ROOT_ID.toLowerCase(), IN_REACH_CHILD_ID.toLowerCase()]);
        const minimalProvider = {} as IMetadataProvider;

        // Multi-space Team audience: per-space band ceilings preserved, SpaceChat used as PrimaryScopeRecordID
        const teamHits = await adapter.search({
            provider: minimalProvider,
            queryText: 'quantum telemetry',
            spaceChatId: SPACE_CHAT_ID,
            anchorSpaceId: ROOT_SPACE_ID,
            chatAudience: 'Team',
            allowedSpaces: [
                { spaceId: ROOT_SPACE_ID, maxBand: 'Team' },
                { spaceId: CHILD_SPACE_ID, maxBand: 'Shared' },
            ],
            allowedBandsBySpaceId: {
                [ROOT_SPACE_ID.toLowerCase()]: 'Team',
                [CHILD_SPACE_ID.toLowerCase()]: 'Shared',
            },
            allowedSpaceItemIds,
            audienceUserIds: [ADA_ID, BEA_ID],
            topK: 5,
            user: { ID: ADA_ID, Name: 'Ada' } as UserInfo,
        });

        assert.equal(capturedCalls.length, 1);
        const teamCall = capturedCalls[0];
        assert.equal(teamCall.SearchContext?.PrimaryScopeRecordID?.toLowerCase(), SPACE_CHAT_ID.toLowerCase());
        assert.deepEqual(
            teamCall.SearchContext?.SecondaryScopes?.SpaceID?.map((s) => s.toLowerCase()).sort(),
            [ROOT_SPACE_ID.toLowerCase(), CHILD_SPACE_ID.toLowerCase()].sort(),
        );
        assert.deepEqual(teamCall.SearchContext?.SecondaryScopes?.Audience, ['Shared', 'Team']);
        assert.deepEqual(teamCall.Filters?.AllowedBandsBySpaceID, {
            [ROOT_SPACE_ID.toLowerCase()]: 'Team',
            [CHILD_SPACE_ID.toLowerCase()]: 'Shared',
        });
        assert.equal(teamCall.Filters?.AllowedSpaceItemIDs?.length, 2);
        assert.deepEqual(
            teamHits.map((h) => h.spaceItemId),
            [IN_REACH_CHILD_ID.toLowerCase(), IN_REACH_ROOT_ID.toLowerCase()],
            'Out-of-reach hit excluded by defense-in-depth post-filter even if provider leaks it',
        );

        // Shared audience clamp: all per-space ceilings must clamp strictly to Shared pre-search
        await adapter.search({
            provider: minimalProvider,
            queryText: 'quantum telemetry',
            spaceChatId: SPACE_CHAT_ID,
            anchorSpaceId: ROOT_SPACE_ID,
            chatAudience: 'Shared',
            allowedSpaces: [
                { spaceId: ROOT_SPACE_ID, maxBand: 'Team' },
                { spaceId: CHILD_SPACE_ID, maxBand: 'Team' },
            ],
            allowedBandsBySpaceId: {
                [ROOT_SPACE_ID.toLowerCase()]: 'Team',
                [CHILD_SPACE_ID.toLowerCase()]: 'Team',
            },
            allowedSpaceItemIds,
            audienceUserIds: [ADA_ID, BEA_ID],
            topK: 5,
            user: { ID: ADA_ID, Name: 'Ada' } as UserInfo,
        });
        assert.equal(capturedCalls.length, 2);
        const sharedCall = capturedCalls[1];
        assert.deepEqual(sharedCall.SearchContext?.SecondaryScopes?.Audience, ['Shared']);
        assert.deepEqual(sharedCall.Filters?.AllowedBandsBySpaceID, {
            [ROOT_SPACE_ID.toLowerCase()]: 'Shared',
            [CHILD_SPACE_ID.toLowerCase()]: 'Shared',
        });
    });

    it('discovers chunk-only needle at index > 40,000 across a 50,000-item library under both rankingQuery and explicit query (CR-3)', async () => {
        const needleToken = 'obsidian-chronometer-calibration';
        const world = createScaleWorld(50_000, {
            targetNeedleIndex: 43_781,
            targetMode: 'chunk-only',
            needleToken,
        });
        const provider = createScaleProvider(world);
        const ada = { ID: ADA_ID, Name: 'Ada' } as UserInfo;

        const rankedRes = await resolveSpaceAgentRetrieval(provider, ada, ROOT_SPACE_ID, {
            conversationKind: 'General',
            rankingQuery: needleToken,
            topK: 5,
            itemsPageSize: 2000,
        });
        assert.equal(rankedRes.quotedItems[0]?.Name, 'late-index-generic-record-43781.pdf');
        assert.ok(
            rankedRes.quotedItems[0]?.ChunkTexts?.some((t) => t.includes(needleToken)),
            'Chunk-only needle at index > 40,000 must be discovered and enriched',
        );

        const explicitRes = await resolveSpaceAgentRetrieval(provider, ada, ROOT_SPACE_ID, {
            conversationKind: 'General',
            query: needleToken,
            topK: 5,
            itemsPageSize: 2000,
        });
        assert.equal(explicitRes.quotedItems.length, 1);
        assert.equal(explicitRes.quotedItems[0]?.Name, 'late-index-generic-record-43781.pdf');
    });

    it('discovers assignee-only task needle at index > 40,000 across a 50,000-item library under both rankingQuery and explicit query (CR-3)', async () => {
        const world = createScaleWorld(50_000, {
            targetNeedleIndex: 44_219,
            targetMode: 'assignee-only',
            assigneeDisplayName: 'Zephyr Nightwing',
        });
        const provider = createScaleProvider(world);
        const ada = { ID: ADA_ID, Name: 'Ada' } as UserInfo;

        const rankedRes = await resolveSpaceAgentRetrieval(provider, ada, ROOT_SPACE_ID, {
            conversationKind: 'General',
            rankingQuery: 'Zephyr Nightwing',
            topK: 5,
            itemsPageSize: 2000,
        });
        assert.equal(rankedRes.quotedItems[0]?.Name, 'late-index-followup-workitem-44219');
        assert.deepEqual(rankedRes.quotedItems[0]?.Assignees, ['Zephyr Nightwing']);

        const explicitRes = await resolveSpaceAgentRetrieval(provider, ada, ROOT_SPACE_ID, {
            conversationKind: 'General',
            query: 'Zephyr Nightwing',
            topK: 5,
            itemsPageSize: 2000,
        });
        assert.equal(explicitRes.quotedItems.length, 1);
        assert.equal(explicitRes.quotedItems[0]?.Name, 'late-index-followup-workitem-44219');
    });

    it('strictly enforces per-source and aggregate prompt token ceilings on first item, long titles, and oversized assignee lists (CR-4)', () => {
        const longNameTask = {
            ID: makeUuid('D0000001', 1),
            SpaceID: ROOT_SPACE_ID,
            EntityID: TASKS_ENTITY_ID,
            RecordID: makeUuid('F0000001', 1),
            EntityName: 'MJ_BizApps_Tasks: Tasks',
            Name: 'Extremely-Long-Task-Title-'.repeat(12),
            Description: 'Detailed description '.repeat(20),
            Band: 'Shared' as const,
            StoredContentType: null,
            Status: 'InProgress',
            Priority: 'Urgent',
            DueAt: '2026-12-31',
            PercentComplete: 85,
            Assignees: Array.from({ length: 100 }, (_, i) => `Assignee Member Number ${i + 1}`),
            ChunkTexts: ['Extensive chunk content '.repeat(30)],
        };

        const perSourceResult = applyContextTokenBudget(
            [{ item: longNameTask, score: 1.0, rankingMode: 'lexical', originalIndex: 0 }],
            { topK: 5, maxTokensPerSource: 32, maxContextTokens: 120 },
        );
        assert.equal(perSourceResult.items.length, 1);
        const renderedFirstLine = renderCandidateItemPromptLine(perSourceResult.items[0]);
        const renderedTokens = estimateTokenCount(renderedFirstLine);
        assert.ok(
            renderedTokens <= 32,
            `Rendered prompt line (${renderedTokens} tokens) must not exceed 32 tokens: ${renderedFirstLine}`,
        );
        assert.ok(perSourceResult.totalEstimatedTokens <= 120);
        assert.equal(perSourceResult.suppliedSources[0]?.truncated, true);

        // Even when the very first item exceeds maxContextTokens (below minimum viable rendered line), it must NOT be emitted
        const impossibleBudget = applyContextTokenBudget(
            [{ item: longNameTask, score: 1.0, rankingMode: 'lexical', originalIndex: 0 }],
            { topK: 5, maxTokensPerSource: 64, maxContextTokens: 8 },
        );
        assert.equal(impossibleBudget.items.length, 0, 'First item cannot bypass maxContextTokens ceiling');
        assert.equal(impossibleBudget.totalEstimatedTokens, 0);
    });

    it('emits allowed=false refusal decisions with withheld task metadata for Team items in General rooms (AG15)', async () => {
        const sharedTaskId = makeUuid('E0000001', 1);
        const teamTaskId = makeUuid('E0000001', 2);
        const sharedItemId = makeUuid('D0000001', 1);
        const teamItemId = makeUuid('D0000001', 2);

        const world: SyntheticWorld = {
            items: [
                {
                    ID: sharedItemId,
                    SpaceID: ROOT_SPACE_ID,
                    EntityID: TASKS_ENTITY_ID,
                    RecordID: `ID|${sharedTaskId}`,
                    Band: 'Shared',
                },
                {
                    ID: teamItemId,
                    SpaceID: ROOT_SPACE_ID,
                    EntityID: TASKS_ENTITY_ID,
                    RecordID: `ID|${teamTaskId}`,
                    Band: 'Team',
                },
            ],
            filesById: new Map(),
            tasksById: new Map([
                [sharedTaskId.toLowerCase(), {
                    ID: sharedTaskId,
                    Name: 'Shared Discovery Action Item',
                    Description: 'Public shared action item',
                    Status: 'Open',
                    Priority: 'High',
                    DueAt: '2026-12-15',
                    PercentComplete: 25,
                }],
                [teamTaskId.toLowerCase(), {
                    ID: teamTaskId,
                    Name: 'Team Internal Strategy Task',
                    Description: 'Confidential team-only roadmap item',
                    Status: 'InProgress',
                    Priority: 'Critical',
                    DueAt: '2026-12-20',
                    PercentComplete: 50,
                }],
            ]),
            taskAssignments: [],
            peopleById: new Map(),
            chunksByItemId: new Map(),
        };

        const provider = createScaleProvider(world);
        const ada = { ID: ADA_ID, Name: 'Ada' } as UserInfo;

        const res = await resolveSpaceAgentRetrieval(provider, ada, ROOT_SPACE_ID, {
            conversationKind: 'General',
        });

        assert.equal(res.quotedItems.some((i) => i.Name === 'Shared Discovery Action Item'), true);
        assert.equal(res.quotedItems.some((i) => i.Name === 'Team Internal Strategy Task'), false);
        assert.equal(res.suppliedSources?.some((s) => s.name === 'Team Internal Strategy Task') ?? false, false);

        const withheldDecision = res.decisions.find((d) => d.item.Name === 'Team Internal Strategy Task');
        assert.ok(withheldDecision, 'Staff caller must see Team task refusal decision in General room');
        assert.equal(withheldDecision?.allowed, false);
        assert.equal(withheldDecision?.item.Status, undefined);
        assert.equal(withheldDecision?.item.Priority, undefined);
        assert.equal(withheldDecision?.item.DueAt, undefined);
        assert.equal(withheldDecision?.item.Assignees, undefined);
        assert.equal(withheldDecision?.item.ChunkTexts, undefined);
    });
});
