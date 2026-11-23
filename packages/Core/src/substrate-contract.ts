/**
 * CX-10: Collaboration Substrate Contract & Reusable Contract-Test Bundle.
 *
 * Defines the strongly-typed substrate contract covering:
 *  - CX-1: Unified subtyped EnsureSpaceForRecord with owner seat, sealed default,
 *          and distributed race-winner idempotency.
 *  - CS-3: Rule-based chat write permission evaluation (fail-closed, non-loosening).
 *  - CX-4: Deterministic Scoped Prompt Parts hierarchy (`SpaceType -> Root -> Space`).
 *
 * Extension points (e.g. `contractVersion`, `capabilities`) are designed for additive
 * Slice 2 evolution without breaking Slice 1 contract consumers.
 */

import type { ChatWriteOperation, ChatWriteVerdict } from './chat-write-rules.ts';
import type { Band } from './rules.ts';
import type {
    ScopedPromptPartInput,
    ScopedPromptResolutionResult,
    ScopedPromptSecondaryValue,
} from './scoped-prompt-parts.ts';

export const SUBSTRATE_CONTRACT_VERSION = '1.0.0' as const;

export type SpaceDetailValue = string | number | boolean | Date | null;
export type SpaceDetailsMap = Record<string, SpaceDetailValue>;

export interface SubstrateEnsureSpaceRequest {
    typeCode: string;
    entityName: string;
    recordId: string;
    spaceName?: string;
    anchorRole?: string;
    inheritsMembership?: boolean;
    details?: SpaceDetailsMap | null;
    callerUserId: string;
}

export interface SubstrateEnsureSpaceResult {
    spaceId: string;
    spaceTypeId: string;
    inheritsMembership: boolean;
    ownerUserId: string;
    ownerSeatAssigned: boolean;
    subtypeEntityName: string | null;
    anchorRole: string;
    created: boolean;
}

export interface SubstrateChatWriteRequest {
    callerUserId: string;
    operation: ChatWriteOperation;
    spaceId: string;
    conversationId: string;
    detailAuthorUserId?: string | null;
    detailRole?: string | null;
    isServerAuthoredReply?: boolean;
}

export interface SubstrateScopedPromptRequest {
    spaceTypeId: string;
    rootSpaceId: string;
    spaceId: string;
    promptId?: string | null;
    audience?: Band;
    secondaryScopes?: Record<string, ScopedPromptSecondaryValue> | null;
    candidates?: readonly ScopedPromptPartInput[];
}

export interface CollaborationSubstrateContract {
    readonly contractVersion: string;
    readonly capabilities?: readonly string[];
    ensureSpaceForRecord(request: SubstrateEnsureSpaceRequest): Promise<SubstrateEnsureSpaceResult>;
    evaluateChatWritePermission(request: SubstrateChatWriteRequest): Promise<ChatWriteVerdict>;
    resolveScopedPromptParts(request: SubstrateScopedPromptRequest): Promise<ScopedPromptResolutionResult>;
}

export type SubstrateContractScenarioId =
    | 'CX1-01-subtyped-sealed-owner'
    | 'CX1-02-idempotent-defaults'
    | 'CX1-03-concurrent-race-winner'
    | 'CS3-01-seat-sealed-role-rules'
    | 'CS3-02-band-and-status-isolation'
    | 'CS3-03-non-loosening-and-fail-closed'
    | 'CX4-01-hierarchy-override-append'
    | 'CX4-02-zero-cross-scope-leakage';

export interface SubstrateContractScenarioDescriptor {
    id: SubstrateContractScenarioId;
    capability: 'CX-1' | 'CS-3' | 'CX-4';
    title: string;
}

