import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_SPACE_RULES,
    ResolveCollaborationSettings,
    ResolveSpaceRules,
    ValidateCollaborationSettings,
    validateSpaceConfiguration,
    refuseChildType,
    validateSpaceTypeConfiguration,
    type CollaborationSettings,
    type ISpaceConfiguration,
    type ISpaceTypeConfiguration,
} from './configuration.ts';

describe('Configuration & ResolveSpaceRules', () => {
    it('returns default rules when type and space configurations are empty', () => {
        const rules = ResolveSpaceRules(null, null);
        assert.deepEqual(rules, DEFAULT_SPACE_RULES);

        const rulesUndefined = ResolveSpaceRules(undefined, undefined);
        assert.deepEqual(rulesUndefined, DEFAULT_SPACE_RULES);
    });

    it('applies type configuration values', () => {
        const typeConfig: ISpaceTypeConfiguration = {
            Chats: {
                WhoCanStart: 'Owners',
                AgentReplyMode: 'Always',
                HistoryOnAdd: 'Since',
            },
            Agents: {
                ListMode: 'Replace',
            },
            Extensions: {
                audit: {
                    RetentionDays: 90,
                },
            },
        };

        const rules = ResolveSpaceRules(typeConfig, null);
        assert.equal(rules.Chats.WhoCanStart, 'Owners');
        assert.equal(rules.Chats.AgentReplyMode, 'Always');
        assert.equal(rules.Chats.HistoryOnAdd, 'Since');
        assert.equal(rules.Agents.ListMode, 'Replace');
        assert.deepEqual(rules.Extensions.audit, { RetentionDays: 90 });
    });

    it('applies space overrides only for keys in SpaceOverridable', () => {
        const typeConfig: ISpaceTypeConfiguration = {
            Chats: {
                WhoCanStart: 'Owners',
                AgentReplyMode: 'MentionOrOneToOne',
                HistoryOnAdd: 'None',
            },
            Agents: {
                ListMode: 'Extend',
            },
            SpaceOverridable: ['Chats.WhoCanStart', 'Agents.ListMode', 'Extensions.audit'],
        };

        const spaceConfig: ISpaceConfiguration = {
            Chats: {
                WhoCanStart: 'Owners', // Allowed
                AgentReplyMode: 'Always', // NOT in SpaceOverridable, must NOT override
            },
            Agents: {
                ListMode: 'Replace', // Allowed
            },
            Extensions: {
                audit: {
                    CustomFlag: true,
                },
                unauthorizedApp: {
                    Flag: 123,
                },
            },
        };

        const rules = ResolveSpaceRules(typeConfig, spaceConfig);
        assert.equal(rules.Chats.WhoCanStart, 'Owners'); // Overridden
        assert.equal(rules.Chats.AgentReplyMode, 'MentionOrOneToOne'); // Kept from type
        assert.equal(rules.Agents.ListMode, 'Replace'); // Overridden
        assert.deepEqual(rules.Extensions.audit, { CustomFlag: true }); // Overridden
        assert.equal(rules.Extensions.unauthorizedApp, undefined); // Not allowed
    });

    it('validates space type configuration correctly', () => {
        const valid = validateSpaceTypeConfiguration({
            Chats: { WhoCanStart: 'Anyone', AgentReplyMode: 'MentionOnly', HistoryOnAdd: 'All' },
            Agents: { ListMode: 'Extend' },
            Children: { AllowedTypeCodes: ['workspace', 'cohort'], MaxOpen: 5 },
            SpaceOverridable: ['Chats.WhoCanStart'],
        });
        assert.equal(valid.valid, true);
        assert.equal(valid.errors.length, 0);

        const invalid = validateSpaceTypeConfiguration({
            Chats: {
                WhoCanStart: 'InvalidOption' as unknown as 'Anyone',
            },
            Children: {
                MaxOpen: -1,
            },
        });
        assert.equal(invalid.valid, false);
        assert.equal(invalid.errors.length, 2);
    });

    it('validates space configuration against SpaceOverridable', () => {
        const typeConfig: ISpaceTypeConfiguration = {
            SpaceOverridable: ['Chats.WhoCanStart'],
        };

        const validSpace: ISpaceConfiguration = {
            Chats: {
                WhoCanStart: 'Owners',
            },
        };
        const validRes = validateSpaceConfiguration(validSpace, typeConfig);
        assert.equal(validRes.valid, true);

        const invalidSpace: ISpaceConfiguration = {
            Chats: {
                WhoCanStart: 'Owners',
                AgentReplyMode: 'Always',
            },
        };
        const invalidRes = validateSpaceConfiguration(invalidSpace, typeConfig);
        assert.equal(invalidRes.valid, false);
        assert.match(invalidRes.errors[0], /Chats.AgentReplyMode cannot be overridden/);
    });

    describe('CollaborationSettings (Punch list 2 items 55, 12, 6)', () => {
        const appDefaults: CollaborationSettings = {
            PostCloseAccess: 'ReadOnly',
            PostCloseAccessDays: null,
            StorageAccountID: 'APP-STORAGE-001',
            Chats: {
                WhoCanStart: 'Anyone',
                AgentReplyMode: 'MentionOrOneToOne',
                HistoryOnAdd: 'None',
            },
            Agents: {
                ListMode: 'Extend',
            },
        };

        it('refuses when the app settings row is missing', () => {
            assert.throws(() => {
                ResolveCollaborationSettings({
                    spaces: [],
                    type: {},
                    app: null,
                });
            }, /Collaboration application settings row is missing/);
        });

        it('resolves the chain in order: sub-space -> parent -> type -> app', () => {
            const typeConfig: CollaborationSettings = {
                StorageAccountID: 'TYPE-STORAGE-002',
                PostCloseAccess: 'ReadOnlyWithAgent',
                PostCloseAccessDays: 90,
                SpaceOverridable: [
                    'StorageAccountID',
                    'PostCloseAccess',
                    'PostCloseAccessDays',
                    'Chats.WhoCanStart',
                ],
            };

            const rootSpace: CollaborationSettings = {
                StorageAccountID: 'ROOT-STORAGE-003',
                PostCloseAccess: 'None',
                PostCloseAccessDays: 30,
            };

            const parentSpace: CollaborationSettings = {
                StorageAccountID: 'PARENT-STORAGE-004',
            };

            const subSpace: CollaborationSettings = {
                PostCloseAccessDays: 14,
            };

            // spaces: [subSpace, parentSpace, rootSpace] (leaf to root)
            const resolved = ResolveCollaborationSettings({
                spaces: [subSpace, parentSpace, rootSpace],
                type: typeConfig,
                app: appDefaults,
            });

            // PostCloseAccessDays: subSpace wins (14)
            assert.equal(resolved.PostCloseAccessDays, 14);
            // StorageAccountID: subSpace has none, parentSpace has 'PARENT-STORAGE-004' so parentSpace wins
            assert.equal(resolved.StorageAccountID, 'PARENT-STORAGE-004');
            // PostCloseAccess: subSpace & parentSpace have none, rootSpace has 'None' so rootSpace wins
            assert.equal(resolved.PostCloseAccess, 'None');
            // Chats.WhoCanStart: none of the spaces set it, type didn't, so app sets 'Anyone'
            assert.equal(resolved.Chats.WhoCanStart, 'Anyone');
            // Agents.ListMode: app sets 'Extend'
            assert.equal(resolved.Agents.ListMode, 'Extend');
        });

        it('enforces SpaceOverridable on space overrides', () => {
            const typeConfig: CollaborationSettings = {
                StorageAccountID: 'TYPE-STORAGE',
                PostCloseAccess: 'ReadOnly',
                SpaceOverridable: ['StorageAccountID'], // Only StorageAccountID is overridable!
            };

            const space: CollaborationSettings = {
                StorageAccountID: 'SPACE-STORAGE',
                PostCloseAccess: 'None', // NOT in SpaceOverridable!
            };

            const resolved = ResolveCollaborationSettings({
                spaces: [space],
                type: typeConfig,
                app: appDefaults,
            });

            // StorageAccountID is overridable, so space wins
            assert.equal(resolved.StorageAccountID, 'SPACE-STORAGE');
            // PostCloseAccess is NOT overridable, so space's 'None' is ignored and type's 'ReadOnly' wins
            assert.equal(resolved.PostCloseAccess, 'ReadOnly');
        });

        it("refuses an app row that leaves a key unset or misspells a value", () => {
            const complete = { PostCloseAccess: 'ReadOnly', PostCloseAccessDays: null, Chats: { WhoCanStart: 'Anyone', AgentReplyMode: 'MentionOrOneToOne', HistoryOnAdd: 'None' }, Agents: { ListMode: 'Extend' } };
            assert.equal(ValidateCollaborationSettings(complete, 'app').valid, true);
            const partial = ValidateCollaborationSettings({ Chats: { WhoCanStart: 'Anyone' } }, 'app');
            assert.equal(partial.valid, false);
            assert.ok(partial.errors.some((e) => /must set PostCloseAccess/.test(e)));
            assert.ok(partial.errors.some((e) => /must set Agents.ListMode/.test(e)));
            const misspelled = ValidateCollaborationSettings({ ...complete, Chats: { ...complete.Chats, WhoCanStart: 'Owner' } }, 'app');
            assert.equal(misspelled.valid, false);
            // A type may leave keys to the app: only the app's row is held to "every key"
            assert.equal(ValidateCollaborationSettings({ Chats: { WhoCanStart: 'Owners' } }, 'type').valid, true);
        });

        it('refuses on a space the keys only a type or the app can hold, and Labels unless the type allows them', () => {
            const type: CollaborationSettings = { SpaceOverridable: ['Chats.WhoCanStart'] };
            for (const key of ['Children', 'SpaceOverridable']) {
                const res = ValidateCollaborationSettings({ [key]: key === 'SpaceOverridable' ? ['Chats'] : {} }, 'space', type);
                assert.equal(res.valid, false, key);
                assert.match(res.errors.join(' '), new RegExp(`${key} cannot be set on a space`));
            }
            assert.equal(ValidateCollaborationSettings({ Labels: { Tabs: { library: 'Papers' } } }, 'space', type).valid, false);
            assert.equal(ValidateCollaborationSettings({ Labels: { Tabs: { library: 'Papers' } } }, 'space', { SpaceOverridable: ['Labels'] }).valid, true);
        });

        it('validates settings and refuses bad values and unknown keys', () => {
            // Bad top-level key
            const res1 = ValidateCollaborationSettings({ FooBar: 'baz' }, 'type');
            assert.equal(res1.valid, false);
            assert.match(res1.errors[0], /Unknown settings key: FooBar/);

            // Bad PostCloseAccess value
            const res2 = ValidateCollaborationSettings({ PostCloseAccess: 'InvalidAccess' }, 'type');
            assert.equal(res2.valid, false);
            assert.match(res2.errors[0], /Invalid PostCloseAccess/);

            // Bad PostCloseAccessDays (negative)
            const res3 = ValidateCollaborationSettings({ PostCloseAccessDays: -5 }, 'type');
            assert.equal(res3.valid, false);
            assert.match(res3.errors[0], /PostCloseAccessDays must be a non-negative integer/);

            // Bad Chats.WhoCanStart
            const res4 = ValidateCollaborationSettings({ Chats: { WhoCanStart: 'Nobody' } }, 'type');
            assert.equal(res4.valid, false);
            assert.match(res4.errors[0], /Invalid Chats.WhoCanStart/);

            // Space-level validation without SpaceOverridable
            const typeConfig: CollaborationSettings = {
                SpaceOverridable: ['Chats.WhoCanStart'],
            };
            const res5 = ValidateCollaborationSettings(
                { StorageAccountID: 'ACC-123' },
                'space',
                typeConfig
            );
            assert.equal(res5.valid, false);
            assert.match(res5.errors[0], /StorageAccountID cannot be overridden by space/);
        });
    });
});

