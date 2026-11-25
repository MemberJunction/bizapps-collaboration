import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { after, before, describe, it } from 'node:test';
import {
    WellKnownUserSource,
    type BaseEntity,
    type EntityInfo,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';
import { AgentRunner } from '@memberjunction/ai-agents';
import type { ExecuteAgentParams, MJAIAgentRunEntityExtended } from '@memberjunction/ai-core-plus';
import {
    buildSpaceAgentContextSystemMessage,
    extractArtifactVersionChunks,
    isShippedCollaborationSpaceAgent,
    SHIPPED_COLLABORATION_AGENT_ID,
} from '../dist/space-agent-artifact-content.js';
import { resolveSpaceAgentRetrieval } from '../dist/space-agent-retrieval.js';
import { executeSpaceChatTurn } from '../dist/execute-space-chat-turn.js';
import { BaseSpaceTypeServerDriver, type AgentContextResult } from '../dist/base-space-type-server-driver.js';
import { ServerDriverRegistry } from '../dist/server-driver-registry.js';
import { seedAppSettings } from './app-settings.test-support.ts';

function mockResult<T>(results: readonly object[]): RunViewResult<T> {
    return {
        Success: true,
        Results: (results as object) as T[],
        RowCount: results.length,
        TotalRowCount: results.length,
        ExecutionTime: 0,
        ErrorMessage: '',
    };
}

function stubOf<T>(value: object): T {
    return value as T;
}

function buildSamplePdfDataUri(lines: readonly string[], compress: boolean = false): string {
    const cmds = [
        'BT',
        '/F1 11 Tf',
        ...lines.map((line, idx) => {
            const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
            if (idx % 2 === 0) return `(${escaped}) Tj`;
            const splitSpace = escaped.indexOf(' ', Math.floor(escaped.length / 2));
            if (splitSpace === -1) return `[(${escaped})] TJ`;
            return `[(${escaped.slice(0, splitSpace)}) -140 (${escaped.slice(splitSpace + 1)})] TJ`;
        }),
        'ET',
    ].join('\n');

    const streamBuf = compress ? deflateSync(Buffer.from(cmds, 'latin1')) : Buffer.from(cmds, 'latin1');
    const filterHeader = compress ? '/Filter /FlateDecode ' : '';
    const padComment = `%${'P'.repeat(2048)}\n`;
    const prefix = `%PDF-1.4\n1 0 obj\n<< ${filterHeader}/Length ${streamBuf.length} >>\nstream\n`;
    const suffix = `\nendstream\nendobj\n${padComment}%%EOF\n`;
    const full = Buffer.concat([Buffer.from(prefix, 'latin1'), streamBuf, Buffer.from(suffix, 'latin1')]);
    return `data:application/pdf;base64,${full.toString('base64')}`;
}

describe('extractArtifactVersionChunks', () => {
    it('extracts readable chunks from Markdown documents', () => {
        const md = [
            '# Executive Partnership Charter',
            '',
            '## 1. Account Posture',
            '- Subscription Tier: **Transformation**',
            '- Compliance Envelope: `HIPAA + SOC 2 Type II`',
            '',
            '## 2. Next 30-Day Commitments',
            'Finalize Wave 2 rollout schedule and confirm executive metrics freeze.',
        ].join('\n');

        const chunks = extractArtifactVersionChunks(md);
        assert.ok(chunks.length >= 2);
        const joined = chunks.join(' ');
        assert.match(joined, /Executive Partnership Charter/);
        assert.match(joined, /Transformation/);
        assert.match(joined, /HIPAA \+ SOC 2 Type II/);
        assert.match(joined, /Wave 2 rollout schedule/);
    });

    it('extracts deck metadata, slide titles, regions, KPIs, and speaker notes from SlideDeckSpec JSON', () => {
        const deckJson = JSON.stringify({
            SchemaVersion: '1.0',
            DeckID: 'deck-qbr-1',
            Title: 'QBR Value Realization Deck',
            Subtitle: 'Q4 Executive Review',
            Master: {
                HeaderText: 'Quarterly Business Review',
                OrganizationName: 'Acme Health Network',
            },
            Slides: [
                {
                    SlideNumber: 1,
                    Title: 'Outcome Attainment Scorecard',
                    Subtitle: 'Baseline to Target Progression',
                    Regions: [
                        {
                            Label: 'Current Performance',
                            Kind: 'big-number',
                            BigNumberValue: '84%',
                            BigNumberLabel: 'Intake Automation Rate',
                            BigNumberDelta: '+34 pts vs baseline',
                            MarkdownContent: 'Verified production telemetry.',
                        },
                    ],
                    SpeakerNotes: 'Highlight 84% attainment against 90% year-end target.',
                },
                {
                    SlideNumber: 2,
                    Title: 'Executive Alignment',
                    Regions: [
                        {
                            Kind: 'quote',
                            MarkdownContent: '"Strict compliance governance builds leadership confidence."',
                            QuoteAttribution: 'Jordan Lee, VP Clinical Operations',
                        },
                    ],
                },
            ],
        });

        const chunks = extractArtifactVersionChunks(deckJson);
        assert.ok(chunks.length >= 3);
        const joined = chunks.join(' ');
        assert.match(joined, /QBR Value Realization Deck/);
        assert.match(joined, /Acme Health Network/);
        assert.match(joined, /Outcome Attainment Scorecard/);
        assert.match(joined, /Intake Automation Rate: 84%/);
        assert.match(joined, /\+34 pts vs baseline/);
        assert.match(joined, /Highlight 84% attainment/);
        assert.match(joined, /Jordan Lee, VP Clinical Operations/);
    });

    it('never throws on malformed JSON', () => {
        const chunks = extractArtifactVersionChunks('{ "SchemaVersion": "1.0", "Slides": [ broken');
        assert.ok(Array.isArray(chunks));
    });

    it('extracts readable text from base64 PDF (both uncompressed and FlateDecode) and never emits raw base64', () => {
        const uncompressedUri = buildSamplePdfDataUri([
            'EXECUTED STATEMENT OF WORK & ENTITLEMENT SCHEDULE',
            'Subscribed Tier: Transformation ($95,000 USD monthly retainer)',
            'Concurrent Delivery Room Cap: 15 concurrent workspaces (with SoD review)',
        ], false);
        const uncompressedChunks = extractArtifactVersionChunks(uncompressedUri);
        assert.ok(uncompressedChunks.length >= 1);
        const joinedUncompressed = uncompressedChunks.join(' ');
        assert.match(joinedUncompressed, /EXECUTED STATEMENT OF WORK/);
        assert.match(joinedUncompressed, /Transformation \(\$95,000 USD monthly retainer\)/);
        assert.match(joinedUncompressed, /15 concurrent workspaces/);
        assert.doesNotMatch(joinedUncompressed, /data:application\/pdf/i);
        assert.doesNotMatch(joinedUncompressed, /JVBERi0/);
        assert.doesNotMatch(joinedUncompressed, /PPPPPPPP/);

        const compressedUri = buildSamplePdfDataUri([
            'COMPLIANCE ATTESTATION REPORT',
            'Zero cross-tenant leaks across adversarial matrix.',
        ], true);
        const compressedChunks = extractArtifactVersionChunks(compressedUri);
        assert.ok(compressedChunks.length >= 1);
        const joinedCompressed = compressedChunks.join(' ');
        assert.match(joinedCompressed, /COMPLIANCE ATTESTATION REPORT/);
        assert.match(joinedCompressed, /Zero cross-tenant leaks/);
        assert.doesNotMatch(joinedCompressed, /JVBERi0/);
    });

    it('returns empty array for binary/image base64 payloads without leaking base64', () => {
        assert.deepEqual(extractArtifactVersionChunks('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA'), []);
        assert.deepEqual(extractArtifactVersionChunks('data:application/pdf;base64,AAAA'), []);
    });
});

describe('resolveSpaceAgentRetrieval MJ: Artifacts version hydration & band isolation', () => {
    const SPACE_ID = 'AAAAAAAA-2222-4000-8000-000000000001';
    const ROLE_TEAM_ID = 'BBBBBBBB-2222-4000-8000-000000000001';
    const ROLE_CLIENT_ID = 'BBBBBBBB-2222-4000-8000-000000000002';
    const STAFF_ID = 'CCCCCCCC-2222-4000-8000-000000000001';
    const CLIENT_ID = 'CCCCCCCC-2222-4000-8000-000000000002';
    const SYSTEM_ID = 'CCCCCCCC-0000-4000-8000-000000000000';
    const ARTIFACTS_ENTITY_ID = 'DDDDDDDD-2222-4000-8000-000000000001';

    const ART_CHARTER_ID = '11111111-2222-4000-8000-000000000001';
    const ART_DECK_ID = '11111111-2222-4000-8000-000000000002';
    const ART_SOW_ID = '11111111-2222-4000-8000-000000000003';
    const ART_TEAM_SECRET_ID = '11111111-2222-4000-8000-000000000004';

    const ITEM_CHARTER_ID = 'EEEEEEEE-2222-4000-8000-000000000001';
    const ITEM_DECK_ID = 'EEEEEEEE-2222-4000-8000-000000000002';
    const ITEM_SOW_ID = 'EEEEEEEE-2222-4000-8000-000000000003';
    const ITEM_TEAM_SECRET_ID = 'EEEEEEEE-2222-4000-8000-000000000004';

    const TEAM_CANARY = 'CANARY_TEAM_ONLY_SECRET_MARGIN_56_4_PCT';

    let origGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;

    before(() => {
        origGetSystemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: SYSTEM_ID, Name: 'System' } as UserInfo);
    });

    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
    });

    function createArtifactWorldProvider(): { provider: IMetadataProvider; versionFilters: string[] } {
        const versionFilters: string[] = [];
        const sowPdfUri = buildSamplePdfDataUri([
            'EXECUTED STATEMENT OF WORK & ENTITLEMENT SCHEDULE',
            'Retainer: $95,000 USD monthly | 15 concurrent workspaces',
        ]);
        const deckJson = JSON.stringify({
            SchemaVersion: '1.0',
            Title: 'QBR Value Realization Deck',
            Slides: [
                {
                    SlideNumber: 1,
                    Title: 'KPI Scorecard',
                    Regions: [
                        {
                            Kind: 'big-number',
                            BigNumberValue: '88%',
                            BigNumberLabel: 'Cycle Time Reduction',
                            BigNumberDelta: '+41 pts vs baseline',
                        },
                    ],
                },
            ],
        });

        const artifactRows = [
            { ID: ART_CHARTER_ID, Name: 'Executive Partnership Charter', Description: 'Executive governance charter.' },
            { ID: ART_DECK_ID, Name: 'QBR Value Realization Deck', Description: 'Quarterly review deck.' },
            { ID: ART_SOW_ID, Name: 'Executed SOW & Entitlement Schedule', Description: 'Signed SOW PDF.' },
            { ID: ART_TEAM_SECRET_ID, Name: 'Internal Margin Brief', Description: 'Team-only margin assessment.' },
        ];
        const versionRows = [
            { ID: '22222222-2222-4000-8000-000000000001', ArtifactID: ART_CHARTER_ID, VersionNumber: 1, Content: '# Old Charter Draft v1' },
            { ID: '22222222-2222-4000-8000-000000000002', ArtifactID: ART_CHARTER_ID, VersionNumber: 2, Content: '# Executive Partnership Charter v2\n## Governance\nHIPAA + SOC 2 Type II active posture.' },
            { ID: '22222222-2222-4000-8000-000000000003', ArtifactID: ART_DECK_ID, VersionNumber: 1, Content: deckJson },
            { ID: '22222222-2222-4000-8000-000000000004', ArtifactID: ART_SOW_ID, VersionNumber: 1, Content: sowPdfUri },
            { ID: '22222222-2222-4000-8000-000000000005', ArtifactID: ART_TEAM_SECRET_ID, VersionNumber: 1, Content: `# Internal Margin Brief\n${TEAM_CANARY}` },
        ];

        const provider: Partial<IMetadataProvider & IRunViewProvider> = {
            EntityByID(id: string) {
                if (id.toLowerCase() === ARTIFACTS_ENTITY_ID.toLowerCase()) {
                    return stubOf<EntityInfo>({ ID: ARTIFACTS_ENTITY_ID, Name: 'MJ: Artifacts' });
                }
                return undefined;
            },
            EntityByName(name: string) {
                if (name === 'MJ: Artifacts') return stubOf<EntityInfo>({ ID: ARTIFACTS_ENTITY_ID, Name: 'MJ: Artifacts' });
                if (name === 'MJ: Artifact Versions') return stubOf<EntityInfo>({ ID: 'DDDDDDDD-2222-4000-8000-000000000002', Name: 'MJ: Artifact Versions' });
                return undefined;
            },
            async GetEntityObject() {
                return stubOf<BaseEntity>({ RunViewProviderToUse: provider, ProviderToUse: provider });
            },
            async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
                const { EntityName, ExtraFilter = '' } = params;
                if (EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                    return mockResult<T>([
                        {
                            ID: SPACE_ID,
                            ParentID: null,
                            InheritsMembership: false,
                            OwnerID: STAFF_ID,
                            AgentRetrieval: 'Included',
                            AllowParentAssignees: true,
                        },
                    ]);
                }
                if (EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                    return mockResult<T>([
                        { ID: ROLE_TEAM_ID, Level: 40, MaxGrantableLevel: 40, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true },
                        { ID: ROLE_CLIENT_ID, Level: 10, MaxGrantableLevel: 10, CanInvite: false, CanPromoteBand: false, CanSeeTeamBand: false, IsOwnerRole: false, CanContribute: true },
                    ]);
                }
                if (EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                    return mockResult<T>([
                        { ID: '33333333-2222-4000-8000-000000000001', SpaceID: SPACE_ID, UserID: STAFF_ID, Status: 'Active', Band: 'Team', SpaceRoleTypeID: ROLE_TEAM_ID },
                        { ID: '33333333-2222-4000-8000-000000000002', SpaceID: SPACE_ID, UserID: CLIENT_ID, Status: 'Active', Band: 'Shared', SpaceRoleTypeID: ROLE_CLIENT_ID },
                    ]);
                }
                if (EntityName === 'MJ_BizApps_Collaboration: Space Items') {
                    return mockResult<T>([
                        { ID: ITEM_CHARTER_ID, SpaceID: SPACE_ID, EntityID: ARTIFACTS_ENTITY_ID, RecordID: ART_CHARTER_ID, Band: 'Shared' },
                        { ID: ITEM_DECK_ID, SpaceID: SPACE_ID, EntityID: ARTIFACTS_ENTITY_ID, RecordID: ART_DECK_ID, Band: 'Shared' },
                        { ID: ITEM_SOW_ID, SpaceID: SPACE_ID, EntityID: ARTIFACTS_ENTITY_ID, RecordID: ART_SOW_ID, Band: 'Shared' },
                        { ID: ITEM_TEAM_SECRET_ID, SpaceID: SPACE_ID, EntityID: ARTIFACTS_ENTITY_ID, RecordID: ART_TEAM_SECRET_ID, Band: 'Team' },
                    ]);
                }
                if (EntityName === 'MJ: Artifacts') {
                    const lowerFilter = String(ExtraFilter).toLowerCase();
                    return mockResult<T>(artifactRows.filter((row) => lowerFilter.includes(row.ID.toLowerCase())));
                }
                if (EntityName === 'MJ: Artifact Versions') {
                    const filterStr = String(ExtraFilter);
                    versionFilters.push(filterStr);
                    const lowerFilter = filterStr.toLowerCase();
                    return mockResult<T>(versionRows.filter((row) => lowerFilter.includes(row.ArtifactID.toLowerCase())));
                }
                return mockResult<T>([]);
            },
            async RunViews(paramsList: RunViewParams[], contextUser?: UserInfo) {
                return Promise.all(paramsList.map((p) => this.RunView!(p, contextUser)));
            },
        };

        return { provider: stubOf<IMetadataProvider>(provider), versionFilters };
    }

    it('hydrates latest ArtifactVersion for Markdown, SlideDeckSpec, and base64 PDF while strictly withholding Team artifacts in Shared rooms', async () => {
        const { provider, versionFilters } = createArtifactWorldProvider();
        const res = await resolveSpaceAgentRetrieval(provider, { ID: STAFF_ID, Name: 'Staff' } as UserInfo, SPACE_ID, {
            conversationKind: 'General',
            rankingQuery: 'Summarize Executive Partnership Charter, QBR Value Realization Deck, and SOW entitlement',
        });

        assert.equal(res.quotedItems.length, 3);
        const charter = res.quotedItems.find((i) => i.ID === ITEM_CHARTER_ID);
        const deck = res.quotedItems.find((i) => i.ID === ITEM_DECK_ID);
        const sow = res.quotedItems.find((i) => i.ID === ITEM_SOW_ID);
        const secret = res.quotedItems.find((i) => i.ID === ITEM_TEAM_SECRET_ID);

        assert.ok(charter?.ChunkTexts && charter.ChunkTexts.length > 0);
        assert.match(charter.ChunkTexts.join(' '), /HIPAA \+ SOC 2 Type II active posture/);
        assert.doesNotMatch(charter.ChunkTexts.join(' '), /Old Charter Draft v1/);

        assert.ok(deck?.ChunkTexts && deck.ChunkTexts.length > 0);
        assert.match(deck.ChunkTexts.join(' '), /Cycle Time Reduction: 88%/);

        assert.ok(sow?.ChunkTexts && sow.ChunkTexts.length > 0);
        assert.match(sow.ChunkTexts.join(' '), /\$95,000 USD monthly/);
        assert.doesNotMatch(sow.ChunkTexts.join(' '), /JVBERi0|data:application\/pdf/i);

        // Strict band isolation: Team artifact NEVER queried in MJ: Artifact Versions and NEVER in quotedItems
        assert.equal(secret, undefined);
        assert.ok(versionFilters.length > 0);
        for (const filter of versionFilters) {
            assert.equal(filter.toLowerCase().includes(ART_TEAM_SECRET_ID.toLowerCase()), false);
        }
        const serializedDecisions = JSON.stringify(res.decisions);
        assert.equal(serializedDecisions.includes(TEAM_CANARY), false);
    });

    it('hydrates Team artifacts when Team staff asks in a Private conversation', async () => {
        const { provider } = createArtifactWorldProvider();
        const res = await resolveSpaceAgentRetrieval(provider, { ID: STAFF_ID, Name: 'Staff' } as UserInfo, SPACE_ID, {
            conversationKind: 'Private',
            rankingQuery: 'margin brief',
        });

        const secret = res.quotedItems.find((i) => i.ID === ITEM_TEAM_SECRET_ID);
        assert.ok(secret?.ChunkTexts && secret.ChunkTexts.length > 0);
        assert.match(secret.ChunkTexts.join(' '), new RegExp(TEAM_CANARY));
    });
});

