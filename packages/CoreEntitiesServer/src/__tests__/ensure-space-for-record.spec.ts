import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
    EntityFieldTSType,
    WellKnownUserSource,
    type BaseEntity,
    type EntityFieldInfo,
    type EntityInfo,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';
import type { SpaceDetailValue } from '@mj-biz-apps/collaboration-core';
import type {
    mjBizAppsCollaborationSpaceAnchorEntity,
    mjBizAppsCollaborationSpaceEntity,
    mjBizAppsCollaborationSpaceMemberEntity,
    mjBizAppsCollaborationSpaceRoleTypeEntity,
    mjBizAppsCollaborationSpaceTypeEntity,
} from '@mj-biz-apps/collaboration-entities';
import { CollaborationEngine, EnsureSpaceForRecord } from '../../dist/index.js';

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';
const CALLER_A_ID = 'A1000001-0000-4000-8000-000000000001';
const CALLER_B_ID = 'A1000001-0000-4000-8000-000000000002';
const OWNER_ROLE_ID = 'B1000001-0000-4000-8000-000000000001';
const SPACE_TYPE_ID = 'C1000001-0000-4000-8000-000000000001';
const TARGET_ENTITY_ID = 'D1000001-0000-4000-8000-000000000001';
const RECORD_UUID_1 = 'E1000001-0000-4000-8000-000000000001';
const RECORD_UUID_2 = 'E1000001-0000-4000-8000-000000000002';
const RECORD_UUID_3 = 'E1000001-0000-4000-8000-000000000003';
const RECORD_UUID_RACE = 'E1000001-0000-4000-8000-000000000005';
const RECORD_UUID_COMPENSATE = 'E1000001-0000-4000-8000-000000000006';

interface StoredSpaceRow {
    ID: string;
    Name: string;
    SpaceTypeID: string;
    OwnerID: string;
    ParentID: string | null;
    InheritsMembership: boolean;
    Details: Record<string, SpaceDetailValue>;
}

interface StoredMemberRow {
    ID: string;
    SpaceID: string;
    UserID: string;
    SpaceRoleTypeID: string;
    Band: mjBizAppsCollaborationSpaceMemberEntity['Band'];
    Status: mjBizAppsCollaborationSpaceMemberEntity['Status'];
}

interface StoredAnchorRow {
    ID: string;
    SpaceID: string;
    SpaceTypeID: string;
    EntityID: string;
    RecordID: string;
    Role: string;
    IsPrimary: boolean;
    Sequence: number;
}

interface MockLeafShape {
    EntityInfo: EntityInfo;
    TermName?: SpaceDetailValue;
    NextMeeting?: SpaceDetailValue;
    Save: () => Promise<boolean>;
    LatestResult: { CompleteMessage: string };
}

interface MockSpaceShape {
    ID: string;
    Name: string;
    SpaceTypeID: string;
    OwnerID: string;
    ParentID: string | null;
    InheritsMembership: boolean;
    NewRecord: () => boolean;
    Load: (id: string) => Promise<boolean>;
    Save: () => Promise<boolean>;
    Delete: () => Promise<boolean>;
    EnsureISAChild: () => Promise<BaseEntity | null>;
    LeafEntity?: BaseEntity;
}

function makeUser(id: string, name: string): UserInfo {
    const u: Partial<UserInfo> = {
        ID: id,
        Name: name,
        Email: `${name.toLowerCase()}@example.com`,
        Type: 'User',
        IsActive: true,
    };
    return u as UserInfo;
}

function makeEntityInfo(name: string, id: string, fields: EntityFieldInfo[]): EntityInfo {
    const info: Partial<EntityInfo> = {
        ID: id,
        Name: name,
        Fields: fields,
        PrimaryKeys: fields.filter((f) => f.IsPrimaryKey),
        ParentEntityFieldNames: new Set(['ID', 'Name', 'SpaceTypeID', 'OwnerID', 'ParentID', 'InheritsMembership']),
    };
    return info as EntityInfo;
}

