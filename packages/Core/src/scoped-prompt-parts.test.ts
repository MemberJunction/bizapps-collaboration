import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveScopedPromptParts, type ScopedPromptPartInput } from './scoped-prompt-parts.ts';

const TYPE_A = '20000000-0000-4000-8000-000000000001';
const TYPE_B = '20000000-0000-4000-8000-000000000002';
const ROOT_A = '40000000-0000-4000-8000-000000000001';
const SPACE_A1 = '40000000-0000-4000-8000-000000000002';
const ROOT_B = '40000000-0000-4000-8000-000000000003';
const SPACE_B1 = '40000000-0000-4000-8000-000000000004';

function part(over: Partial<ScopedPromptPartInput> & { Name: string; Text: string; ScopeLevel: ScopedPromptPartInput['ScopeLevel']; ScopeRecordID: string }): ScopedPromptPartInput {
    return {
        ID: `id-${over.ScopeLevel}-${over.Name}-${over.Sort ?? 0}`,
        Role: 'System',
        Sort: 0,
        Priority: 0,
        MergeBehavior: 'Override',
        Status: 'Active',
        Band: 'Shared',
        ...over,
    };
}

describe('CX-4 Scoped Prompt Parts hierarchy', () => {
    it('resolves Override down SpaceType -> Root -> Space with Space winning', () => {
        const candidates: ScopedPromptPartInput[] = [
            part({ Name: 'Persona', Text: 'Type Persona', ScopeLevel: 'SpaceType', ScopeRecordID: TYPE_A, Sort: 10 }),
            part({ Name: 'Persona', Text: 'Root Persona', ScopeLevel: 'Root', ScopeRecordID: ROOT_A, Sort: 10 }),
            part({ Name: 'Persona', Text: 'Space Persona', ScopeLevel: 'Space', ScopeRecordID: SPACE_A1, Sort: 10 }),
        ];

        const atSpace = resolveScopedPromptParts(candidates, { spaceTypeId: TYPE_A, rootSpaceId: ROOT_A, spaceId: SPACE_A1, audience: 'Shared' });
        assert.deepEqual(atSpace.instructions, ['Space Persona']);

        const atRoot = resolveScopedPromptParts(candidates, { spaceTypeId: TYPE_A, rootSpaceId: ROOT_A, spaceId: ROOT_A, audience: 'Shared' });
        assert.deepEqual(atRoot.instructions, ['Root Persona']);
    });

    it('resolves Append deterministically in SpaceType -> Root -> Space order and deduplicates identical entries', () => {
        const candidates: ScopedPromptPartInput[] = [
            part({ Name: 'Policy', Text: 'Space Policy', ScopeLevel: 'Space', ScopeRecordID: SPACE_A1, MergeBehavior: 'Append', Sort: 20 }),
            part({ Name: 'Policy', Text: 'Type Policy', ScopeLevel: 'SpaceType', ScopeRecordID: TYPE_A, MergeBehavior: 'Append', Sort: 20 }),
            part({ Name: 'Policy', Text: 'Root Policy', ScopeLevel: 'Root', ScopeRecordID: ROOT_A, MergeBehavior: 'Append', Sort: 20 }),
            part({ ID: 'dup-root', Name: 'Policy', Text: 'Root Policy', ScopeLevel: 'Root', ScopeRecordID: ROOT_A, MergeBehavior: 'Append', Sort: 20 }),
        ];

        const resolved = resolveScopedPromptParts(candidates, { spaceTypeId: TYPE_A, rootSpaceId: ROOT_A, spaceId: SPACE_A1, audience: 'Shared' });
        assert.deepEqual(resolved.instructions, ['Type Policy', 'Root Policy', 'Space Policy']);
        assert.deepEqual(resolved.messages, [{ role: 'system', content: 'Type Policy\n\nRoot Policy\n\nSpace Policy' }]);
    });

    it('prevents cross-type, cross-root, cross-space, Archived, and Team-into-Shared leakage', () => {
        const candidates: ScopedPromptPartInput[] = [
            part({ Name: 'Allowed', Text: 'In-scope shared', ScopeLevel: 'Space', ScopeRecordID: SPACE_A1 }),
            part({ Name: 'TeamSecret', Text: 'In-scope team', ScopeLevel: 'Space', ScopeRecordID: SPACE_A1, Band: 'Team' }),
            part({ Name: 'ArchivedPart', Text: 'Old text', ScopeLevel: 'Space', ScopeRecordID: SPACE_A1, Status: 'Archived' }),
            part({ Name: 'LeakType', Text: 'Other type', ScopeLevel: 'SpaceType', ScopeRecordID: TYPE_B }),
            part({ Name: 'LeakRoot', Text: 'Other root', ScopeLevel: 'Root', ScopeRecordID: ROOT_B }),
            part({ Name: 'LeakSpace', Text: 'Other space', ScopeLevel: 'Space', ScopeRecordID: SPACE_B1 }),
        ];

        const sharedRes = resolveScopedPromptParts(candidates, { spaceTypeId: TYPE_A, rootSpaceId: ROOT_A, spaceId: SPACE_A1, audience: 'Shared' });
        assert.deepEqual(sharedRes.parts.map((p) => p.Name), ['Allowed']);
        assert.equal(sharedRes.excludedCount, 5);

        const teamRes = resolveScopedPromptParts(candidates, { spaceTypeId: TYPE_A, rootSpaceId: ROOT_A, spaceId: SPACE_A1, audience: 'Team' });
        assert.deepEqual(teamRes.parts.map((p) => p.Name), ['Allowed', 'TeamSecret']);
    });

    it('collapses Root and Space duplicate part IDs when target space is the root', () => {
        const sharedId = '99999999-0000-4000-8000-000000000001';
        const candidates: ScopedPromptPartInput[] = [
            part({ ID: sharedId, Name: 'RootRule', Text: 'Root rule text', ScopeLevel: 'Root', ScopeRecordID: ROOT_A, MergeBehavior: 'Append' }),
            part({ ID: sharedId, Name: 'RootRule', Text: 'Root rule text', ScopeLevel: 'Space', ScopeRecordID: ROOT_A, MergeBehavior: 'Append' }),
        ];
        const res = resolveScopedPromptParts(candidates, { spaceTypeId: TYPE_A, rootSpaceId: ROOT_A, spaceId: ROOT_A, audience: 'Shared' });
        assert.deepEqual(res.instructions, ['Root rule text']);
    });
});
