/**
 * SPDX-License-Identifier: BUSL-1.1
 *
 * OpenApp v3 Readiness, Dual Form Registration Parity, Navigation Parity,
 * --mj-* CSS Design Token Compliance, and Zero Server-Import Boundary Tests.
 */
// @vitest-environment jsdom
import '@angular/compiler';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MJGlobal } from '@memberjunction/global';
import { BaseFormComponent } from '@memberjunction/ng-base-forms';
import { BaseResourceComponent } from '@memberjunction/ng-shared';
import { LoadBizAppsCollaborationClient } from '../public-api.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');

const ALL_GENERATED_ENTITY_NAMES: readonly string[] = [
    'MJ_BizApps_Collaboration: Item Uses',
    'MJ_BizApps_Collaboration: Share Notices',
    'MJ_BizApps_Collaboration: Space Agent Source Receipts',
    'MJ_BizApps_Collaboration: Space Anchors',
    'MJ_BizApps_Collaboration: Space Chats',
    'MJ_BizApps_Collaboration: Space Digest Checkpoints',
    'MJ_BizApps_Collaboration: Space Grants',
    'MJ_BizApps_Collaboration: Space Items',
    'MJ_BizApps_Collaboration: Space Member Pins',
    'MJ_BizApps_Collaboration: Space Members',
    'MJ_BizApps_Collaboration: Space Notes',
    'MJ_BizApps_Collaboration: Space Notice Events',
    'MJ_BizApps_Collaboration: Space Notice Watermarks',
    'MJ_BizApps_Collaboration: Space Role Types',
    'MJ_BizApps_Collaboration: Space Type Status',
    'MJ_BizApps_Collaboration: Space Types',
    'MJ_BizApps_Collaboration: Spaces',
];

// Dynamically constructed regex patterns so static token scanners never mistake test code for CSS literals.
const RAW_COLOR_PATTERN = new RegExp('#[0-9a-fA-F]{3,8}\\b|\\b(?:rg' + 'ba?|hs' + 'la?)\\(', 'g');
const FALLBACK_WRAPPER_PATTERN = new RegExp(
    'var\\(--[a-z0-9-]+\\s*,\\s*(?:#[0-9a-fA-F]{3,8}|(?:rg' + 'ba?|hs' + 'la?)\\([^)]*\\))\\s*\\)',
    'g',
);

function collectSourceFiles(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        if (name === 'node_modules' || name === 'dist' || name === 'generated' || name === '__tests__') {
            continue;
        }
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            collectSourceFiles(full, out);
        } else if (/\.(ts|html|css|scss)$/.test(name) && !/\.(test|spec)\.ts$/.test(name)) {
            out.push(full);
        }
    }
    return out;
}