function makeField(partial: Partial<EntityFieldInfo>): EntityFieldInfo {
    return partial as EntityFieldInfo;
}

function asFilterString(extraFilter: RunViewParams['ExtraFilter']): string {
    return typeof extraFilter === 'string' ? extraFilter : String(extraFilter ?? '');
}

function extractQuotedFilter(filter: string, key: string): string | null {
    const m = filter.match(new RegExp(`${key}\\s*=\\s*'([^']*)'`, 'i'));
    return m ? m[1] : null;
}

interface TransactionalMockConfig {
    spaceType: Partial<mjBizAppsCollaborationSpaceTypeEntity>;
    supportsTransactions?: boolean;
    firstSaveBarrierCount?: number;
}

function createTransactionalAnchorHarness(config: TransactionalMockConfig) {
    const spaces: StoredSpaceRow[] = [];
    const members: StoredMemberRow[] = [];
    const anchors: StoredAnchorRow[] = [];
    const txEvents: string[] = [];
    let idSeq = 0;

    let activeTxDepth = 0;
    let pendingBarrierRemaining = config.firstSaveBarrierCount ?? 0;
    const barrierResolvers: Array<() => void> = [];

    const nextUuid = (prefix: string): string => {
        idSeq += 1;
        const hex = idSeq.toString(16).padStart(12, '0');
        return `${prefix}00001-0000-4000-8000-${hex}`;
    };

    const targetEntityInfo = makeEntityInfo('CRM: Accounts', TARGET_ENTITY_ID, [
        makeField({ Name: 'ID', IsPrimaryKey: true, Type: 'uniqueidentifier', AllowUpdateAPI: true, Sequence: 1, TSType: EntityFieldTSType.String }),
    ]);

    const subtypeEntityInfo = makeEntityInfo('Example Boards', 'D2000001-0000-4000-8000-000000000001', [
        makeField({ Name: 'ID', DisplayNameOrName: 'ID', IsPrimaryKey: true, IsVirtual: false, AllowUpdateAPI: true, AllowsNull: false, DefaultValue: '', Sequence: 1, TSType: EntityFieldTSType.String }),
        makeField({ Name: 'Name', DisplayNameOrName: 'Name', IsPrimaryKey: false, IsVirtual: true, AllowUpdateAPI: true, AllowsNull: false, DefaultValue: '', Sequence: 2, TSType: EntityFieldTSType.String }),
        makeField({ Name: 'TermName', DisplayNameOrName: 'Term Name', IsPrimaryKey: false, IsVirtual: false, AllowUpdateAPI: true, AllowsNull: true, DefaultValue: '', Sequence: 3, TSType: EntityFieldTSType.String }),
        makeField({ Name: 'NextMeeting', DisplayNameOrName: 'Next Meeting', IsPrimaryKey: false, IsVirtual: false, AllowUpdateAPI: true, AllowsNull: true, DefaultValue: '', Sequence: 4, TSType: EntityFieldTSType.Date }),
    ]);

    const txSpaceBuffer = new Map<string, StoredSpaceRow>();
    const txMemberBuffer = new Map<string, StoredMemberRow[]>();
    const winningSpaceIds = new Set<string>();

    const makeAnchorKey = (a: { SpaceTypeID: string; EntityID: string; RecordID: string }): string =>
        `${a.SpaceTypeID.toLowerCase()}|${a.EntityID.toLowerCase()}|${a.RecordID.toLowerCase()}`;

    const commitPrimaryAnchor = (row: StoredAnchorRow): void => {
        if (row.IsPrimary) {
            const key = makeAnchorKey(row);
            const conflict = anchors.find((existing) => existing.IsPrimary && makeAnchorKey(existing) === key);
            if (conflict) {
                // Simulate DB rolling back only the conflicting unit of work
                txSpaceBuffer.delete(row.SpaceID);
                txMemberBuffer.delete(row.SpaceID);
                throw new Error(
                    "Violation of UNIQUE KEY constraint 'UQ_SpaceAnchor_PrimaryPerType'. Cannot insert duplicate key (SQL 2627).",
                );
            }
        }
        winningSpaceIds.add(row.SpaceID);
        anchors.push(row);
    };

    const providerObj: Partial<IMetadataProvider & IRunViewProvider> & {
        BeginTransaction?: () => Promise<void>;
        CommitTransaction?: () => Promise<void>;
        RollbackTransaction?: () => Promise<void>;
    } = {
        EntityByID(id: string): EntityInfo | undefined {
            if (id.toLowerCase() === TARGET_ENTITY_ID.toLowerCase()) {
                return targetEntityInfo;
            }
            if (id.toLowerCase() === subtypeEntityInfo.ID.toLowerCase()) {
                return subtypeEntityInfo;
            }
            return undefined;
        },

        async RunView<T>(viewParams: RunViewParams): Promise<RunViewResult<T>> {
            const filter = asFilterString(viewParams.ExtraFilter);
            const makeResult = (rows: T[]): RunViewResult<T> => ({
                Success: true,
                Results: rows,
                UserViewRunID: '',
                RowCount: rows.length,
                TotalRowCount: rows.length,
                ExecutionTime: 0,
                ErrorMessage: '',
            });

            if (viewParams.EntityName === 'MJ: Entities') {
                const name = extractQuotedFilter(filter, 'Name');
                const rows = name === 'CRM: Accounts' ? [{ ID: TARGET_ENTITY_ID }] : [];
                return makeResult(rows as T[]);
            }

            if (viewParams.EntityName === 'MJ_BizApps_Collaboration: Space Types') {
                const code = extractQuotedFilter(filter, 'Code');
                const matches = config.spaceType.Code && code === config.spaceType.Code ? [config.spaceType] : [];
                return makeResult(matches as T[]);
            }

            if (viewParams.EntityName === 'MJ_BizApps_Collaboration: Space Anchors') {
                // Barrier ensures concurrent callers both pass the pre-insert check before either inserts!
                if (pendingBarrierRemaining > 0 && filter.includes('IsPrimary = 1')) {
                    pendingBarrierRemaining -= 1;
                    if (pendingBarrierRemaining === 0) {
                        for (const resolve of barrierResolvers.splice(0)) {
                            resolve();
                        }
                    } else {
                        await new Promise<void>((resolve) => {
                            barrierResolvers.push(resolve);
                        });
                    }
                }
                const stId = extractQuotedFilter(filter, 'SpaceTypeID')?.toLowerCase();
                const entId = extractQuotedFilter(filter, 'EntityID')?.toLowerCase();
                const recId = extractQuotedFilter(filter, 'RecordID')?.toLowerCase();
                const match = anchors.filter(
                    (a) =>
                        a.IsPrimary &&
                        a.SpaceTypeID.toLowerCase() === stId &&
                        a.EntityID.toLowerCase() === entId &&
                        a.RecordID.toLowerCase() === recId,
                );
                return makeResult(match.map((m) => ({ SpaceID: m.SpaceID })) as T[]);
            }

            if (viewParams.EntityName === 'MJ_BizApps_Collaboration: Space Role Types') {
                return makeResult([{ ID: OWNER_ROLE_ID }] as T[]);
            }

            return makeResult([]);
        },

        async RunViews<T>(viewParams: RunViewParams[]): Promise<RunViewResult<T>[]> {
            return Promise.all(viewParams.map((p) => this.RunView!<T>(p)));
        },

        async GetEntityObject<T>(entityName: string): Promise<T> {
            if (entityName === 'MJ_BizApps_Collaboration: Spaces') {
                const details: Record<string, SpaceDetailValue> = {};
                const txId = `tx-${idSeq + 1}`;
                const spaceObj: MockSpaceShape = {
                    ID: '',
                    Name: '',
                    SpaceTypeID: '',
                    OwnerID: '',
                    ParentID: null,
                    InheritsMembership: false,
                    NewRecord() {
                        this.ID = nextUuid('F1');
                        return true;
                    },
                    async Load(id: string): Promise<boolean> {
                        const found = spaces.find((s) => s.ID.toLowerCase() === id.toLowerCase());
                        if (!found) return false;
                        this.ID = found.ID;
                        this.Name = found.Name;
                        this.SpaceTypeID = found.SpaceTypeID;
                        this.OwnerID = found.OwnerID;
                        this.ParentID = found.ParentID;
                        this.InheritsMembership = found.InheritsMembership;
                        Object.assign(details, found.Details);
                        return true;
                    },
                    async Save(): Promise<boolean> {
                        const row: StoredSpaceRow = {
                            ID: spaceObj.ID,
                            Name: spaceObj.Name,
                            SpaceTypeID: spaceObj.SpaceTypeID,
                            OwnerID: spaceObj.OwnerID,
                            ParentID: spaceObj.ParentID,
                            InheritsMembership: spaceObj.InheritsMembership,
                            Details: { ...details },
                        };
                        if (activeTxDepth > 0) {
                            txSpaceBuffer.set(row.ID, row);
                        } else {
                            spaces.push(row);
                        }
                        return true;
                    },
                    async Delete(): Promise<boolean> {
                        const idx = spaces.findIndex((s) => s.ID === spaceObj.ID);
                        if (idx >= 0) spaces.splice(idx, 1);
                        return true;
                    },
                    async EnsureISAChild(): Promise<BaseEntity | null> {
                        if (!config.spaceType.SpaceExtensionEntity) {
                            return null;
                        }
                        const leafObj: MockLeafShape = {
                            EntityInfo: subtypeEntityInfo,
                            LatestResult: { CompleteMessage: '' },
                            async Save(): Promise<boolean> {
                                if (leafObj.TermName !== undefined) {
                                    details['TermName'] = leafObj.TermName;
                                }
                                if (leafObj.NextMeeting !== undefined) {
                                    details['NextMeeting'] = leafObj.NextMeeting;
                                }
                                return spaceObj.Save();
                            },
                        };
                        Object.defineProperty(leafObj, 'TermName', {
                            get: () => details['TermName'],
                            set: (v: SpaceDetailValue) => {
                                details['TermName'] = v;
                            },
                            enumerable: true,
                        });
                        Object.defineProperty(leafObj, 'NextMeeting', {
                            get: () => details['NextMeeting'],
                            set: (v: SpaceDetailValue) => {
                                details['NextMeeting'] = v;
                            },
                            enumerable: true,
                        });
                        const typedLeaf = leafObj as Partial<BaseEntity> as BaseEntity;
                        spaceObj.LeafEntity = typedLeaf;
                        return typedLeaf;
                    },
                };
                spaceObj.LeafEntity = spaceObj as Partial<BaseEntity> as BaseEntity;
                return spaceObj as Partial<BaseEntity> as T;
            }

            if (entityName === 'MJ_BizApps_Collaboration: Space Members') {
                const memberObj = {
                    ID: '',
                    SpaceID: '',
                    UserID: '',
                    SpaceRoleTypeID: '',
                    Band: 'Team' as mjBizAppsCollaborationSpaceMemberEntity['Band'],
                    Status: 'Active' as mjBizAppsCollaborationSpaceMemberEntity['Status'],
                    LatestResult: { CompleteMessage: '' },
                    NewRecord(): boolean {
                        this.ID = nextUuid('F2');
                        return true;
                    },
                    async Save(): Promise<boolean> {
                        const row: StoredMemberRow = {
                            ID: memberObj.ID || nextUuid('F2'),
                            SpaceID: memberObj.SpaceID,
                            UserID: memberObj.UserID,
                            SpaceRoleTypeID: memberObj.SpaceRoleTypeID,
                            Band: memberObj.Band === 'Shared' ? 'Shared' : 'Team',
                            Status: memberObj.Status === 'Invited' || memberObj.Status === 'Removed' ? memberObj.Status : 'Active',
                        };
                        if (activeTxDepth > 0) {
                            const list = txMemberBuffer.get(row.SpaceID) ?? [];
                            list.push(row);
                            txMemberBuffer.set(row.SpaceID, list);
                        } else {
                            members.push(row);
                        }
                        return true;
                    },
                    async Delete(): Promise<boolean> {
                        const idx = members.findIndex((m) => m.ID === memberObj.ID);
                        if (idx >= 0) members.splice(idx, 1);
                        return true;
                    },
                };
                return memberObj as Partial<mjBizAppsCollaborationSpaceMemberEntity> as T;
            }

            if (entityName === 'MJ_BizApps_Collaboration: Space Anchors') {
                const anchorObj = {
                    ID: '',
                    SpaceID: '',
                    SpaceTypeID: '',
                    EntityID: '',
                    RecordID: '',
                    Role: 'primary',
                    IsPrimary: true,
                    Sequence: 0,
                    LatestResult: { CompleteMessage: '' },
                    NewRecord(): boolean {
                        this.ID = nextUuid('F3');
                        return true;
                    },
                    async Save(): Promise<boolean> {
                        const row: StoredAnchorRow = {
                            ID: anchorObj.ID || nextUuid('F3'),
                            SpaceID: anchorObj.SpaceID,
                            SpaceTypeID: anchorObj.SpaceTypeID,
                            EntityID: anchorObj.EntityID,
                            RecordID: anchorObj.RecordID,
                            Role: anchorObj.Role,
                            IsPrimary: Boolean(anchorObj.IsPrimary),
                            Sequence: anchorObj.Sequence,
                        };
                        commitPrimaryAnchor(row);
                        return true;
                    },
                };
                return anchorObj as Partial<mjBizAppsCollaborationSpaceAnchorEntity> as T;
            }

            throw new Error(`Unexpected entity lookup: ${entityName}`);
        },
    };

    if (config.supportsTransactions !== false) {
        providerObj.BeginTransaction = async () => {
            txEvents.push('begin');
            activeTxDepth += 1;
        };
        providerObj.CommitTransaction = async () => {
            txEvents.push('commit');
            for (const row of txSpaceBuffer.values()) {
                if (winningSpaceIds.has(row.ID) && !spaces.some((s) => s.ID === row.ID)) {
                    spaces.push(row);
                }
            }
            for (const [spId, rows] of txMemberBuffer.entries()) {
                if (!winningSpaceIds.has(spId)) continue;
                for (const row of rows) {
                    if (!members.some((m) => m.ID === row.ID)) {
                        members.push(row);
                    }
                }
            }
            txSpaceBuffer.clear();
            txMemberBuffer.clear();
            activeTxDepth = Math.max(0, activeTxDepth - 1);
        };
        providerObj.RollbackTransaction = async () => {
            txEvents.push('rollback');
            for (const key of txSpaceBuffer.keys()) {
                if (!winningSpaceIds.has(key)) txSpaceBuffer.delete(key);
            }
            for (const key of txMemberBuffer.keys()) {
                if (!winningSpaceIds.has(key)) txMemberBuffer.delete(key);
            }
            activeTxDepth = Math.max(0, activeTxDepth - 1);
        };
    }

    return {
        provider: providerObj as IMetadataProvider,
        spaces,
        members,
        anchors,
        txEvents,
    };
}

