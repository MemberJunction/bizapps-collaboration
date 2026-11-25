import { Directive, EventEmitter, Input, Output } from '@angular/core';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';
import type { SpaceArtifactOpenCallback, SpaceArtifactOpenRequest } from './artifact-slideover.component';

/**
 * Base class for space tab extensions registered by downstream apps (such as Committees).
 */
@Directive()
export abstract class BaseSpaceTab extends BaseAngularComponent {
    @Input() public SpaceId: string = '';
    @Input() public SpaceTypeCode: string = '';
    @Input() public Sequence: number = 0;
    /** Optional host-provided callback to open an `MJ: Artifacts` record in Collaboration's in-place slide-over. */
    @Input() public OpenArtifact?: SpaceArtifactOpenCallback;
    /** Emits when this space tab asks the Collaboration host to open an `MJ: Artifacts` record in-place. */
    @Output() public OpenArtifactRequested = new EventEmitter<SpaceArtifactOpenRequest>();
}
