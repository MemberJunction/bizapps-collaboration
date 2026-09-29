/**
 * Which subtype a Space is, from its type. A space type may name an IsA child of Spaces (`SpaceType.SpaceExtensionEntity`): a
 * space of that type is created, and loaded, as that child, and one save writes both tables.
 *
 * The rule lives in code, not in Spaces' `SubtypeSelector`, because it depends on a row of another table (the type), and
 * because a type's subtype is Collaboration's to decide: the engine that holds the types keeps the directory below current, and
 * `ResolveLoadHint` answers only from it (it runs for every record a load returns, and must never query).
 */
import { EntitySubtypeResolver, Metadata, RunView, type BaseEntity } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';

const SPACES = 'MJ_BizApps_Collaboration: Spaces';
const SPACE_TYPES = 'MJ_BizApps_Collaboration: Space Types';

/** What each space type names as its subtype, by type id. Kept current by the engine that loads the types. */
export class SpaceSubtypeDirectory {
    private static byTypeId = new Map<string, string | null>();

    /** Replaces the directory with what the given types name. A type that names none maps to null. */
    public static Replace(types: ReadonlyArray<{ ID: string; SpaceExtensionEntity: string | null }>): void {
        SpaceSubtypeDirectory.byTypeId = new Map(types.map((type) => [type.ID.toLowerCase(), type.SpaceExtensionEntity?.trim() || null]));
    }

    /** The subtype the type names; null when it names none; undefined when the type isn't in the directory (not loaded yet). */
    public static Get(typeId: string | null | undefined): string | null | undefined {
        if (!typeId) return undefined;
        return SpaceSubtypeDirectory.byTypeId.get(typeId.toLowerCase());
    }
}

@RegisterClass(EntitySubtypeResolver, SPACES)
export class SpaceSubtypeResolver extends EntitySubtypeResolver {
    /** The subtype a new space gets: its type's. May read the type when the directory hasn't been filled, since the answer has to be right. */
    public override async Resolve(record: BaseEntity): Promise<string | null> {
        const typeId = record.Get('SpaceTypeID') as string | null;
        if (!typeId) return null;
        const known = SpaceSubtypeDirectory.Get(typeId);
        if (known !== undefined) return known;
        const provider = Metadata.Provider;
        const result = await new RunView(provider as unknown as ConstructorParameters<typeof RunView>[0]).RunView<{ SpaceExtensionEntity: string | null }>({
            EntityName: SPACE_TYPES,
            ExtraFilter: `ID = '${typeId.replace(/[^0-9a-fA-F-]/g, '')}'`,
            Fields: ['SpaceExtensionEntity'],
            ResultType: 'simple',
        }, record.ContextCurrentUser);
        if (!result.Success) throw new Error(`The subtype of the space's type could not be read: ${result.ErrorMessage ?? 'unknown error'}`);
        return result.Results?.[0]?.SpaceExtensionEntity?.trim() || null;
    }

    /** The subtype a loaded space most likely has: its type's, from memory. No hint (null) while the directory isn't filled. */
    public override ResolveLoadHint(record: BaseEntity): string | null {
        const typeId = record.Get('SpaceTypeID') as string | null;
        const known = SpaceSubtypeDirectory.Get(typeId);
        return known ?? null;
    }
}

/** Keeps the class from being tree-shaken away where only the entities package is imported. */
export function LoadSpaceSubtypeResolver(): void {}