describe('which types a space may contain', () => {
    it('allows any child when the type lists none, exactly the listed ones when it lists some, and none for an empty list', () => {
        assert.equal(refuseChildType(null, 'project', 0), null);
        assert.equal(refuseChildType({}, 'project', 0), null);
        const team = { Children: { AllowedTypeCodes: ['project', 'Working-Group'] } };
        assert.equal(refuseChildType(team, 'PROJECT', 0), null);
        assert.equal(refuseChildType(team, 'working-group', 0), null);
        assert.match(refuseChildType(team, 'cohort', 0) ?? '', /cannot sit under this kind of space/);
        assert.match(refuseChildType({ Children: { AllowedTypeCodes: [] } }, 'project', 0) ?? '', /cannot contain sub-spaces/);
    });

    it('refuses a child beyond MaxOpen, and counts only the open ones passed in', () => {
        const capped = { Children: { MaxOpen: 2 } };
        assert.equal(refuseChildType(capped, 'project', 1), null);
        assert.match(refuseChildType(capped, 'project', 2) ?? '', /most its type allows \(2\)/);
    });
});

describe('tab labels merge without regard to key case', () => {
    it("lets a type's 'library' beat the app's 'Library', and a space's 'WORK' beat the app's 'Work' when the type lets it", () => {
        const app: CollaborationSettings = { PostCloseAccess: 'ReadOnly', PostCloseAccessDays: null, Chats: { WhoCanStart: 'Anyone', AgentReplyMode: 'MentionOrOneToOne', HistoryOnAdd: 'None' }, Agents: { ListMode: 'Extend' }, Labels: { Tabs: { Library: 'Files', Work: 'Tasks' } } };
        const type: CollaborationSettings = { Labels: { Tabs: { library: 'Documents' } }, SpaceOverridable: ['Labels'] };
        const resolved = ResolveCollaborationSettings({ spaces: [{ Labels: { Tabs: { WORK: 'Deliverables' } } }], type, app });
        assert.deepEqual(resolved.Labels?.Tabs, { library: 'Documents', work: 'Deliverables' });
    });
});

