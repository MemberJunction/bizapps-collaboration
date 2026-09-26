import { Directive, Input } from '@angular/core';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';

/**
 * Base class for space overview card extensions registered by downstream apps.
 */
@Directive()
export abstract class BaseSpaceOverviewCard extends BaseAngularComponent {
    @Input() public SpaceId: string = '';
    @Input() public Sequence: number = 0;
}
