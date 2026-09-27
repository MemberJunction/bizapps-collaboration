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

    it('Item 3: MJ Owner user with no seat cannot reach the space and gets empty retrieval', async () => {
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

    it('Item 3: Owner-type user with no seat gets nothing back from retrieval', async () => {
        const ownerWithoutSeat = { ID: OUTSIDER_ID, Name: 'Outsider Owner', Type: 'Owner' } as UserInfo;
        const res = await resolveSpaceAgentRetrieval(provider, ownerWithoutSeat, CHILD_SPACE_ID);
        assert.equal(res.searchedSpaceIds.length, 0);
        assert.equal(res.candidateItems.length, 0);
        assert.equal(res.quotedItems.length, 0);
        assert.equal(res.callerCanSeeTeam, false);
    });
});

