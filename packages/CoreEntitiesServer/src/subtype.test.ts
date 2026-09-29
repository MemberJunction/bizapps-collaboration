import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { refuseSubtypePairing } from '../dist/SpaceEntityServer.js';
import { refuseSubtypeEntity, type SubtypeEntityShape } from '../dist/subtype-rules.js';

describe('a space type and its subtype go together', () => {
    const base = { typeName: 'Board', isNew: true, typeChanged: false };

    it('refuses a new plain space under a type that names a subtype, and says how to create it', () => {
        const refusal = refuseSubtypePairing({ ...base, expected: 'Example Boards', actual: null });
        assert.match(refusal ?? '', /keeps its details in Example Boards: create the space as that \(NewRecord, then Save\)/);
    });

    it('refuses a subtype save under a type that names none, and one under a type that names another', () => {
        assert.match(refuseSubtypePairing({ ...base, expected: null, actual: 'Example Boards' }) ?? '', /names no subtype, so a Example Boards cannot be saved under it/);
        assert.match(refuseSubtypePairing({ ...base, expected: 'Example Rooms', actual: 'Example Boards' }) ?? '', /names Example Rooms, not Example Boards/);
    });

    it('accepts the pairing, and a plain space under a plain type, whatever the case of the name', () => {
        assert.equal(refuseSubtypePairing({ ...base, expected: 'Example Boards', actual: 'example boards' }), null);
        assert.equal(refuseSubtypePairing({ ...base, expected: null, actual: null }), null);
    });

    it('lets an existing plain space be edited under a type that now names a subtype', () => {
        assert.equal(refuseSubtypePairing({ ...base, isNew: false, expected: 'Example Boards', actual: null }), null);
    });

    it('leaves a change of type to the check that the two types share a subtype table', () => {
        assert.equal(refuseSubtypePairing({ ...base, isNew: false, typeChanged: true, expected: 'Example Boards', actual: null }), null);
        assert.equal(refuseSubtypePairing({ ...base, isNew: false, typeChanged: true, expected: 'Example Rooms', actual: 'Example Boards' }), null);
        assert.equal(refuseSubtypePairing({ ...base, isNew: false, typeChanged: true, expected: null, actual: 'Example Boards' }), null);
    });
});

describe("an entity a space type names as its subtype", () => {
    const FILTER = 'F1000001-0000-4000-8000-000000000001';
    const OTHER_FILTER = 'F1000001-0000-4000-8000-000000000002';
    const ROLE_PARTICIPANT = 'A0000000-0000-4000-8000-000000000001';
    const ROLE_STAFF = 'A0000000-0000-4000-8000-000000000002';
    const ROLE_OUTSIDER = 'A0000000-0000-4000-8000-000000000003';
    const spaces: SubtypeEntityShape = {
        ID: 'E0000000-0000-4000-8000-000000000001', Name: 'Spaces', ParentID: null,
        Permissions: [
            { RoleID: ROLE_PARTICIPANT, Role: 'Space Participant', CanRead: true, ReadRLSFilterID: FILTER },
            { RoleID: ROLE_STAFF, Role: 'Developer', CanRead: true, ReadRLSFilterID: null },
        ],
    };
    const child = (over: Partial<SubtypeEntityShape>): SubtypeEntityShape => ({
        ID: 'E0000000-0000-4000-8000-000000000002', Name: 'Example Boards', ParentID: spaces.ID,
        Permissions: [
            { RoleID: ROLE_PARTICIPANT, Role: 'Space Participant', CanRead: true, ReadRLSFilterID: FILTER },
            { RoleID: ROLE_STAFF, Role: 'Developer', CanRead: true, ReadRLSFilterID: null },
        ],
        ...over,
    });
    const none = () => undefined;

    it('may be one when it is an IsA child of Spaces and every role reads it under the filter Spaces gives that role', () => {
        assert.equal(refuseSubtypeEntity(spaces, child({}), none), null);
    });

    it('may be a grandchild: an IsA child of another child of Spaces', () => {
        const mid = child({ ID: 'E0000000-0000-4000-8000-000000000009', Name: 'Boards' });
        const grand = child({ ID: 'E0000000-0000-4000-8000-000000000010', Name: 'Sub Boards', ParentID: mid.ID });
        assert.equal(refuseSubtypeEntity(spaces, grand, (id) => (id === mid.ID ? mid : undefined)), null);
    });

    it('is refused when it is not an IsA child of Spaces', () => {
        assert.match(refuseSubtypeEntity(spaces, child({ ParentID: null }), none) ?? '', /is not an IsA child of Spaces/);
        assert.match(refuseSubtypeEntity(spaces, child({ ParentID: 'E0000000-0000-4000-8000-0000000000FF' }), none) ?? '', /is not an IsA child of Spaces/);
    });

    it('is refused when a role reads it without the filter Spaces gives that role, naming the role', () => {
        const unfiltered = child({ Permissions: [{ RoleID: ROLE_PARTICIPANT, Role: 'Space Participant', CanRead: true, ReadRLSFilterID: null }] });
        assert.match(refuseSubtypeEntity(spaces, unfiltered, none) ?? '', /read by Space Participant without the row filter Spaces gives that role/);
        const wrong = child({ Permissions: [{ RoleID: ROLE_PARTICIPANT, Role: 'Space Participant', CanRead: true, ReadRLSFilterID: OTHER_FILTER }] });
        assert.match(refuseSubtypeEntity(spaces, wrong, none) ?? '', /without the row filter/);
    });

    it('is refused when a role reads it that cannot read Spaces at all', () => {
        const extra = child({ Permissions: [{ RoleID: ROLE_OUTSIDER, Role: 'Outsider', CanRead: true, ReadRLSFilterID: null }] });
        assert.match(refuseSubtypeEntity(spaces, extra, none) ?? '', /Outsider cannot read Spaces/);
    });

    it('ignores a role that cannot read it, and reads filter ids without regard to case', () => {
        const lower = child({ Permissions: [
            { RoleID: ROLE_PARTICIPANT.toLowerCase(), Role: 'Space Participant', CanRead: true, ReadRLSFilterID: FILTER.toLowerCase() },
            { RoleID: ROLE_OUTSIDER, Role: 'Outsider', CanRead: false, ReadRLSFilterID: null },
        ] });
        assert.equal(refuseSubtypeEntity(spaces, lower, none), null);
    });
});
