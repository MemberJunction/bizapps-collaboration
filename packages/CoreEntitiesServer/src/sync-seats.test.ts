import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import type { mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
import { BaseSpaceTypeServerDriver } from '../dist/base-space-type-server-driver.js';

const ACTING_USER = { ID: '11111111-1111-4111-8111-111111111111', Name: 'Ada' } as UserInfo;
const SPACE_ID = '22222222-2222-4222-8222-222222222222';
const TYPE_ID = '33333333-3333-4333-8333-333333333333';
const ROLE_OWNER = '44444444-4444-4444-8444-444444444444';
const ROLE_MEMBER = '55555555-5555-4555-8555-555555555555';
const ROLE_GUEST = '66666666-6666-4666-8666-666666666666';
const PEOPLE_ENTITY_ID = '77777777-7777-4777-8777-777777777777';

const PERSON_ALICE = 'aaaa0000-0000-4000-8000-000000000001';
const USER_ALICE = 'bbbb0000-0000-4000-8000-000000000001';
const PERSON_BOB = 'aaaa0000-0000-4000-8000-000000000002';
const USER_BOB = 'bbbb0000-0000-4000-8000-000000000002';
const PERSON_CAROL = 'aaaa0000-0000-4000-8000-000000000003';
const USER_MANUAL = 'bbbb0000-0000-4000-8000-000000000004';
const USER_OTHER_SOURCE = 'bbbb0000-0000-4000-8000-000000000005';

interface SeatRecord {
    ID: string;
    SpaceID: string;
    UserID: string;
    PersonID?: string | null;
    SpaceRoleTypeID: string;
    Band?: 'Team' | 'Shared';
    Status: 'Active' | 'Invited' | 'Removed';
    SyncSource?: string | null;
}

function createMockProvider(options: {
    existingSeats?: SeatRecord[];
    refuseRemoveSeatIds?: Set<string>;
}) {
    const seats = new Map<string, SeatRecord>();
    for (const s of options.existingSeats ?? []) {
        seats.set(s.ID, { ...s });
    }
    const savedSeats: SeatRecord[] = [];
    const savedInvites: Record<string, unknown>[] = [];
    let seq = 100;

    const roles = [
        { ID: ROLE_OWNER, Name: 'Owner', Code: 'owner', SpaceTypeID: null, CanSeeTeamBand: true },
        { ID: ROLE_MEMBER, Name: 'Team Member', Code: 'member', SpaceTypeID: null, CanSeeTeamBand: true },
        { ID: ROLE_GUEST, Name: 'Participant', Code: 'guest', SpaceTypeID: null, CanSeeTeamBand: false },
    ];

    const provider = {
        Entities: [
            { ID: PEOPLE_ENTITY_ID, Name: 'MJ_BizApps_Common: People', SchemaName: '__mj_BizAppsCommon', BaseTable: 'Person' },
        ],
        RunView: async (params: { EntityName: string; ExtraFilter?: string }) => {
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                return { Success: true, Results: roles };
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Members') {
                return { Success: true, Results: [...seats.values()] };
            }
            if (params.EntityName === 'MJ: Users') {
                const filter = params.ExtraFilter ?? '';
                if (filter.includes('LinkedEntityRecordID')) {
                    const results = [];
                    if (filter.toLowerCase().includes(PERSON_ALICE.toLowerCase())) {
                        results.push({ ID: USER_ALICE, LinkedEntityRecordID: PERSON_ALICE });
                    }
                    if (filter.toLowerCase().includes(PERSON_BOB.toLowerCase())) {
                        results.push({ ID: USER_BOB, LinkedEntityRecordID: PERSON_BOB });
                    }
                    return { Success: true, Results: results };
                }
                return { Success: true, Results: [] };
            }
            if (params.EntityName === 'MJ_BizApps_Common: People') {
                const filter = (params.ExtraFilter ?? '').toLowerCase();
                const results = [];
                if (filter.includes(PERSON_CAROL.toLowerCase())) {
                    results.push({ ID: PERSON_CAROL, Email: 'carol@example.org', LinkedUserID: null });
                }
                return { Success: true, Results: results };
            }
            if (params.EntityName === 'MJ: Magic Link Invites') {
                return { Success: true, Results: [] };
            }
            return { Success: true, Results: [] };
        },
        GetEntityObject: async (entityName: string) => {
            if (entityName === 'MJ_BizApps_Collaboration: Space Members') {
                const draft: SeatRecord = {
                    ID: '',
                    SpaceID: '',
                    UserID: '',
                    PersonID: null,
                    SpaceRoleTypeID: '',
                    Band: 'Team',
                    Status: 'Active',
                    SyncSource: null,
                };
                return {
                    get ID() { return draft.ID; },
                    set ID(v: string) { draft.ID = v; },
                    get SpaceID() { return draft.SpaceID; },
                    set SpaceID(v: string) { draft.SpaceID = v; },
                    get UserID() { return draft.UserID; },
                    set UserID(v: string) { draft.UserID = v; },
                    get PersonID() { return draft.PersonID ?? null; },
                    set PersonID(v: string | null) { draft.PersonID = v; },
                    get SpaceRoleTypeID() { return draft.SpaceRoleTypeID; },
                    set SpaceRoleTypeID(v: string) { draft.SpaceRoleTypeID = v; },
                    get Band() { return draft.Band ?? 'Team'; },
                    set Band(v: 'Team' | 'Shared') { draft.Band = v; },
                    get Status() { return draft.Status; },
                    set Status(v: 'Active' | 'Invited' | 'Removed') { draft.Status = v; },
                    get SyncSource() { return draft.SyncSource ?? null; },
                    set SyncSource(v: string | null) { draft.SyncSource = v; },
                    LatestResult: { CompleteMessage: 'Seat save refused: last owner.' },
                    NewRecord() {
                        seq += 1;
                        draft.ID = `00000000-0000-4000-8000-000000000${seq}`;
                    },
                    async Load(id: string) {
                        const existing = seats.get(id);
                        if (!existing) return false;
                        Object.assign(draft, existing);
                        return true;
                    },
                    async Save() {
                        if (draft.Status === 'Removed' && options.refuseRemoveSeatIds?.has(draft.ID)) {
                            return false;
                        }
                        seats.set(draft.ID, { ...draft });
                        savedSeats.push({ ...draft });
                        return true;
                    },
                };
            }
            if (entityName === 'MJ: Magic Link Invites') {
                const invite: Record<string, unknown> = {};
                return {
                    ...invite,
                    NewRecord() {
                        invite.ID = 'invite-1';
                    },
                    set Email(v: string) { invite.Email = v; },
                    set Status(v: string) { invite.Status = v; },
                    set CreatedByUserID(v: string) { invite.CreatedByUserID = v; },
                    set IdentityMode(v: string) { invite.IdentityMode = v; },
                    set Kind(v: string) { invite.Kind = v; },
                    async Save() {
                        savedInvites.push({ ...invite });
                        return true;
                    },
                };
            }
            return null;
        },
    };

    const space = {
        ID: SPACE_ID,
        SpaceTypeID: TYPE_ID,
    } as unknown as mjBizAppsCollaborationSpaceEntity;

    return {
        provider: provider as unknown as IMetadataProvider,
        space,
        seats,
        savedSeats,
        savedInvites,
    };
}

