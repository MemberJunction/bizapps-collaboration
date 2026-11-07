import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    WellKnownUserSource,
    type BaseEntity,
    type EntityInfo,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type UserInfo,
} from '@memberjunction/core';
import { resolveSpaceAgentRetrieval, type SpaceAgentCandidateItem } from '../dist/space-agent-retrieval.js';
import { filterRoomReplyItems } from '../dist/post-space-message.js';

const ROOT_SPACE_ID = 'AAAAAAAA-1111-4000-8000-000000000001';
const CHILD_SPACE_ID = 'AAAAAAAA-1111-4000-8000-000000000002';
const SIBLING_SPACE_ID = 'AAAAAAAA-1111-4000-8000-000000000003';
const CLOSED_SPACE_ID = 'AAAAAAAA-1111-4000-8000-000000000004';

const OWNER_ROLE_ID = 'BBBBBBBB-2222-4000-8000-000000000001';
const CLIENT_ROLE_ID = 'BBBBBBBB-2222-4000-8000-000000000002';

const ADA_ID = 'CCCCCCCC-3333-4000-8000-000000000001'; // Staff owner
const BEA_ID = 'CCCCCCCC-3333-4000-8000-000000000002'; // Client
const OUTSIDER_ID = 'CCCCCCCC-3333-4000-8000-000000000003';
const SYSTEM_USER_ID = 'CCCCCCCC-0000-4000-8000-000000000000';

const FILES_ENTITY_ID = 'DDDDDDDD-4444-4000-8000-000000000001';

const spacesData = [
    {
        ID: ROOT_SPACE_ID,
        ParentID: null,
        InheritsMembership: true,
        OwnerID: ADA_ID,
        AgentRetrieval: 'Included',
        AllowParentAssignees: true,
    },
    {
        ID: CHILD_SPACE_ID,
        ParentID: ROOT_SPACE_ID,
        InheritsMembership: true,
        OwnerID: ADA_ID,
        AgentRetrieval: 'Included',
        AllowParentAssignees: true,
    },
    {
        ID: SIBLING_SPACE_ID,
        ParentID: ROOT_SPACE_ID,
        InheritsMembership: true,
        OwnerID: ADA_ID,
        AgentRetrieval: 'ExcludedFromParentScope',
        AllowParentAssignees: true,
    },
    {
        ID: CLOSED_SPACE_ID,
        ParentID: ROOT_SPACE_ID,
        InheritsMembership: true,
        OwnerID: ADA_ID,
        AgentRetrieval: 'ExcludedEntirely',
        AllowParentAssignees: true,
    },
];

const rolesData = [
    {
        ID: OWNER_ROLE_ID,
        Level: 40,
        MaxGrantableLevel: 40,
        CanInvite: true,
        CanPromoteBand: true,
        CanSeeTeamBand: true,
        IsOwnerRole: true,
        CanContribute: true,
    },
    {
        ID: CLIENT_ROLE_ID,
        Level: 10,
        MaxGrantableLevel: 10,
        CanInvite: false,
        CanPromoteBand: false,
        CanSeeTeamBand: false,
        IsOwnerRole: false,
        CanContribute: true,
    },
];

const membersData = [
    {
        SpaceID: ROOT_SPACE_ID,
        UserID: ADA_ID,
        Status: 'Active',
        Band: 'Team',
        SpaceRoleTypeID: OWNER_ROLE_ID,
    },
    {
        SpaceID: CHILD_SPACE_ID,
        UserID: BEA_ID,
        Status: 'Active',
        Band: 'Shared',
        SpaceRoleTypeID: CLIENT_ROLE_ID,
    },
];

const itemsData = [
    {
        ID: 'EEEEEEEE-5555-4000-8000-000000000001',
        SpaceID: CHILD_SPACE_ID,
        EntityID: FILES_ENTITY_ID,
        RecordID: '11111111-5555-4000-8000-000000000001',
        Band: 'Shared' as const,
    },
    {
        ID: 'EEEEEEEE-5555-4000-8000-000000000002',
        SpaceID: CHILD_SPACE_ID,
        EntityID: FILES_ENTITY_ID,
        RecordID: '11111111-5555-4000-8000-000000000002',
        Band: 'Team' as const,
    },
    {
        ID: 'EEEEEEEE-5555-4000-8000-000000000003',
        SpaceID: ROOT_SPACE_ID,
        EntityID: FILES_ENTITY_ID,
        RecordID: '11111111-5555-4000-8000-000000000003',
        Band: 'Shared' as const,
    },
    {
        ID: 'EEEEEEEE-5555-4000-8000-000000000004',
        SpaceID: SIBLING_SPACE_ID,
        EntityID: FILES_ENTITY_ID,
        RecordID: '11111111-5555-4000-8000-000000000004',
        Band: 'Shared' as const,
    },
    {
        ID: 'EEEEEEEE-5555-4000-8000-000000000005',
        SpaceID: CLOSED_SPACE_ID,
        EntityID: FILES_ENTITY_ID,
        RecordID: '11111111-5555-4000-8000-000000000005',
        Band: 'Shared' as const,
    },
];

const targetRecords: Record<string, { Name: string; Description: string }> = {
    '11111111-5555-4000-8000-000000000001': { Name: 'site-photo.png', Description: 'Site photo for discovery' },
    '11111111-5555-4000-8000-000000000002': { Name: 'discovery-brief.pdf', Description: 'Internal discovery brief' },
    '11111111-5555-4000-8000-000000000003': { Name: 'root-notes.txt', Description: 'Root space notes' },
    '11111111-5555-4000-8000-000000000004': { Name: 'delivery-plan.docx', Description: 'Delivery plan' },
    '11111111-5555-4000-8000-000000000005': { Name: 'archive.zip', Description: 'Closed archive' },
};

function createMockProvider(): IMetadataProvider {
    const mockProvider = {
        async GetEntityObject() {
            return {
                RunViewProviderToUse: mockProvider as unknown as IRunViewProvider,
                ProviderToUse: mockProvider as unknown as IMetadataProvider,
            } as unknown as BaseEntity;
        },
        EntityByID(id: string): EntityInfo | undefined {
            if (id.toLowerCase() === FILES_ENTITY_ID.toLowerCase()) {
                return { Name: 'MJ_BizApps_Collaboration: Space Files' } as Partial<EntityInfo> as EntityInfo;
            }
            return undefined;
        },
        async RunView(params: RunViewParams) {
            const results = runSingleView(params);
            return { Success: true, Results: results, ErrorMessage: '', RowCount: results.length, TotalRowCount: results.length, ExecutionTime: 0 };
        },
        async RunViews(params: RunViewParams[]) {
            return params.map((p) => {
                const results = runSingleView(p);
                return { Success: true, Results: results, ErrorMessage: '', RowCount: results.length, TotalRowCount: results.length, ExecutionTime: 0 };
            });
        },
    };
    return mockProvider as unknown as IMetadataProvider;
}

