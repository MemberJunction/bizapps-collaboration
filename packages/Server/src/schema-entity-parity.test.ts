import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
    mjBizAppsCollaborationSpaceSchema,
    mjBizAppsCollaborationSpaceTypeSchema,
} from '@mj-biz-apps/collaboration-entities';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, 'generated/graphql-schemas/__mj_BizAppsCollaboration.ts');

function extractFieldNamesByClass(filePath: string): Map<string, Set<string>> {
    const sourceText = readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
    const fieldsByClass = new Map<string, Set<string>>();

    for (const stmt of sourceFile.statements) {
        if (!ts.isClassDeclaration(stmt) || !stmt.name) continue;
        const className = stmt.name.text;
        const fields = new Set<string>();
        for (const member of stmt.members) {
            if (!ts.isPropertyDeclaration(member) || !ts.isIdentifier(member.name)) continue;
            const decorators = ts.getDecorators(member) ?? [];
            const hasFieldDecorator = decorators.some((dec) => {
                if (!ts.isCallExpression(dec.expression)) return false;
                return ts.isIdentifier(dec.expression.expression) && dec.expression.expression.text === 'Field';
            });
            if (hasFieldDecorator) {
                fields.add(member.name.text);
            }
        }
        fieldsByClass.set(className, fields);
    }
    return fieldsByClass;
}

describe('GraphQL schema to Entity parity (CR-3)', () => {
    it('places TargetApplicationID and TargetApplication on SpaceType only and never on Space', () => {
        const fieldsByClass = extractFieldNamesByClass(schemaPath);

        const spaceTypeGql = fieldsByClass.get('mjBizAppsCollaborationSpaceType_');
        const spaceTypeCreateGql = fieldsByClass.get('CreatemjBizAppsCollaborationSpaceTypeInput');
        const spaceTypeUpdateGql = fieldsByClass.get('UpdatemjBizAppsCollaborationSpaceTypeInput');
        const spaceGql = fieldsByClass.get('mjBizAppsCollaborationSpace_');
        const spaceCreateGql = fieldsByClass.get('CreatemjBizAppsCollaborationSpaceInput');
        const spaceUpdateGql = fieldsByClass.get('UpdatemjBizAppsCollaborationSpaceInput');

        assert.ok(spaceTypeGql, 'mjBizAppsCollaborationSpaceType_ class must exist in generated schema');
        assert.ok(spaceTypeCreateGql, 'CreatemjBizAppsCollaborationSpaceTypeInput must exist');
        assert.ok(spaceTypeUpdateGql, 'UpdatemjBizAppsCollaborationSpaceTypeInput must exist');
        assert.ok(spaceGql, 'mjBizAppsCollaborationSpace_ class must exist in generated schema');
        assert.ok(spaceCreateGql, 'CreatemjBizAppsCollaborationSpaceInput must exist');
        assert.ok(spaceUpdateGql, 'UpdatemjBizAppsCollaborationSpaceInput must exist');

        // SpaceType entity & GraphQL schema must carry TargetApplicationID + TargetApplication
        assert.equal('TargetApplicationID' in mjBizAppsCollaborationSpaceTypeSchema.shape, true);
        assert.equal('TargetApplication' in mjBizAppsCollaborationSpaceTypeSchema.shape, true);
        assert.equal(spaceTypeGql.has('TargetApplicationID'), true);
        assert.equal(spaceTypeGql.has('TargetApplication'), true);
        assert.equal(spaceTypeCreateGql.has('TargetApplicationID'), true);
        assert.equal(spaceTypeUpdateGql.has('TargetApplicationID'), true);

        // Space entity & GraphQL schema must NOT carry TargetApplicationID or TargetApplication
        assert.equal('TargetApplicationID' in mjBizAppsCollaborationSpaceSchema.shape, false);
        assert.equal('TargetApplication' in mjBizAppsCollaborationSpaceSchema.shape, false);
        assert.equal(spaceGql.has('TargetApplicationID'), false);
        assert.equal(spaceGql.has('TargetApplication'), false);
        assert.equal(spaceCreateGql.has('TargetApplicationID'), false);
        assert.equal(spaceCreateGql.has('TargetApplication'), false);
        assert.equal(spaceUpdateGql.has('TargetApplicationID'), false);
        assert.equal(spaceUpdateGql.has('TargetApplication'), false);

        // Verify full field-name parity between Zod entity schemas and GraphQL @ObjectType classes
        const normalizeField = (name: string) => name.replace(/^__mj_/, '_mj__');
        const spaceEntityFields = new Set(Object.keys(mjBizAppsCollaborationSpaceSchema.shape).map(normalizeField));
        const spaceTypeEntityFields = new Set(Object.keys(mjBizAppsCollaborationSpaceTypeSchema.shape).map(normalizeField));

        for (const field of spaceEntityFields) {
            assert.equal(spaceGql.has(field), true, `Expected Space GraphQL type to contain entity field '${field}'`);
        }
        for (const field of spaceGql) {
            if (field === 'ReadableFields___') continue;
            assert.equal(spaceEntityFields.has(field), true, `Unexpected extra field '${field}' on mjBizAppsCollaborationSpace_ not in Space entity schema`);
        }

        for (const field of spaceTypeEntityFields) {
            assert.equal(spaceTypeGql.has(field), true, `Expected SpaceType GraphQL type to contain entity field '${field}'`);
        }
        for (const field of spaceTypeGql) {
            if (field === 'ReadableFields___') continue;
            assert.equal(spaceTypeEntityFields.has(field), true, `Unexpected extra field '${field}' on mjBizAppsCollaborationSpaceType_ not in SpaceType entity schema`);
        }
    });
});
