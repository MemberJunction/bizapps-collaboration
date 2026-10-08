import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    typeSeatsAudience,
    DEFAULT_SPACE_RULES,
    ResolveCollaborationSettings,
    ValidateCollaborationSettings,
    validateSpaceConfiguration,
    refuseChildType,
    validateSpaceTypeConfiguration,
    type CollaborationSettings,
    type ISpaceConfiguration,
    type ISpaceTypeConfiguration,
} from './configuration.ts';

describe('Configuration validation', () => {
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
                Chats: { WhoCanStart: 'Owners', AgentReplyMode: 'Always' },
                SpaceOverridable: [
                    'StorageAccountID',
                    'Chats.WhoCanStart',
                    'Chats.AgentReplyMode',
                ],
            };

            const rootSpace: CollaborationSettings = {
                StorageAccountID: 'ROOT-STORAGE-003',
                Chats: { WhoCanStart: 'Anyone', AgentReplyMode: 'MentionOnly' },
            };

            const parentSpace: CollaborationSettings = {
                StorageAccountID: 'PARENT-STORAGE-004',
            };

            const subSpace: CollaborationSettings = {
                Chats: { AgentReplyMode: 'MentionOrOneToOne' },
            };

            // spaces: [subSpace, parentSpace, rootSpace] (leaf to root)
            const resolved = ResolveCollaborationSettings({
                spaces: [subSpace, parentSpace, rootSpace],
                type: typeConfig,
                app: appDefaults,
            });

            // Chats.AgentReplyMode: subSpace wins
            assert.equal(resolved.Chats.AgentReplyMode, 'MentionOrOneToOne');
            // StorageAccountID: subSpace has none, parentSpace has 'PARENT-STORAGE-004' so parentSpace wins
            assert.equal(resolved.StorageAccountID, 'PARENT-STORAGE-004');
            // Chats.WhoCanStart: subSpace & parentSpace have none, rootSpace has 'Anyone' so rootSpace wins over the type's 'Owners'
            assert.equal(resolved.Chats.WhoCanStart, 'Anyone');
            // Chats.HistoryOnAdd: none of the spaces set it, type didn't, so app sets 'None'
            assert.equal(resolved.Chats.HistoryOnAdd, 'None');
            // Agents.ListMode: app sets 'Extend'
            assert.equal(resolved.Agents.ListMode, 'Extend');
        });

        it('enforces SpaceOverridable on space overrides', () => {
            const typeConfig: CollaborationSettings = {
                StorageAccountID: 'TYPE-STORAGE',
                Chats: { WhoCanStart: 'Owners' },
                SpaceOverridable: ['StorageAccountID'], // Only StorageAccountID is overridable!
            };

            const space: CollaborationSettings = {
                StorageAccountID: 'SPACE-STORAGE',
                Chats: { WhoCanStart: 'Anyone' }, // NOT in SpaceOverridable!
            };

            const resolved = ResolveCollaborationSettings({
                spaces: [space],
                type: typeConfig,
                app: appDefaults,
            });

            // StorageAccountID is overridable, so space wins
            assert.equal(resolved.StorageAccountID, 'SPACE-STORAGE');
            // Chats.WhoCanStart is NOT overridable, so the space's 'Anyone' is ignored and the type's 'Owners' wins
            assert.equal(resolved.Chats.WhoCanStart, 'Owners');
        });

        it("refuses an app row that leaves a key unset or misspells a value", () => {
            const complete = { Chats: { WhoCanStart: 'Anyone', AgentReplyMode: 'MentionOrOneToOne', HistoryOnAdd: 'None' }, Agents: { ListMode: 'Extend' } };
            assert.equal(ValidateCollaborationSettings(complete, 'app').valid, true);
            const partial = ValidateCollaborationSettings({ Chats: { WhoCanStart: 'Anyone' } }, 'app');
            assert.equal(partial.valid, false);
            assert.ok(partial.errors.some((e) => /must set Chats.AgentReplyMode/.test(e)));
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

            // Bad StorageAccountID value
            const res2 = ValidateCollaborationSettings({ StorageAccountID: 5 }, 'type');
            assert.equal(res2.valid, false);
            assert.match(res2.errors[0], /StorageAccountID must be a string or null/);

            // A retired key is unknown now: post-close access is a status
            const res3 = ValidateCollaborationSettings({ PostCloseAccess: 'ReadOnly' }, 'type');
            assert.equal(res3.valid, false);
            assert.match(res3.errors[0], /Unknown settings key: PostCloseAccess/);

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

describe('Seats.Audience (item 142)', () => {
    it('is a type key with two values, refused on a space, and fails closed to StaffAndParticipants when absent', () => {
        assert.equal(ValidateCollaborationSettings({ Seats: { Audience: 'StaffOnly' } }, 'type').valid, true);
        assert.match(ValidateCollaborationSettings({ Seats: { Audience: 'Everyone' } }, 'type').errors[0], /Seats.Audience must be StaffOnly or StaffAndParticipants/);
        assert.match(ValidateCollaborationSettings({ Seats: { Audience: 'StaffOnly' } }, 'space', { SpaceOverridable: ['Seats'] }).errors[0], /Seats cannot be set on a space/);
        assert.equal(typeSeatsAudience({ Seats: { Audience: 'StaffOnly' } }), 'StaffOnly');
        assert.equal(typeSeatsAudience({}), 'StaffAndParticipants');
        assert.equal(typeSeatsAudience(null), 'StaffAndParticipants');
    });
});

describe('tab labels merge without regard to key case', () => {
    it("lets a type's 'library' beat the app's 'Library', and a space's 'WORK' beat the app's 'Work' when the type lets it", () => {
        const app: CollaborationSettings = { Chats: { WhoCanStart: 'Anyone', AgentReplyMode: 'MentionOrOneToOne', HistoryOnAdd: 'None' }, Agents: { ListMode: 'Extend' }, Labels: { Tabs: { Library: 'Files', Work: 'Tasks' } } };
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
        const bands = ValidateCollaborationSettings({ Labels: { Colors: {} } }, 'space', { SpaceOverridable: ['Labels'] });
        assert.match(bands.errors.join(' '), /Unknown Labels key: Colors/);
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


describe('band names come from the type (item 53)', () => {
    const app: CollaborationSettings = { Chats: { WhoCanStart: 'Anyone', AgentReplyMode: 'MentionOrOneToOne', HistoryOnAdd: 'None' }, Agents: { ListMode: 'Extend' } };
    it('a type names the bands; a space may rename them only where the type lists Labels.Bands or Labels; the nearest level wins per band', () => {
        const type: CollaborationSettings = { Labels: { Bands: { Team: 'Staff', Shared: 'Members' } }, SpaceOverridable: ['Labels.Bands'] };
        const resolved = ResolveCollaborationSettings({ app, type, spaces: [{ Labels: { Bands: { Shared: 'Chapter members' } } }] });
        assert.deepEqual(resolved.Labels?.Bands, { Team: 'Staff', Shared: 'Chapter members' });
        const closed = ResolveCollaborationSettings({ app, type: { Labels: { Bands: { Team: 'Staff' } } }, spaces: [{ Labels: { Bands: { Shared: 'Chapter members' } } }] });
        assert.deepEqual(closed.Labels?.Bands, { Team: 'Staff' }, "a space's names are not read where the type does not allow them");
        assert.equal(ResolveCollaborationSettings({ app, type: null, spaces: [] }).Labels, undefined, 'no names configured: the app\'s words stand');
    });
    it('validation accepts the two bands with non-empty names and refuses anything else, and a space needs the type\'s leave', () => {
        assert.equal(ValidateCollaborationSettings({ Labels: { Bands: { Team: 'Staff' } } }, 'type').valid, true);
        assert.match(ValidateCollaborationSettings({ Labels: { Bands: { Guests: 'x' } } }, 'type').errors.join(' '), /the bands are Team and Shared/);
        assert.match(ValidateCollaborationSettings({ Labels: { Bands: { Team: '' } } }, 'type').errors.join(' '), /non-empty string/);
        assert.match(ValidateCollaborationSettings({ Labels: { Bands: { Team: 'Staff' } } }, 'space', { SpaceOverridable: ['Labels.Tabs'] }).errors.join(' '), /Labels.Bands cannot be overridden/);
        assert.equal(ValidateCollaborationSettings({ Labels: { Bands: { Team: 'Staff' } } }, 'space', { SpaceOverridable: ['Labels'] }).valid, true);
    });
});

describe("ValidateCollaborationSettings knows stage 1's keys", () => {
    it('accepts Grants and DataReach on a type, refuses DataReach on a space, and a space\'s Grants list mode without the type\'s leave', () => {
        const reach = [{ Entity: 'X: Members', Path: 'ChapterID', AnchorRole: 'chapter', Band: 'Shared', Fields: ['Name'] }];
        assert.equal(ValidateCollaborationSettings({ Grants: { Action: { ListMode: 'Replace' } }, DataReach: reach }, 'type').valid, true);
        assert.match(ValidateCollaborationSettings({ Grants: { Widget: { ListMode: 'Replace' } } }, 'type').errors.join(' '), /not a grant kind/);
        assert.match(ValidateCollaborationSettings({ DataReach: [{ Entity: 'X', Path: 'A.B.C', AnchorRole: 'r', Band: 'Shared', Fields: ['F'] }] }, 'type').errors.join(' '), /DataReach\[0\]/);
        assert.match(ValidateCollaborationSettings({ DataReach: reach }, 'space', { SpaceOverridable: ['DataReach'] }).errors.join(' '), /DataReach cannot be set on a space/);
        assert.match(ValidateCollaborationSettings({ Grants: { Action: { ListMode: 'Replace' } } }, 'space', {}).errors.join(' '), /Grants.Action cannot be overridden/);
        assert.equal(ValidateCollaborationSettings({ Grants: { Action: { ListMode: 'Replace' } } }, 'space', { SpaceOverridable: ['Grants.Action'] }).valid, true);
    });
});
