import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { IMetadataProvider, UserInfo } from '@memberjunction/core';
import type { AppContext } from '@memberjunction/server';

// @memberjunction/server evaluates LoadConfig() on module load; provide benign non-secret
// placeholder defaults when running unit tests without a local DB config, then restore.
const heldEnv = {
    DB_DATABASE: process.env.DB_DATABASE,
    DB_USERNAME: process.env.DB_USERNAME,
    DB_PASSWORD: process.env.DB_PASSWORD,
    MAGIC_LINK_IDP_INVITES: process.env.MAGIC_LINK_IDP_INVITES,
    COLLABORATION_IDP_INVITES: process.env.COLLABORATION_IDP_INVITES,
};
process.env.DB_DATABASE ??= 'unit_test_db';
process.env.DB_USERNAME ??= 'unit_test_user';
process.env.DB_PASSWORD ??= 'unit_test_placeholder';
delete process.env.MAGIC_LINK_IDP_INVITES;
delete process.env.COLLABORATION_IDP_INVITES;

const [{ configInfo }, { MintSpaceLinkResolver }] = await Promise.all([
    import('@memberjunction/server'),
    import('../dist/mint-space-link.resolver.js'),
]);

if (heldEnv.DB_DATABASE === undefined) delete process.env.DB_DATABASE;
if (heldEnv.DB_USERNAME === undefined) delete process.env.DB_USERNAME;
if (heldEnv.DB_PASSWORD === undefined) delete process.env.DB_PASSWORD;

const SPACE_ID = '44444444-4444-4444-8444-444444444444';
const ROLE_ID = '77777777-7777-4777-8777-777777777777';
const CALLER_ID = '22222222-2222-4222-8222-222222222222';

describe('MintSpaceLinkResolver host opt-in defaults', () => {
    it('refuses with zero provider writes on MJ default configInfo.magicLink (enabled: false, idpInvites unset)', async () => {
        const prevMagic = configInfo.magicLink;
        let getEntityObjectCalls = 0;
        const mockProvider = {
            async GetEntityObject() {
                getEntityObjectCalls += 1;
                throw new Error('Provider must not be queried when invites are disabled');
            },
        } as Partial<IMetadataProvider> as IMetadataProvider;

        const caller = {
            ID: CALLER_ID,
            Email: 'owner@example.test',
            Type: 'Owner',
        } as Partial<UserInfo> as UserInfo;

        const resolver = new MintSpaceLinkResolver();
        resolver.GetUserFromPayload = () => caller;

        const context = {
            providers: [
                {
                    provider: mockProvider,
                    type: 'Read-Write',
                    label: 'Primary',
                },
            ],
            userPayload: { email: 'owner@example.test', userRecord: caller },
        } as Partial<AppContext> as AppContext;

        configInfo.magicLink = {
            ...prevMagic,
            enabled: false,
            grantableRoleNames: [],
        };
        if ('idpInvites' in configInfo.magicLink) {
            delete configInfo.magicLink.idpInvites;
        }

        try {
            const payload = await resolver.MintSpaceLink(
                { SpaceID: SPACE_ID, Email: 'anyone@elsewhere.test', RoleID: ROLE_ID },
                context,
            );
            assert.equal(payload.Success, false);
            assert.equal(payload.Sent, false);
            assert.match(payload.ErrorMessage ?? '', /turned off/i);
            assert.equal(getEntityObjectCalls, 0);
        } finally {
            configInfo.magicLink = prevMagic;
            if (heldEnv.MAGIC_LINK_IDP_INVITES !== undefined) {
                process.env.MAGIC_LINK_IDP_INVITES = heldEnv.MAGIC_LINK_IDP_INVITES;
            }
            if (heldEnv.COLLABORATION_IDP_INVITES !== undefined) {
                process.env.COLLABORATION_IDP_INVITES = heldEnv.COLLABORATION_IDP_INVITES;
            }
        }
    });
});
