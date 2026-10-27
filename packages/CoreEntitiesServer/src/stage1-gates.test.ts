import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EntityInfo } from '@memberjunction/core';
import { grantRuleRefusal } from '../dist/SpaceGrantEntityServer.js';
import { recordKeyParses } from '../dist/SpaceAnchorEntityServer.js';
import { artifactTypeNameFor } from '../dist/upload-space-file.js';

const uuidKey = { PrimaryKeys: [{ Name: 'ID', Type: 'uniqueidentifier' }] } as unknown as Pick<EntityInfo, 'PrimaryKeys'>;
const intKey = { PrimaryKeys: [{ Name: 'ID', Type: 'int' }] } as unknown as Pick<EntityInfo, 'PrimaryKeys'>;
const composite = { PrimaryKeys: [{ Name: 'AccountID', Type: 'uniqueidentifier' }, { Name: 'Year', Type: 'int' }] } as unknown as Pick<EntityInfo, 'PrimaryKeys'>;
const UUID = 'AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEE1';

describe("a grant's § 4 rules (item 142), by kind, bindings and who the type seats", () => {
    it('refuses a view with a binding anywhere, and a view with none unless the type seats staff only', () => {
        assert.match(grantRuleRefusal({ kind: 'View', hasBindings: true, audience: 'StaffOnly' }) ?? '', /cannot be bound/);
        assert.match(grantRuleRefusal({ kind: 'View', hasBindings: false, audience: 'StaffAndParticipants' }) ?? '', /seats staff only/);
        assert.equal(grantRuleRefusal({ kind: 'View', hasBindings: false, audience: 'StaffOnly' }), null);
    });

    it('refuses a dashboard everywhere, and a query or a component outside a staff-only type', () => {
        assert.match(grantRuleRefusal({ kind: 'Dashboard', hasBindings: false, audience: 'StaffOnly' }) ?? '', /dashboard/);
        assert.match(grantRuleRefusal({ kind: 'Query', hasBindings: false, audience: 'StaffAndParticipants' }) ?? '', /query may only be granted/);
        assert.match(grantRuleRefusal({ kind: 'Component', hasBindings: true, audience: 'StaffAndParticipants' }) ?? '', /component may only be granted/);
        assert.equal(grantRuleRefusal({ kind: 'Query', hasBindings: true, audience: 'StaffOnly' }), null);
    });

    it('allows agents, knowledge sources and actions (a bound action is stored; the turn leaves its parameter out)', () => {
        for (const kind of ['Agent', 'KnowledgeSource', 'Action']) {
            assert.equal(grantRuleRefusal({ kind, hasBindings: true, audience: 'StaffAndParticipants' }), null, kind);
        }
    });
});

describe("an anchor's record key, as the entity's primary key accepts it", () => {
    it('takes MJ\'s composite form and the bare value of a single key, and needs a UUID for a uniqueidentifier key', () => {
        assert.equal(recordKeyParses(uuidKey, `ID|${UUID}`), true);
        assert.equal(recordKeyParses(uuidKey, UUID.toLowerCase()), true);
        assert.equal(recordKeyParses(uuidKey, 'ID|not-a-uuid'), false);
        assert.equal(recordKeyParses(uuidKey, ''), false);
        assert.equal(recordKeyParses(intKey, '42'), true);
        assert.equal(recordKeyParses(intKey, 'ID|42'), true);
    });

    it('needs every column of a composite key, by name', () => {
        assert.equal(recordKeyParses(composite, `AccountID|${UUID}||Year|2026`), true);
        assert.equal(recordKeyParses(composite, `Year|2026||AccountID|${UUID}`), true);
        assert.equal(recordKeyParses(composite, `AccountID|${UUID}`), false);
        assert.equal(recordKeyParses(composite, UUID), false);
        assert.equal(recordKeyParses(composite, `AccountID|${UUID}||Year|`), false);
    });
});

describe("the Library's artifact type for an upload", () => {
    it('reads the extension first (the server stores most uploads as octet-stream), then the media type', () => {
        assert.equal(artifactTypeNameFor('minutes.docx', 'application/octet-stream'), 'Word Document');
        assert.equal(artifactTypeNameFor('figures.csv', 'application/octet-stream'), 'CSV');
        assert.equal(artifactTypeNameFor('clip', 'video/mp4'), 'Video');
        assert.equal(artifactTypeNameFor('page.htm', 'text/html'), 'HTML');
        assert.equal(artifactTypeNameFor('x.unknown', 'text/x-anything'), 'Generic Text');
    });
});
