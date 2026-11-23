import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import {
    WellKnownUserSource,
    type EntityInfo,
    type IMetadataProvider,
    type IRunViewProvider,
    type RunViewParams,
    type RunViewResult,
    type UserInfo,
} from '@memberjunction/core';
import type { MJScopedPromptPartEntity } from '@memberjunction/core-entities';
import type { PromptComponentScope } from '@memberjunction/ai-agents';
import type { mjBizAppsCollaborationSpaceTypeEntity } from '@mj-biz-apps/collaboration-entities';
import {
    CollaborationEngine,
    CollaborationPromptComponentResolver,
    resolveSpaceScopedPromptParts,
} from '../../dist/index.js';

const SYSTEM_ID = '00000000-0000-0000-0000-000000000000';
const SPACE_TYPES_ENTITY_ID = '66666666-6666-4666-8666-666666666601';
const SPACES_ENTITY_ID = '66666666-6666-4666-8666-666666666602';
const TYPE_A_ID = '77777777-7777-4777-8777-777777777701';
const TYPE_OTHER_ID = '77777777-7777-4777-8777-777777777799';
const ROOT_A_ID = '88888888-8888-4888-8888-888888888801';
const CHILD_A_ID = '88888888-8888-4888-8888-888888888802';
const GRANDCHILD_A_ID = '88888888-8888-4888-8888-888888888803';
const OTHER_ROOT_ID = '88888888-8888-4888-8888-888888888881';
const OTHER_SPACE_ID = '88888888-8888-4888-8888-888888888882';
const PROMPT_ID = '99999999-9999-4999-8999-999999999901';

interface RecordedPromptQuery {
    entityName: string;
    extraFilter: string;
    resultType: string | undefined;
}

function makeUser(id: string): UserInfo {
    const u: Partial<UserInfo> = { ID: id, Name: 'System', Type: 'Owner', IsActive: true };
    return u as UserInfo;
}

function asFilterString(extraFilter: RunViewParams['ExtraFilter']): string {
    return typeof extraFilter === 'string' ? extraFilter : String(extraFilter ?? '');
}

function extractInIds(filter: string, col: string): string[] {
    const m = filter.match(new RegExp(`${col}\\s+IN\\s*\\(([^)]+)\\)`, 'i'));
    if (!m) return [];
    return [...m[1].matchAll(/'([^']+)'/g)].map((g) => g[1].toLowerCase());
}

function extractEq(filter: string, col: string): string | null {
    const m = filter.match(new RegExp(`${col}\\s*=\\s*'([^']+)'`, 'i'));
    return m ? m[1].toLowerCase() : null;
}