describe('CX-1 EnsureSpaceForRecord', () => {
    let heldSystem: typeof WellKnownUserSource.Instance.GetSystemUser;
    const engine = CollaborationEngine.Instance;
    let heldEnsureLoaded: typeof engine.EnsureLoaded;
    let heldRoleByCode: typeof engine.SpaceRoleTypeByCode;

    before(() => {
        heldSystem = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => makeUser(SYSTEM_USER_ID, 'System');
        heldEnsureLoaded = engine.EnsureLoaded.bind(engine);
        heldRoleByCode = engine.SpaceRoleTypeByCode.bind(engine);
        engine.EnsureLoaded = async () => undefined;
        engine.SpaceRoleTypeByCode = (code: string | null | undefined) => {
            if (code === 'owner') {
                const role: Partial<mjBizAppsCollaborationSpaceRoleTypeEntity> = { ID: OWNER_ROLE_ID, Code: 'owner' };
                return role as mjBizAppsCollaborationSpaceRoleTypeEntity;
            }
            return undefined;
        };
    });

    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = heldSystem;
        engine.EnsureLoaded = heldEnsureLoaded;
        engine.SpaceRoleTypeByCode = heldRoleByCode;
    });

    it('creates a subtyped space with sealed default, coerced Details, owner Team seat, and primary anchor', async () => {
        const harness = createTransactionalAnchorHarness({
            spaceType: {
                ID: SPACE_TYPE_ID,
                Code: 'BOARD',
                Name: 'Board',
                SpaceExtensionEntity: 'Example Boards',
                ServerDriverClass: null,
            },
        });
        const caller = makeUser(CALLER_A_ID, 'Alice');

        const created = await EnsureSpaceForRecord({
            typeCode: 'BOARD',
            entityName: 'CRM: Accounts',
            recordId: RECORD_UUID_1,
            spaceName: 'Q4 Steering Board',
            details: { TermName: 'Q4', NextMeeting: '2026-12-01T10:00:00.000Z' },
            contextUser: caller,
            provider: harness.provider,
        });

        assert.equal(created.InheritsMembership, false, 'new space defaults to sealed posture');
        assert.equal(harness.spaces.length, 1);
        assert.equal(harness.spaces[0].Details['TermName'], 'Q4');
        assert.equal(harness.spaces[0].Details['NextMeeting'] instanceof Date, true);
        assert.equal(harness.members.length, 1);
        assert.equal(harness.members[0].Band, 'Team');
        assert.equal(harness.members[0].Status, 'Active');
        assert.equal(harness.members[0].SpaceRoleTypeID, OWNER_ROLE_ID);
        assert.equal(harness.members[0].UserID, CALLER_A_ID);
        assert.equal(harness.anchors.length, 1);
        assert.equal(harness.anchors[0].Role, 'primary');
        assert.equal(harness.anchors[0].IsPrimary, true);
        assert.deepEqual(harness.txEvents, ['begin', 'commit']);
    });

    it('preserves backward-compatible defaults and supports explicit inheritsMembership + custom anchorRole', async () => {
        const harness = createTransactionalAnchorHarness({
            spaceType: {
                ID: SPACE_TYPE_ID,
                Code: 'DEAL',
                Name: 'Deal Room',
                SpaceExtensionEntity: null,
                ServerDriverClass: null,
            },
        });
        const caller = makeUser(CALLER_A_ID, 'Alice');

        const created = await EnsureSpaceForRecord({
            typeCode: 'DEAL',
            entityName: 'CRM: Accounts',
            recordId: RECORD_UUID_2,
            anchorRole: 'account-review',
            inheritsMembership: true,
            contextUser: caller,
            provider: harness.provider,
        });

        assert.equal(created.InheritsMembership, true);
        assert.equal(created.Name, `Deal Room: ${RECORD_UUID_2}`);
        assert.equal(harness.anchors[0].Role, 'account-review');
    });

    it('rejects unknown subtype detail fields before starting a transaction or creating rows', async () => {
        const harness = createTransactionalAnchorHarness({
            spaceType: {
                ID: SPACE_TYPE_ID,
                Code: 'BOARD',
                Name: 'Board',
                SpaceExtensionEntity: 'Example Boards',
                ServerDriverClass: null,
            },
        });
        const caller = makeUser(CALLER_A_ID, 'Alice');

        await assert.rejects(
            () =>
                EnsureSpaceForRecord({
                    typeCode: 'BOARD',
                    entityName: 'CRM: Accounts',
                    recordId: RECORD_UUID_3,
                    details: { NotARealColumn: 'oops' },
                    contextUser: caller,
                    provider: harness.provider,
                }),
            /NotARealColumn is not a detail of a Board space/,
        );

        assert.equal(harness.spaces.length, 0);
        assert.equal(harness.members.length, 0);
        assert.equal(harness.anchors.length, 0);
        assert.equal(harness.txEvents.length, 0);
    });

    it('converges parallel concurrent EnsureSpaceForRecord calls to the identical DB race-winner without duplicate rows', async () => {
        const harness = createTransactionalAnchorHarness({
            spaceType: {
                ID: SPACE_TYPE_ID,
                Code: 'DEAL',
                Name: 'Deal Room',
                SpaceExtensionEntity: null,
                ServerDriverClass: null,
            },
            firstSaveBarrierCount: 3,
        });

        const callerA = makeUser(CALLER_A_ID, 'Alice');
        const callerB = makeUser(CALLER_B_ID, 'Bob');

        const [winner1, winner2, winner3] = await Promise.all([
            EnsureSpaceForRecord({
                typeCode: 'DEAL',
                entityName: 'CRM: Accounts',
                recordId: RECORD_UUID_RACE,
                contextUser: callerA,
                provider: harness.provider,
            }),
            EnsureSpaceForRecord({
                typeCode: 'DEAL',
                entityName: 'CRM: Accounts',
                recordId: RECORD_UUID_RACE,
                contextUser: callerB,
                provider: harness.provider,
            }),
            EnsureSpaceForRecord({
                typeCode: 'DEAL',
                entityName: 'CRM: Accounts',
                recordId: RECORD_UUID_RACE,
                contextUser: callerB,
                provider: harness.provider,
            }),
        ]);

        assert.equal(winner1.ID, winner2.ID);
        assert.equal(winner2.ID, winner3.ID);
        assert.equal(harness.spaces.length, 1, 'exactly one winning Space row survives');
        assert.equal(harness.anchors.length, 1, 'exactly one primary SpaceAnchor row survives');
        assert.equal(harness.members.length, 1, 'exactly one owner seat survives');
        assert.equal(harness.txEvents.filter((e) => e === 'rollback').length >= 1, true);
    });

    it('cleans up orphaned rows and recovers winning Space when provider has no transaction methods', async () => {
        const raceHarness = createTransactionalAnchorHarness({
            spaceType: {
                ID: SPACE_TYPE_ID,
                Code: 'DEAL',
                Name: 'Deal Room',
                SpaceExtensionEntity: null,
                ServerDriverClass: null,
            },
            supportsTransactions: false,
            firstSaveBarrierCount: 2,
        });

        const callerA = makeUser(CALLER_A_ID, 'Alice');
        const callerB = makeUser(CALLER_B_ID, 'Bob');

        const [first, second] = await Promise.all([
            EnsureSpaceForRecord({
                typeCode: 'DEAL',
                entityName: 'CRM: Accounts',
                recordId: RECORD_UUID_COMPENSATE,
                contextUser: callerA,
                provider: raceHarness.provider,
            }),
            EnsureSpaceForRecord({
                typeCode: 'DEAL',
                entityName: 'CRM: Accounts',
                recordId: RECORD_UUID_COMPENSATE,
                contextUser: callerB,
                provider: raceHarness.provider,
            }),
        ]);

        assert.equal(first.ID, second.ID);
        assert.equal(raceHarness.spaces.length, 1, 'compensating Delete removes loser orphan space');
        assert.equal(raceHarness.members.length, 1, 'compensating Delete removes loser orphan seat');
        assert.equal(raceHarness.anchors.length, 1, 'only winner primary anchor exists');
    });
});
