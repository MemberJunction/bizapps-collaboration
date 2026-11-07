import { RegisterClassEx } from '@memberjunction/global';
import {
    BaseAgendaProvider,
    BaseNeedsYouProvider,
    BaseSpaceHeaderChipProvider,
    type AgendaItem,
    type NeedsYouItem,
    type SpaceBatchContext,
    type SpaceHeaderChip,
} from '@mj-biz-apps/collaboration-core';

@RegisterClassEx(BaseAgendaProvider, {
    key: 'example-board:agenda-provider',
    metadata: {
        spaceTypes: ['example-board'],
    },
})
export class ExampleBoardAgendaProvider extends BaseAgendaProvider {
    public override async getItemsForSpaces(context: SpaceBatchContext): Promise<AgendaItem[]> {
        const items: AgendaItem[] = [];
        for (const spaceId of context.spaceIds) {
            items.push({
                id: `meeting-${spaceId}-q3`,
                spaceId,
                title: 'Q3 Audit Committee Meeting',
                context: 'Boardroom, 12th floor & Video · 4:00 PM',
                date: new Date('2026-10-02T16:00:00Z'),
                typeIcon: 'fa-regular fa-calendar-days',
                sourceProvider: 'example-board:agenda-provider',
            });
        }
        return items;
    }
}

@RegisterClassEx(BaseNeedsYouProvider, {
    key: 'example-board:needs-you-provider',
    metadata: {
        spaceTypes: ['example-board'],
    },
})
export class ExampleBoardNeedsYouProvider extends BaseNeedsYouProvider {
    public override async getItemsForSpaces(context: SpaceBatchContext): Promise<NeedsYouItem[]> {
        const items: NeedsYouItem[] = [];
        for (const spaceId of context.spaceIds) {
            items.push({
                id: `vote-${spaceId}-motion-2026-14`,
                spaceId,
                title: 'Motion 2026-14: Appoint External Auditor',
                description: 'Your vote is needed on the external audit appointment before Wed 5:00 PM',
                actionLabel: 'Vote now',
                actionType: 'vote',
                urgency: 'high',
                sourceProvider: 'example-board:needs-you-provider',
                createdAt: new Date('2026-09-25T12:00:00Z'),
            });
        }
        return items;
    }
}

@RegisterClassEx(BaseSpaceHeaderChipProvider, {
    key: 'example-board:chip-provider',
    metadata: {
        spaceTypes: ['example-board'],
    },
})
export class ExampleBoardHeaderChipProvider extends BaseSpaceHeaderChipProvider {
    public override async getChipsForSpaces(context: SpaceBatchContext): Promise<Map<string, SpaceHeaderChip[]>> {
        const result = new Map<string, SpaceHeaderChip[]>();
        for (const spaceId of context.spaceIds) {
            result.set(spaceId, [
                {
                    id: 'term-chip',
                    label: 'FY2026 term',
                    variant: 'plain',
                },
                {
                    id: 'cadence-chip',
                    label: 'Meets quarterly',
                    variant: 'plain',
                },
            ]);
        }
        return result;
    }
}