export const COLLABORATION_SUBSTRATE_CONTRACT_SCENARIOS: readonly SubstrateContractScenarioDescriptor[] = [
    {
        id: 'CX1-01-subtyped-sealed-owner',
        capability: 'CX-1',
        title: 'Creates subtyped space with owner seat and sealed-by-default posture',
    },
    {
        id: 'CX1-02-idempotent-defaults',
        capability: 'CX-1',
        title: 'Returns identical space idempotently and honors backward-compatible defaults',
    },
    {
        id: 'CX1-03-concurrent-race-winner',
        capability: 'CX-1',
        title: 'Converges parallel concurrent invocations onto single winning space without duplicates',
    },
    {
        id: 'CS3-01-seat-sealed-role-rules',
        capability: 'CS-3',
        title: 'Enforces active seat, sealed boundary, and role contribution permissions',
    },
    {
        id: 'CS3-02-band-and-status-isolation',
        capability: 'CS-3',
        title: 'Enforces Team/Shared band rules, Assistant ownership, and ReadOnly/Archived denial',
    },
    {
        id: 'CS3-03-non-loosening-and-fail-closed',
        capability: 'CS-3',
        title: 'Enforces non-loosening write policies and fail-closed defaults on unknown inputs',
    },
    {
        id: 'CX4-01-hierarchy-override-append',
        capability: 'CX-4',
        title: 'Resolves SpaceType -> Root -> Space deterministically with Override and Append semantics',
    },
    {
        id: 'CX4-02-zero-cross-scope-leakage',
        capability: 'CX-4',
        title: 'Blocks cross-root, cross-space, cross-type, Archived, and Team-into-Shared prompt leakage',
    },
];

export interface SubstrateContractTestContext {
    /** Fixed deterministic UUIDs provided to the substrate fixture factory. */
    ids: {
        ownerUserId: string;
        teamContributorUserId: string;
        sharedContributorUserId: string;
        guestReadOnlyUserId: string;
        outsiderUserId: string;
        subtypedTypeCode: string;
        subtypedTypeId: string;
        subtypeEntityName: string;
        plainTypeCode: string;
        plainTypeId: string;
        anchorEntityName: string;
        primaryRecordId: string;
        concurrentRecordId: string;
        explicitInheritRecordId: string;
        openGeneralSpaceId: string;
        openGeneralConversationId: string;
        sealedChildSpaceId: string;
        sealedChildConversationId: string;
        privateChatSpaceId: string;
        privateChatConversationId: string;
        assistantChatSpaceId: string;
        assistantChatConversationId: string;
        closedSpaceId: string;
        closedSpaceConversationId: string;
        ownersOnlyPolicySpaceId: string;
        ownersOnlyPolicyConversationId: string;
        unknownKindConversationId: string;
        rootSpaceAId: string;
        childSpaceAId: string;
        rootSpaceBId: string;
        childSpaceBId: string;
        otherTypeId: string;
    };
}

export const DEFAULT_SUBSTRATE_CONTRACT_FIXTURE_IDS: SubstrateContractTestContext['ids'] = {
    ownerUserId: '10000000-0000-4000-8000-000000000001',
    teamContributorUserId: '10000000-0000-4000-8000-000000000002',
    sharedContributorUserId: '10000000-0000-4000-8000-000000000003',
    guestReadOnlyUserId: '10000000-0000-4000-8000-000000000004',
    outsiderUserId: '10000000-0000-4000-8000-000000000005',
    subtypedTypeCode: 'contract-subtyped',
    subtypedTypeId: '20000000-0000-4000-8000-000000000001',
    subtypeEntityName: 'MJ_BizApps_Collaboration: Subtyped Spaces',
    plainTypeCode: 'contract-plain',
    plainTypeId: '20000000-0000-4000-8000-000000000002',
    anchorEntityName: 'MJ: Records',
    primaryRecordId: '30000000-0000-4000-8000-000000000001',
    concurrentRecordId: '30000000-0000-4000-8000-000000000002',
    explicitInheritRecordId: '30000000-0000-4000-8000-000000000003',
    openGeneralSpaceId: '40000000-0000-4000-8000-000000000001',
    openGeneralConversationId: '50000000-0000-4000-8000-000000000001',
    sealedChildSpaceId: '40000000-0000-4000-8000-000000000002',
    sealedChildConversationId: '50000000-0000-4000-8000-000000000002',
    privateChatSpaceId: '40000000-0000-4000-8000-000000000003',
    privateChatConversationId: '50000000-0000-4000-8000-000000000003',
    assistantChatSpaceId: '40000000-0000-4000-8000-000000000004',
    assistantChatConversationId: '50000000-0000-4000-8000-000000000004',
    closedSpaceId: '40000000-0000-4000-8000-000000000005',
    closedSpaceConversationId: '50000000-0000-4000-8000-000000000005',
    ownersOnlyPolicySpaceId: '40000000-0000-4000-8000-000000000006',
    ownersOnlyPolicyConversationId: '50000000-0000-4000-8000-000000000006',
    unknownKindConversationId: '50000000-0000-4000-8000-000000000007',
    rootSpaceAId: '60000000-0000-4000-8000-000000000001',
    childSpaceAId: '60000000-0000-4000-8000-000000000002',
    rootSpaceBId: '60000000-0000-4000-8000-000000000003',
    childSpaceBId: '60000000-0000-4000-8000-000000000004',
    otherTypeId: '20000000-0000-4000-8000-000000000099',
};