describe('OpenApp v3 registration parity, NavigationService hygiene, and --mj-* token compliance', () => {
    it('registers BaseResourceComponent and all 17 entity BaseFormComponent classes reachable from mj-app.json startupExport', () => {
        const mjApp = JSON.parse(readFileSync(resolve(repoRoot, 'mj-app.json'), 'utf8')) as {
            packages: { client: Array<{ name: string; startupExport?: string }> };
        };
        const ngBootstrap = mjApp.packages.client.find((p) => p.name === '@mj-biz-apps/collaboration-ng');
        expect(ngBootstrap?.startupExport).toBe('LoadBizAppsCollaborationClient');

        LoadBizAppsCollaborationClient();

        const resourceReg = MJGlobal.Instance.ClassFactory.GetRegistration(
            BaseResourceComponent,
            'CollaborationSectionResource',
        );
        expect(resourceReg, 'CollaborationSectionResource must be registered on BaseResourceComponent').toBeDefined();

        for (const entityName of ALL_GENERATED_ENTITY_NAMES) {
            const formReg = MJGlobal.Instance.ClassFactory.GetRegistration(BaseFormComponent, entityName);
            expect(formReg, `Expected active BaseFormComponent ClassFactory registration for "${entityName}"`).toBeDefined();
        }

        const appsJson = JSON.parse(
            readFileSync(resolve(repoRoot, 'metadata/applications/.applications.json'), 'utf8'),
        ) as Array<{ fields: { DefaultNavItems: string } }>;
        const navItems = JSON.parse(appsJson[0].fields.DefaultNavItems) as Array<{ DriverClass: string }>;
        expect(navItems.some((item) => item.DriverClass === 'CollaborationSectionResource')).toBe(true);
    });

    it('enforces OnPush, @if/@for, inject(), deferred NotifyLoadStarted(), <mj-page-layout>, NotifyLoadComplete(), zero localStorage, zero window.print(), and zero server imports', () => {
        const sectionSrc = readFileSync(resolve(repoRoot, 'packages/Angular/src/lib/collaboration-section.component.ts'), 'utf8');
        const notesSrc = readFileSync(resolve(repoRoot, 'packages/AngularWidgets/src/lib/space-notes.component.ts'), 'utf8');
        const railSrc = readFileSync(resolve(repoRoot, 'packages/AngularWidgets/src/lib/space-rail.component.ts'), 'utf8');
        const noteLogicSrc = readFileSync(resolve(repoRoot, 'packages/Angular/src/lib/logic/note-to-document.ts'), 'utf8');

        expect(sectionSrc).toContain('ChangeDetectionStrategy.OnPush');
        expect(notesSrc).toContain('ChangeDetectionStrategy.OnPush');
        expect(sectionSrc).toContain('<mj-page-layout');
        expect(sectionSrc).toContain('queueMicrotask');
        expect(sectionSrc).toContain('this.NotifyLoadStarted()');
        expect(sectionSrc).toContain('this.NotifyLoadComplete()');
        expect(sectionSrc).toContain('inject(');
        expect(sectionSrc).toContain('@if (');
        expect(sectionSrc).toContain('@for (');
        expect(notesSrc).toContain('@if (');
        expect(notesSrc).toContain('@for (');
        expect(railSrc).toContain('UserInfoEngine');

        // Zero raw Angular Router navigation, zero localStorage, zero window.print(), zero server-package imports
        for (const src of [sectionSrc, notesSrc, noteLogicSrc]) {
            expect(src).not.toContain('@angular/router');
            expect(src).not.toContain('localStorage');
            expect(src).not.toContain('sessionStorage');
            expect(src).not.toContain('window.print(');
            expect(src).not.toContain('@mj-biz-apps/collaboration-core-entities-server');
            expect(src).not.toContain('upload-space-file');
        }
    });

    it('enforces zero raw #hex/rgb/rgba/hsl color literals in SpaceNotes and across Angular & AngularWidgets stylesheets', () => {
        // Strict zero-literal check (not even inside fallbacks) on upgraded SpaceNotes component
        const notesSrc = readFileSync(resolve(repoRoot, 'packages/AngularWidgets/src/lib/space-notes.component.ts'), 'utf8');
        expect(notesSrc.match(RAW_COLOR_PATTERN) ?? []).toEqual([]);

        // Full scan across packages/Angular/src and packages/AngularWidgets/src
        const files = [
            ...collectSourceFiles(resolve(repoRoot, 'packages/Angular/src')),
            ...collectSourceFiles(resolve(repoRoot, 'packages/AngularWidgets/src')),
        ];
        expect(files.length).toBeGreaterThan(20);

        for (const filePath of files) {
            const content = readFileSync(filePath, 'utf8');
            expect(content, `Forbidden window.print() in ${filePath}`).not.toContain('window.print(');
            expect(content, `Forbidden localStorage in ${filePath}`).not.toContain('localStorage');

            const lines = content.split('\n');
            let inBlockComment = false;
            for (let i = 0; i < lines.length; i += 1) {
                const line = lines[i];
                if (line.includes('hex-ok')) continue;
                let cleaned = '';
                for (let j = 0; j < line.length; j += 1) {
                    if (inBlockComment) {
                        const end = line.indexOf('*/', j);
                        if (end < 0) {
                            cleaned = '';
                            break;
                        }
                        j = end + 1;
                        inBlockComment = false;
                        continue;
                    }
                    if (line[j] === '/' && line[j + 1] === '*') {
                        inBlockComment = true;
                        j += 1;
                        continue;
                    }
                    if (line[j] === '/' && line[j + 1] === '/' && (j === 0 || /\s/.test(line[j - 1]))) {
                        break;
                    }
                    cleaned += line[j];
                }
                const stripped = cleaned
                    .replace(FALLBACK_WRAPPER_PATTERN, '')
                    .replace(/href\s*=\s*"#[^"]*"/g, '')
                    .replace(/\burl\(\s*['"]?#[^)]*\)/g, '');
                const matches = stripped.match(RAW_COLOR_PATTERN) ?? [];
                expect(matches, `Raw color literal in ${filePath}:${i + 1}`).toEqual([]);
            }
        }
    });
});
