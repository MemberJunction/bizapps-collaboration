import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import type { AppContext } from '@memberjunction/server';

const heldEnv = {
    DB_DATABASE: process.env.DB_DATABASE,
    DB_USERNAME: process.env.DB_USERNAME,
    DB_PASSWORD: process.env.DB_PASSWORD,
};
process.env.DB_DATABASE ??= 'unit_test_db';
process.env.DB_USERNAME ??= 'unit_test_user';
process.env.DB_PASSWORD ??= 'unit_test_placeholder';

const [{ PromoteSpaceNoteToDocResolver }, { RESOLVER_PATHS }] = await Promise.all([
    import('../dist/promote-space-note-to-doc.resolver.js'),
    import('../dist/index.js'),
]);

if (heldEnv.DB_DATABASE === undefined) delete process.env.DB_DATABASE;
if (heldEnv.DB_USERNAME === undefined) delete process.env.DB_USERNAME;
if (heldEnv.DB_PASSWORD === undefined) delete process.env.DB_PASSWORD;

const SPACE_ID = '44444444-4444-4444-8444-444444444444';
const CALLER_ID = '22222222-2222-4222-8222-222222222222';

describe('PromoteSpaceNoteToDocResolver', () => {
    it('is registered in RESOLVER_PATHS for MJAPI schema assembly', () => {
        assert.ok(
            RESOLVER_PATHS.some((entry) => entry.includes('promote-space-note-to-doc.resolver')),
            'Expected promote-space-note-to-doc.resolver in RESOLVER_PATHS',
        );
    });

    it('rejects invalid Band and Visibility fail-closed with zero provider queries', async () => {
        let providerCalls = 0;
        const mockProvider = {
            async GetEntityObject() {
                providerCalls += 1;
                throw new Error('Provider must not be called for invalid GraphQL enum inputs');
            },
        } as Partial<IMetadataProvider> as IMetadataProvider;

        const caller = {
            ID: CALLER_ID,
            Email: 'ada@example.test',
            Type: 'User',
        } as Partial<UserInfo> as UserInfo;

        const resolver = new PromoteSpaceNoteToDocResolver();
        resolver.GetUserFromPayload = () => caller;

        const context = {
            providers: [{ provider: mockProvider, type: 'Read-Write', label: 'Primary' }],
            userPayload: { email: 'ada@example.test', userRecord: caller },
        } as Partial<AppContext> as AppContext;

        const badBand = await resolver.PromoteSpaceNoteToDoc(
            { SpaceID: SPACE_ID, Title: 'Note', Band: 'Public' },
            context,
        );
        assert.equal(badBand.Success, false);
        assert.equal(badBand.ErrorCode, 'INVALID_INPUT');
        assert.match(badBand.ErrorMessage ?? '', /Team or Shared/i);

        const badVisibility = await resolver.PromoteSpaceNoteToDoc(
            { SpaceID: SPACE_ID, Title: 'Note', Band: 'Team', Visibility: 'External' },
            context,
        );
        assert.equal(badVisibility.Success, false);
        assert.equal(badVisibility.ErrorCode, 'INVALID_INPUT');
        assert.match(badVisibility.ErrorMessage ?? '', /Space or Private/i);

        assert.equal(providerCalls, 0);
    });
});
