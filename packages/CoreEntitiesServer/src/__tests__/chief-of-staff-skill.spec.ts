import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    RunView,
    type IRunViewProvider,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../../..');

const UUID_REGEX = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

interface AgentSkillGrantRecord {
    primaryKey: { ID: string };
    fields: {
        AgentID: string;
        SkillID: string;
        Status: string;
        AllowMetadataSyncUpdate?: boolean;
    };
}

interface SkillMetadataRecord {
    primaryKey: { ID: string };
    fields: {
        Name: string;
        Description: string;
        Instructions: string;
        Status: string;
        ActivationMode: string;
        Category: string;
        CreatedByUserID: string;
    };
    relatedEntities?: {
        'MJ: AI Agent Skills'?: AgentSkillGrantRecord[];
    };
}

interface MockSpaceRow {
    ID: string;
    Name: string;
    OwnerID: string;
    ClosedAt: string | null;
}

interface MockSpaceMemberRow {
    SpaceID: string;
    UserID: string;
    Status: string;
    CanSeeTeamBand: boolean;
}

interface MockSpaceItemRow {
    ID: string;
    SpaceID: string;
    Title: string;
    Band: 'Team' | 'Shared';
}

interface MockSpaceNoteRow {
    ID: string;
    SpaceID: string;
    Title: string;
    Band: 'Team' | 'Shared';
    AuthorUserID: string;
}

interface CollaborationSkillBriefing {
    UserID: string;
    VisibleSpaceNames: string[];
    VisibleItemTitles: string[];
    VisibleNoteTitles: string[];
}

function makeUser(id: string, name: string, email: string): UserInfo {
    const partial: Partial<UserInfo> = {
        ID: id,
        Name: name,
        Email: email,
        IsActive: true,
    };
    return partial as UserInfo;
}

function makeSuccessResult<T>(rows: T[]): RunViewResult<T> {
    return {
        Success: true,
        Results: rows,
        RowCount: rows.length,
        TotalRowCount: rows.length,
        ExecutionTime: 1,
        ErrorMessage: '',
        UserViewRunID: '',
    };
}

async function queryCollaborationForCaller(caller: UserInfo): Promise<CollaborationSkillBriefing> {
    const rv = new RunView();
    const [spacesRes, itemsRes, notesRes] = await Promise.all([
        rv.RunView<MockSpaceRow>({ EntityName: 'MJ_BizApps_Collaboration: Spaces', ResultType: 'simple' }, caller),
        rv.RunView<MockSpaceItemRow>({ EntityName: 'MJ_BizApps_Collaboration: Space Items', ResultType: 'simple' }, caller),
        rv.RunView<MockSpaceNoteRow>({ EntityName: 'MJ_BizApps_Collaboration: Space Notes', ResultType: 'simple' }, caller),
    ]);
    assert.equal(spacesRes.Success, true);
    assert.equal(itemsRes.Success, true);
    assert.equal(notesRes.Success, true);

    return {
        UserID: caller.ID,
        VisibleSpaceNames: spacesRes.Results.map((s) => s.Name),
        VisibleItemTitles: itemsRes.Results.map((i) => i.Title),
        VisibleNoteTitles: notesRes.Results.map((n) => n.Title),
    };
}