let mockSpacesOverride: Record<string, unknown>[] | null = null;
let mockItemsOverride: Record<string, unknown>[] | null = null;

function runSingleView(params: RunViewParams): Record<string, unknown>[] {
    const { EntityName, ExtraFilter } = params;
    const filter = typeof ExtraFilter === 'string' ? ExtraFilter : (ExtraFilter ? String(ExtraFilter) : '');
    if (EntityName === 'MJ_BizApps_Collaboration: Spaces') {
        return mockSpacesOverride ?? spacesData;
    }
    if (EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
        return rolesData;
    }
    if (EntityName === 'MJ_BizApps_Collaboration: Space Members') {
        return membersData.filter((m) => {
            if (filter.includes('UserID')) {
                const match = filter.match(/UserID\s*=\s*'([^']+)'/i);
                if (match && match[1].toLowerCase() !== m.UserID.toLowerCase()) return false;
            }
            return true;
        });
    }
    if (EntityName === 'MJ_BizApps_Collaboration: Space Items') {
        if (mockItemsOverride) return mockItemsOverride;
        return itemsData.filter((item) => {
            if (filter.includes('SpaceID IN')) {
                return filter.toLowerCase().includes(item.SpaceID.toLowerCase());
            }
            return true;
        });
    }
    if (EntityName === 'MJ_BizApps_Collaboration: Space Files') {
        const matching: Record<string, unknown>[] = [];
        for (const [id, rec] of Object.entries(targetRecords)) {
            if (filter.toLowerCase().includes(id.toLowerCase())) {
                matching.push({ ID: id, Name: rec.Name, Description: rec.Description });
            }
        }
        return matching;
    }
    return [];
}