export type SubstrateContractFactory = (
    context: SubstrateContractTestContext,
) => CollaborationSubstrateContract | Promise<CollaborationSubstrateContract>;

export interface SubstrateContractAssertionResult {
    name: string;
    passed: boolean;
    errorMessage?: string;
}

export interface SubstrateContractScenarioResult {
    id: SubstrateContractScenarioId;
    capability: 'CX-1' | 'CS-3' | 'CX-4';
    title: string;
    passed: boolean;
    assertions: readonly SubstrateContractAssertionResult[];
    errorMessage?: string;
}

export interface SubstrateContractSuiteReport {
    contractVersion: string;
    passed: boolean;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    results: readonly SubstrateContractScenarioResult[];
}

class ContractAssertionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ContractAssertionError';
    }
}

function assertContract(condition: boolean, message: string): void {
    if (!condition) {
        throw new ContractAssertionError(message);
    }
}

function norm(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

export function buildContractPromptFixtures(ids: SubstrateContractTestContext['ids']): ScopedPromptPartInput[] {
    return [
        {
            ID: 'p-type-persona',
            Name: 'Persona',
            Role: 'System',
            Text: 'Type-level persona',
            Sort: 10,
            Priority: 10,
            MergeBehavior: 'Override',
            Status: 'Active',
            ScopeLevel: 'SpaceType',
            ScopeRecordID: ids.subtypedTypeId,
            Band: 'Shared',
        },
        {
            ID: 'p-root-persona',
            Name: 'Persona',
            Role: 'System',
            Text: 'Root-level persona',
            Sort: 10,
            Priority: 10,
            MergeBehavior: 'Override',
            Status: 'Active',
            ScopeLevel: 'Root',
            ScopeRecordID: ids.rootSpaceAId,
            Band: 'Shared',
        },
        {
            ID: 'p-space-persona',
            Name: 'Persona',
            Role: 'System',
            Text: 'Space-level persona',
            Sort: 10,
            Priority: 10,
            MergeBehavior: 'Override',
            Status: 'Active',
            ScopeLevel: 'Space',
            ScopeRecordID: ids.childSpaceAId,
            Band: 'Shared',
        },
        {
            ID: 'p-type-rules',
            Name: 'Guardrails',
            Role: 'System',
            Text: 'Type guardrail',
            Sort: 20,
            Priority: 5,
            MergeBehavior: 'Append',
            Status: 'Active',
            ScopeLevel: 'SpaceType',
            ScopeRecordID: ids.subtypedTypeId,
            Band: 'Shared',
        },
        {
            ID: 'p-root-rules',
            Name: 'Guardrails',
            Role: 'System',
            Text: 'Root guardrail',
            Sort: 20,
            Priority: 5,
            MergeBehavior: 'Append',
            Status: 'Active',
            ScopeLevel: 'Root',
            ScopeRecordID: ids.rootSpaceAId,
            Band: 'Shared',
        },
        {
            ID: 'p-space-rules',
            Name: 'Guardrails',
            Role: 'System',
            Text: 'Space guardrail',
            Sort: 20,
            Priority: 5,
            MergeBehavior: 'Append',
            Status: 'Active',
            ScopeLevel: 'Space',
            ScopeRecordID: ids.childSpaceAId,
            Band: 'Shared',
        },
        {
            ID: 'p-team-only',
            Name: 'InternalGuidance',
            Role: 'System',
            Text: 'Team internal guidance',
            Sort: 30,
            Priority: 1,
            MergeBehavior: 'Override',
            Status: 'Active',
            ScopeLevel: 'Space',
            ScopeRecordID: ids.childSpaceAId,
            Band: 'Team',
        },
        {
            ID: 'p-archived',
            Name: 'RetiredPart',
            Role: 'System',
            Text: 'Should never appear (archived)',
            Sort: 40,
            Priority: 1,
            MergeBehavior: 'Override',
            Status: 'Archived',
            ScopeLevel: 'Space',
            ScopeRecordID: ids.childSpaceAId,
            Band: 'Shared',
        },
        {
            ID: 'p-other-root',
            Name: 'OtherRootLeak',
            Role: 'System',
            Text: 'Unrelated Root B leakage',
            Sort: 5,
            Priority: 99,
            MergeBehavior: 'Override',
            Status: 'Active',
            ScopeLevel: 'Root',
            ScopeRecordID: ids.rootSpaceBId,
            Band: 'Shared',
        },
        {
            ID: 'p-other-space',
            Name: 'OtherSpaceLeak',
            Role: 'System',
            Text: 'Unrelated Space B leakage',
            Sort: 5,
            Priority: 99,
            MergeBehavior: 'Override',
            Status: 'Active',
            ScopeLevel: 'Space',
            ScopeRecordID: ids.childSpaceBId,
            Band: 'Shared',
        },
        {
            ID: 'p-other-type',
            Name: 'OtherTypeLeak',
            Role: 'System',
            Text: 'Unrelated SpaceType leakage',
            Sort: 5,
            Priority: 99,
            MergeBehavior: 'Override',
            Status: 'Active',
            ScopeLevel: 'SpaceType',
            ScopeRecordID: ids.otherTypeId,
            Band: 'Shared',
        },
    ];
}

async function runScenario(
    descriptor: SubstrateContractScenarioDescriptor,
    substrate: CollaborationSubstrateContract,
    context: SubstrateContractTestContext,
): Promise<SubstrateContractScenarioResult> {
    const assertions: SubstrateContractAssertionResult[] = [];
    const { ids } = context;

    const check = async (name: string, fn: () => Promise<void> | void): Promise<void> => {
        try {
            await fn();
            assertions.push({ name, passed: true });
        } catch (err) {
            assertions.push({
                name,
                passed: false,
                errorMessage: err instanceof Error ? err.message : String(err),
            });
            throw err;
        }
    };

    try {
        switch (descriptor.id) {
            case 'CX1-01-subtyped-sealed-owner': {
                const created = await substrate.ensureSpaceForRecord({
                    typeCode: ids.subtypedTypeCode,
                    entityName: ids.anchorEntityName,
                    recordId: ids.primaryRecordId,
                    callerUserId: ids.ownerUserId,
                });
                await check('creates subtyped space with sealed posture and owner seat', () => {
                    assertContract(Boolean(created.spaceId), 'spaceId must be non-empty');
                    assertContract(created.inheritsMembership === false, 'new spaces must default to sealed (inheritsMembership === false)');
                    assertContract(created.ownerSeatAssigned === true, 'owner seat must be assigned');
                    assertContract(norm(created.ownerUserId) === norm(ids.ownerUserId), 'ownerUserId must match caller');
                    assertContract(
                        norm(created.subtypeEntityName) === norm(ids.subtypeEntityName),
                        `expected subtypeEntityName "${ids.subtypeEntityName}", got "${String(created.subtypeEntityName)}"`,
                    );
                });
                break;
            }
            case 'CX1-02-idempotent-defaults': {
                const first = await substrate.ensureSpaceForRecord({
                    typeCode: ids.subtypedTypeCode,
                    entityName: ids.anchorEntityName,
                    recordId: ids.primaryRecordId,
                    callerUserId: ids.ownerUserId,
                });
                const second = await substrate.ensureSpaceForRecord({
                    typeCode: ids.subtypedTypeCode,
                    entityName: ids.anchorEntityName,
                    recordId: ids.primaryRecordId,
                    callerUserId: ids.ownerUserId,
                });
                const explicitInherit = await substrate.ensureSpaceForRecord({
                    typeCode: ids.plainTypeCode,
                    entityName: ids.anchorEntityName,
                    recordId: ids.explicitInheritRecordId,
                    inheritsMembership: true,
                    callerUserId: ids.ownerUserId,
                });
                await check('returns identical space on repeat call and preserves explicit inheritsMembership', () => {
                    assertContract(norm(first.spaceId) === norm(second.spaceId), 'repeat EnsureSpaceForRecord must return identical spaceId');
                    assertContract(first.anchorRole === 'primary', 'default anchorRole must be primary');
                    assertContract(explicitInherit.inheritsMembership === true, 'explicit inheritsMembership=true must be honored');
                });
                break;
            }
            case 'CX1-03-concurrent-race-winner': {
                const calls = Array.from({ length: 8 }, () =>
                    substrate.ensureSpaceForRecord({
                        typeCode: ids.subtypedTypeCode,
                        entityName: ids.anchorEntityName,
                        recordId: ids.concurrentRecordId,
                        callerUserId: ids.ownerUserId,
                    }),
                );
                const results = await Promise.all(calls);
                await check('all concurrent callers converge on identical winning spaceId', () => {
                    assertContract(results.length === 8, 'all 8 concurrent calls must resolve');
                    const winnerIds = new Set(results.map((r) => norm(r.spaceId)));
                    assertContract(winnerIds.size === 1, `expected exactly 1 winning spaceId, got ${winnerIds.size}`);
                    assertContract(results.every((r) => r.ownerSeatAssigned), 'every resolved result must reflect owner seat assigned');
                });
                break;
            }
            case 'CS3-01-seat-sealed-role-rules': {
                const allowed = await substrate.evaluateChatWritePermission({
                    callerUserId: ids.sharedContributorUserId,
                    operation: 'create',
                    spaceId: ids.openGeneralSpaceId,
                    conversationId: ids.openGeneralConversationId,
                });
                const guestDenied = await substrate.evaluateChatWritePermission({
                    callerUserId: ids.guestReadOnlyUserId,
                    operation: 'create',
                    spaceId: ids.openGeneralSpaceId,
                    conversationId: ids.openGeneralConversationId,
                });
                const outsiderDenied = await substrate.evaluateChatWritePermission({
                    callerUserId: ids.outsiderUserId,
                    operation: 'create',
                    spaceId: ids.openGeneralSpaceId,
                    conversationId: ids.openGeneralConversationId,
                });
                const sealedDenied = await substrate.evaluateChatWritePermission({
                    callerUserId: ids.sharedContributorUserId,
                    operation: 'create',
                    spaceId: ids.sealedChildSpaceId,
                    conversationId: ids.sealedChildConversationId,
                });
                await check('allows contributor, denies guest/outsider/unseated-in-sealed-child', () => {
                    assertContract(allowed.Decision === 'Allow', `contributor should be allowed, got ${allowed.Decision}`);
                    assertContract(guestDenied.Decision === 'Deny', 'read-only guest must be denied');
                    assertContract(outsiderDenied.Decision === 'Deny', 'unseated outsider must be denied');
                    assertContract(sealedDenied.Decision === 'Deny', 'parent-only member must be denied on sealed child space');
                });
                break;
            }
            case 'CS3-02-band-and-status-isolation': {
                const sharedInPrivate = await substrate.evaluateChatWritePermission({
                    callerUserId: ids.sharedContributorUserId,
                    operation: 'create',
                    spaceId: ids.privateChatSpaceId,
                    conversationId: ids.privateChatConversationId,
                });
                const teamInPrivate = await substrate.evaluateChatWritePermission({
                    callerUserId: ids.teamContributorUserId,
                    operation: 'create',
                    spaceId: ids.privateChatSpaceId,
                    conversationId: ids.privateChatConversationId,
                });
                const nonOwnerAssistant = await substrate.evaluateChatWritePermission({
                    callerUserId: ids.teamContributorUserId,
                    operation: 'create',
                    spaceId: ids.assistantChatSpaceId,
                    conversationId: ids.assistantChatConversationId,
                });
                const closedSpaceWrite = await substrate.evaluateChatWritePermission({
                    callerUserId: ids.ownerUserId,
                    operation: 'create',
                    spaceId: ids.closedSpaceId,
                    conversationId: ids.closedSpaceConversationId,
                });
                await check('enforces Private Team-band, Assistant ownership, and Closed ReadOnly refusal', () => {
                    assertContract(sharedInPrivate.Decision === 'Deny', 'Shared member must be denied in Private chat');
                    assertContract(teamInPrivate.Decision === 'Allow', 'Team contributor must be allowed in Private chat');
                    assertContract(nonOwnerAssistant.Decision === 'Deny', 'non-owner must be denied in Assistant chat');
                    assertContract(closedSpaceWrite.Decision === 'Deny', 'writes to closed space must be denied even for owner');
                });
                break;
            }
            case 'CS3-03-non-loosening-and-fail-closed': {
                const nonOwnerOnOwnersPolicy = await substrate.evaluateChatWritePermission({
                    callerUserId: ids.teamContributorUserId,
                    operation: 'create',
                    spaceId: ids.ownersOnlyPolicySpaceId,
                    conversationId: ids.ownersOnlyPolicyConversationId,
                });
                const ownerOnOwnersPolicy = await substrate.evaluateChatWritePermission({
                    callerUserId: ids.ownerUserId,
                    operation: 'create',
                    spaceId: ids.ownersOnlyPolicySpaceId,
                    conversationId: ids.ownersOnlyPolicyConversationId,
                });
                const unknownKind = await substrate.evaluateChatWritePermission({
                    callerUserId: ids.ownerUserId,
                    operation: 'create',
                    spaceId: ids.openGeneralSpaceId,
                    conversationId: ids.unknownKindConversationId,
                });
                await check('enforces non-loosening Owners policy and fail-closed on unknown kind', () => {
                    assertContract(nonOwnerOnOwnersPolicy.Decision === 'Deny', 'non-loosening Owners policy must deny non-owner');
                    assertContract(ownerOnOwnersPolicy.Decision === 'Allow', 'owner must be allowed under Owners policy');
                    assertContract(unknownKind.Decision === 'Deny', 'unknown chat kind must fail closed to Deny');
                });
                break;
            }
            case 'CX4-01-hierarchy-override-append': {
                const candidates = buildContractPromptFixtures(ids);
                const resolved = await substrate.resolveScopedPromptParts({
                    spaceTypeId: ids.subtypedTypeId,
                    rootSpaceId: ids.rootSpaceAId,
                    spaceId: ids.childSpaceAId,
                    audience: 'Shared',
                    candidates,
                });
                await check('resolves Override at Space and Append in SpaceType -> Root -> Space order', () => {
                    const persona = resolved.parts.filter((p) => p.Name === 'Persona');
                    assertContract(persona.length === 1 && persona[0].Text === 'Space-level persona', 'Space-level Override must win over Root and SpaceType');
                    const guardrails = resolved.parts.filter((p) => p.Name === 'Guardrails').map((p) => p.Text);
                    assertContract(
                        JSON.stringify(guardrails) === JSON.stringify(['Type guardrail', 'Root guardrail', 'Space guardrail']),
                        `Append must preserve SpaceType -> Root -> Space order, got ${JSON.stringify(guardrails)}`,
                    );
                });
                break;
            }
            case 'CX4-02-zero-cross-scope-leakage': {
                const candidates = buildContractPromptFixtures(ids);
                const sharedResolved = await substrate.resolveScopedPromptParts({
                    spaceTypeId: ids.subtypedTypeId,
                    rootSpaceId: ids.rootSpaceAId,
                    spaceId: ids.childSpaceAId,
                    audience: 'Shared',
                    candidates,
                });
                const teamResolved = await substrate.resolveScopedPromptParts({
                    spaceTypeId: ids.subtypedTypeId,
                    rootSpaceId: ids.rootSpaceAId,
                    spaceId: ids.childSpaceAId,
                    audience: 'Team',
                    candidates,
                });
                await check('excludes unrelated SpaceType, Root, Space, Archived, and Team-into-Shared parts', () => {
                    const sharedNames = new Set(sharedResolved.parts.map((p) => p.Name));
                    assertContract(!sharedNames.has('OtherRootLeak'), 'must not leak unrelated Root parts');
                    assertContract(!sharedNames.has('OtherSpaceLeak'), 'must not leak unrelated Space parts');
                    assertContract(!sharedNames.has('OtherTypeLeak'), 'must not leak unrelated SpaceType parts');
                    assertContract(!sharedNames.has('RetiredPart'), 'must exclude Archived parts');
                    assertContract(!sharedNames.has('InternalGuidance'), 'must exclude Team parts when audience is Shared');
                    assertContract(teamResolved.parts.some((p) => p.Name === 'InternalGuidance'), 'Team audience must include Team parts');
                });
                break;
            }
        }

        return {
            id: descriptor.id,
            capability: descriptor.capability,
            title: descriptor.title,
            passed: true,
            assertions,
        };
    } catch (error) {
        return {
            id: descriptor.id,
            capability: descriptor.capability,
            title: descriptor.title,
            passed: false,
            assertions,
            errorMessage: error instanceof Error ? error.message : String(error),
        };
    }
}

/**
 * Executes the full CX-10 substrate contract-test bundle against a compliant implementation.
 */
export async function runCollaborationSubstrateContractTests(
    factory: SubstrateContractFactory,
): Promise<SubstrateContractSuiteReport> {
    const context: SubstrateContractTestContext = {
        ids: { ...DEFAULT_SUBSTRATE_CONTRACT_FIXTURE_IDS },
    };
    const substrate = await factory(context);
    const results: SubstrateContractScenarioResult[] = [];

    for (const descriptor of COLLABORATION_SUBSTRATE_CONTRACT_SCENARIOS) {
        const res = await runScenario(descriptor, substrate, context);
        results.push(res);
    }

    const passedScenarios = results.filter((r) => r.passed).length;
    const failedScenarios = results.length - passedScenarios;

    return {
        contractVersion: SUBSTRATE_CONTRACT_VERSION,
        passed: failedScenarios === 0,
        totalScenarios: results.length,
        passedScenarios,
        failedScenarios,
        results,
    };
}

/**
 * Throws a detailed Error if any scenario in a `SubstrateContractSuiteReport` failed.
 */
export function assertSubstrateContractPassed(report: SubstrateContractSuiteReport): void {
    if (report.passed) {
        return;
    }
    const failures = report.results
        .filter((r) => !r.passed)
        .map((r) => `[${r.id}] ${r.title}: ${r.errorMessage ?? 'failed'}`)
        .join('; ');
    throw new Error(`Substrate contract v${report.contractVersion} failed (${report.failedScenarios}/${report.totalScenarios}): ${failures}`);
}

/**
 * Registers individual scenarios into any standard test runner (`node:test` or `vitest`).
 */
export function registerCollaborationSubstrateContractTests(
    suiteFn: (name: string, fn: () => void) => void,
    testFn: (name: string, fn: () => Promise<void> | void) => void,
    factory: SubstrateContractFactory,
): void {
    suiteFn(`Collaboration Substrate Contract v${SUBSTRATE_CONTRACT_VERSION} (CX-10)`, () => {
        for (const descriptor of COLLABORATION_SUBSTRATE_CONTRACT_SCENARIOS) {
            testFn(`${descriptor.id}: ${descriptor.title}`, async () => {
                const context: SubstrateContractTestContext = {
                    ids: { ...DEFAULT_SUBSTRATE_CONTRACT_FIXTURE_IDS },
                };
                const substrate = await factory(context);
                const res = await runScenario(descriptor, substrate, context);
                if (!res.passed) {
                    throw new Error(res.errorMessage ?? `Scenario ${descriptor.id} failed`);
                }
            });
        }
    });
}
