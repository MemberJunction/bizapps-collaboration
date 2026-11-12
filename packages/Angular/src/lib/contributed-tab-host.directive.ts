import {
    ComponentRef,
    Directive,
    EventEmitter,
    Inject,
    Input,
    OnChanges,
    OnDestroy,
    Output,
    SimpleChanges,
    Type,
    ViewContainerRef,
    reflectComponentType,
} from '@angular/core';
import type { NewSpaceMeetingDraft, SpaceMeetingCardItem } from '@mj-biz-apps/collaboration-ng-widgets';

export interface ContributedMeetingTabInstance {
    completeSchedule?: () => void;
    failSchedule?: (errorMessage: string) => void;
    loadForSpace?: (spaceId: string) => Promise<void>;
}

export interface CreateSpaceMeetingEvent {
    draft: NewSpaceMeetingDraft;
    instance: ContributedMeetingTabInstance | null;
}

/**
 * Mounts a contributed space tab component via ViewContainerRef, forwarding only the
 * inputs declared on the target component (`reflectComponentType`) and subscribing
 * to its meeting workflow outputs (`CreateMeetingRequested`, `OpenMeetingChatRequested`,
 * `OpenMeetingRequested`).
 */
@Directive({
    selector: '[mjcContributedTabHost]',
    standalone: true,
})
export class CollabContributedTabHostDirective implements OnChanges, OnDestroy {
    @Input('mjcContributedTabHost') ComponentType: Type<unknown> | null = null;
    @Input() TabInputs: Record<string, unknown> = {};

    @Output() CreateMeetingRequested = new EventEmitter<CreateSpaceMeetingEvent>();
    @Output() OpenMeetingChatRequested = new EventEmitter<SpaceMeetingCardItem>();
    @Output() OpenMeetingRequested = new EventEmitter<SpaceMeetingCardItem>();

    private componentRef: ComponentRef<unknown> | null = null;
    private currentType: Type<unknown> | null = null;
    private declaredInputs = new Set<string>();
    private outputSubs: Array<{ unsubscribe(): void }> = [];

    constructor(@Inject(ViewContainerRef) private readonly vcr: ViewContainerRef) {}

    ngOnChanges(_changes: SimpleChanges): void {
        if (this.ComponentType !== this.currentType) {
            this.teardown();
            this.currentType = this.ComponentType;
            if (this.ComponentType) {
                const mirror = reflectComponentType(this.ComponentType);
                this.declaredInputs = new Set((mirror?.inputs ?? []).map((input) => input.templateName));
                this.componentRef = this.vcr.createComponent(this.ComponentType);
                this.bindOutputs(this.componentRef.instance as Record<string, unknown>, mirror?.outputs ?? []);
            }
        }

        if (this.componentRef) {
            for (const [key, value] of Object.entries(this.TabInputs ?? {})) {
                if (this.declaredInputs.has(key)) {
                    this.componentRef.setInput(key, value);
                }
            }
            this.componentRef.changeDetectorRef.markForCheck();
        }
    }

    ngOnDestroy(): void {
        this.teardown();
    }

    private bindOutputs(
        instance: Record<string, unknown> | null | undefined,
        outputs: ReadonlyArray<{ propName: string; templateName: string }>,
    ): void {
        if (!instance) return;
        const findEmitter = (name: string): EventEmitter<unknown> | null => {
            const match = outputs.find((o) => o.templateName === name || o.propName === name);
            const prop = match ? match.propName : name;
            const candidate = instance[prop] as EventEmitter<unknown> | undefined;
            return candidate && typeof candidate.subscribe === 'function' ? candidate : null;
        };

        const createEmitter = findEmitter('CreateMeetingRequested');
        if (createEmitter) {
            this.outputSubs.push(
                createEmitter.subscribe((draft: unknown) => {
                    this.CreateMeetingRequested.emit({
                        draft: draft as NewSpaceMeetingDraft,
                        instance: (this.componentRef?.instance as ContributedMeetingTabInstance) ?? null,
                    });
                }),
            );
        }

        const chatEmitter = findEmitter('OpenMeetingChatRequested');
        if (chatEmitter) {
            this.outputSubs.push(
                chatEmitter.subscribe((meeting: unknown) => {
                    this.OpenMeetingChatRequested.emit(meeting as SpaceMeetingCardItem);
                }),
            );
        }

        const openEmitter = findEmitter('OpenMeetingRequested');
        if (openEmitter) {
            this.outputSubs.push(
                openEmitter.subscribe((meeting: unknown) => {
                    this.OpenMeetingRequested.emit(meeting as SpaceMeetingCardItem);
                }),
            );
        }
    }

    private teardown(): void {
        for (const sub of this.outputSubs) {
            sub.unsubscribe();
        }
        this.outputSubs = [];
        this.declaredInputs.clear();
        if (this.componentRef) {
            this.componentRef.destroy();
            this.componentRef = null;
        }
        this.vcr.clear();
    }
}