describe('BaseSpaceTypeServerDriver.SyncSeats', () => {
    it('adds, updates, and removes only seats with the matching SyncSource, and invites people without an MJ User by email', async () => {
        const { provider, space, seats, savedInvites } = createMockProvider({
            existingSeats: [
                // Alice is already seated by 'roster:main' as Team Member; incoming roster promotes her to Owner
                {
                    ID: 'seat-alice',
                    SpaceID: SPACE_ID,
                    UserID: USER_ALICE,
                    PersonID: PERSON_ALICE,
                    SpaceRoleTypeID: ROLE_MEMBER,
                    Band: 'Team',
                    Status: 'Active',
                    SyncSource: 'roster:main',
                },
                // Bob was seated by 'roster:main' and is no longer in the incoming roster -> should be Removed
                {
                    ID: 'seat-bob',
                    SpaceID: SPACE_ID,
                    UserID: USER_BOB,
                    PersonID: PERSON_BOB,
                    SpaceRoleTypeID: ROLE_MEMBER,
                    Band: 'Team',
                    Status: 'Active',
                    SyncSource: 'roster:main',
                },
                // Manual seat (SyncSource: null) -> must NOT be removed or modified
                {
                    ID: 'seat-manual',
                    SpaceID: SPACE_ID,
                    UserID: USER_MANUAL,
                    PersonID: null,
                    SpaceRoleTypeID: ROLE_MEMBER,
                    Band: 'Team',
                    Status: 'Active',
                    SyncSource: null,
                },
                // Another sync source -> must NOT be removed or modified
                {
                    ID: 'seat-other',
                    SpaceID: SPACE_ID,
                    UserID: USER_OTHER_SOURCE,
                    PersonID: null,
                    SpaceRoleTypeID: ROLE_GUEST,
                    Band: 'Shared',
                    Status: 'Active',
                    SyncSource: 'roster:other',
                },
            ],
        });

        const driver = new BaseSpaceTypeServerDriver();
        const result = await driver.SyncSeats(
            space,
            'roster:main',
            [
                // Alice -> promoted from Team Member to Owner
                { PersonID: PERSON_ALICE, RoleTypeName: 'Owner' },
                // Carol -> has Person with Email 'carol@example.org', no MJ User -> invited
                { PersonID: PERSON_CAROL, RoleTypeName: 'Participant' },
            ],
            ACTING_USER,
            provider
        );

        assert.deepEqual(result, {
            added: 0,
            updated: 1,
            removed: 1,
            invited: 1,
            errors: [],
        });

        // Alice updated to Owner
        assert.equal(seats.get('seat-alice')?.SpaceRoleTypeID, ROLE_OWNER);
        assert.equal(seats.get('seat-alice')?.Status, 'Active');
        // Bob marked Removed
        assert.equal(seats.get('seat-bob')?.Status, 'Removed');
        // Manual and other-source seats untouched
        assert.equal(seats.get('seat-manual')?.Status, 'Active');
        assert.equal(seats.get('seat-other')?.Status, 'Active');
        // Carol invited by email
        assert.equal(savedInvites.length, 1);
        assert.equal(savedInvites[0]?.Email, 'carol@example.org');
    });

    it('adds a new seat when the person resolves to an MJ User not yet seated in the space', async () => {
        const { provider, space, savedSeats } = createMockProvider({ existingSeats: [] });
        const driver = new BaseSpaceTypeServerDriver();

        const result = await driver.SyncSeats(
            space,
            'roster:main',
            [{ PersonID: PERSON_ALICE, RoleTypeName: 'Participant' }],
            ACTING_USER,
            provider
        );

        assert.deepEqual(result, {
            added: 1,
            updated: 0,
            removed: 0,
            invited: 0,
            errors: [],
        });
        assert.equal(savedSeats.length, 1);
        assert.equal(savedSeats[0].UserID, USER_ALICE);
        assert.equal(savedSeats[0].PersonID, PERSON_ALICE);
        assert.equal(savedSeats[0].SpaceRoleTypeID, ROLE_GUEST);
        assert.equal(savedSeats[0].Band, 'Shared');
        assert.equal(savedSeats[0].SyncSource, 'roster:main');
    });

    it('records errors when a role does not exist or removing a seat is refused', async () => {
        const { provider, space } = createMockProvider({
            existingSeats: [
                {
                    ID: 'seat-last-owner',
                    SpaceID: SPACE_ID,
                    UserID: USER_ALICE,
                    PersonID: PERSON_ALICE,
                    SpaceRoleTypeID: ROLE_OWNER,
                    Band: 'Team',
                    Status: 'Active',
                    SyncSource: 'roster:main',
                },
            ],
            refuseRemoveSeatIds: new Set(['seat-last-owner']),
        });

        const driver = new BaseSpaceTypeServerDriver();
        const result = await driver.SyncSeats(
            space,
            'roster:main',
            [{ PersonID: PERSON_BOB, RoleTypeName: 'NonExistentRole' }],
            ACTING_USER,
            provider
        );

        assert.equal(result.removed, 0);
        assert.equal(result.errors.length, 2);
        assert.match(result.errors[0], /Unknown space role type 'NonExistentRole'/);
        assert.match(result.errors[1], /last owner/);
    });
});
