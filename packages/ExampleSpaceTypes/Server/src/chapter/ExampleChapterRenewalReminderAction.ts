/**
 * `Example: Chapter Renewal Reminder` (the plan's B24): the action the example-chapter type grants, with `ChapterID` bound to the
 * space's chapter anchor (D27). The server fills ChapterID in when the action runs for a space; an agent is never shown that input
 * and a value it sends for it is discarded (A16, stage 3). `DaysAhead` is the caller's own. Test-only: it writes nothing and returns
 * the reminder it would send, so the harness can see what the binding gave it.
 */
import { RegisterClass } from '@memberjunction/global';
import { BaseAction } from '@memberjunction/actions';
import type { ActionParam, ActionResultSimple, RunActionParams } from '@memberjunction/actions-base';

@RegisterClass(BaseAction, 'Example: Chapter Renewal Reminder')
export class ExampleChapterRenewalReminderAction extends BaseAction {
    protected async InternalRunAction(params: RunActionParams): Promise<ActionResultSimple> {
        const chapterId = this.valueOf(params.Params, 'ChapterID');
        if (!chapterId) return { Success: false, ResultCode: 'FAILED', Message: 'ChapterID is required: the grant binds it to the space\'s chapter anchor.' };
        const daysAhead = Number(this.valueOf(params.Params, 'DaysAhead') ?? 30);
        const message = `Renewal reminder drafted for chapter ${chapterId}: members whose renewal falls within ${Number.isFinite(daysAhead) ? daysAhead : 30} days.`;
        params.Params.push({ Name: 'Reminder', Type: 'Output', Value: message });
        return { Success: true, ResultCode: 'SUCCESS', Message: message };
    }

    private valueOf(params: ActionParam[], name: string): string | null {
        const found = params.find((param) => param.Name.toLowerCase() === name.toLowerCase());
        const value = found?.Value;
        return value === null || value === undefined || value === '' ? null : String(value);
    }
}

export function LoadExampleChapterRenewalReminderAction(): void {
    void ExampleChapterRenewalReminderAction;
}