describe('a space may set the label keys its type lists', () => {
    it("accepts Labels.Tabs when the type lists 'Labels.Tabs' or 'Labels', refuses it otherwise, and refuses a Labels key nothing reads", () => {
        const tabs = { Labels: { Tabs: { library: 'Papers' } } };
        assert.equal(ValidateCollaborationSettings(tabs, 'space', { SpaceOverridable: ['Labels.Tabs'] }).valid, true);
        assert.equal(ValidateCollaborationSettings(tabs, 'space', { SpaceOverridable: ['Labels'] }).valid, true);
        assert.equal(ValidateCollaborationSettings(tabs, 'space', { SpaceOverridable: ['Chats.WhoCanStart'] }).valid, false);
        const bands = ValidateCollaborationSettings({ Labels: { Bands: {} } }, 'space', { SpaceOverridable: ['Labels'] });
        assert.match(bands.errors.join(' '), /Unknown Labels key: Bands/);
    });
});

describe('a key nothing reads is refused', () => {
    it("refuses Admin, which the app dropped: nothing read it", () => {
        assert.match(ValidateCollaborationSettings({ Admin: { RoleNames: ['Developer'] } }, 'type').errors.join(' '), /Unknown settings key: Admin/);
    });
});

describe("WhoCanStart is 'Anyone' or 'Owners'", () => {
    it("refuses 'Contributors', which meant the same as 'Anyone' and narrowed nothing", () => {
        const result = ValidateCollaborationSettings({ Chats: { WhoCanStart: 'Contributors' } }, 'app');
        assert.equal(result.valid, false);
        assert.match(result.errors.join(' '), /WhoCanStart/);
    });
});

