const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A catalog id, quoted for SQL, or a throw. These values are interpolated. */
export function sqlUuid(value: string, label: string): string {
    if (!UUID.test(value)) throw new Error(`${label} is not a UUID: ${value}`);
    return `'${value}'`;
}

/** The MemberJunction core schema. Collaboration's own schema is not this name. */
export function coreSchema(): string {
    const name = process.env.MJ_CORE_SCHEMA || '__mj';
    if (!/^[_A-Za-z][_A-Za-z0-9]*$/.test(name)) throw new Error(`MJ_CORE_SCHEMA "${name}" is not a SQL identifier.`);
    return name;
}