describe('Chief of Staff Collaboration Skills — metadata & two-user RLS isolation', () => {
    const originalProvider = RunView.Provider;

    after(() => {
        RunView.Provider = originalProvider;
    });

    it('wires metadata/chief-of-staff-skills into mj-app.json and .mj-sync.json with active Chief of Staff grants and zero sync blocks', () => {
        const appManifest = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'mj-app.json'), 'utf8'),
        ) as { metadata?: { directory?: string } };
        assert.equal(appManifest.metadata?.directory, 'metadata');

        const rootSync = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'metadata/.mj-sync.json'), 'utf8'),
        ) as { directoryOrder: string[] };
        assert.equal(rootSync.directoryOrder.includes('chief-of-staff-skills'), true);
        assert.equal(rootSync.directoryOrder.includes('ai-skills'), false);
        assert.equal(
            rootSync.directoryOrder.indexOf('chief-of-staff-skills') > rootSync.directoryOrder.indexOf('actions'),
            true,
        );

        const skillDir = path.join(REPO_ROOT, 'metadata/chief-of-staff-skills');
        const skillDirSync = JSON.parse(
            fs.readFileSync(path.join(skillDir, '.mj-sync.json'), 'utf8'),
        ) as { entity: string };
        assert.equal(skillDirSync.entity, 'MJ: AI Skills');

        const rawLegacy = fs.readFileSync(path.join(skillDir, '.collaboration-skills.json'), 'utf8');
        const rawCos = fs.readFileSync(path.join(skillDir, '.chief-of-staff-collaboration-skill.json'), 'utf8');
        assert.equal(rawLegacy.includes('"sync"'), false);
        assert.equal(rawCos.includes('"sync"'), false);

        const legacySkills = JSON.parse(rawLegacy) as SkillMetadataRecord[];
        const cosSkills = JSON.parse(rawCos) as SkillMetadataRecord[];
        const allSkills = [...legacySkills, ...cosSkills];

        // Preserve exact existing UUIDs for Promote, Summarize, Find & act
        const expectedPreservedIds = new Map<string, string>([
            ['Promote', '2FDE0484-FFEC-4789-98C1-AB4FEC3A2D94'],
            ['Summarize', '76B26C41-8113-491A-9BBB-2008E1CAEE4B'],
            ['Find & act', '574722E4-961A-4A14-A38F-0DD300F0D53B'],
        ]);
        for (const [name, expectedId] of expectedPreservedIds) {
            const found = legacySkills.find((s) => s.fields.Name === name);
            assert.ok(found, `Missing preserved skill '${name}'`);
            assert.equal(found.primaryKey.ID, expectedId);
        }

        const primaryCosSkill = cosSkills.find((s) => s.fields.Name === 'Collaboration Spaces');
        assert.ok(primaryCosSkill, 'Missing Collaboration Spaces Chief of Staff skill');
        assert.equal(primaryCosSkill.fields.Instructions, '@file:templates/collaboration-chief-of-staff.skill.md');

        const instructionsPath = path.join(skillDir, 'templates/collaboration-chief-of-staff.skill.md');
        const instructionsText = fs.readFileSync(instructionsPath, 'utf8');
        assert.equal(instructionsText.includes('MJ_BizApps_Collaboration: Spaces'), true);
        assert.equal(instructionsText.includes('MJ_BizApps_Collaboration: Space Items'), true);
        assert.equal(instructionsText.includes('MJ_BizApps_Collaboration: Space Members'), true);
        assert.equal(instructionsText.includes('RunView'), true);

        const seenIds = new Set<string>();
        const cosGrantedSkillNames: string[] = [];
        for (const skill of allSkills) {
            assert.match(skill.primaryKey.ID, UUID_REGEX);
            assert.equal(seenIds.has(skill.primaryKey.ID), false);
            seenIds.add(skill.primaryKey.ID);
            assert.equal(skill.fields.Status, 'Active');
            assert.equal(skill.fields.ActivationMode, 'Auto');
            assert.equal(skill.fields.CreatedByUserID, '@lookup:MJ: Users.Name=System');

            const grants = skill.relatedEntities?.['MJ: AI Agent Skills'] ?? [];
            const cosGrant = grants.find((g) => g.fields.AgentID === '@lookup:MJ: AI Agents.Name=Chief of Staff');
            assert.ok(cosGrant, `Skill '${skill.fields.Name}' must be granted to Chief of Staff`);
            assert.match(cosGrant.primaryKey.ID, UUID_REGEX);
            assert.equal(seenIds.has(cosGrant.primaryKey.ID), false);
            seenIds.add(cosGrant.primaryKey.ID);
            assert.equal(cosGrant.fields.Status, 'Active');
            assert.equal(cosGrant.fields.SkillID, '@parent:ID');
            cosGrantedSkillNames.push(skill.fields.Name);
        }

        // Personal Chief of Staff instance inheriting from BaseAgent = Chief of Staff receives all 4 skills
        assert.deepEqual(cosGrantedSkillNames.sort(), ['Collaboration Spaces', 'Find & act', 'Promote', 'Summarize']);

        // Confirm zero raw SQL in Collaboration action implementations
        for (const actionFile of [
            'packages/CoreEntitiesServer/src/space-audience-actions.ts',
            'packages/CoreEntitiesServer/src/RunSpaceDataAction.ts',
        ]) {
            const src = fs.readFileSync(path.join(REPO_ROOT, actionFile), 'utf8');
            assert.equal(/\bExecuteSQL\b|\bsql\.query\b|\brequest\.query\b/.test(src), false);
        }
    });

    it('enforces two-user space membership and Team vs Shared band RLS isolation through RunView', async () => {
        const USER_ALICE = makeUser('11111111-1111-4111-8111-111111111101', 'Alice Internal', 'alice@internal.example');
        const USER_BOB = makeUser('11111111-1111-4111-8111-111111111102', 'Bob Partner', 'bob@partner.example');

        const SPACE_ALPHA = '22222222-2222-4222-8222-222222222201';
        const SPACE_BETA = '22222222-2222-4222-8222-222222222202';
        const SPACE_GAMMA = '22222222-2222-4222-8222-222222222203';

        const spaces: MockSpaceRow[] = [
            { ID: SPACE_ALPHA, Name: 'Alpha Internal Room', OwnerID: USER_ALICE.ID, ClosedAt: null },
            { ID: SPACE_BETA, Name: 'Beta Partner Room', OwnerID: USER_BOB.ID, ClosedAt: null },
            { ID: SPACE_GAMMA, Name: 'Gamma Joint Delivery', OwnerID: USER_ALICE.ID, ClosedAt: null },
        ];

        const memberships: MockSpaceMemberRow[] = [
            { SpaceID: SPACE_ALPHA, UserID: USER_ALICE.ID, Status: 'Active', CanSeeTeamBand: true },
            { SpaceID: SPACE_GAMMA, UserID: USER_ALICE.ID, Status: 'Active', CanSeeTeamBand: true },
            { SpaceID: SPACE_BETA, UserID: USER_BOB.ID, Status: 'Active', CanSeeTeamBand: false },
            { SpaceID: SPACE_GAMMA, UserID: USER_BOB.ID, Status: 'Active', CanSeeTeamBand: false },
        ];

        const items: MockSpaceItemRow[] = [
            { ID: '33333333-3333-4333-8333-333333333301', SpaceID: SPACE_ALPHA, Title: 'Alpha Strategy Deck', Band: 'Team' },
            { ID: '33333333-3333-4333-8333-333333333302', SpaceID: SPACE_BETA, Title: 'Beta Partner Charter', Band: 'Shared' },
            { ID: '33333333-3333-4333-8333-333333333303', SpaceID: SPACE_GAMMA, Title: 'Gamma Internal Pricing Draft', Band: 'Team' },
            { ID: '33333333-3333-4333-8333-333333333304', SpaceID: SPACE_GAMMA, Title: 'Gamma Published Roadmap', Band: 'Shared' },
        ];

        const notes: MockSpaceNoteRow[] = [
            { ID: '44444444-4444-4444-8444-444444444401', SpaceID: SPACE_GAMMA, Title: 'Gamma Team Risk Note', Band: 'Team', AuthorUserID: USER_ALICE.ID },
            { ID: '44444444-4444-4444-8444-444444444402', SpaceID: SPACE_GAMMA, Title: 'Gamma Shared Kickoff Notes', Band: 'Shared', AuthorUserID: USER_ALICE.ID },
            { ID: '44444444-4444-4444-8444-444444444403', SpaceID: SPACE_BETA, Title: 'Beta Partner Feedback', Band: 'Shared', AuthorUserID: USER_BOB.ID },
        ];

        const seatFor = (spaceId: string, userId: string): MockSpaceMemberRow | undefined =>
            memberships.find((m) => m.SpaceID === spaceId && m.UserID === userId && m.Status === 'Active');

        const canReachSpace = (space: MockSpaceRow, userId: string): boolean =>
            space.OwnerID === userId || seatFor(space.ID, userId) !== undefined;

        const canSeeBand = (spaceId: string, band: 'Team' | 'Shared', userId: string): boolean => {
            const space = spaces.find((s) => s.ID === spaceId);
            if (!space || !canReachSpace(space, userId)) {
                return false;
            }
            if (band === 'Shared') {
                return true;
            }
            const seat = seatFor(spaceId, userId);
            return space.OwnerID === userId || Boolean(seat?.CanSeeTeamBand);
        };

        const rlsProvider = {
            RunView: async <T>(params: RunViewParams, contextUser?: UserInfo): Promise<RunViewResult<T>> => {
                const callerId = contextUser?.ID ?? '';
                if (params.EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                    return makeSuccessResult(spaces.filter((s) => canReachSpace(s, callerId)) as T[]);
                }
                if (params.EntityName === 'MJ_BizApps_Collaboration: Space Items') {
                    return makeSuccessResult(items.filter((i) => canSeeBand(i.SpaceID, i.Band, callerId)) as T[]);
                }
                if (params.EntityName === 'MJ_BizApps_Collaboration: Space Notes') {
                    return makeSuccessResult(notes.filter((n) => canSeeBand(n.SpaceID, n.Band, callerId)) as T[]);
                }
                return makeSuccessResult([] as T[]);
            },
            RunViews: async <T>(paramsList: RunViewParams[], contextUser?: UserInfo): Promise<RunViewResult<T>[]> =>
                Promise.all(paramsList.map((p) => rlsProvider.RunView<T>(p, contextUser))),
        } as IRunViewProvider;

        RunView.Provider = rlsProvider;

        const aliceView = await queryCollaborationForCaller(USER_ALICE);
        const bobView = await queryCollaborationForCaller(USER_BOB);

        // Alice reaches Alpha & Gamma (both Team and Shared), never Beta
        assert.deepEqual(aliceView.VisibleSpaceNames.sort(), ['Alpha Internal Room', 'Gamma Joint Delivery']);
        assert.deepEqual(aliceView.VisibleItemTitles.sort(), [
            'Alpha Strategy Deck',
            'Gamma Internal Pricing Draft',
            'Gamma Published Roadmap',
        ]);
        assert.deepEqual(aliceView.VisibleNoteTitles.sort(), ['Gamma Shared Kickoff Notes', 'Gamma Team Risk Note']);
        assert.equal(aliceView.VisibleSpaceNames.includes('Beta Partner Room'), false);
        assert.equal(aliceView.VisibleItemTitles.includes('Beta Partner Charter'), false);

        // Bob reaches Beta & Gamma Shared only — zero Alpha spaces and zero Gamma Team-band leakage
        assert.deepEqual(bobView.VisibleSpaceNames.sort(), ['Beta Partner Room', 'Gamma Joint Delivery']);
        assert.deepEqual(bobView.VisibleItemTitles.sort(), ['Beta Partner Charter', 'Gamma Published Roadmap']);
        assert.deepEqual(bobView.VisibleNoteTitles.sort(), ['Beta Partner Feedback', 'Gamma Shared Kickoff Notes']);
        assert.equal(bobView.VisibleSpaceNames.includes('Alpha Internal Room'), false);
        assert.equal(bobView.VisibleItemTitles.includes('Gamma Internal Pricing Draft'), false);
        assert.equal(bobView.VisibleNoteTitles.includes('Gamma Team Risk Note'), false);
    });
});