describe('stage 1 configuration: Grants and DataReach', () => {
    it('accepts a well-formed DataReach declaration and a Grants list mode on a type', () => {
        const typeConfig: ISpaceTypeConfiguration = {
            Grants: { Agent: { ListMode: 'Replace' } },
            DataReach: [{ Entity: 'MJ_BizApps_Common: People', Path: 'MemberID.ChapterID', AnchorRole: 'chapter', Band: 'Shared', Fields: ['Name', 'Email'] }],
        };
        assert.deepEqual(validateSpaceTypeConfiguration(typeConfig), { valid: true, errors: [] });
    });

    it('refuses an unknown grant kind, a two-hop path, an empty allow-list and a band outside the two', () => {
        const result = validateSpaceTypeConfiguration({
            Grants: { Widget: { ListMode: 'Extend' }, Query: { ListMode: 'Merge' } },
            DataReach: [{ Entity: 'X', Path: 'A.B.C', AnchorRole: 'chapter', Band: 'Public', Fields: [] }],
        });
        assert.equal(result.valid, false);
        assert.equal(result.errors.length, 5, result.errors.join(' | '));
    });

    it("refuses DataReach on a space, and a space's Grants list mode unless the type lets it", () => {
        const typeConfig: ISpaceTypeConfiguration = { SpaceOverridable: ['Grants.Agent'] };
        assert.equal(validateSpaceConfiguration({ DataReach: [] } as ISpaceConfiguration, typeConfig).valid, false);
        assert.equal(validateSpaceConfiguration({ Grants: { Agent: { ListMode: 'Replace' } } } as ISpaceConfiguration, typeConfig).valid, true);
        assert.equal(validateSpaceConfiguration({ Grants: { Query: { ListMode: 'Replace' } } } as ISpaceConfiguration, typeConfig).valid, false);
    });
});