describe('resolveSpaceAgentRetrieval', () => {
    const provider = createMockProvider();
    const source = WellKnownUserSource.Instance;
    const origGetSystemUser = source.GetSystemUser.bind(source);

    source.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID, Name: 'System' } as UserInfo);

    it('returns empty result for user who cannot reach the space', async () => {
        const user = { ID: OUTSIDER_ID, Name: 'Outsider' } as UserInfo;
        const res = await resolveSpaceAgentRetrieval(provider, user, CHILD_SPACE_ID);

        assert.equal(res.candidateItems.length, 0);
        assert.equal(res.quotedItems.length, 0);
        assert.equal(res.callerCanSeeTeam, false);
    });

    it('MJ Owner user with no seat cannot reach the space and gets empty retrieval', async () => {
        const ownerUser = { ID: OUTSIDER_ID, Name: 'OwnerOutsider', Type: 'Owner' } as UserInfo;
        const res = await resolveSpaceAgentRetrieval(provider, ownerUser, CHILD_SPACE_ID);

        assert.equal(res.candidateItems.length, 0);
        assert.equal(res.quotedItems.length, 0);
        assert.equal(res.callerCanSeeTeam, false);
        assert.equal(res.searchedSpaceIds.length, 0);
    });

    it('client Bea in Discovery quotes Shared site-photo.png but never Team discovery-brief.pdf', async () => {
        const user = { ID: BEA_ID, Name: 'Bea' } as UserInfo;
        const res = await resolveSpaceAgentRetrieval(provider, user, CHILD_SPACE_ID);

        assert.equal(res.callerCanSeeTeam, false);
        const quotedNames = res.quotedItems.map((q) => q.Name);
        assert.ok(quotedNames.includes('site-photo.png'), 'Quotes site-photo.png');
        assert.ok(!quotedNames.includes('discovery-brief.pdf'), 'Never quotes Team discovery-brief.pdf');
        assert.ok(!quotedNames.includes('root-notes.txt'), 'Never quotes parent space items');
        assert.ok(!quotedNames.includes('delivery-plan.docx'), 'Never quotes sibling space items');

        const photoDecision = res.decisions.find((d) => d.item.Name === 'site-photo.png');
        assert.equal(photoDecision?.allowed, true);
        const briefDecision = res.decisions.find((d) => d.item.Name === 'discovery-brief.pdf');
        assert.equal(briefDecision?.allowed, false);
    });

    it('staff Ada in Discovery quotes both Shared and Team items in Discovery', async () => {
        const user = { ID: ADA_ID, Name: 'Ada' } as UserInfo;
        const res = await resolveSpaceAgentRetrieval(provider, user, CHILD_SPACE_ID);

        assert.equal(res.callerCanSeeTeam, true);
        const quotedNames = res.quotedItems.map((q) => q.Name);
        assert.ok(quotedNames.includes('site-photo.png'), 'Quotes site-photo.png');
        assert.ok(quotedNames.includes('discovery-brief.pdf'), 'Quotes discovery-brief.pdf');
        assert.ok(!quotedNames.includes('root-notes.txt'), 'Does not leak parent items when asked from child');
    });

    it('staff Ada in Root quotes Root and Child items but honors ExcludedFromParentScope and ExcludedEntirely', async () => {
        const user = { ID: ADA_ID, Name: 'Ada' } as UserInfo;
        const res = await resolveSpaceAgentRetrieval(provider, user, ROOT_SPACE_ID);

        assert.equal(res.callerCanSeeTeam, true);
        const quotedNames = res.quotedItems.map((q) => q.Name);
        assert.ok(quotedNames.includes('root-notes.txt'), 'Quotes root notes');
        assert.ok(quotedNames.includes('site-photo.png'), 'Quotes discovery photo from child space');
        assert.ok(!quotedNames.includes('delivery-plan.docx'), 'Excludes Delivery (ExcludedFromParentScope)');
        assert.ok(!quotedNames.includes('archive.zip'), 'Excludes Closed space (ExcludedEntirely)');
    });

    it('safely handles invalid / missing spaceId or user, including quote injection', async () => {
        const user = { ID: ADA_ID, Name: 'Ada' } as UserInfo;
        const res1 = await resolveSpaceAgentRetrieval(provider, user, 'not-a-uuid');
        assert.equal(res1.quotedItems.length, 0);

        const res2 = await resolveSpaceAgentRetrieval(provider, { ID: 'invalid' } as UserInfo, ROOT_SPACE_ID);
        assert.equal(res2.quotedItems.length, 0);

        const resQuote = await resolveSpaceAgentRetrieval(provider, user, `${ROOT_SPACE_ID}' OR '1'='1`);
        assert.equal(resQuote.quotedItems.length, 0);
        assert.equal(resQuote.candidateItems.length, 0);
    });

    it('B0.2: filterRoomReplyItems includes only Shared items for the room space', () => {
        const items: SpaceAgentCandidateItem[] = [
            { ID: '1', SpaceID: CHILD_SPACE_ID, EntityID: FILES_ENTITY_ID, RecordID: 'r1', Name: 'site-photo.png', Description: null, Band: 'Shared', StoredContentType: 'image/png' },
            { ID: '2', SpaceID: CHILD_SPACE_ID, EntityID: FILES_ENTITY_ID, RecordID: 'r2', Name: 'discovery-brief.pdf', Description: null, Band: 'Team', StoredContentType: 'application/pdf' },
            { ID: '3', SpaceID: CHILD_SPACE_ID, EntityID: FILES_ENTITY_ID, RecordID: 'r3', Name: 'field-notes.txt', Description: null, Band: 'Team', StoredContentType: 'text/plain' },
            { ID: '4', SpaceID: 'SOME-SUB-SPACE-ID', EntityID: FILES_ENTITY_ID, RecordID: 'r4', Name: 'subspace-shared.pdf', Description: null, Band: 'Shared', StoredContentType: 'application/pdf' },
        ];
        const roomItems = filterRoomReplyItems(items, CHILD_SPACE_ID);
        assert.equal(roomItems.length, 1);
        assert.equal(roomItems[0].Name, 'site-photo.png');
        assert.equal(roomItems[0].Band, 'Shared');
        assert.equal(roomItems[0].SpaceID, CHILD_SPACE_ID);
    });

    it('B0.2: filterRoomReplyItems excludes Shared items from sub-spaces even when asker may quote them', () => {
        const SUB_SPACE_ID = 'SUB-0001-0000-4000-8000-000000000001';
        const items: SpaceAgentCandidateItem[] = [
            { ID: '10', SpaceID: SUB_SPACE_ID, EntityID: FILES_ENTITY_ID, RecordID: 'r10', Name: 'sub-space-shared.docx', Description: null, Band: 'Shared', StoredContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
            { ID: '11', SpaceID: CHILD_SPACE_ID, EntityID: FILES_ENTITY_ID, RecordID: 'r11', Name: 'this-space-shared.docx', Description: null, Band: 'Shared', StoredContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        ];
        const roomItems = filterRoomReplyItems(items, CHILD_SPACE_ID);
        assert.equal(roomItems.length, 1);
        assert.equal(roomItems[0].Name, 'this-space-shared.docx');
        assert.equal(roomItems.some((i) => i.Name === 'sub-space-shared.docx'), false);
    });

    it('refuses retrieval if spaces page comes back full (2000 rows)', async () => {
        const user = { ID: ADA_ID, Name: 'Ada' } as UserInfo;
        const fakeSpaces = Array.from({ length: 2000 }, () => spacesData[0]);
        mockSpacesOverride = fakeSpaces;
        try {
            await assert.rejects(
                () => resolveSpaceAgentRetrieval(provider, user, CHILD_SPACE_ID),
                /spaces page came back full/
            );
        } finally {
            mockSpacesOverride = null;
        }
    });

    it('refuses retrieval if items page comes back full (2000 rows)', async () => {
        const user = { ID: ADA_ID, Name: 'Ada' } as UserInfo;
        const fakeItems = Array.from({ length: 2000 }, () => itemsData[0]);
        mockItemsOverride = fakeItems;
        try {
            await assert.rejects(
                () => resolveSpaceAgentRetrieval(provider, user, CHILD_SPACE_ID),
                /items page came back full/
            );
        } finally {
            mockItemsOverride = null;
        }
    });

    it('B2.3: staff Ada in General room of Discovery is bounded to Shared band (excludes discovery-brief.pdf)', async () => {
        const user = { ID: ADA_ID, Name: 'Ada' } as UserInfo;
        const res = await resolveSpaceAgentRetrieval(provider, user, CHILD_SPACE_ID, {
            conversationKind: 'General',
        });

        assert.equal(res.callerCanSeeTeam, true, 'Caller Ada still has a Team seat');
        assert.ok(res.audienceUserIds.some((id) => id.toLowerCase() === ADA_ID.toLowerCase()), 'Ada is in room audience');
        assert.ok(res.audienceUserIds.some((id) => id.toLowerCase() === BEA_ID.toLowerCase()), 'Client Bea is in General room audience');

        const quotedNames = res.quotedItems.map((q) => q.Name);
        assert.ok(quotedNames.includes('site-photo.png'), 'Quotes Shared site-photo.png');
        assert.ok(!quotedNames.includes('discovery-brief.pdf'), 'Excludes Team discovery-brief.pdf in General room');
    });

    it('B2.3: staff Ada in Private room of Discovery quotes both Shared and Team items', async () => {
        const user = { ID: ADA_ID, Name: 'Ada' } as UserInfo;
        const res = await resolveSpaceAgentRetrieval(provider, user, CHILD_SPACE_ID, {
            conversationKind: 'Private',
        });

        assert.equal(res.callerCanSeeTeam, true, 'Private room allows Team band for staff');
        assert.ok(res.audienceUserIds.some((id) => id.toLowerCase() === ADA_ID.toLowerCase()), 'Ada is in Private room audience');
        assert.ok(!res.audienceUserIds.some((id) => id.toLowerCase() === BEA_ID.toLowerCase()), 'Client Bea is excluded from Private room audience');

        const quotedNames = res.quotedItems.map((q) => q.Name);
        assert.ok(quotedNames.includes('site-photo.png'), 'Quotes Shared site-photo.png');
        assert.ok(quotedNames.includes('discovery-brief.pdf'), 'Quotes Team discovery-brief.pdf in Private room');
    });

    it('B2.3: audience intersection excludes sealed sub-space that another room participant cannot reach', async () => {
        const SEALED_SPACE_ID = 'AAAAAAAA-1111-4000-8000-000000000005';
        const SEALED_RECORD_ID = '11111111-5555-4000-8000-000000000006';
        const CASEY_ID = 'CCCCCCCC-3333-4000-8000-000000000004';
        targetRecords[SEALED_RECORD_ID] = { Name: 'sealed-secret.pdf', Description: 'Sealed branch item' };
        mockSpacesOverride = [
            ...spacesData,
            {
                ID: SEALED_SPACE_ID,
                ParentID: ROOT_SPACE_ID,
                InheritsMembership: false,
                OwnerID: ADA_ID,
                AgentRetrieval: 'Included',
                AllowParentAssignees: false,
            },
        ];
        mockItemsOverride = [
            ...itemsData,
            {
                ID: 'EEEEEEEE-5555-4000-8000-000000000006',
                SpaceID: SEALED_SPACE_ID,
                EntityID: FILES_ENTITY_ID,
                RecordID: SEALED_RECORD_ID,
                Band: 'Shared' as const,
            },
        ];
        membersData.push(
            {
                SpaceID: SEALED_SPACE_ID,
                UserID: ADA_ID,
                Status: 'Active',
                Band: 'Team',
                SpaceRoleTypeID: OWNER_ROLE_ID,
            },
            {
                SpaceID: ROOT_SPACE_ID,
                UserID: CASEY_ID,
                Status: 'Active',
                Band: 'Team',
                SpaceRoleTypeID: OWNER_ROLE_ID,
            },
        );
        try {
            const ada = { ID: ADA_ID, Name: 'Ada' } as UserInfo;
            // Without room audience, Ada has a direct seat on SEALED_SPACE_ID so she reaches it from ROOT_SPACE_ID
            const soloRes = await resolveSpaceAgentRetrieval(provider, ada, ROOT_SPACE_ID);
            assert.ok(
                soloRes.quotedItems.some((q) => q.Name === 'sealed-secret.pdf'),
                'Ada alone reaches sealed child from root',
            );

            // In Root General room, Casey is also in the audience and cannot reach SEALED_SPACE_ID
            const roomRes = await resolveSpaceAgentRetrieval(provider, ada, ROOT_SPACE_ID, {
                conversationKind: 'General',
            });
            assert.ok(
                !roomRes.searchedSpaceIds.some((id) => id.toLowerCase() === SEALED_SPACE_ID.toLowerCase()),
                'Sealed child space is excluded from searchedSpaceIds when another room participant cannot reach it',
            );
            assert.ok(
                !roomRes.quotedItems.some((q) => q.Name === 'sealed-secret.pdf'),
                'Sealed child item is never quoted in parent room where Casey is present',
            );
        } finally {
            mockSpacesOverride = null;
            mockItemsOverride = null;
            membersData.pop();
            membersData.pop();
            delete targetRecords[SEALED_RECORD_ID];
        }
    });

    it('retrieves a variety of documents uploaded via uploadSpaceFile (.pdf, .docx, .xlsx, .csv, .md, .json, .html, .xml, .txt, .png, .svg), Space Notes turned into documents via noteDocument, and polymorphic Tasks across bands, audiences, subtrees, and query filters', async () => {
        const { noteDocument } = await import('@mj-biz-apps/collaboration-core');
        const { uploadSpaceFile } = await import('../dist/upload-space-file.js');
        const REAL_FILES_ENTITY_ID = '33642155-617E-4825-A2CC-F071A60F3739';
        const TASKS_ENTITY_ID = '77777777-4444-4000-8000-000000000001';

        const uploadedFiles = new Map<string, { ID: string; Name: string; Description: string | null; ContentType: string }>();
        const uploadedItems: Array<{ ID: string; SpaceID: string; EntityID: string; RecordID: string; Band: 'Shared' | 'Team' }> = [];
        const uploadedArtifacts: Array<{ id: string; name: string; typeId: string }> = [];
        let seq = 0;

        const sharedNoteDoc = noteDocument({
            Title: 'Kickoff Workshop Synthesis Note',
            Body: 'Agreed on EDI 856 ASN feed and webhook milestones.',
        });
        const teamNoteDoc = noteDocument({
            Title: 'Internal Pricing Redline Note',
            Body: 'Hold 18% blended margin floor on renewal.',
        });

        const docsToUpload: Array<{
            spaceId: string;
            fileName: string;
            mimeType: string;
            expectedStoredMime: string;
            expectedArtifactType: string;
            description: string;
            band: 'Shared' | 'Team';
            content: string;
        }> = [
            {
                spaceId: CHILD_SPACE_ID,
                fileName: 'executive-roadmap.pdf',
                mimeType: 'application/pdf',
                expectedStoredMime: 'application/pdf',
                expectedArtifactType: 'TYPE:PDF',
                description: 'Q3/Q4 client executive roadmap and milestone schedule',
                band: 'Shared',
                content: '%PDF-1.4 executive roadmap',
            },
            {
                spaceId: CHILD_SPACE_ID,
                fileName: 'master-services-agreement.docx',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                expectedStoredMime: 'application/octet-stream',
                expectedArtifactType: 'TYPE:Word Document',
                description: 'Signed MSA and statement of work deliverables',
                band: 'Shared',
                content: 'PK\x03\x04 MSA docx content',
            },
            {
                spaceId: CHILD_SPACE_ID,
                fileName: 'kpi-financial-model.xlsx',
                mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                expectedStoredMime: 'application/octet-stream',
                expectedArtifactType: 'TYPE:Excel Spreadsheet',
                description: 'Internal EBITDA sensitivity and margin workbook',
                band: 'Team',
                content: 'PK\x03\x04 Excel financial model',
            },
            {
                spaceId: CHILD_SPACE_ID,
                fileName: 'warehouse-dwell-metrics.csv',
                mimeType: 'text/csv',
                expectedStoredMime: 'text/plain',
                expectedArtifactType: 'TYPE:CSV',
                description: 'Daily dock-to-stock dwell hours and OTIF telemetry',
                band: 'Shared',
                content: 'facility,dwell_hours,otif_pct\nChicago,3.8,94.2\n',
            },
            {
                spaceId: CHILD_SPACE_ID,
                fileName: 'architecture-decisions.md',
                mimeType: 'text/markdown',
                expectedStoredMime: 'text/plain',
                expectedArtifactType: 'TYPE:Markdown Document',
                description: 'ADR-01 event-driven integration architecture notes',
                band: 'Shared',
                content: '# ADR-01\nUse GraphQL + Row-Level Security.',
            },
            {
                spaceId: CHILD_SPACE_ID,
                fileName: sharedNoteDoc.fileName,
                mimeType: sharedNoteDoc.mimeType,
                expectedStoredMime: 'text/plain',
                expectedArtifactType: 'TYPE:Markdown Document',
                description: 'Space Note turned into Shared document from kickoff workshop',
                band: 'Shared',
                content: sharedNoteDoc.content,
            },
            {
                spaceId: CHILD_SPACE_ID,
                fileName: teamNoteDoc.fileName,
                mimeType: teamNoteDoc.mimeType,
                expectedStoredMime: 'text/plain',
                expectedArtifactType: 'TYPE:Markdown Document',
                description: 'Space Note turned into Team document for pricing redlines',
                band: 'Team',
                content: teamNoteDoc.content,
            },
            {
                spaceId: CHILD_SPACE_ID,
                fileName: 'api-contract.json',
                mimeType: 'application/json',
                expectedStoredMime: 'application/octet-stream',
                expectedArtifactType: 'TYPE:JSON',
                description: 'OpenAPI 3.1 contract for order fulfillment webhooks',
                band: 'Shared',
                content: JSON.stringify({ openapi: '3.1.0', info: { title: 'Fulfillment API' } }),
            },
            {
                spaceId: CHILD_SPACE_ID,
                fileName: 'onboarding-portal.html',
                mimeType: 'text/html',
                expectedStoredMime: 'text/plain',
                expectedArtifactType: 'TYPE:HTML',
                description: 'Static HTML snapshot of partner onboarding portal',
                band: 'Shared',
                content: '<!doctype html><html><body><h1>Onboarding</h1></body></html>',
            },
            {
                spaceId: CHILD_SPACE_ID,
                fileName: 'erp-schema-export.xml',
                mimeType: 'application/xml',
                expectedStoredMime: 'application/octet-stream',
                expectedArtifactType: 'TYPE:XML',
                description: 'Internal ERP ledger schema definition XML',
                band: 'Team',
                content: '<?xml version="1.0"?><schema name="Ledger"/>',
            },
            {
                spaceId: CHILD_SPACE_ID,
                fileName: 'negotiation-playbook.txt',
                mimeType: 'text/plain',
                expectedStoredMime: 'text/plain',
                expectedArtifactType: 'TYPE:Generic Text',
                description: 'Internal renewal negotiation redlines and fallback terms',
                band: 'Team',
                content: 'Internal playbook: hold 18% margin floor.',
            },
            {
                spaceId: CHILD_SPACE_ID,
                fileName: 'warehouse-floorplan.png',
                mimeType: 'image/png',
                expectedStoredMime: 'image/png',
                expectedArtifactType: 'TYPE:Image',
                description: 'Annotated bay layout diagram for Chicago facility',
                band: 'Shared',
                content: '\x89PNG\r\n\x1a\n floorplan',
            },
            {
                spaceId: CHILD_SPACE_ID,
                fileName: 'network-topology.svg',
                mimeType: 'image/svg+xml',
                expectedStoredMime: 'application/octet-stream',
                expectedArtifactType: 'TYPE:SVG Image',
                description: 'VPC peering and transit gateway vector diagram',
                band: 'Shared',
                content: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
            },
            {
                spaceId: ROOT_SPACE_ID,
                fileName: 'account-governance-charter.pdf',
                mimeType: 'application/pdf',
                expectedStoredMime: 'application/pdf',
                expectedArtifactType: 'TYPE:PDF',
                description: 'Root relationship charter and steering cadence',
                band: 'Shared',
                content: '%PDF-1.4 governance charter',
            },
            {
                spaceId: SIBLING_SPACE_ID,
                fileName: 'delivery-cutover-runbook.md',
                mimeType: 'text/markdown',
                expectedStoredMime: 'text/plain',
                expectedArtifactType: 'TYPE:Markdown Document',
                description: 'Production cutover runbook in ExcludedFromParentScope space',
                band: 'Shared',
                content: '# Cutover Runbook',
            },
            {
                spaceId: CLOSED_SPACE_ID,
                fileName: 'legacy-postmortem.docx',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                expectedStoredMime: 'application/octet-stream',
                expectedArtifactType: 'TYPE:Word Document',
                description: 'Archived postmortem in ExcludedEntirely space',
                band: 'Shared',
                content: 'PK\x03\x04 legacy postmortem',
            },
        ];

        const ada = { ID: ADA_ID, Name: 'Ada' } as UserInfo;
        const bea = { ID: BEA_ID, Name: 'Bea' } as UserInfo;
        const system = { ID: SYSTEM_USER_ID, Name: 'System' } as UserInfo;

        const uploadAndRetrievalProvider = {
            EntityByName(name: string) {
                if (name === 'MJ: Files') return { ID: REAL_FILES_ENTITY_ID };
                return undefined;
            },
            EntityByID(id: string): EntityInfo | undefined {
                const lower = id.toLowerCase();
                if (lower === REAL_FILES_ENTITY_ID.toLowerCase()) {
                    return {
                        Name: 'MJ: Files',
                        Fields: [{ Name: 'ID' }, { Name: 'Name' }, { Name: 'Description' }, { Name: 'ContentType' }],
                    } as unknown as EntityInfo;
                }
                if (lower === TASKS_ENTITY_ID.toLowerCase()) {
                    return {
                        Name: 'MJ_BizApps_Tasks: Tasks',
                        Fields: [{ Name: 'ID' }, { Name: 'Name' }, { Name: 'Description' }],
                    } as unknown as EntityInfo;
                }
                return undefined;
            },
            async GetEntityObject(entityName: string) {
                if (entityName === 'MJ: Artifacts' || entityName === 'MJ: Artifact Versions') {
                    const values: Record<string, unknown> = {};
                    return {
                        NewRecord() { return undefined; },
                        Set(k: string, v: unknown) { values[k] = v; },
                        Get(k: string) { return values[k]; },
                        async Save() {
                            seq += 1;
                            const id = `99999999-0000-4000-8000-${String(seq).padStart(12, '0')}`;
                            values['ID'] = id;
                            if (entityName === 'MJ: Artifacts') {
                                uploadedArtifacts.push({
                                    id,
                                    name: String(values['Name'] ?? ''),
                                    typeId: String(values['TypeID'] ?? ''),
                                });
                            }
                            return true;
                        },
                        async InnerLoad() { return true; },
                        async Delete() { return true; },
                        LatestResult: { CompleteMessage: '' },
                    } as unknown as BaseEntity;
                }
                if (entityName === 'MJ_BizApps_Collaboration: Space Items') {
                    const itemObj = {
                        ID: '',
                        SpaceID: '',
                        EntityID: '',
                        RecordID: '',
                        ArtifactVersionID: null as string | null,
                        Band: 'Shared' as 'Shared' | 'Team',
                        Folder: null as string | null,
                        NewRecord() { return undefined; },
                        async Save() {
                            seq += 1;
                            this.ID = `88888888-1111-4000-8000-${String(seq).padStart(12, '0')}`;
                            uploadedItems.push({
                                ID: this.ID,
                                SpaceID: this.SpaceID,
                                EntityID: this.EntityID,
                                RecordID: this.RecordID,
                                Band: this.Band,
                            });
                            return true;
                        },
                        LatestResult: { CompleteMessage: '' },
                    };
                    return itemObj as unknown as BaseEntity;
                }
                return {
                    RunViewProviderToUse: uploadAndRetrievalProvider as unknown as IRunViewProvider,
                    ProviderToUse: uploadAndRetrievalProvider as unknown as IMetadataProvider,
                } as unknown as BaseEntity;
            },
            async RunView(params: RunViewParams, contextUser?: UserInfo) {
                const results = runMultiSourceView(params, contextUser);
                return { Success: true, Results: results, ErrorMessage: '', RowCount: results.length, TotalRowCount: results.length, ExecutionTime: 0 };
            },
            async RunViews(params: RunViewParams[], contextUser?: UserInfo) {
                return params.map((p) => {
                    const results = runMultiSourceView(p, contextUser);
                    return { Success: true, Results: results, ErrorMessage: '', RowCount: results.length, TotalRowCount: results.length, ExecutionTime: 0 };
                });
            },
        } as unknown as IMetadataProvider;

        const tasksById: Record<string, { ID: string; Name: string; Description: string }> = {
            '77777777-0000-4000-8000-000000000001': {
                ID: '77777777-0000-4000-8000-000000000001',
                Name: 'Validate EDI 856 ASN Feed',
                Description: 'Verify advance ship notice payload mapping with client warehouse team',
            },
            '77777777-0000-4000-8000-000000000002': {
                ID: '77777777-0000-4000-8000-000000000002',
                Name: 'Internal Margin Sign-off',
                Description: 'Partner sign-off on blended hourly rate card',
            },
        };

        function runMultiSourceView(params: RunViewParams, contextUser?: UserInfo): Record<string, unknown>[] {
            const filter = typeof params.ExtraFilter === 'string' ? params.ExtraFilter : '';
            if (params.EntityName === 'MJ: Artifact Types') {
                return [{ ID: `TYPE:${/Name = '([^']*)'/.exec(filter)?.[1] ?? ''}` }];
            }
            if (params.EntityName === 'MJ: Files') {
                return Array.from(uploadedFiles.values()).filter((f) => filter.toLowerCase().includes(f.ID.toLowerCase()));
            }
            if (params.EntityName === 'MJ_BizApps_Tasks: Tasks') {
                return Object.values(tasksById).filter((t) => filter.toLowerCase().includes(t.ID.toLowerCase()));
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Items') {
                // Simulate SQL RLS fnCollaborationAccess: Bea (client) only sees Shared items in CHILD_SPACE_ID
                const isBea = contextUser?.ID?.toLowerCase() === BEA_ID.toLowerCase();
                return uploadedItems.filter((item) => {
                    if (filter.includes('SpaceID IN') && !filter.toLowerCase().includes(item.SpaceID.toLowerCase())) {
                        return false;
                    }
                    if (isBea) {
                        return item.SpaceID.toLowerCase() === CHILD_SPACE_ID.toLowerCase() && item.Band === 'Shared';
                    }
                    return true;
                });
            }
            return runSingleView(params);
        }

        // 1. Upload all 16 documents (14 formats + 2 Space Notes turned into Markdown documents) across spaces and bands via uploadSpaceFile
        for (const doc of docsToUpload) {
            const outcome = await uploadSpaceFile({
                user: ada,
                storageUser: system,
                provider: uploadAndRetrievalProvider,
                store: {
                    async put(input) {
                        seq += 1;
                        const fileId = `66666666-0000-4000-8000-${String(seq).padStart(12, '0')}`;
                        uploadedFiles.set(fileId.toLowerCase(), {
                            ID: fileId,
                            Name: input.fileName,
                            Description: doc.description,
                            ContentType: input.mimeType,
                        });
                        return { fileId, storagePath: `spaces/${doc.spaceId}/${input.fileName}`, accountId: 'ACC-1' };
                    },
                    async remove() {
                        return true;
                    },
                },
                spaceId: doc.spaceId,
                folder: 'Library',
                fileName: doc.fileName,
                mimeType: doc.mimeType,
                content: Buffer.from(doc.content),
                gate: async () => ({ ok: true, band: doc.band }),
            });
            assert.equal(outcome.ok, true, `uploadSpaceFile succeeded for ${doc.fileName}`);
            const artifact = uploadedArtifacts.find((a) => a.name === doc.fileName);
            assert.equal(artifact?.typeId, doc.expectedArtifactType, `Artifact TypeID matches for ${doc.fileName}`);
        }

        // Also link polymorphic Space Items: 2 Tasks (1 Shared, 1 Team) in CHILD_SPACE_ID
        uploadedItems.push(
            {
                ID: '88888888-2222-4000-8000-000000000001',
                SpaceID: CHILD_SPACE_ID,
                EntityID: TASKS_ENTITY_ID,
                RecordID: 'ID|77777777-0000-4000-8000-000000000001',
                Band: 'Shared',
            },
            {
                ID: '88888888-2222-4000-8000-000000000002',
                SpaceID: CHILD_SPACE_ID,
                EntityID: TASKS_ENTITY_ID,
                RecordID: 'ID|77777777-0000-4000-8000-000000000002',
                Band: 'Team',
            },
        );

        // 2. Client Bea in CHILD_SPACE_ID retrieves all 9 Shared uploaded documents (including Shared note document) + Shared Task, with StoredContentType populated, and NEVER Team items
        const beaRes = await resolveSpaceAgentRetrieval(uploadAndRetrievalProvider, bea, CHILD_SPACE_ID);
        const beaNames = beaRes.quotedItems.map((q) => q.Name);
        const expectedSharedDocs = [
            'executive-roadmap.pdf',
            'master-services-agreement.docx',
            'warehouse-dwell-metrics.csv',
            'architecture-decisions.md',
            'kickoff-workshop-synthesis-note.md',
            'api-contract.json',
            'onboarding-portal.html',
            'warehouse-floorplan.png',
            'network-topology.svg',
        ];
        const expectedTeamDocs = [
            'kpi-financial-model.xlsx',
            'internal-pricing-redline-note.md',
            'erp-schema-export.xml',
            'negotiation-playbook.txt',
        ];

        for (const name of expectedSharedDocs) {
            const item = beaRes.quotedItems.find((q) => q.Name === name);
            assert.ok(item, `Bea retrieves Shared uploaded document ${name}`);
            const spec = docsToUpload.find((d) => d.fileName === name)!;
            assert.equal(item.StoredContentType, spec.expectedStoredMime, `StoredContentType populated for ${name}`);
            assert.equal(item.Description, spec.description, `Description populated for ${name}`);
        }
        assert.ok(beaNames.includes('Validate EDI 856 ASN Feed'), 'Bea retrieves Shared Task item');
        for (const teamName of [...expectedTeamDocs, 'Internal Margin Sign-off']) {
            assert.ok(!beaNames.includes(teamName), `Bea NEVER retrieves Team item ${teamName}`);
        }

        // 3. Staff Ada in CHILD_SPACE_ID (Private context) retrieves all 13 uploaded documents (9 Shared + 4 Team) + both Tasks, and no parent/sibling items
        const adaPrivate = await resolveSpaceAgentRetrieval(uploadAndRetrievalProvider, ada, CHILD_SPACE_ID, {
            conversationKind: 'Private',
        });
        const adaPrivNames = adaPrivate.quotedItems.map((q) => q.Name);
        for (const name of [...expectedSharedDocs, ...expectedTeamDocs, 'Validate EDI 856 ASN Feed', 'Internal Margin Sign-off']) {
            assert.ok(adaPrivNames.includes(name), `Ada Private in Discovery retrieves ${name}`);
        }
        assert.ok(!adaPrivNames.includes('account-governance-charter.pdf'), 'Child space does not leak parent document');
        assert.ok(!adaPrivNames.includes('delivery-cutover-runbook.md'), 'Child space does not leak sibling document');

        // 4. Staff Ada in CHILD_SPACE_ID (General conversation where Bea is in the room) is bounded to Shared items
        const adaGeneral = await resolveSpaceAgentRetrieval(uploadAndRetrievalProvider, ada, CHILD_SPACE_ID, {
            conversationKind: 'General',
        });
        const adaGenNames = adaGeneral.quotedItems.map((q) => q.Name);
        for (const name of expectedSharedDocs) {
            assert.ok(adaGenNames.includes(name), `Ada General in Discovery quotes Shared ${name}`);
        }
        for (const teamName of [...expectedTeamDocs, 'Internal Margin Sign-off']) {
            assert.ok(!adaGenNames.includes(teamName), `Ada General in Discovery blocks Team ${teamName} because Bea is in the room`);
        }

        // 5. Staff Ada in ROOT_SPACE_ID reaches Root + Discovery uploaded documents, but excludes Delivery (ExcludedFromParentScope) and Closed (ExcludedEntirely)
        const adaRoot = await resolveSpaceAgentRetrieval(uploadAndRetrievalProvider, ada, ROOT_SPACE_ID);
        const adaRootNames = adaRoot.quotedItems.map((q) => q.Name);
        assert.ok(adaRootNames.includes('account-governance-charter.pdf'), 'Root retrieval includes Root PDF');
        assert.ok(adaRootNames.includes('master-services-agreement.docx'), 'Root retrieval reaches Child DOCX');
        assert.ok(adaRootNames.includes('kpi-financial-model.xlsx'), 'Root retrieval reaches Child XLSX');
        assert.ok(!adaRootNames.includes('delivery-cutover-runbook.md'), 'Root retrieval excludes ExcludedFromParentScope MD');
        assert.ok(!adaRootNames.includes('legacy-postmortem.docx'), 'Root retrieval excludes ExcludedEntirely DOCX');

        // 6. Query filtering matches both filename and document Description across uploaded document formats
        const byFileName = await resolveSpaceAgentRetrieval(uploadAndRetrievalProvider, ada, CHILD_SPACE_ID, {
            query: 'warehouse-dwell',
        });
        assert.deepEqual(byFileName.quotedItems.map((q) => q.Name), ['warehouse-dwell-metrics.csv']);

        const byDescriptionShared = await resolveSpaceAgentRetrieval(uploadAndRetrievalProvider, bea, CHILD_SPACE_ID, {
            query: 'OpenAPI 3.1 contract',
        });
        assert.deepEqual(byDescriptionShared.quotedItems.map((q) => q.Name), ['api-contract.json']);

        const byDescriptionTeamAsAda = await resolveSpaceAgentRetrieval(uploadAndRetrievalProvider, ada, CHILD_SPACE_ID, {
            query: 'EBITDA sensitivity',
        });
        assert.deepEqual(byDescriptionTeamAsAda.quotedItems.map((q) => q.Name), ['kpi-financial-model.xlsx']);

        const byDescriptionTeamAsBea = await resolveSpaceAgentRetrieval(uploadAndRetrievalProvider, bea, CHILD_SPACE_ID, {
            query: 'EBITDA sensitivity',
        });
        assert.equal(byDescriptionTeamAsBea.quotedItems.length, 0, 'Bea cannot retrieve Team XLSX by description query');
    });

    it('attaches ChunkTexts from MJ: Content Item Chunks only to allowed Space Items and matches query against chunk text', async () => {
        const ada = { ID: ADA_ID, Name: 'Ada' } as UserInfo;
        const bea = { ID: BEA_ID, Name: 'Bea' } as UserInfo;
        const ERD_SHARED_ID = '55555555-1111-4111-8111-111111111111';
        const ERD_TEAM_ID = '55555555-2222-4222-8222-222222222222';
        const CI_SHARED_ID = '66666666-1111-4111-8111-111111111111';
        const CI_TEAM_ID = '66666666-2222-4222-8222-222222222222';
        const SHARED_ITEM_ID = itemsData[0].ID; // site-photo.png (Shared in CHILD_SPACE_ID)
        const TEAM_ITEM_ID = itemsData[1].ID;   // discovery-brief.pdf (Team in CHILD_SPACE_ID)

        const chunkProvider = {
            ...provider,
            EntityByID: provider.EntityByID.bind(provider),
            EntityByName(name: string): EntityInfo | undefined {
                if (name === 'MJ: Content Item Chunks') {
                    return { Name: 'MJ: Content Item Chunks' } as Partial<EntityInfo> as EntityInfo;
                }
                return undefined;
            },
            async GetEntityObject() {
                return {
                    RunViewProviderToUse: chunkProvider as unknown as IRunViewProvider,
                    ProviderToUse: chunkProvider as unknown as IMetadataProvider,
                } as unknown as BaseEntity;
            },
            async RunView(params: RunViewParams) {
                const filter = typeof params.ExtraFilter === 'string' ? params.ExtraFilter : String(params.ExtraFilter ?? '');
                if (params.EntityName === 'MJ: Entity Record Documents') {
                    const erds = [
                        { ID: ERD_SHARED_ID, RecordID: `ID|${SHARED_ITEM_ID}` },
                        { ID: ERD_TEAM_ID, RecordID: `ID|${TEAM_ITEM_ID}` },
                    ].filter((e) => filter.toLowerCase().includes(e.RecordID.slice(3).toLowerCase()));
                    return { Success: true, Results: erds, ErrorMessage: '', RowCount: erds.length, TotalRowCount: erds.length, ExecutionTime: 0 };
                }
                if (params.EntityName === 'MJ: Content Items') {
                    const cis = [
                        { ID: CI_SHARED_ID, EntityRecordDocumentID: ERD_SHARED_ID, RootParentID: null },
                        { ID: CI_TEAM_ID, EntityRecordDocumentID: ERD_TEAM_ID, RootParentID: null },
                    ].filter((c) => filter.toLowerCase().includes(c.EntityRecordDocumentID.toLowerCase()));
                    return { Success: true, Results: cis, ErrorMessage: '', RowCount: cis.length, TotalRowCount: cis.length, ExecutionTime: 0 };
                }
                if (params.EntityName === 'MJ: Content Item Chunks') {
                    const chunks = [
                        { ContentItemID: CI_SHARED_ID, Text: ' Dock door 7 bay sensor calibration phrase ', SortOrder: 0 },
                        { ContentItemID: CI_TEAM_ID, Text: ' Confidential margin floor 41 percent phrase ', SortOrder: 0 },
                    ].filter((ch) => filter.toLowerCase().includes(ch.ContentItemID.toLowerCase()));
                    return { Success: true, Results: chunks, ErrorMessage: '', RowCount: chunks.length, TotalRowCount: chunks.length, ExecutionTime: 0 };
                }
                return (provider as unknown as { RunView: (p: RunViewParams) => Promise<unknown> }).RunView(params);
            },
            async RunViews(params: RunViewParams[]) {
                return Promise.all(params.map((p) => (chunkProvider as unknown as { RunView: (p: RunViewParams) => Promise<unknown> }).RunView(p)));
            },
        } as unknown as IMetadataProvider;

        const beaRes = await resolveSpaceAgentRetrieval(chunkProvider, bea, CHILD_SPACE_ID);
        const beaShared = beaRes.quotedItems.find((i) => i.ID === SHARED_ITEM_ID);
        assert.deepEqual(beaShared?.ChunkTexts, ['Dock door 7 bay sensor calibration phrase']);
        const beaTeamDecision = beaRes.decisions.find((d) => d.item.ID === TEAM_ITEM_ID);
        assert.equal(beaTeamDecision?.allowed, false);
        assert.equal(beaTeamDecision?.item.ChunkTexts, undefined, 'Disallowed Team item never gets ChunkTexts');

        const bySharedChunk = await resolveSpaceAgentRetrieval(chunkProvider, bea, CHILD_SPACE_ID, {
            query: 'bay sensor calibration',
        });
        assert.deepEqual(bySharedChunk.quotedItems.map((i) => i.ID), [SHARED_ITEM_ID]);

        const byTeamChunkAsBea = await resolveSpaceAgentRetrieval(chunkProvider, bea, CHILD_SPACE_ID, {
            query: 'Confidential margin floor',
        });
        assert.equal(byTeamChunkAsBea.quotedItems.length, 0, 'Client Bea cannot match disallowed Team chunk text');

        const byTeamChunkAsAda = await resolveSpaceAgentRetrieval(chunkProvider, ada, CHILD_SPACE_ID, {
            query: 'Confidential margin floor',
        });
        assert.deepEqual(byTeamChunkAsAda.quotedItems.map((i) => i.ID), [TEAM_ITEM_ID]);
    });

    it('supports ThisSpace narrowing to exclude child space items while keeping anchor space items', async () => {
        const ada = { ID: ADA_ID, Name: 'Ada' } as UserInfo;
        const resThisSpace = await resolveSpaceAgentRetrieval(provider, ada, ROOT_SPACE_ID, {
            narrowing: 'ThisSpace',
        });
        assert.deepEqual(resThisSpace.searchedSpaceIds, [ROOT_SPACE_ID.toLowerCase()]);
        const quotedNames = resThisSpace.quotedItems.map((q) => q.Name);
        assert.deepEqual(quotedNames, ['root-notes.txt']);
    });

    it('supports Everything narrowing for a 1-to-1 Assistant conversation across multiple spaces with per-space band enforcement, and refuses to widen ExcludedEntirely or ExcludedFromParentScope floors', async () => {
        const OTHER_ROOT_SPACE_ID = 'AAAAAAAA-1111-4000-8000-000000000006';
        const OTHER_SHARED_REC_ID = '11111111-5555-4000-8000-000000000007';
        const OTHER_TEAM_REC_ID = '11111111-5555-4000-8000-000000000008';

        targetRecords[OTHER_SHARED_REC_ID] = { Name: 'partner-shared-charter.pdf', Description: 'Partner shared charter' };
        targetRecords[OTHER_TEAM_REC_ID] = { Name: 'partner-internal-pricing.xlsx', Description: 'Partner internal pricing' };

        mockSpacesOverride = [
            ...spacesData,
            {
                ID: OTHER_ROOT_SPACE_ID,
                ParentID: null,
                InheritsMembership: false,
                OwnerID: BEA_ID,
                AgentRetrieval: 'Included',
                AllowParentAssignees: true,
            },
        ];
        mockItemsOverride = [
            ...itemsData,
            {
                ID: 'EEEEEEEE-5555-4000-8000-000000000007',
                SpaceID: OTHER_ROOT_SPACE_ID,
                EntityID: FILES_ENTITY_ID,
                RecordID: OTHER_SHARED_REC_ID,
                Band: 'Shared' as const,
            },
            {
                ID: 'EEEEEEEE-5555-4000-8000-000000000008',
                SpaceID: OTHER_ROOT_SPACE_ID,
                EntityID: FILES_ENTITY_ID,
                RecordID: OTHER_TEAM_REC_ID,
                Band: 'Team' as const,
            },
        ];
        // Give Ada a Client (Shared-only) seat on OTHER_ROOT_SPACE_ID while she has Owner (Team) on ROOT_SPACE_ID / CHILD_SPACE_ID
        membersData.push({
            SpaceID: OTHER_ROOT_SPACE_ID,
            UserID: ADA_ID,
            Status: 'Active',
            Band: 'Shared',
            SpaceRoleTypeID: CLIENT_ROLE_ID,
        });

        try {
            const ada = { ID: ADA_ID, Name: 'Ada' } as UserInfo;

            // 1. Asking from CHILD_SPACE_ID with Everything narrowing in an Assistant chat
            const everythingRes = await resolveSpaceAgentRetrieval(provider, ada, CHILD_SPACE_ID, {
                conversationKind: 'Assistant',
                narrowing: 'Everything',
            });
            const quotedNames = everythingRes.quotedItems.map((q) => q.Name);

            // Quotes both Shared and Team in CHILD_SPACE_ID, plus Shared in ROOT_SPACE_ID
            assert.ok(quotedNames.includes('site-photo.png'), 'Quotes Shared item in anchor space');
            assert.ok(quotedNames.includes('discovery-brief.pdf'), 'Quotes Team item in anchor space where Ada has Team seat');
            assert.ok(quotedNames.includes('root-notes.txt'), 'Quotes parent space item under Everything narrowing');

            // Quotes Shared in OTHER_ROOT_SPACE_ID, but NEVER Team in OTHER_ROOT_SPACE_ID where Ada only has a Shared seat
            assert.ok(quotedNames.includes('partner-shared-charter.pdf'), 'Quotes Shared item from other reachable space');
            assert.ok(!quotedNames.includes('partner-internal-pricing.xlsx'), 'Refuses Team item from space where caller only has Shared seat');

            // Floor enforcement: NEVER quotes ExcludedFromParentScope (SIBLING_SPACE_ID) or ExcludedEntirely (CLOSED_SPACE_ID)
            assert.ok(!quotedNames.includes('delivery-plan.docx'), 'Floor enforced: ExcludedFromParentScope space is excluded under Everything');
            assert.ok(!quotedNames.includes('archive.zip'), 'Floor enforced: ExcludedEntirely space is excluded under Everything');

            // 2. Asking directly from CLOSED_SPACE_ID (ExcludedEntirely) with Everything narrowing still excludes CLOSED_SPACE_ID
            const fromExcludedEntirely = await resolveSpaceAgentRetrieval(provider, ada, CLOSED_SPACE_ID, {
                conversationKind: 'Assistant',
                narrowing: 'Everything',
            });
            assert.ok(
                !fromExcludedEntirely.quotedItems.some((q) => q.Name === 'archive.zip'),
                'ExcludedEntirely anchor space is never quoted even under Everything narrowing'
            );

            // 3. Multi-person General room ignores Everything narrowing and stays bounded to CHILD_SPACE_ID subtree + Shared band
            const multiPersonEverything = await resolveSpaceAgentRetrieval(provider, ada, CHILD_SPACE_ID, {
                conversationKind: 'General',
                narrowing: 'Everything',
            });
            const multiNames = multiPersonEverything.quotedItems.map((q) => q.Name);
            assert.deepEqual(multiNames, ['site-photo.png'], 'Multi-person conversation refuses Everything widening');
        } finally {
            mockSpacesOverride = null;
            mockItemsOverride = null;
            membersData.pop();
            delete targetRecords[OTHER_SHARED_REC_ID];
            delete targetRecords[OTHER_TEAM_REC_ID];
        }
    });
});