function createPromptProvider() {
    const queries: RecordedPromptQuery[] = [];

    const spaces = [
        {
            ID: ROOT_A_ID,
            ParentID: null,
            SpaceTypeID: TYPE_A_ID,
            Configuration: JSON.stringify({
                PromptParts: [
                    { Name: 'tone', Text: 'Root Tone Override', MergeBehavior: 'Override', Sort: 1, Priority: 5 },
                    { Name: 'root-checklist', Text: 'Root Shared Checklist', MergeBehavior: 'Append', Sort: 10 },
                    { Name: 'team-internal', Text: 'Root Team Secret Notes', MergeBehavior: 'Append', Band: 'Team', Sort: 15 },
                ],
            }),
        },
        {
            ID: CHILD_A_ID,
            ParentID: ROOT_A_ID,
            SpaceTypeID: TYPE_A_ID,
            Configuration: null,
        },
        {
            ID: GRANDCHILD_A_ID,
            ParentID: CHILD_A_ID,
            SpaceTypeID: TYPE_A_ID,
            Configuration: JSON.stringify({
                PromptParts: [
                    { Name: 'space-focus', Text: 'Grandchild Space Focus', MergeBehavior: 'Append', Sort: 20 },
                ],
            }),
        },
    ];

    const dbPromptParts = [
        {
            ID: 'db-type-tone',
            PromptID: PROMPT_ID,
            Name: 'tone',
            Role: 'System',
            Sort: 1,
            Text: 'Type Default Tone',
            PrimaryScopeEntityID: SPACE_TYPES_ENTITY_ID,
            PrimaryScopeRecordID: TYPE_A_ID,
            SecondaryScopes: null,
            Status: 'Active',
            MergeBehavior: 'Override',
            Priority: 20,
        },
        {
            ID: 'db-type-append',
            PromptID: PROMPT_ID,
            Name: 'type-policy',
            Role: 'System',
            Sort: 5,
            Text: 'Type Safety Policy',
            PrimaryScopeEntityID: SPACE_TYPES_ENTITY_ID,
            PrimaryScopeRecordID: TYPE_A_ID,
            SecondaryScopes: null,
            Status: 'Active',
            MergeBehavior: 'Append',
            Priority: 1,
        },
        {
            ID: 'db-grandchild-tone',
            PromptID: PROMPT_ID,
            Name: 'tone',
            Role: 'System',
            Sort: 1,
            Text: 'Grandchild Final Tone',
            PrimaryScopeEntityID: SPACES_ENTITY_ID,
            PrimaryScopeRecordID: GRANDCHILD_A_ID,
            SecondaryScopes: JSON.stringify({ Region: 'NA' }),
            Status: 'Active',
            MergeBehavior: 'Override',
            Priority: 1,
        },
        {
            ID: 'db-other-root-leak',
            PromptID: PROMPT_ID,
            Name: 'leak-check',
            Role: 'System',
            Sort: 1,
            Text: 'MUST NOT LEAK FROM OTHER ROOT',
            PrimaryScopeEntityID: SPACES_ENTITY_ID,
            PrimaryScopeRecordID: OTHER_ROOT_ID,
            SecondaryScopes: null,
            Status: 'Active',
            MergeBehavior: 'Append',
            Priority: 99,
        },
        {
            ID: 'db-other-type-leak',
            PromptID: PROMPT_ID,
            Name: 'leak-type',
            Role: 'System',
            Sort: 1,
            Text: 'MUST NOT LEAK FROM OTHER TYPE',
            PrimaryScopeEntityID: SPACE_TYPES_ENTITY_ID,
            PrimaryScopeRecordID: TYPE_OTHER_ID,
            SecondaryScopes: null,
            Status: 'Active',
            MergeBehavior: 'Append',
            Priority: 99,
        },
    ];

    const providerObj: Partial<IMetadataProvider & IRunViewProvider> = {
        EntityByID(): EntityInfo | undefined {
            return undefined;
        },
        EntityByName(name: string): EntityInfo | undefined {
            if (name === 'MJ_BizApps_Collaboration: Space Types') {
                return { ID: SPACE_TYPES_ENTITY_ID, Name: name } as EntityInfo;
            }
            if (name === 'MJ_BizApps_Collaboration: Spaces') {
                return { ID: SPACES_ENTITY_ID, Name: name } as EntityInfo;
            }
            return undefined;
        },
        async GetEntityObject<T>(): Promise<T> {
            throw new Error('Unexpected entity hydration during batched prompt resolution');
        },
        async RunView<T>(params: RunViewParams): Promise<RunViewResult<T>> {
            const filter = asFilterString(params.ExtraFilter);
            queries.push({
                entityName: params.EntityName ?? '',
                extraFilter: filter,
                resultType: params.ResultType,
            });
            const ok = (rows: T[]): RunViewResult<T> => ({
                Success: true,
                Results: rows,
                UserViewRunID: '',
                RowCount: rows.length,
                TotalRowCount: rows.length,
                ExecutionTime: 0,
                ErrorMessage: '',
            });

            if (params.EntityName === 'MJ_BizApps_Collaboration: Spaces') {
                const spaceId = extractEq(filter, 'ID');
                return ok(spaces.filter((s) => s.ID.toLowerCase() === spaceId) as T[]);
            }
            if (params.EntityName === 'MJ_BizApps_Collaboration: Space Types') {
                const id = extractEq(filter, 'ID');
                if (id === TYPE_A_ID.toLowerCase()) {
                    return ok([{
                        ID: TYPE_A_ID,
                        Code: 'STD',
                        Name: 'Standard',
                        Configuration: JSON.stringify({
                            SpaceOverridable: ['PromptParts'],
                            PromptParts: [
                                { Name: 'type-cfg-append', Text: 'Type Config Intro', MergeBehavior: 'Append', Sort: 2 },
                            ],
                        }),
                    }] as T[]);
                }
                return ok([]);
            }
            if (params.EntityName === 'MJ: Scoped Prompt Parts') {
                const recordIds = extractInIds(filter, 'PrimaryScopeRecordID');
                return ok(
                    dbPromptParts.filter((p) => recordIds.includes(p.PrimaryScopeRecordID.toLowerCase())) as T[],
                );
            }
            return ok([]);
        },
        async RunViews<T>(paramsList: RunViewParams[]): Promise<RunViewResult<T>[]> {
            return Promise.all(paramsList.map((p) => this.RunView!<T>(p)));
        },
    };

    return { provider: providerObj as IMetadataProvider, queries };
}

