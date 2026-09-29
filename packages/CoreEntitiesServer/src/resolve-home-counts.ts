import type { IMetadataProvider, IRunQueryProvider, UserInfo } from '@memberjunction/core';
import { runHomeQuery } from './home-query.js';

const QUERY_NAME = 'Collaboration Home Counts';

/** What Home counts across every space a person reaches. */
export interface HomeCounts {
    /** Files on the Shared band. Only a file counts as a file: not a task, not a link. A file shared in two spaces counts once. */
    sharedFiles: number;
    /** Tasks filed in their spaces that are neither completed nor cancelled. A task filed in two spaces counts once. */
    openTasks: number;
    /** Invitations waiting on an owner, in spaces where their role may invite. Their own invitation is not one. */
    awaitingApproval: number;
}

interface HomeCountsRow {
    SharedFiles: number;
    OpenTasks: number;
    AwaitingApproval: number;
}

/** Runs the approved MJ query 'Collaboration Home Counts' for the signed-in person. One round trip answers all three. */
export async function resolveHomeCounts(provider: IMetadataProvider & IRunQueryProvider, user: UserInfo): Promise<HomeCounts> {
    const [row] = await runHomeQuery<HomeCountsRow>(provider, user, QUERY_NAME, "Home's counts");
    if (!row) throw new Error("Home's counts query returned no row.");
    return { sharedFiles: Number(row.SharedFiles), openTasks: Number(row.OpenTasks), awaitingApproval: Number(row.AwaitingApproval) };
}
