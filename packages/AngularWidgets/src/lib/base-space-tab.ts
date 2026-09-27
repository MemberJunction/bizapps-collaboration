import { Directive, Input } from '@angular/core';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';

/**
 * Base class for space tab extensions registered by downstream apps (such as Committees).
 */
@Directive()
export abstract class BaseSpaceTab extends BaseAngularComponent {
    @Input() public SpaceId: string = '';
    @Input() public SpaceTypeCode: string = '';
    @Input() public Sequence: number = 0;
}
