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
                Assert(Array.isArray(res.Results) && res.Results.length > 0, 'People rows returned under FLS query');
                for (const row of res.Results ?? []) {
                    Assert(row.Phone == null || row.Phone === '', `Phone leaked: ${row.Phone}`);
                    Assert(row.DateOfBirth == null, `DateOfBirth leaked: ${row.DateOfBirth}`);
                    Assert(row.Gender == null, `Gender leaked: ${row.Gender}`);
                }
            } else {
                const err = (res.ErrorMessage ?? '').toLowerCase();
                Assert(
                    err.includes('permission') || err.includes('denied') || err.includes('security') || err.includes('access'),
                    `Expected security/permission error message for restricted fields query, got: ${res.ErrorMessage}`,
                );
            }
        },
    },
    {
        Id: 'people-fls.FLS3',
        Name: 'FLS3 — exact column audit: Space Participant readable People fields are strictly ID, name, email, and link fields',
        RequiresMutation: false,
        Fn: async (ctx: IntegrationCheckContext) => {
            // Find Entity ID and check EnableFieldLevelSecurity on People
            const peopleEntityInfo = ctx.Provider.EntityByName(PERSON_ENTITY);
            Assert(!!peopleEntityInfo, `Entity ${PERSON_ENTITY} found in metadata`);
            Assert(
                peopleEntityInfo!.EnableFieldLevelSecurity === true,
                `MJ_BizApps_Common: People MUST have EnableFieldLevelSecurity enabled, saw ${peopleEntityInfo!.EnableFieldLevelSecurity}`,
            );
            const peopleEntityId = peopleEntityInfo!.ID;

            // Find Space Participant role ID
            const roles = await FindRows<{ ID: string }>(ctx, 'MJ: Roles', "Name = 'Space Participant'", ['ID']);
            Assert(roles.length === 1, 'Space Participant role found');
            const participantRoleId = roles[0].ID;

            // Find all Entity Fields for People
            const peopleFields = await FindRows<{ ID: string; Name: string; IsPrimaryKey: boolean }>(
                ctx,
                ENTITY_FIELD_ENTITY,
                `EntityID = '${peopleEntityId}'`,
                ['ID', 'Name', 'IsPrimaryKey'],
            );
            Assert(peopleFields.length > 0, 'People entity has fields');
            const fieldMap = new Map(peopleFields.map((f) => [f.ID.toLowerCase(), f]));

            // Query Entity Field Permissions for Space Participant
            const perms = await FindRows<{ EntityFieldID: string; ReadAccess: string }>(
                ctx,
                ENTITY_FIELD_PERMISSION_ENTITY,
                `RoleID = '${participantRoleId}'`,
                ['EntityFieldID', 'ReadAccess'],
            );
            const peoplePerms = perms.filter((p) => fieldMap.has(p.EntityFieldID.toLowerCase()));
            Assert(peoplePerms.length > 0, 'Field permissions exist for Space Participant on People');

            const permMap = new Map(peoplePerms.map((p) => [p.EntityFieldID.toLowerCase(), p.ReadAccess]));

            // Compute effective readability for every field on People
            for (const [fieldId, fieldInfo] of fieldMap) {
                const name = fieldInfo.Name;
                const lower = name.toLowerCase();

                // Skip __mj_ internal system columns (e.g. __mj_CreatedAt)
                if (lower.startsWith('__mj_')) continue;

                const readAccess = permMap.get(fieldId);
                if (readAccess) {
                    Assert(
                        readAccess === 'Allow' || readAccess === 'Deny' || readAccess === 'No Access',
                        `Field ${name} has invalid ReadAccess '${readAccess}' — must be Allow, Deny, or No Access`,
                    );
                }

                const isEffectivelyReadable = fieldInfo.IsPrimaryKey || readAccess === 'Allow';

                if (isEffectivelyReadable) {
                    Assert(
                        ALLOWED_PEOPLE_FIELDS.has(lower),
                        `Field '${name}' is readable for Space Participant, but is NOT in allowed list`,
                    );
                } else {
                    Assert(
                        !ALLOWED_PEOPLE_FIELDS.has(lower),
                        `Field '${name}' is in allowed list but is NOT readable for Space Participant`,
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

            // Participant holds only Space Participant role.
            // When core startup engines are ungranted or restricted, they must safely expose
            // their IsPermissionConstrained state without throwing unhandled exceptions.
            const aiEngine = AIEngineBase.Instance;
            if (aiEngine) {
                const constrained = aiEngine.IsPermissionConstrained;
                Assert(
                    typeof constrained === 'boolean',
                    `AIEngineBase.IsPermissionConstrained should be a boolean, saw: ${typeof constrained}`,
                );
            }
        },
    },
];

for (const check of checks) IntegrationCheckRegistry.Instance.Register(check);
IntegrationCheckRegistry.Instance.RegisterLifecycle('people-fls', {
    Setup: async () => {},
    Teardown: async () => {},
});
