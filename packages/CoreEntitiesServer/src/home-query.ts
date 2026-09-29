import { type IMetadataProvider, RunQuery, type IRunQueryProvider, type UserInfo, WellKnownUserSource } from '@memberjunction/core';

const CATEGORY_PATH = 'Collaboration';

/**
 * Runs one of Collaboration's approved Home queries for the signed-in person. An MJ query isn't bound by row filters and takes
 * whatever `UserID` it is given, so only the Integration role may run them, and they are run here as the system user with the signed-in
 * person's own id: no caller passes the id, so no caller can ask for someone else's rows.
 */
export async function runHomeQuery<TRow>(provider: IMetadataProvider & IRunQueryProvider, user: UserInfo, queryName: string, what: string): Promise<TRow[]> {
    const system = await WellKnownUserSource.Instance.GetSystemUser(provider);
    if (!system) throw new Error(`The system user is not available, so ${what} cannot be read.`);
    const result = await new RunQuery(provider).RunQuery({ QueryName: queryName, CategoryPath: CATEGORY_PATH, Parameters: { UserID: user.ID } }, system);
    if (!result.Success) throw new Error(`${what[0].toUpperCase()}${what.slice(1)} could not be read: ${result.ErrorMessage ?? 'unknown error'}`);
    return (result.Results ?? []) as TRow[];
}
