import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    DEFAULT_SPACE_RULES,
    ResolveSpaceRules,
    validateSpaceConfiguration,
    validateSpaceTypeConfiguration,
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
                WhoCanStart: 'Contributors',
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
        assert.equal(rules.Chats.WhoCanStart, 'Contributors');
        assert.equal(rules.Chats.AgentReplyMode, 'Always');
        assert.equal(rules.Chats.HistoryOnAdd, 'Since');
        assert.equal(rules.Agents.ListMode, 'Replace');
        assert.deepEqual(rules.Extensions.audit, { RetentionDays: 90 });
    });

    it('applies space overrides only for keys in SpaceOverridable', () => {
        const typeConfig: ISpaceTypeConfiguration = {
            Chats: {
                WhoCanStart: 'Contributors',
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
});
