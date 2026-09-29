// @vitest-environment jsdom
import '@angular/compiler';
import { Component, EventEmitter, type Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TestBed, getTestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import type { BaseEntity } from '@memberjunction/core';
import type { EntityFormConfig } from '@memberjunction/ng-base-forms';
import { SpaceDetailsViewComponent } from './space-details-view.component.ts';

beforeAll(() => {
    getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
    TestBed.resetTestingModule();
    document.body.innerHTML = '';
});

/**
 * Test components are declared without decorator syntax (the tsconfig that covers this package leaves `*.test.ts` out, and the
 * toolchain reads `experimentalDecorators` from the tsconfig that covers a file). Calling the decorator is what `@Component` does.
 */
function declareComponent(target: Type<unknown>, metadata: Component): void {
    Component({ standalone: true, ...metadata })(target);
}

/** Stands in for MJ's form host and keeps what the page gave it, so a test can read the config that decides which sections show. */
class FormHostStub {
    public Record: unknown = null;
    public Config: EntityFormConfig | null = null;
    public EditMode: boolean | null = null;
}
declareComponent(FormHostStub, { selector: 'mj-entity-form-host', template: '<span class="form-host-stub"></span>', inputs: ['Record', 'Config', 'EditMode'] });

/** Stands in for the single-field control. */
class FormFieldStub {
    public Record: unknown = null;
    public FieldName = '';
    public EditMode = false;
    public ValueChange = new EventEmitter<{ FieldName: string }>();
}
declareComponent(FormFieldStub, { selector: 'mj-form-field', template: '<span class="field-stub">{{ FieldName }}</span>', inputs: ['Record', 'FieldName', 'EditMode'], outputs: ['ValueChange'] });

/** A component a type's UI driver might give, taking the record and the edit mode. */
class DriverDetails {
    public Record: unknown = null;
    public EditMode = false;
}
declareComponent(DriverDetails, { selector: 'driver-details', template: '<b class="driver-details">{{ EditMode ? "edit" : "read" }}</b>', inputs: ['Record', 'EditMode'] });

const record = { EntityInfo: { Name: 'Example Boards' } } as unknown as BaseEntity;

async function render(inputs: Record<string, unknown>) {
    // A test may render twice: each render starts from a fresh test module
    TestBed.resetTestingModule();
    TestBed.overrideComponent(SpaceDetailsViewComponent, { set: { imports: [CommonModule, FormHostStub, FormFieldStub] } });
    const fixture = TestBed.createComponent(SpaceDetailsViewComponent);
    fixture.componentRef.setInput('Record', record);
    for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
}

describe("a space's details, rendered", () => {
    it("mounts MemberJunction's form host on the subtype's record with only the subtype's sections, and no toolbar, related entities or links", async () => {
        const fixture = await render({ Presentation: 'form', FormSections: ['boardDetails'], EditMode: true });
        const host = (fixture.nativeElement as HTMLElement).querySelector('mj-entity-form-host')!;
        expect(host).not.toBeNull();
        const config = fixture.debugElement.query((el) => el.name === 'mj-entity-form-host').componentInstance as FormHostStub;
        expect(config.Record).toBe(record);
        expect(config.EditMode).toBe(true);
        expect(config.Config?.VisibleSectionKeys).toEqual(['boardDetails']);
        expect(config.Config?.Toolbar).toBeNull();
        expect(config.Config?.ShowRelatedEntities).toBe(false);
        expect(config.Config?.EnableRecordLinks).toBe(false);
        expect((fixture.nativeElement as HTMLElement).querySelector('mj-form-field')).toBeNull();
    });

    it('hands the form host the same config until the sections change, not a new one on every pass', async () => {
        const fixture = await render({ Presentation: 'form', FormSections: ['boardDetails'] });
        const stub = () => fixture.debugElement.query((el) => el.name === 'mj-entity-form-host').componentInstance as FormHostStub;
        const first = stub().Config;
        fixture.detectChanges();
        fixture.componentInstance.Changed.emit();
        fixture.detectChanges();
        expect(stub().Config).toBe(first);
        fixture.componentRef.setInput('FormSections', ['boardDetails', 'meetings']);
        fixture.detectChanges();
        expect(stub().Config?.VisibleSectionKeys).toEqual(['boardDetails', 'meetings']);
    });

    it('draws a field for each column when there is no form, bound to the record, read-only on the About card', async () => {
        const fields = [{ name: 'TermName', label: 'Term', required: true }, { name: 'Cadence', label: 'Cadence', required: false }];
        const editing = await render({ Presentation: 'fields', Fields: fields, EditMode: true });
        const names = Array.from((editing.nativeElement as HTMLElement).querySelectorAll('.field-stub')).map((el) => el.textContent);
        expect(names).toEqual(['TermName', 'Cadence']);
        expect((editing.nativeElement as HTMLElement).querySelector('mj-entity-form-host')).toBeNull();
        const stubs = editing.debugElement.queryAll((el) => el.name === 'mj-form-field').map((el) => el.componentInstance as FormFieldStub);
        expect(stubs.every((s) => s.Record === record && s.EditMode === true)).toBe(true);
        const reading = await render({ Presentation: 'fields', Fields: fields, EditMode: false });
        expect(reading.debugElement.queryAll((el) => el.name === 'mj-form-field').every((el) => (el.componentInstance as FormFieldStub).EditMode === false)).toBe(true);
    });

    it("mounts the type's own component with the record and the edit mode", async () => {
        const fixture = await render({ Presentation: 'component', Component: DriverDetails, EditMode: true });
        expect((fixture.nativeElement as HTMLElement).querySelector('.driver-details')?.textContent).toBe('edit');
        expect((fixture.nativeElement as HTMLElement).querySelector('mj-entity-form-host')).toBeNull();
    });

    it("says a change happened from what was typed (input, change, focus leaving) and from a field's own change event", async () => {
        const fixture = await render({ Presentation: 'fields', Fields: [{ name: 'TermName', label: 'Term', required: true }], EditMode: true });
        const changed = vi.fn();
        fixture.componentInstance.Changed.subscribe(changed);
        const root = (fixture.nativeElement as HTMLElement).querySelector('.details-view')!;
        root.dispatchEvent(new Event('input', { bubbles: true }));
        root.dispatchEvent(new Event('change', { bubbles: true }));
        root.dispatchEvent(new Event('focusout', { bubbles: true }));
        expect(changed).toHaveBeenCalledTimes(3);
        (fixture.debugElement.query((el) => el.name === 'mj-form-field').componentInstance as FormFieldStub).ValueChange.emit({ FieldName: 'TermName' });
        expect(changed).toHaveBeenCalledTimes(4);
    });
});
