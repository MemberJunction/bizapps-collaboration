import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { WellKnownUserSource, type IMetadataProvider, type UserInfo } from '@memberjunction/core';
import type { mjBizAppsCollaborationSpaceEntity } from '@mj-biz-apps/collaboration-entities';
import { BaseSpaceTypeServerDriver } from '../dist/base-space-type-server-driver.js';

const SYSTEM_USER = { ID: '00000000-0000-0000-0000-000000000000', Name: 'System', Type: 'Owner' } as UserInfo;
const ACTING_USER = { ID: '11111111-1111-4111-8111-111111111111', Name: 'Ada', Type: 'Owner' } as UserInfo;
const NON_OWNER_ADMIN = {
    ID: '11111111-1111-4111-8111-111111111112',
    Name: 'Casey',
    Type: 'User',
    UserRoles: [{ Role: 'UI' }],
} as unknown as UserInfo;
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
    refuseInviteSave?: boolean;
    failPeopleLookup?: boolean;
    failUsersLookup?: boolean;
    inviteApproval?: 'Approve' | 'AutoApprove';
    /** Role types beside the three every world has, read before them. */
    extraRoles?: Array<{ ID: string; Name: string; Code: string; CanSeeTeamBand: boolean }>;
}) {
    const seats = new Map<string, SeatRecord>();
    for (const s of options.existingSeats ?? []) {
        seats.set(s.ID, { ...s });
    }
    const savedSeats: SeatRecord[] = [];
    const savedInvites: Record<string, unknown>[] = [];
    const savedAccounts = new Map<string, Record<string, unknown>>();
    const savedPeople = new Map<string, Record<string, unknown>>([
        [PERSON_CAROL, { ID: PERSON_CAROL, Email: 'carol@example.org', LinkedUserID: null }],
    ]);
    let seq = 100;

    const roles = [
        ...(options.extraRoles ?? []).map((role) => ({
            Level: 20,
            MaxGrantableLevel: 0,
            CanInvite: false,
            CanPromoteBand: false,
            IsOwnerRole: false,
            CanContribute: true,
            ...role,
        })),
        {
            ID: ROLE_OWNER,
            Name: 'Owner',
            Code: 'owner',
            Level: 100,
            MaxGrantableLevel: 100,
            CanInvite: true,
            CanPromoteBand: true,
            CanSeeTeamBand: true,
            IsOwnerRole: true,
            CanContribute: true,
        },
        {
            ID: ROLE_MEMBER,
            Name: 'Team Member',
            Code: 'member',
            Level: 80,
            MaxGrantableLevel: 80,
            CanInvite: true,
            CanPromoteBand: true,
            CanSeeTeamBand: true,
            IsOwnerRole: false,
            CanContribute: true,
        },
        {
            ID: ROLE_GUEST,
            Name: 'Participant',
            Code: 'guest',
            Level: 20,
            MaxGrantableLevel: 0,
            CanInvite: false,
            CanPromoteBand: false,
            CanSeeTeamBand: false,
            IsOwnerRole: false,
            CanContribute: true,
        },
    ];

    const runSingleView = async (params: { EntityName: string; ExtraFilter?: string }) => {
        const filter = (params.ExtraFilter ?? '').toLowerCase();
        if (params.EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
            if (filter.includes('isownerrole = 1')) {
                return { Success: true, Results: roles.filter((r) => r.IsOwnerRole) };
            }
            return { Success: true, Results: roles };
        }
        if (params.EntityName === 'MJ_BizApps_Collaboration: Space Members') {
            let list = [...seats.values()];
            if (filter.includes(`userid = '${ACTING_USER.ID.toLowerCase()}'`)) {
                list = [
                    {
                        ID: 'seat-owner-ada',
                        SpaceID: SPACE_ID,
                        UserID: ACTING_USER.ID,
                        SpaceRoleTypeID: ROLE_OWNER,
                        Band: 'Team',
                        Status: 'Active',
                    },
                ];
            } else if (filter.includes(`userid = '${NON_OWNER_ADMIN.ID.toLowerCase()}'`)) {
                list = [
                    {
                        ID: 'seat-admin-casey',
                        SpaceID: SPACE_ID,
                        UserID: NON_OWNER_ADMIN.ID,
                        SpaceRoleTypeID: ROLE_MEMBER,
                        Band: 'Team',
                        Status: 'Active',
                    },
                ];
            } else if (filter.includes(' and userid = ')) {
                const match = filter.match(/userid = '([^']+)'/);
                if (match) {
                    list = list.filter((s) => s.UserID.toLowerCase() === match[1]);
                }
            }
            return { Success: true, Results: list };
        }
        if (params.EntityName === 'MJ_BizApps_Collaboration: Spaces') {
            return {
                Success: true,
                Results: [
                    {
                        ID: SPACE_ID,
                        ParentID: null,
                        InheritsMembership: false,
                        OwnerID: ACTING_USER.ID,
                        AgentRetrieval: 'Full',
                        SpaceTypeID: TYPE_ID,
                    },
                ],
            };
        }
        if (params.EntityName === 'MJ_BizApps_Collaboration: Space Types') {
            return {
                Success: true,
                Results: [
                    {
                        ID: TYPE_ID,
                        InviteApproval: options.inviteApproval ?? 'AutoApprove',
                        MemberCap: null,
                    },
                ],
            };
        }
        if (params.EntityName === 'MJ: Users') {
            if (options.failUsersLookup && filter.includes('email =')) {
                return { Success: false, Results: [], ErrorMessage: 'transient users store error' };
            }
            if (filter.includes('linkedentityrecordid')) {
                const results = [];
                if (filter.includes(PERSON_ALICE.toLowerCase())) {
                    results.push({ ID: USER_ALICE, LinkedEntityRecordID: PERSON_ALICE });
                }
                if (filter.includes(PERSON_BOB.toLowerCase())) {
                    results.push({ ID: USER_BOB, LinkedEntityRecordID: PERSON_BOB });
                }
                return { Success: true, Results: results };
            }
            return { Success: true, Results: [] };
        }
        if (params.EntityName === 'MJ_BizApps_Common: People') {
            if (options.failPeopleLookup) {
                return { Success: false, Results: [], ErrorMessage: 'transient people store error' };
            }
            const results = [];
            if (filter.includes(PERSON_CAROL.toLowerCase())) {
                const p = savedPeople.get(PERSON_CAROL);
                if (p) results.push(p);
            }
            return { Success: true, Results: results };
        }
        if (params.EntityName === 'MJ: User Roles') {
            return {
                Success: true,
                Results: [{ RoleID: 'AAF434FD-EF58-4857-854E-2607ACAF763B' }],
            };
        }
        if (params.EntityName === 'MJ: Roles') {
            return {
                Success: true,
                Results: [{ Name: 'Space Participant' }],
            };
        }
        if (params.EntityName === 'MJ: User Applications') {
            return {
                Success: true,
                Results: [{ ID: 'user-app-1' }],
            };
        }
        if (params.EntityName === 'MJ: Magic Link Invites') {
            return { Success: true, Results: [] };
        }
        return { Success: true, Results: [] };
    };

    const provider = {
        Entities: [
            { ID: PEOPLE_ENTITY_ID, Name: 'MJ_BizApps_Common: People', SchemaName: '__mj_BizAppsCommon', BaseTable: 'Person' },
        ],
        EntityByName(name: string) {
            return this.Entities.find((e) => e.Name === name);
        },
        EntityByID(id: string) {
            return this.Entities.find((e) => e.ID === id);
        },
        RunView: runSingleView,
        RunViews: async (viewParams: Array<{ EntityName: string; ExtraFilter?: string }>) => {
            return Promise.all(viewParams.map((p) => runSingleView(p)));
        },
        GetEntityObject: async (entityName: string) => {
            if (entityName === 'MJ_BizApps_Collaboration: Spaces') {
                return {
                    ProviderToUse: provider,
                    RunViewProviderToUse: provider,
                };
            }
            if (entityName === 'MJ: Users') {
                const draft: Record<string, unknown> = {};
                return {
                    get ID() { return draft.ID as string; },
                    get Name() { return draft.Name as string; },
                    set Name(v: string) { draft.Name = v; },
                    get Email() { return draft.Email as string; },
                    set Email(v: string) { draft.Email = v; },
                    set FirstName(v: string) { draft.FirstName = v; },
                    set LastName(v: string) { draft.LastName = v; },
                    set Type(v: string) { draft.Type = v; },
                    set IsActive(v: boolean) { draft.IsActive = v; },
                    get LinkedEntityID() { return (draft.LinkedEntityID as string) ?? null; },
                    set LinkedEntityID(v: string | null) { draft.LinkedEntityID = v; },
                    get LinkedEntityRecordID() { return (draft.LinkedEntityRecordID as string) ?? null; },
                    set LinkedEntityRecordID(v: string | null) { draft.LinkedEntityRecordID = v; },
                    set LinkedRecordType(v: string | null) { draft.LinkedRecordType = v; },
                    NewRecord() {
                        seq += 1;
                        draft.ID = `cccc0000-0000-4000-8000-000000000${seq}`;
                    },
                    async Load(id: string) {
                        const existing = savedAccounts.get(id);
                        if (!existing) return false;
                        Object.assign(draft, existing);
                        return true;
                    },
                    async Save() {
                        savedAccounts.set(draft.ID as string, { ...draft });
                        return true;
                    },
                    async Delete() {
                        savedAccounts.delete(draft.ID as string);
                        return true;
                    },
                };
            }
            if (entityName === 'MJ: User Roles' || entityName === 'MJ: User Applications' || entityName === 'MJ: Magic Link Invite Applications' || entityName === 'MJ: Magic Link Invite Roles') {
                return {
                    NewRecord() {},
                    async Load() { return true; },
                    async Save() { return true; },
                    async Delete() { return true; },
                };
            }
            if (entityName === 'MJ_BizApps_Common: People') {
                const draft: Record<string, unknown> = {};
                return {
                    get ID() { return draft.ID as string; },
                    get Email() { return draft.Email as string; },
                    set Email(v: string) { draft.Email = v; },
                    set FirstName(v: string) { draft.FirstName = v; },
                    set LastName(v: string) { draft.LastName = v; },
                    set LinkedUserID(v: string | null) { draft.LinkedUserID = v; },
                    NewRecord() {
                        seq += 1;
                        draft.ID = `dddd0000-0000-4000-8000-000000000${seq}`;
                    },
                    async Load(id: string) {
                        const existing = savedPeople.get(id);
                        if (!existing) return false;
                        Object.assign(draft, existing);
                        return true;
                    },
                    async Save() {
                        savedPeople.set(draft.ID as string, { ...draft });
                        return true;
                    },
                    async Delete() {
                        savedPeople.delete(draft.ID as string);
                        return true;
                    },
                };
            }
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
                    get ID() { return invite.ID as string; },
                    NewRecord() {
                        invite.ID = 'invite-1';
                    },
                    set TokenHash(v: string) { invite.TokenHash = v; },
                    set Email(v: string) { invite.Email = v; },
                    set ApplicationID(v: string) { invite.ApplicationID = v; },
                    set RoleID(v: string) { invite.RoleID = v; },
                    set ExpiresAt(v: Date) { invite.ExpiresAt = v; },
                    set MaxUses(v: number) { invite.MaxUses = v; },
                    set UseCount(v: number) { invite.UseCount = v; },
                    set Status(v: string) { invite.Status = v; },
                    set CreatedByUserID(v: string) { invite.CreatedByUserID = v; },
                    set IdentityMode(v: string) { invite.IdentityMode = v; },
                    set Kind(v: string) { invite.Kind = v; },
                    LatestResult: { CompleteMessage: 'Invite save refused.' },
                    async Save() {
                        if (options.refuseInviteSave) {
                            return false;
                        }
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
        ProviderToUse: provider,
        RunViewProviderToUse: provider,
    } as unknown as mjBizAppsCollaborationSpaceEntity;

    return {
        provider: provider as unknown as IMetadataProvider,
        space,
        seats,
        savedSeats,
        savedInvites,
        savedPeople,
    };
}

describe('BaseSpaceTypeServerDriver.SyncSeats', () => {
    let heldGetSystemUser: typeof WellKnownUserSource.Instance.GetSystemUser;

    before(() => {
        heldGetSystemUser = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => SYSTEM_USER;
    });

    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = heldGetSystemUser;
    });

    it('adds, updates, and removes only seats with the matching SyncSource, and invites people without an MJ User through mintSpaceLink', async () => {
        const { provider, space, seats, savedInvites, savedPeople } = createMockProvider({
            existingSeats: [
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
                { PersonID: PERSON_ALICE, RoleTypeName: 'Owner' },
                { PersonID: PERSON_CAROL, RoleTypeName: 'Participant' },
            ],
            ACTING_USER,
            provider
        );

        assert.equal(result.added, 0);
        assert.equal(result.updated, 1);
        assert.equal(result.removed, 1);
        assert.equal(result.invited, 1);
        assert.deepEqual(result.errors, []);
        assert.match(result.redemptionUrls?.['carol@example.org'] ?? '', /\/magic-link\/redeem\?token=mj_ml_/);

        // Alice updated to Owner
        assert.equal(seats.get('seat-alice')?.SpaceRoleTypeID, ROLE_OWNER);
        assert.equal(seats.get('seat-alice')?.Status, 'Active');
        // Bob marked Removed
        assert.equal(seats.get('seat-bob')?.Status, 'Removed');
        // Manual and other-source seats untouched
        assert.equal(seats.get('seat-manual')?.Status, 'Active');
        assert.equal(seats.get('seat-other')?.Status, 'Active');
        // Carol's existing Person record linked to the provisioned MJ User
        assert.ok(savedPeople.get(PERSON_CAROL)?.LinkedUserID);
        // Carol invited by email with complete Magic Link Invite fields
        assert.equal(savedInvites.length, 1);
        assert.equal(savedInvites[0]?.Email, 'carol@example.org');
        assert.equal(typeof savedInvites[0]?.TokenHash, 'string');
        assert.ok((savedInvites[0]?.TokenHash as string).length > 10);
        assert.equal(savedInvites[0]?.ApplicationID, '94F5906B-38AB-4A9F-BFCA-3D395BBBC198');
        assert.equal(savedInvites[0]?.RoleID, 'AAF434FD-EF58-4857-854E-2607ACAF763B');
        assert.ok(savedInvites[0]?.ExpiresAt instanceof Date);
        assert.equal(savedInvites[0]?.MaxUses, 1);
        assert.equal(savedInvites[0]?.UseCount, 0);
    });

    /** Alice holds a synced Member seat; the sync names her next role, and the role her seat ends on is the one the name resolved to. */
    async function syncAliceAs(roleTypeName: string, extraRoles?: Array<{ ID: string; Name: string; Code: string; CanSeeTeamBand: boolean }>) {
        const world = createMockProvider({
            existingSeats: [
                { ID: 'seat-alice', SpaceID: SPACE_ID, UserID: USER_ALICE, PersonID: PERSON_ALICE, SpaceRoleTypeID: ROLE_MEMBER, Band: 'Team', Status: 'Active', SyncSource: 'roster:main' },
            ],
            extraRoles,
        });
        const result = await new BaseSpaceTypeServerDriver().SyncSeats(
            world.space,
            'roster:main',
            [{ PersonID: PERSON_ALICE, RoleTypeName: roleTypeName }],
            ACTING_USER,
            world.provider,
        );
        return { result, seat: world.seats.get('seat-alice') };
    }

    it('resolves a role type by its code, its ID or its name: role types are global, and the space\'s type plays no part', async () => {
        const byCode = await syncAliceAs('guest');
        assert.deepEqual(byCode.result.errors, []);
        assert.equal(byCode.seat?.SpaceRoleTypeID, ROLE_GUEST, 'the code "guest" is the Participant role');
        assert.equal(byCode.seat?.Band, 'Shared');

        const byId = await syncAliceAs(ROLE_OWNER.toUpperCase());
        assert.deepEqual(byId.result.errors, []);
        assert.equal(byId.seat?.SpaceRoleTypeID, ROLE_OWNER);

        const byName = await syncAliceAs('  participant ');
        assert.deepEqual(byName.result.errors, []);
        assert.equal(byName.seat?.SpaceRoleTypeID, ROLE_GUEST, 'a name is matched whatever its case and padding');
    });

    it('takes a role\'s code before another role\'s name, whichever was read first', async () => {
        const ROLE_NAMED_GUEST = '66666666-6666-4666-8666-66666666aaaa';
        // A Team-seeing role that is merely named "guest" is read before the role whose code is "guest"
        const { result, seat } = await syncAliceAs('guest', [{ ID: ROLE_NAMED_GUEST, Name: 'guest', Code: 'visitor', CanSeeTeamBand: true }]);
        assert.deepEqual(result.errors, []);
        assert.equal(seat?.SpaceRoleTypeID, ROLE_GUEST, 'the code decides: codes are unique, names are not');
        assert.equal(seat?.Band, 'Shared');
    });

    it('refuses a name that more than one role type carries, and gives the seat neither role', async () => {
        const ROLE_SECOND_PARTICIPANT = '66666666-6666-4666-8666-66666666bbbb';
        const { result, seat } = await syncAliceAs('Participant', [{ ID: ROLE_SECOND_PARTICIPANT, Name: 'Participant', Code: 'participant-2', CanSeeTeamBand: true }]);
        assert.equal(result.updated, 0);
        assert.equal(result.removed, 0);
        assert.equal(result.errors.length, 1);
        assert.match(result.errors[0], /'Participant' is the name of more than one role/);
        assert.equal(seat?.SpaceRoleTypeID, ROLE_MEMBER, 'the seat is given neither of the two roles');
        assert.equal(seat?.Status, 'Active', 'the seat is not removed when the role name is ambiguous');
    });

    it('keeps a person\'s existing synced seat (even with PersonID null) when their roster entry fails to resolve', async () => {
        const { result, seat } = await syncAliceAs('Typo');
        assert.equal(result.removed, 0);
        assert.equal(result.updated, 0);
        assert.equal(result.errors.length, 1);
        assert.match(result.errors[0], /Unknown space role type 'Typo'/);
        assert.equal(seat?.Status, 'Active');
        assert.equal(seat?.SpaceRoleTypeID, ROLE_MEMBER);

        // Seat has PersonID: null — identity must still resolve PersonID -> UserID before matching the role.
        const world = createMockProvider({
            existingSeats: [
                {
                    ID: 'seat-alice-no-person',
                    SpaceID: SPACE_ID,
                    UserID: USER_ALICE,
                    PersonID: null,
                    SpaceRoleTypeID: ROLE_MEMBER,
                    Band: 'Team',
                    Status: 'Active',
                    SyncSource: 'roster:main',
                },
            ],
        });
        const noPersonRes = await new BaseSpaceTypeServerDriver().SyncSeats(
            world.space,
            'roster:main',
            [{ PersonID: PERSON_ALICE, RoleTypeName: 'Typo' }],
            ACTING_USER,
            world.provider
        );
        assert.equal(noPersonRes.removed, 0);
        assert.equal(noPersonRes.errors.length, 1);
        assert.equal(world.seats.get('seat-alice-no-person')?.Status, 'Active');
    });

    it('keeps an existing synced seat when an invite fails or a person has no user and no valid email', async () => {
        const USER_CAROL_EXISTING = 'bbbb0000-0000-4000-8000-000000000099';
        const PERSON_NO_EMAIL = 'aaaa0000-0000-4000-8000-000000000099';
        const USER_NO_EMAIL = 'bbbb0000-0000-4000-8000-000000000098';

        // Failed invite preserves Carol's existing synced seat
        const failedInviteWorld = createMockProvider({
            existingSeats: [
                {
                    ID: 'seat-carol',
                    SpaceID: SPACE_ID,
                    UserID: USER_CAROL_EXISTING,
                    PersonID: PERSON_CAROL,
                    SpaceRoleTypeID: ROLE_GUEST,
                    Band: 'Shared',
                    Status: 'Invited',
                    SyncSource: 'roster:main',
                },
            ],
            refuseInviteSave: true,
        });
        const inviteRes = await new BaseSpaceTypeServerDriver().SyncSeats(
            failedInviteWorld.space,
            'roster:main',
            [{ PersonID: PERSON_CAROL, RoleTypeName: 'Participant' }],
            ACTING_USER,
            failedInviteWorld.provider
        );
        assert.equal(inviteRes.removed, 0);
        assert.equal(inviteRes.errors.length, 1);
        assert.equal(failedInviteWorld.seats.get('seat-carol')?.Status, 'Invited');

        // Person with no linked user and no valid email preserves their existing synced seat
        const noEmailWorld = createMockProvider({
            existingSeats: [
                {
                    ID: 'seat-no-email',
                    SpaceID: SPACE_ID,
                    UserID: USER_NO_EMAIL,
                    PersonID: PERSON_NO_EMAIL,
                    SpaceRoleTypeID: ROLE_GUEST,
                    Band: 'Shared',
                    Status: 'Active',
                    SyncSource: 'roster:main',
                },
            ],
        });
        const noEmailRes = await new BaseSpaceTypeServerDriver().SyncSeats(
            noEmailWorld.space,
            'roster:main',
            [{ PersonID: PERSON_NO_EMAIL, RoleTypeName: 'Participant' }],
            ACTING_USER,
            noEmailWorld.provider
        );
        assert.equal(noEmailRes.removed, 0);
        assert.equal(noEmailRes.errors.length, 1);
        assert.equal(noEmailWorld.seats.get('seat-no-email')?.Status, 'Active');
    });

    it('does not let a permanently unmapped email-only error block removals of dropped seats', async () => {
        const { provider, space, seats } = createMockProvider({
            existingSeats: [
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
                {
                    ID: 'seat-bob',
                    SpaceID: SPACE_ID,
                    UserID: USER_BOB,
                    PersonID: PERSON_BOB,
                    SpaceRoleTypeID: ROLE_GUEST,
                    Band: 'Shared',
                    Status: 'Active',
                    SyncSource: 'roster:main',
                },
            ],
        });
        const result = await new BaseSpaceTypeServerDriver().SyncSeats(
            space,
            'roster:main',
            [
                { PersonID: PERSON_ALICE, RoleTypeName: 'member' },
                { Email: 'dave@example.org', RoleTypeName: 'Typo' },
            ],
            ACTING_USER,
            provider
        );
        assert.equal(result.removed, 1);
        assert.equal(result.errors.length, 1);
        assert.equal(seats.get('seat-alice')?.Status, 'Active');
        assert.equal(seats.get('seat-bob')?.Status, 'Removed');
    });

    it('skips removals when a transient People or Users lookup fails during roster resolution', async () => {
        const baseSeats: SeatRecord[] = [
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
            {
                ID: 'seat-bob',
                SpaceID: SPACE_ID,
                UserID: USER_BOB,
                PersonID: PERSON_BOB,
                SpaceRoleTypeID: ROLE_GUEST,
                Band: 'Shared',
                Status: 'Active',
                SyncSource: 'roster:main',
            },
        ];

        const peopleWorld = createMockProvider({ existingSeats: baseSeats, failPeopleLookup: true });
        const peopleRes = await new BaseSpaceTypeServerDriver().SyncSeats(
            peopleWorld.space,
            'roster:main',
            [{ PersonID: PERSON_CAROL, RoleTypeName: 'Participant' }],
            ACTING_USER,
            peopleWorld.provider
        );
        assert.equal(peopleRes.removed, 0);
        assert.equal(peopleRes.errors.length, 1);
        assert.match(peopleRes.errors[0], /transient people store error/);
        assert.equal(peopleWorld.seats.get('seat-alice')?.Status, 'Active');
        assert.equal(peopleWorld.seats.get('seat-bob')?.Status, 'Active');

        const usersWorld = createMockProvider({ existingSeats: baseSeats, failUsersLookup: true });
        const usersRes = await new BaseSpaceTypeServerDriver().SyncSeats(
            usersWorld.space,
            'roster:main',
            [{ Email: 'carol@example.org', RoleTypeName: 'Participant' }],
            ACTING_USER,
            usersWorld.provider
        );
        assert.equal(usersRes.removed, 0);
        assert.equal(usersRes.errors.length, 1);
        assert.match(usersRes.errors[0], /transient users store error/);
        assert.equal(usersWorld.seats.get('seat-alice')?.Status, 'Active');
        assert.equal(usersWorld.seats.get('seat-bob')?.Status, 'Active');
    });

    it('passes a type-less, role-less space owner unchanged to mintSpaceLink rather than promoting them to Owner', async () => {
        const { provider, space } = createMockProvider({
            existingSeats: [],
        });
        // Uses ACTING_USER.ID (an active space Owner in the mock) with no Type or UserRoles so mintSpaceLink reaches callerMayReceiveLink.
        const bareSpaceOwner = {
            ID: ACTING_USER.ID,
            Name: 'Ada (no Type)',
        } as unknown as UserInfo;

        const driver = new BaseSpaceTypeServerDriver();
        const result = await driver.SyncSeats(
            space,
            'roster:main',
            [{ PersonID: PERSON_CAROL, RoleTypeName: 'Participant' }],
            bareSpaceOwner,
            provider
        );

        assert.equal(result.invited, 1);
        assert.deepEqual(result.errors, []);
        assert.equal(result.redemptionUrls, undefined, 'type-less caller must not be promoted to Owner and handed a raw link');
    });

    it('seats an invitee as Invited without issuing a link when a non-owner invites onto an approval-gated space', async () => {
        const { provider, space, savedSeats, savedInvites } = createMockProvider({
            existingSeats: [],
            inviteApproval: 'Approve',
        });
        const driver = new BaseSpaceTypeServerDriver();
        const result = await driver.SyncSeats(
            space,
            'roster:main',
            [{ PersonID: PERSON_CAROL, RoleTypeName: 'Participant' }],
            NON_OWNER_ADMIN,
            provider
        );

        assert.equal(result.invited, 1);
        assert.deepEqual(result.errors, []);
        assert.equal(savedSeats.length, 1);
        assert.equal(savedSeats[0].Status, 'Invited');
        assert.equal(savedSeats[0].SyncSource, 'roster:main');
        assert.equal(savedSeats[0].PersonID, PERSON_CAROL);
        assert.equal(savedInvites.length, 0);
    });

    it('does not increment invited and records an error when saving a magic link invite fails', async () => {
        const { provider, space, savedInvites } = createMockProvider({
            existingSeats: [],
            refuseInviteSave: true,
        });
        const driver = new BaseSpaceTypeServerDriver();
        const result = await driver.SyncSeats(
            space,
            'roster:main',
            [{ PersonID: PERSON_CAROL, RoleTypeName: 'Participant' }],
            ACTING_USER,
            provider
        );

        assert.equal(result.invited, 0);
        assert.equal(savedInvites.length, 0);
        assert.equal(result.errors.length, 1);
        assert.match(result.errors[0], /sign-in link could not be saved/i);
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
