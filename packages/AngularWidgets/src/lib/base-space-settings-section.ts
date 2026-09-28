import { Directive, Input } from '@angular/core';
import { BaseAngularComponent } from '@memberjunction/ng-base-types';

/**
 * Base class for space settings section extensions registered by downstream apps.
 */
@Directive()
export abstract class BaseSpaceSettingsSection extends BaseAngularComponent {
    @Input() public SpaceId: string = '';
    @Input() public SpaceTypeCode: string = '';
    @Input() public Sequence: number = 0;
}
