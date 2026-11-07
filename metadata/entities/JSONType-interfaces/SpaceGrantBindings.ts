/**
 * A space grant's bindings (MJ_BizApps_Collaboration: Space Grants.Bindings): the target's parameter or property names mapped
 * to where each value comes from (D27). The source of truth is packages/Core/src/grants.ts; this copy is what CodeGen reads.
 */

/** Where a bound value comes from (D27). A literal is a `Value`; anything else is resolved on the server. */
export type BindingExpression =
    | { From: `Anchor:${string}` | `Space.${string}` | `Config:${string}` | 'User.ID' | 'User.Email' | 'User.PersonID' }
    | { Value: string | number | boolean };

/** A grant's bindings: a parameter or property name of the target, mapped to where its value comes from. */
export type SpaceGrantBindings = Record<string, BindingExpression>;
