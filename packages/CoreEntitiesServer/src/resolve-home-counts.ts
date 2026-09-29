import { type IMetadataProvider, RunQuery, type IRunQueryProvider, type UserInfo, WellKnownUserSource } from '@memberjunction/core';

const QUERY_NAME = 'Collaboration Home Counts';
const CATEGORY_PATH = 'Collaboration';

/** What Home counts across every space a person reaches. */
export interface HomeCounts {
    /** Files on the Shared band. Only a file counts as a file: not a task, not a link. */
    sharedFiles: number;
    /** Tasks filed in their spaces that are neither completed nor cancelled. */
    openTasks: number;
    /** Invitations waiting on an owner, in spaces where their role may invite. Their own invitation is not one. */
    awaitingApproval: number;
}

interface HomeCountsRow {
    SharedFiles: number;
    OpenTasks: number;
    AwaitingApproval: number;
}

/**
 * Runs the approved MJ query 'Collaboration Home Counts' for the signed-in person. An MJ query isn't bound by row filters and takes
 * whatever `UserID` it is given, so only the Integration role may run it, and it is run here as the system user with the signed-in
 * person's own id: no caller passes the id, so no caller can ask for someone else's counts. One round trip answers all three.
 */
export async function resolveHomeCounts(provider: IMetadataProvider & IRunQueryProvider, user: UserInfo): Promise<HomeCounts> {
    const system = await WellKnownUserSource.Instance.GetSystemUser(provider);
    if (!system) throw new Error("The system user is not available, so Home's counts cannot be read.");
    const result = await new RunQuery(provider).RunQuery({ QueryName: QUERY_NAME, CategoryPath: CATEGORY_PATH, Parameters: { UserID: user.ID } }, system);
    if (!result.Success) throw new Error(`Home's counts could not be read: ${result.ErrorMessage ?? 'unknown error'}`);
    const row = (result.Results?.[0] ?? null) as HomeCountsRow | null;
    if (!row) throw new Error('Home\'s counts query returned no row.');
    return { sharedFiles: Number(row.SharedFiles), openTasks: Number(row.OpenTasks), awaitingApproval: Number(row.AwaitingApproval) };
}
