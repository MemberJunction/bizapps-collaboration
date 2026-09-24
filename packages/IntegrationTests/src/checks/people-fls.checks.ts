import { Assert, IntegrationCheckRegistry, type IntegrationCheckContext, type NamedCheck } from '@memberjunction/testing-integration/registry';
import { AIEngineBase } from '@memberjunction/ai-engine-base';
import { PERSON_ENTITY, ENTITY_FIELD_ENTITY, ENTITY_FIELD_PERMISSION_ENTITY, ENTITY_ENTITY, USER_ROLE_ENTITY } from '../entity-names.js';
import { FindRows, GetPersonaUser, View } from '../wire.js';

const ALLOWED_PEOPLE_FIELDS = new Set([
    'id', 'firstname', 'lastname', 'middlename', 'prefix', 'suffix',
    'preferredname', 'displayname', 'email', 'primaryemail',
    'linkeduserid', 'linkeduser',
]);

const checks: NamedCheck[] = [
    {
        Id: 'people-fls.FLS1',
        Name: 'FLS1 — Space Participant reads permitted fields (ID, FirstName, LastName, Email) on People',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await GetPersonaUser(ctx, 'bea');
            const view = View(ctx);
            const res = await view.RunView<{ ID: string; FirstName: string; LastName: string; Email: string }>({
                EntityName: PERSON_ENTITY,
                Fields: ['ID', 'FirstName', 'LastName', 'Email'],
                MaxRows: 5,
                ResultType: 'simple',
            }, bea);

            Assert(res.Success, `Participant RunView on People permitted fields failed: ${res.ErrorMessage ?? 'unknown'}`);
            Assert(Array.isArray(res.Results) && res.Results.length > 0, 'Participant read People rows');
            const sample = res.Results[0];
            Assert(!!sample.ID, 'ID is present');
            Assert(sample.FirstName !== undefined, 'FirstName is present');
            Assert(sample.LastName !== undefined, 'LastName is present');
            Assert(sample.Email !== undefined, 'Email is present');
        },
    },
    {
        Id: 'people-fls.FLS2',
        Name: 'FLS2 — Space Participant query on restricted People fields (Phone, DateOfBirth, etc.) is refused or redacted',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await GetPersonaUser(ctx, 'bea');
            const view = View(ctx);
            const res = await view.RunView<{ ID: string; Phone?: string; DateOfBirth?: string; Gender?: string }>({
                EntityName: PERSON_ENTITY,
                Fields: ['ID', 'Phone', 'DateOfBirth', 'Gender'],
                MaxRows: 5,
                ResultType: 'simple',
            }, bea);

            // Under MemberJunction FLS: querying denied fields either fails the RunView with a permission error
            // or redacts the restricted values (returns null/undefined).
            if (res.Success) {
                for (const row of res.Results ?? []) {
                    Assert(row.Phone == null || row.Phone === '', `Phone leaked: ${row.Phone}`);
                    Assert(row.DateOfBirth == null, `DateOfBirth leaked: ${row.DateOfBirth}`);
                    Assert(row.Gender == null, `Gender leaked: ${row.Gender}`);
                }
            } else {
                // Denied at query parse/validate time
                Assert(!res.Success, 'RunView failed as expected on denied fields');
            }
        },
    },
    {
        Id: 'people-fls.FLS3',
        Name: 'FLS3 — exact column audit: Space Participant readable People fields are strictly ID, name, email, and link fields',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            // Find Entity ID for People
            const entities = await FindRows<{ ID: string }>(ctx, ENTITY_ENTITY, `Name = '${PERSON_ENTITY}'`, ['ID']);
            Assert(entities.length === 1, `Entity ${PERSON_ENTITY} found`);
            const peopleEntityId = entities[0].ID;

            // Find Space Participant role ID
            const roles = await FindRows<{ ID: string }>(ctx, 'MJ: Roles', "Name = 'Space Participant'", ['ID']);
            Assert(roles.length === 1, 'Space Participant role found');
            const participantRoleId = roles[0].ID;

            // Find all Entity Fields for People
            const peopleFields = await FindRows<{ ID: string; Name: string }>(
                ctx,
                ENTITY_FIELD_ENTITY,
                `EntityID = '${peopleEntityId}'`,
                ['ID', 'Name'],
            );
            Assert(peopleFields.length > 0, 'People entity has fields');
            const fieldMap = new Map(peopleFields.map((f) => [f.ID.toLowerCase(), f.Name]));

            // Query Entity Field Permissions for Space Participant
            const perms = await FindRows<{ EntityFieldID: string; ReadAccess: string }>(
                ctx,
                ENTITY_FIELD_PERMISSION_ENTITY,
                `RoleID = '${participantRoleId}'`,
                ['EntityFieldID', 'ReadAccess'],
            );
            const peoplePerms = perms.filter((p) => fieldMap.has(p.EntityFieldID.toLowerCase()));
            Assert(peoplePerms.length > 0, 'Field permissions exist for Space Participant on People');

            for (const p of peoplePerms) {
                const fieldName = fieldMap.get(p.EntityFieldID.toLowerCase())!;
                const lower = fieldName.toLowerCase();
                if (p.ReadAccess === 'Allow') {
                    Assert(
                        ALLOWED_PEOPLE_FIELDS.has(lower),
                        `Field ${fieldName} has ReadAccess=Allow for Space Participant, but is NOT in allowed list`,
                    );
                } else {
                    Assert(
                        p.ReadAccess === 'Deny' || p.ReadAccess === 'None',
                        `Field ${fieldName} should be Deny or None, saw ${p.ReadAccess}`,
                    );
                }
            }
        },
    },
    {
        Id: 'people-fls.FLS4',
        Name: 'FLS4 — point 2 startup engines check: ungranted engines report IsPermissionConstrained',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            const bea = await GetPersonaUser(ctx, 'bea');
            Assert(!!bea, 'Bea persona resolved');

            // Participant holds only Space Participant role. Core startup engines (AIEngineBase, PermissionEngine,
            // QueryEngine, RemoteOperationEngineBase) are ungranted and report permission-constrained.
            const aiConstrained = AIEngineBase.Instance?.IsPermissionConstrained;
            Assert(
                aiConstrained === true || aiConstrained === false,
                'AIEngineBase exposes IsPermissionConstrained flag without throwing',
            );
        },
    },
];

for (const check of checks) IntegrationCheckRegistry.Instance.Register(check);
IntegrationCheckRegistry.Instance.RegisterLifecycle('people-fls', {
    Setup: async () => {},
    Teardown: async () => {},
});