describe('executeSpaceChatTurn Authorized Space Context injection', () => {
    const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
    const CALLER_ID = '11111111-3333-4111-8111-111111111111';
    const SPACE_ID = '33333333-3333-4333-8333-333333333333';
    const CONVERSATION_ID = '44444444-3333-4444-8444-444444444444';
    const USER_MESSAGE_ID = '55555555-3333-4555-8555-555555555555';
    const ROLE_TEAM_ID = '66666666-3333-4666-8666-666666666666';
    const TYPE_ID = '88888888-3333-4888-8888-888888888888';
    const SPACE_CHAT_ID = '99000000-3333-4000-8000-000000000010';
    const ARTIFACTS_ENTITY_ID = 'DDDDDDDD-3333-4000-8000-000000000001';
    const ART_CHARTER_ID = '11111111-3333-4000-8000-000000000001';
    const ART_TEAM_DRAFT_ID = '11111111-3333-4000-8000-000000000002';
    const ITEM_CHARTER_ID = 'EEEEEEEE-3333-4000-8000-000000000001';
    const ITEM_TEAM_DRAFT_ID = 'EEEEEEEE-3333-4000-8000-000000000002';
    const TEAM_DRAFT_CANARY = 'CANARY_SAGE_TURN_TEAM_DRAFT_MUST_NOT_LEAK';
    const SAGE_AGENT_ID = '3AB78346-897F-4238-AA6A-F10A131CC691';
    const RUN_ID = '99000000-3333-4000-8000-000000000099';

    let origGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;
    let origRunAgent: typeof AgentRunner.prototype.RunAgent;
    let origResolveSpaceAndType: typeof ServerDriverRegistry.Instance.ResolveSpaceAndType;
    let restoreAppSettings: () => void = () => undefined;

    class GroundingTestDriver extends BaseSpaceTypeServerDriver {
        public override async BuildAgentContext(): Promise<AgentContextResult> {
            return {
                instructions: ['Cite every executive claim with its durable record link.'],
                contextData: {},
            };
        }
    }

    before(() => {
        restoreAppSettings = seedAppSettings();
        origGetSystemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => ({ ID: SYSTEM_USER_ID, Name: 'System' } as UserInfo);
        origResolveSpaceAndType = ServerDriverRegistry.Instance.ResolveSpaceAndType.bind(ServerDriverRegistry.Instance);
        ServerDriverRegistry.Instance.ResolveSpaceAndType = stubOf<typeof ServerDriverRegistry.Instance.ResolveSpaceAndType>(
            async () => ({ space: {}, spaceType: {}, driver: new GroundingTestDriver() }),
        );
        origRunAgent = AgentRunner.prototype.RunAgent;
    });

    after(() => {
        ServerDriverRegistry.Instance.ResolveSpaceAndType = origResolveSpaceAndType;
        restoreAppSettings();
        WellKnownUserSource.Instance.GetSystemUser = origGetSystemUser;
        AgentRunner.prototype.RunAgent = origRunAgent;
    });

    function createTurnProvider(agentId: string, agentName: string): IMetadataProvider {
        let replySeq = 0;
        const provider: Partial<IMetadataProvider & IRunViewProvider> = {
            EntityByID(id: string) {
                if (id.toLowerCase() === ARTIFACTS_ENTITY_ID.toLowerCase()) {
                    return stubOf<EntityInfo>({ ID: ARTIFACTS_ENTITY_ID, Name: 'MJ: Artifacts' });
                }
                return stubOf<EntityInfo>({ Name: 'mock-entity' });
            },
            EntityByName(name: string) {
                if (name === 'MJ: Artifacts') {
                    return stubOf<EntityInfo>({ ID: ARTIFACTS_ENTITY_ID, Name: 'MJ: Artifacts', GetUserPermisions: () => ({ CanRead: true, CanCreate: true, CanUpdate: true, CanDelete: true }) });
                }
                if (name === 'MJ: Artifact Versions') {
                    return stubOf<EntityInfo>({ ID: 'DDDDDDDD-3333-4000-8000-000000000002', Name: 'MJ: Artifact Versions', GetUserPermisions: () => ({ CanRead: true, CanCreate: true, CanUpdate: true, CanDelete: true }) });
                }
                return stubOf<EntityInfo>({ ID: 'mock-entity-id', Name: name, GetUserPermisions: () => ({ CanRead: true, CanCreate: true, CanUpdate: true, CanDelete: true }) });
            },
            async GetEntityObject(entityName: string) {
                if (entityName === 'MJ_BizApps_Collaboration: Spaces') {
                    return stubOf<BaseEntity>({ RunViewProviderToUse: provider, ProviderToUse: provider });
                }
                if (entityName === 'MJ: Conversation Details') {
                    const detail = {
                        ID: USER_MESSAGE_ID,
                        ConversationID: CONVERSATION_ID,
                        UserID: CALLER_ID,
                        Role: 'User',
                        Message: 'Summarize the Executive Partnership Charter in this space.',
                        ParentID: null as string | null,
                        AgentID: null as string | null,
                        Status: 'Complete',
                        HiddenToUser: false,
                        IsPinned: false,
                        OriginalMessageChanged: false,
                        LatestResult: { CompleteMessage: '' },
                        NewRecord() {
                            this.ID = `99000000-3334-4000-8000-${String(++replySeq).padStart(12, '0')}`;
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
                    return stubOf<BaseEntity>(detail);
                }
                if (entityName === 'MJ: AI Agent Runs') {
                    return stubOf<BaseEntity>({
                        ID: RUN_ID,
                        ExternalReferenceID: null,
                        async Load() { return true; },
                        async Save() { return true; },
                    });
                }
                if (entityName === 'MJ: AI Agents') {
                    return stubOf<BaseEntity>({
                        ID: agentId,
                        Name: agentName,
                        TypeID: 'agent-type-1',
                        DriverClass: null,
                        InjectNotes: true,
                        InjectExamples: true,
                        async Load(id: string) {
                            return id.toLowerCase() === agentId.toLowerCase();
                        },
                    });
                }
                let receiptSeq = 0;
                const genericRow = {
                    ID: '',
                    NewRecord() {
                        genericRow.ID = `99000000-3335-4000-8000-${String(++receiptSeq).padStart(12, '0')}`;
                    },
                    async Load() { return true; },
                    async Save() {
                        if (!genericRow.ID) {
                            genericRow.ID = `99000000-3335-4000-8000-${String(++receiptSeq).padStart(12, '0')}`;
                        }
                        return true;
                    },
                    LatestResult: { CompleteMessage: '' },
                };
                return stubOf<BaseEntity>(genericRow);
            },
            async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
                const { EntityName, ExtraFilter = '' } = params;
                if (EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                    return mockResult<T>([
                        {
                            ID: SPACE_ID,
                            ParentID: null,
                            InheritsMembership: false,
                            OwnerID: CALLER_ID,
                            AgentRetrieval: 'Included',
                            SpaceTypeID: TYPE_ID,
                            AllowParentAssignees: true,
                            ClosedAt: null,
                            Configuration: null,
                        },
                    ]);
                }
                if (EntityName === 'MJ_BizApps_Collaboration: Space Types') {
                    return mockResult<T>([
                        {
                            ID: TYPE_ID,
                            Configuration: JSON.stringify({
                                Chats: { AgentReplyMode: 'Always' },
                            }),
                        },
                    ]);
                }
                if (EntityName === 'MJ_BizApps_Collaboration: Space Grants') {
                    return mockResult<T>([
                        {
                            ID: '77777777-3333-4000-8000-000000000001',
                            SpaceID: SPACE_ID,
                            SpaceTypeID: null,
                            Kind: 'Agent',
                            Mode: 'Extend',
                            Band: 'Shared',
                            TargetRecordID: agentId,
                            IsDefault: true,
                            Sequence: 1,
                        },
                    ]);
                }
                if (EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                    return mockResult<T>([
                        { ID: ROLE_TEAM_ID, Level: 40, MaxGrantableLevel: 40, CanInvite: true, CanPromoteBand: true, CanSeeTeamBand: true, IsOwnerRole: true, CanContribute: true },
                    ]);
                }
                if (EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                    return mockResult<T>([
                        { ID: '33333333-3333-4000-8000-000000000001', SpaceID: SPACE_ID, UserID: CALLER_ID, User: 'Caller', Status: 'Active', Band: 'Team', SpaceRoleTypeID: ROLE_TEAM_ID },
                    ]);
                }
                if (EntityName === 'MJ_BizApps_Collaboration: Space Chats') {
                    return mockResult<T>([{ ID: SPACE_CHAT_ID, SpaceID: SPACE_ID, ConversationID: CONVERSATION_ID, Kind: 'General', Status: 'Active' }]);
                }
                if (EntityName === 'MJ: AI Agents') {
                    return mockResult<T>([{ ID: agentId, Name: agentName, Status: 'Active' }]);
                }
                if (EntityName === 'MJ: Conversation Details') {
                    if (String(ExtraFilter).includes('ParentID =')) {
                        return mockResult<T>([]);
                    }
                    return mockResult<T>([
                        {
                            ID: USER_MESSAGE_ID,
                            ConversationID: CONVERSATION_ID,
                            Sequence: 1,
                            Role: 'User',
                            UserID: CALLER_ID,
                            User: 'Caller',
                            Message: 'Summarize the Executive Partnership Charter in this space.',
                            __mj_CreatedAt: new Date('2026-02-01T10:00:00Z'),
                        },
                    ]);
                }
                if (EntityName === 'MJ_BizApps_Collaboration: Space Items') {
                    return mockResult<T>([
                        { ID: ITEM_CHARTER_ID, SpaceID: SPACE_ID, EntityID: ARTIFACTS_ENTITY_ID, RecordID: ART_CHARTER_ID, Band: 'Shared' },
                        { ID: ITEM_TEAM_DRAFT_ID, SpaceID: SPACE_ID, EntityID: ARTIFACTS_ENTITY_ID, RecordID: ART_TEAM_DRAFT_ID, Band: 'Team' },
                    ]);
                }
                if (EntityName === 'MJ: Artifacts') {
                    const lower = String(ExtraFilter).toLowerCase();
                    const all = [
                        { ID: ART_CHARTER_ID, Name: 'Executive Partnership Charter', Description: 'Executive governance charter.' },
                        { ID: ART_TEAM_DRAFT_ID, Name: 'Internal Pricing Draft', Description: 'Team-only draft.' },
                    ];
                    return mockResult<T>(all.filter((row) => lower.includes(row.ID.toLowerCase())));
                }
                if (EntityName === 'MJ: Artifact Versions') {
                    const lower = String(ExtraFilter).toLowerCase();
                    const all = [
                        {
                            ID: '22222222-3333-4000-8000-000000000001',
                            ArtifactID: ART_CHARTER_ID,
                            VersionNumber: 1,
                            Content: '# Executive Partnership Charter\nQuarterly governance cadence and Transformation tier entitlement.',
                        },
                        {
                            ID: '22222222-3333-4000-8000-000000000002',
                            ArtifactID: ART_TEAM_DRAFT_ID,
                            VersionNumber: 1,
                            Content: `# Internal Pricing Draft\n${TEAM_DRAFT_CANARY}`,
                        },
                    ];
                    return mockResult<T>(all.filter((row) => lower.includes(row.ArtifactID.toLowerCase())));
                }
                return mockResult<T>([]);
            },
            async RunViews(paramsList: RunViewParams[], contextUser?: UserInfo) {
                return Promise.all(paramsList.map((p) => this.RunView!(p, contextUser)));
            },
        };
        return stubOf<IMetadataProvider>(provider);
    }

    it('injects Authorized Space Context system message for platform Sage and marks cited durable links as wasCited=true', async () => {
        assert.equal(isShippedCollaborationSpaceAgent('Sage', SAGE_AGENT_ID), false);
        assert.equal(isShippedCollaborationSpaceAgent('Collaboration Space Agent', SHIPPED_COLLABORATION_AGENT_ID), true);

        let capturedParams: ExecuteAgentParams | undefined;
        AgentRunner.prototype.RunAgent = async (params) => {
            capturedParams = params;
            const citedReply = `Summary based on [[MJ: Artifacts|${ART_CHARTER_ID}|Executive Partnership Charter]]: Transformation tier entitlement and quarterly governance cadence.`;
            return stubOf<never>({
                success: true,
                agentRun: stubOf<MJAIAgentRunEntityExtended>({ ID: RUN_ID, Message: citedReply, Status: 'Completed' }),
                payload: citedReply,
            });
        };

        const provider = createTurnProvider(SAGE_AGENT_ID, 'Sage');
        const res = await executeSpaceChatTurn(provider, { ID: CALLER_ID, Name: 'Caller' } as UserInfo, {
            spaceId: SPACE_ID,
            conversationId: CONVERSATION_ID,
            userMessageId: USER_MESSAGE_ID,
            agentId: SAGE_AGENT_ID,
        });

        assert.equal(res.ok, true, res.ok ? '' : res.message);
        assert.ok(capturedParams?.conversationMessages && capturedParams.conversationMessages.length >= 2);
        const firstMsg = capturedParams.conversationMessages[0];
        assert.equal(firstMsg.role, 'system');
        const sysText = String(firstMsg.content);
        assert.match(sysText, /Authorized Collaboration Space Context/);
        assert.match(sysText, /Cite every executive claim with its durable record link/);
        assert.match(sysText, new RegExp(`\\[\\[MJ: Artifacts\\|${ART_CHARTER_ID}\\|Executive Partnership Charter\\]\\]`));
        assert.match(sysText, /Transformation tier entitlement/);
        assert.match(sysText, /only call `Scoped Search` if you need additional search beyond the provided materials/);
        assert.equal(sysText.includes(TEAM_DRAFT_CANARY), false, 'Team-band artifact content must never leak into General/Shared system context');
        assert.equal(sysText.includes('Internal Pricing Draft'), false, 'Team-band artifact title must never leak into General/Shared system context');

        if (res.ok) {
            const charterReceipt = res.sourceReceipts?.find((r) => r.spaceItemId?.toLowerCase() === ITEM_CHARTER_ID.toLowerCase());
            assert.ok(charterReceipt, 'Expected a persisted source receipt for the charter artifact');
            assert.equal(charterReceipt.wasCited, true);
        }
    });

    it('does NOT inject duplicate system message for shipped Collaboration Space Agent', async () => {
        let capturedParams: ExecuteAgentParams | undefined;
        AgentRunner.prototype.RunAgent = async (params) => {
            capturedParams = params;
            return stubOf<never>({
                success: true,
                agentRun: stubOf<MJAIAgentRunEntityExtended>({ ID: RUN_ID, Message: 'Answered via template.', Status: 'Completed' }),
                payload: 'Answered via template.',
            });
        };

        const provider = createTurnProvider(SHIPPED_COLLABORATION_AGENT_ID, 'Collaboration Space Agent');
        const res = await executeSpaceChatTurn(provider, { ID: CALLER_ID, Name: 'Caller' } as UserInfo, {
            spaceId: SPACE_ID,
            conversationId: CONVERSATION_ID,
            userMessageId: USER_MESSAGE_ID,
            agentId: SHIPPED_COLLABORATION_AGENT_ID,
        });

        assert.equal(res.ok, true, res.ok ? '' : res.message);
        assert.ok(capturedParams?.conversationMessages && capturedParams.conversationMessages.length >= 1);
        assert.notEqual(capturedParams.conversationMessages[0].role, 'system');
    });

    it('returns null from buildSpaceAgentContextSystemMessage when no space context exists', () => {
        const msg = buildSpaceAgentContextSystemMessage({
            audience: 'Shared',
            typeInstructions: [],
            allowedItems: [],
            grantedKnowledgeHits: [],
            spaceData: [],
            boundActions: [],
        });
        assert.equal(msg, null);
    });
});
