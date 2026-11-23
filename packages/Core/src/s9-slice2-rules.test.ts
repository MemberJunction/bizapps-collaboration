import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    buildBoundActionGrantExposure,
    buildBoundActionPromptCatalog,
    enforceBoundActionParameters,
    redactActionParametersForAgent,
    resolveNonLooseningDeliveryPrincipal,
} from './bound-agent-action-grants.ts';
import {
    evaluateApprovalPromotionGate,
    evaluateDraftApprovalTaskVisibility,
} from './approval-promotion.ts';
import {
    evaluateSpaceDocAccess,
    filterVisibleSpaceDocs,
} from './docs-band.ts';
import {
    ResolveCollaborationSettings,
    ValidateCollaborationSettings,
} from './configuration.ts';
import { bindingSource } from './bindings.ts';
import { parseBindingExpression } from './grants.ts';
import type { MemberSnapshot, RoleFlags } from './rules.ts';

const TEAM_PROMOTER_ROLE: RoleFlags = {
    level: 80,
    maxGrantableLevel: 80,
    canInvite: true,
    canPromoteBand: true,
    canSeeTeamBand: true,
    isOwnerRole: true,
    canContribute: true,
};

const TEAM_CONTRIBUTOR_ROLE: RoleFlags = {
    level: 50,
    maxGrantableLevel: 0,
    canInvite: false,
    canPromoteBand: false,
    canSeeTeamBand: true,
    isOwnerRole: false,
    canContribute: true,
};

const SHARED_PARTICIPANT_ROLE: RoleFlags = {
    level: 20,
    maxGrantableLevel: 0,
    canInvite: false,
    canPromoteBand: false,
    canSeeTeamBand: false,
    isOwnerRole: false,
    canContribute: true,
};

function seat(userId: string, role: RoleFlags, band: 'Team' | 'Shared'): MemberSnapshot {
    return {
        spaceId: '10000000-0000-4000-8000-000000000001',
        userId,
        status: 'Active',
        band,
        role,
    };
}