describe('CX-4 resolveSpaceScopedPromptParts & CollaborationPromptComponentResolver', () => {
    let heldSystem: typeof WellKnownUserSource.Instance.GetSystemUser;
    const engine = CollaborationEngine.Instance;
    let heldEnsureLoaded: typeof engine.EnsureLoaded;
    let heldTypeById: typeof engine.SpaceTypeById;
    let heldSettingsDesc: PropertyDescriptor | undefined;

    before(() => {
        heldSystem = WellKnownUserSource.Instance.GetSystemUser.bind(WellKnownUserSource.Instance);
        WellKnownUserSource.Instance.GetSystemUser = async () => makeUser(SYSTEM_ID);
        heldEnsureLoaded = engine.EnsureLoaded.bind(engine);
        heldTypeById = engine.SpaceTypeById.bind(engine);
        heldSettingsDesc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(engine), 'CollaborationSettings');
        engine.EnsureLoaded = async () => undefined;
        engine.SpaceTypeById = (id: string | null | undefined) => {
            if (id?.toLowerCase() === TYPE_A_ID.toLowerCase()) {
                const typeEnt: Partial<mjBizAppsCollaborationSpaceTypeEntity> = {
                    ID: TYPE_A_ID,
                    Code: 'STD',
                    Name: 'Standard',
                    Configuration: JSON.stringify({
                        SpaceOverridable: ['PromptParts'],
                        PromptParts: [
                            { Name: 'type-cfg-append', Text: 'Type Config Intro', MergeBehavior: 'Append', Sort: 2 },
                        ],
                    }),
                };
                return typeEnt as mjBizAppsCollaborationSpaceTypeEntity;
            }
            return undefined;
        };
        Object.defineProperty(engine, 'CollaborationSettings', {
            configurable: true,
            get: () => ({}),
        });
    });

    after(() => {
        WellKnownUserSource.Instance.GetSystemUser = heldSystem;
        engine.EnsureLoaded = heldEnsureLoaded;
        engine.SpaceTypeById = heldTypeById;
        if (heldSettingsDesc) {
            Object.defineProperty(engine, 'CollaborationSettings', heldSettingsDesc);
        }
    });

    it('resolves SpaceType -> Root -> Space hierarchy via batched RunView with Override/Append semantics and zero leakage', async () => {
        const { provider, queries } = createPromptProvider();

        const sharedResult = await resolveSpaceScopedPromptParts({
            provider,
            spaceId: GRANDCHILD_A_ID,
            promptId: PROMPT_ID,
            audience: 'Shared',
            secondaryScopes: { Region: 'NA' },
        });

        const texts = sharedResult.parts.map((p) => p.Text);
        assert.equal(texts.includes('Grandchild Final Tone'), true);
        assert.equal(texts.includes('Root Tone Override'), false);
        assert.equal(texts.includes('Type Default Tone'), false);

        const typeIdx = texts.indexOf('Type Config Intro');
        const rootIdx = texts.indexOf('Root Shared Checklist');
        const spaceIdx = texts.indexOf('Grandchild Space Focus');
        assert.equal(typeIdx >= 0 && rootIdx > typeIdx && spaceIdx > rootIdx, true);

        const sharedJoined = sharedResult.instructions.join('\n');
        assert.equal(sharedJoined.includes('MUST NOT LEAK'), false);
        assert.equal(sharedJoined.includes('Root Team Secret Notes'), false);

        const promptQueries = queries.filter((q) => q.entityName === 'MJ: Scoped Prompt Parts');
        assert.equal(promptQueries.length, 1);
        assert.equal(promptQueries[0].resultType, 'simple');
        assert.match(promptQueries[0].extraFilter, /PrimaryScopeRecordID IN \(/);

        const teamResult = await resolveSpaceScopedPromptParts({
            provider,
            spaceId: GRANDCHILD_A_ID,
            promptId: PROMPT_ID,
            audience: 'Team',
            secondaryScopes: { Region: 'NA' },
        });
        assert.equal(teamResult.instructions.join('\n').includes('Root Team Secret Notes'), true);
    });

    it('scores Space > Root > SpaceType specificity and blocks cross-scope leakage in CollaborationPromptComponentResolver', () => {
        class TestableResolver extends CollaborationPromptComponentResolver {
            public CheckInScope(p: MJScopedPromptPartEntity, s: PromptComponentScope): boolean {
                return this.isInScope(p, s);
            }
            public ScorePart(p: MJScopedPromptPartEntity): number {
                return this.score(p);
            }
        }

        const resolver = new TestableResolver();
        const scope: PromptComponentScope = {
            secondaryScopes: {
                SpaceTypeID: TYPE_A_ID,
                RootSpaceID: ROOT_A_ID,
                SpaceID: GRANDCHILD_A_ID,
            },
        };

        const typePart: Partial<MJScopedPromptPartEntity> = {
            PrimaryScopeRecordID: TYPE_A_ID,
            SecondaryScopes: JSON.stringify({ CollaborationScopeLevel: 'SpaceType' }),
            Status: 'Active',
        };
        const rootPart: Partial<MJScopedPromptPartEntity> = {
            PrimaryScopeRecordID: ROOT_A_ID,
            SecondaryScopes: JSON.stringify({ CollaborationScopeLevel: 'Root' }),
            Status: 'Active',
        };
        const spacePart: Partial<MJScopedPromptPartEntity> = {
            PrimaryScopeRecordID: GRANDCHILD_A_ID,
            SecondaryScopes: JSON.stringify({ CollaborationScopeLevel: 'Space' }),
            Status: 'Active',
        };
        const crossSpacePart: Partial<MJScopedPromptPartEntity> = {
            PrimaryScopeRecordID: OTHER_SPACE_ID,
            SecondaryScopes: JSON.stringify({ CollaborationScopeLevel: 'Space' }),
            Status: 'Active',
        };

        assert.equal(resolver.CheckInScope(typePart as MJScopedPromptPartEntity, scope), true);
        assert.equal(resolver.CheckInScope(rootPart as MJScopedPromptPartEntity, scope), true);
        assert.equal(resolver.CheckInScope(spacePart as MJScopedPromptPartEntity, scope), true);
        assert.equal(resolver.CheckInScope(crossSpacePart as MJScopedPromptPartEntity, scope), false);

        const typeScore = resolver.ScorePart(typePart as MJScopedPromptPartEntity);
        const rootScore = resolver.ScorePart(rootPart as MJScopedPromptPartEntity);
        const spaceScore = resolver.ScorePart(spacePart as MJScopedPromptPartEntity);
        assert.equal(spaceScore > rootScore && rootScore > typeScore, true);
    });
});
