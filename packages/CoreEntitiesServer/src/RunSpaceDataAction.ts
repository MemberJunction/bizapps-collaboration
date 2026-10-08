/**
 * `Collaboration: Run Space Data` (B20): the one action through which an agent runs the queries and views granted in a space.
 * The turn hands it, in the run's context, the space and the grants in force for the conversation's audience; `Name` must be
 * one of them, `Values` may set only the target's own parameters (the bound ones are the server's, B17 refuses a value for
 * them), and the rows come back as JSON. It calls B17's operations as code, as the caller, with the agent run's id for the log.
 */
import { Metadata, type IMetadataProvider } from '@memberjunction/core';
import { RegisterClass } from '@memberjunction/global';
import { BaseAction } from '@memberjunction/actions';
import type { ActionParam, ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';
import { type ClientValues, runSpaceQuery, runSpaceView } from './grant-operations.js';
import { findSpaceDataGrant, RUN_SPACE_DATA_ACTION_NAME, type SpaceTurnContext } from './turn-tools.js';

/** Rows beyond this are counted, not returned, so a wide result does not flood the model. */
const MAX_ROWS_RETURNED = 200;

@RegisterClass(BaseAction, RUN_SPACE_DATA_ACTION_NAME)
export class RunSpaceDataAction extends BaseAction {
    protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
        const context = (params.Context ?? {}) as Partial<SpaceTurnContext>;
        if (!context.spaceId || !Array.isArray(context.spaceData)) {
            return { Success: false, ResultCode: 'FAILED', Message: 'Run space data runs only inside a space conversation turn, which names the space and the grants in force.' };
        }
        const name = this.stringOf(params.Params, 'Name');
        if (!name) return { Success: false, ResultCode: 'FAILED', Message: `Name is required: one of ${this.allowedNames(context.spaceData)}.` };
        const grant = findSpaceDataGrant(context.spaceData, name);
        if (!grant) return { Success: false, ResultCode: 'FAILED', Message: `"${name}" is not granted in this conversation. The names in force are ${this.allowedNames(context.spaceData)}.` };

        const values = this.valuesOf(params.Params, 'Values');
        if (values === undefined) return { Success: false, ResultCode: 'FAILED', Message: 'Values must be an object of the target\'s parameters by name, or left out.' };
        const unknown = Object.keys(values ?? {}).filter((key) => !grant.Parameters.some((p) => p.toLowerCase() === key.toLowerCase()));
        if (unknown.length) {
            return { Success: false, ResultCode: 'FAILED', Message: `${grant.Name} takes ${grant.Parameters.length ? grant.Parameters.join(', ') : 'no parameters'}; ${unknown.join(', ')} ${unknown.length === 1 ? 'is' : 'are'} not its to set.` };
        }

        const provider: IMetadataProvider = params.Provider ?? Metadata.Provider;
        const request = { provider, user: params.ContextUser, spaceId: context.spaceId, grantId: grant.GrantID, clientValues: values, agentRunId: context.agentRunId ?? null };
        const outcome = grant.Kind === 'Query' ? await runSpaceQuery(request) : await runSpaceView(request);
        if (!outcome.ok) return { Success: false, ResultCode: 'FAILED', Message: outcome.message };

        const rows = outcome.rows.slice(0, MAX_ROWS_RETURNED);
        params.Params.push({ Name: 'Rows', Type: 'Output', Value: rows });
        params.Params.push({ Name: 'RowCount', Type: 'Output', Value: outcome.rowCount });
        const note = outcome.rowCount > rows.length ? ` (the first ${rows.length} of ${outcome.rowCount} rows)` : '';
        return { Success: true, ResultCode: 'SUCCESS', Message: `${grant.Name}: ${outcome.rowCount} row${outcome.rowCount === 1 ? '' : 's'}${note}\n${JSON.stringify(rows)}` };
    }

    private allowedNames(spaceData: readonly { Name: string }[]): string {
        return spaceData.length ? spaceData.map((g) => `"${g.Name}"`).join(', ') : 'none';
    }

    private stringOf(params: ActionParam[], name: string): string | null {
        const value = params.find((p) => p.Name.toLowerCase() === name.toLowerCase())?.Value;
        return value === null || value === undefined || String(value).trim() === '' ? null : String(value);
    }

    /** The Values input as an object: absent gives null; a JSON string is parsed; anything else is refused (undefined). */
    private valuesOf(params: ActionParam[], name: string): ClientValues | null | undefined {
        const raw = params.find((p) => p.Name.toLowerCase() === name.toLowerCase())?.Value;
        if (raw === null || raw === undefined || raw === '') return null;
        let value: unknown = raw;
        if (typeof raw === 'string') {
            try { value = JSON.parse(raw); } catch { return undefined; }
        }
        if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
        const out: ClientValues = {};
        for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
            if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[key] = v;
            else out[key] = JSON.stringify(v);
        }
        return out;
    }
}

export function LoadRunSpaceDataAction(): void {
    void RunSpaceDataAction;
}