describe('S9 Slice 2 Core Pure Rules', () => {
    it('parses Root/Band/DeliveryPrincipal bindings cleanly', () => {
        assert.deepEqual(parseBindingExpression('RootEntityID', { From: 'Root.EntityID' }), {
            ok: true,
            expression: { From: 'Root.EntityID' },
        });
        assert.deepEqual(parseBindingExpression('DeliveryPrincipalID', { From: 'DeliveryPrincipal.ID' }), {
            ok: true,
            expression: { From: 'DeliveryPrincipal.ID' },
        });
        assert.deepEqual(bindingSource('Band', { From: 'Space.Band' }), {
            ok: true,
            source: { kind: 'band' },
        });
    });

    it('CX-3: redacts hidden bound parameters from agent schemas/prompts and rejects spoofing', () => {
        const allParams = [
            { Name: 'SpaceID', Type: 'Input' as const, ValueType: 'Scalar', IsRequired: true },
            { Name: 'RootRecordID', Type: 'Input' as const, ValueType: 'Scalar', IsRequired: true },
            { Name: 'Band', Type: 'Input' as const, ValueType: 'Scalar', IsRequired: true },
            { Name: 'DeliveryPrincipalID', Type: 'Input' as const, ValueType: 'Scalar', IsRequired: true },
            { Name: 'CustomBoundKey', Type: 'Input' as const, ValueType: 'Scalar', IsRequired: true },
            { Name: 'Title', Type: 'Input' as const, ValueType: 'Scalar', IsRequired: true, Description: 'Draft title' },
            { Name: 'Body', Type: 'Input' as const, ValueType: 'Scalar', IsRequired: true, Description: 'Draft markdown body' },
            { Name: 'DraftID', Type: 'Output' as const, ValueType: 'Scalar', IsRequired: false },
        ];

        const exposure = buildBoundActionGrantExposure(
            {
                GrantID: 'G-1',
                Band: 'Team',
                Label: 'Propose Update',
                Bindings: { CustomBoundKey: { Value: 'server-only-key' } },
            },
            {
                ActionID: 'ACT-1',
                ActionName: 'Collaboration: Propose Audience Output',
                Description: 'Propose an audience communication draft.',
                SupportsAudience: true,
            },
            allParams,
        );

        assert.deepEqual(
            exposure.ExposedParams.map((p) => p.Name),
            ['Title', 'Body'],
        );
        assert.equal('SpaceID' in exposure.ToolSchema.parameters.properties, false);
        assert.equal('DeliveryPrincipalID' in exposure.ToolSchema.parameters.properties, false);
        assert.equal('CustomBoundKey' in exposure.ToolSchema.parameters.properties, false);

        const catalog = buildBoundActionPromptCatalog([exposure]);
        assert.equal(catalog.length, 1);
        assert.deepEqual(
            catalog[0].parameters.map((p) => p.Name),
            ['Title', 'Body'],
        );

        const redactedDirect = redactActionParametersForAgent(allParams, new Set(['spaceid', 'band']));
        assert.equal(redactedDirect.some((p) => p.Name === 'SpaceID'), false);

        const spoofed = enforceBoundActionParameters({
            actionName: exposure.ActionName,
            callerArgs: { Title: 'Hello', Body: 'World', spaceid: 'SPOOFED-SPACE', Band: 'Shared' },
            serverBoundValues: {
                SpaceID: 'SPACE-REAL',
                RootRecordID: 'REC-REAL',
                Band: 'Team',
                DeliveryPrincipalID: 'PRIN-REAL',
                CustomBoundKey: 'server-only-key',
            },
            allParams,
            overridePolicy: 'Reject',
        });
        assert.equal(spoofed.allowed, false);
        if (!spoofed.allowed) {
            assert.equal(spoofed.resultCode, 'SERVER_BOUND_SCOPE_SPOOFING');
            assert.deepEqual(spoofed.spoofedParamNames, ['spaceid', 'Band']);
        }

        const validInjected = enforceBoundActionParameters({
            actionName: exposure.ActionName,
            callerArgs: { Title: 'Hello', Body: 'World' },
            serverBoundValues: {
                SpaceID: 'SPACE-REAL',
                RootRecordID: 'REC-REAL',
                Band: 'Team',
                DeliveryPrincipalID: 'PRIN-REAL',
                CustomBoundKey: 'server-only-key',
            },
            allParams,
        });
        assert.equal(validInjected.allowed, true);
        if (validInjected.allowed) {
            assert.equal(validInjected.injectedParams['SpaceID'], 'SPACE-REAL');
            assert.equal(validInjected.injectedParams['DeliveryPrincipalID'], 'PRIN-REAL');
            assert.equal(validInjected.injectedParams['Title'], 'Hello');
        }
    });

    it('CA-4: enforces non-loosening DeliveryPrincipal configuration and never falls back to caller', () => {
        const p1 = '11111111-1111-4111-8111-111111111111';
        const p2 = '22222222-2222-4222-8222-222222222222';
        const outsider = '33333333-3333-4333-8333-333333333333';

        const badConfig = ValidateCollaborationSettings(
            {
                DeliveryPrincipal: { UserID: p1, AllowFallbackToCaller: true } as { UserID: string; AllowFallbackToCaller: boolean },
            },
            'type',
        );
        assert.equal(badConfig.valid, false);

        const resolved = resolveNonLooseningDeliveryPrincipal([
            { level: 'App', config: { AllowedPrincipalUserIDs: [p1, p2], AllowFallbackToCaller: false } },
            { level: 'SpaceType', config: { UserID: p1 } },
            { level: 'RootSpace', config: { UserID: p2 } },
        ]);
        assert.equal(resolved.ok, true);
        if (resolved.ok) {
            assert.equal(resolved.principalUserId, p2);
            assert.equal(resolved.sourceLevel, 'RootSpace');
        }

        const widened = resolveNonLooseningDeliveryPrincipal([
            { level: 'SpaceType', config: { AllowedPrincipalUserIDs: [p1] } },
            { level: 'RootSpace', config: { UserID: outsider } },
        ]);
        assert.equal(widened.ok, false);

        const missing = resolveNonLooseningDeliveryPrincipal([{ level: 'App', config: { UserID: null } }]);
        assert.equal(missing.ok, false);

        const resolvedSettings = ResolveCollaborationSettings({
            app: {
                Chats: { WhoCanStart: 'Anyone', AgentReplyMode: 'MentionOrOneToOne', HistoryOnAdd: 'None' },
                Agents: { ListMode: 'Extend' },
                DeliveryPrincipal: { AllowedPrincipalUserIDs: [p1, p2] },
            },
            type: {
                SpaceOverridable: ['DeliveryPrincipal'],
                DeliveryPrincipal: { UserID: p1 },
            },
            spaces: [{ DeliveryPrincipal: { UserID: p2 } }],
        });
        assert.equal(resolvedSettings.DeliveryPrincipal?.UserID, p2);
    });

    it('CA-2 & CA-3: enforces Team-band privacy on draft approval tasks and standing decision before promotion', () => {
        const sharedSeat = seat('U-SHARED', SHARED_PARTICIPANT_ROLE, 'Shared');
        const teamPromoterSeat = seat('U-PROMOTER', TEAM_PROMOTER_ROLE, 'Team');
        const teamContributorSeat = seat('U-TEAM', TEAM_CONTRIBUTOR_ROLE, 'Team');

        assert.equal(
            evaluateDraftApprovalTaskVisibility({ callerReach: sharedSeat, itemBand: 'Team', isAdmin: false }).allowed,
            false,
        );
        assert.equal(
            evaluateDraftApprovalTaskVisibility({ callerReach: teamContributorSeat, itemBand: 'Team', isAdmin: false }).allowed,
            true,
        );

        const noDecision = evaluateApprovalPromotionGate({
            callerUserId: 'U-PROMOTER',
            callerReach: teamPromoterSeat,
            isAdmin: false,
            isSpaceOwner: true,
            spaceReadOnly: false,
            itemBand: 'Team',
            taskStatus: 'Open',
            hasApprovingDecision: false,
            hasRejectionDecision: false,
            deliveryPrincipalUserId: 'PRIN-1',
        });
        assert.equal(noDecision.ok, false);

        const approved = evaluateApprovalPromotionGate({
            callerUserId: 'U-PROMOTER',
            callerReach: teamPromoterSeat,
            isAdmin: false,
            isSpaceOwner: true,
            spaceReadOnly: false,
            itemBand: 'Team',
            taskStatus: 'Completed',
            hasApprovingDecision: true,
            hasRejectionDecision: false,
            deliveryPrincipalUserId: 'PRIN-1',
        });
        assert.deepEqual(approved, { ok: true, deliveryPrincipalUserId: 'PRIN-1' });
    });

    it('CX-13: enforces strict Team vs. Shared band isolation for MJ Docs', () => {
        const sharedSeat = seat('U-SHARED', SHARED_PARTICIPANT_ROLE, 'Shared');
        const teamSeat = seat('U-TEAM', TEAM_CONTRIBUTOR_ROLE, 'Team');

        assert.equal(
            evaluateSpaceDocAccess({
                callerReach: sharedSeat,
                docBand: 'Team',
                operation: 'read',
                isAdmin: false,
                spaceReadOnly: false,
            }).allowed,
            false,
        );
        assert.equal(
            evaluateSpaceDocAccess({
                callerReach: sharedSeat,
                docBand: 'Shared',
                operation: 'read',
                isAdmin: false,
                spaceReadOnly: false,
            }).allowed,
            true,
        );
        assert.equal(
            evaluateSpaceDocAccess({
                callerReach: teamSeat,
                docBand: 'Team',
                operation: 'update',
                isAdmin: false,
                spaceReadOnly: false,
            }).allowed,
            true,
        );

        const docs = [
            { id: '1', band: 'Team' as const, title: 'Internal Plan' },
            { id: '2', band: 'Shared' as const, title: 'Client Brief' },
        ];
        assert.deepEqual(
            filterVisibleSpaceDocs(docs, false).map((d) => d.id),
            ['2'],
        );
        assert.deepEqual(
            filterVisibleSpaceDocs(docs, true).map((d) => d.id),
            ['1', '2'],
        );
    });
});
