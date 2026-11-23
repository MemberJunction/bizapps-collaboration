// @vitest-environment jsdom
import '@angular/compiler';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MJGlobal } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import { BaseResourceComponent } from '@memberjunction/ng-shared';
import { CollaborationSectionResource } from './collaboration-section.component.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');

describe('CollaborationSectionResource XS-8 upload ingest disclosure & OpenApp v3 parity', () => {
  it('wires XS-8 upload ingest disclosure into Library and Upload Dialog while preserving OnPush, <mj-page-layout>, NotifyLoadComplete, DefaultNavItems, and ClassFactory registrations', async () => {
    const publicApi = await import('../../dist/public-api.js');
    publicApi.LoadBizAppsCollaborationClient();
    void publicApi.mjBizAppsCollaborationSpaceAgentSourceReceiptFormComponent;
    void CollaborationSectionResource;

    const resourceReg = MJGlobal.Instance.ClassFactory.GetRegistration(
      BaseResourceComponent,
      'CollaborationSectionResource',
    );
    expect(resourceReg).toBeDefined();

    const formReg = MJGlobal.Instance.ClassFactory.GetRegistration(
      BaseFormComponent,
      'MJ_BizApps_Collaboration: Space Agent Source Receipts',
    );
    expect(formReg).toBeDefined();

    const appsJson = JSON.parse(
      readFileSync(resolve(repoRoot, 'metadata/applications/.applications.json'), 'utf8'),
    ) as Array<{ fields: { DefaultNavItems: string } }>;
    const navItems = JSON.parse(appsJson[0].fields.DefaultNavItems) as Array<{ DriverClass: string }>;
    expect(navItems.some((item) => item.DriverClass === 'CollaborationSectionResource')).toBe(true);

    const sectionSrc = readFileSync(resolve(here, 'collaboration-section.component.ts'), 'utf8');
    expect(sectionSrc).toContain('ChangeDetectionStrategy.OnPush');
    expect(sectionSrc).toContain('<mj-page-layout');
    expect(sectionSrc).toContain('NotifyLoadComplete(');
    expect(sectionSrc).toContain('[ShowUploadDisclosure]="canAddHere"');
    expect(sectionSrc).toContain('[AgentRetrieval]="spaceSettings.agentRetrieval || \'Included\'"');
    expect(sectionSrc).not.toContain('window.print(');
  });
});
