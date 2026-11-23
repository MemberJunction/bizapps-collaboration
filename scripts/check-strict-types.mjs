// Static gate verifying strict type safety (zero `any`, zero `unknown`, zero `BaseEntity.Get()/Set()`)
// across Sub-Epic S9 Slice 1 TypeScript source and test files.
//
//   node scripts/check-strict-types.mjs
//   node scripts/check-strict-types.mjs --self-test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const S9_STRICT_TYPE_FILES = [
    'metadata/entities/JSONType-interfaces/CollaborationSettings.ts',
    'packages/Core/src/approval-promotion.ts',
    'packages/Core/src/bindings.ts',
    'packages/Core/src/bound-agent-action-grants.ts',
    'packages/Core/src/chat-write-rules.test.ts',
    'packages/Core/src/chat-write-rules.ts',
    'packages/Core/src/configuration.ts',
    'packages/Core/src/docs-band.ts',
    'packages/Core/src/grants.ts',
    'packages/Core/src/index.ts',
    'packages/Core/src/s9-slice2-rules.test.ts',
    'packages/Core/src/scoped-prompt-parts.test.ts',
    'packages/Core/src/scoped-prompt-parts.ts',
    'packages/Core/src/substrate-contract.test.ts',
    'packages/Core/src/substrate-contract.ts',
    'packages/Core/src/turn-tools.ts',
    'packages/CoreEntitiesServer/src/approval-promotion.ts',
    'packages/CoreEntitiesServer/src/bound-agent-action-grants.ts',
    'packages/CoreEntitiesServer/src/chat-write-permission-provider.ts',
    'packages/CoreEntitiesServer/src/create-space.test.ts',
    'packages/CoreEntitiesServer/src/create-space.ts',
    'packages/CoreEntitiesServer/src/delivery-principal.ts',
    'packages/CoreEntitiesServer/src/ensure-space-for-record-operation.ts',
    'packages/CoreEntitiesServer/src/ensure-space-for-record.ts',
    'packages/CoreEntitiesServer/src/execute-space-chat-turn.ts',
    'packages/CoreEntitiesServer/src/index.ts',
    'packages/CoreEntitiesServer/src/resolve-bindings.ts',
    'packages/CoreEntitiesServer/src/scoped-prompt-parts.ts',
    'packages/CoreEntitiesServer/src/space-audience-actions.ts',
    'packages/CoreEntitiesServer/src/space-configuration.ts',
    'packages/CoreEntitiesServer/src/space-docs.ts',
    'packages/CoreEntitiesServer/src/SpaceGrantEntityServer.ts',
    'packages/CoreEntitiesServer/src/SpaceTypeEntityServer.ts',
    'packages/CoreEntitiesServer/src/substrate-adapter.ts',
    'packages/CoreEntitiesServer/src/subtype-details.ts',
    'packages/CoreEntitiesServer/src/turn-tools.ts',
    'packages/CoreEntitiesServer/src/__tests__/ensure-space-for-record.spec.ts',
    'packages/CoreEntitiesServer/src/__tests__/chat-write-permission-provider.spec.ts',
    'packages/CoreEntitiesServer/src/__tests__/scoped-prompt-parts.spec.ts',
    'packages/CoreEntitiesServer/src/__tests__/substrate-contract-bundle.spec.ts',
    'packages/CoreEntitiesServer/src/__tests__/bound-agent-action-grants.spec.ts',
    'packages/CoreEntitiesServer/src/__tests__/supports-audience-actions.spec.ts',
    'packages/CoreEntitiesServer/src/__tests__/approval-promotion-workflow.spec.ts',
    'packages/CoreEntitiesServer/src/__tests__/docs-band-integration.spec.ts',
    'packages/Entities/src/client.ts',
    'packages/IntegrationTests/src/__tests__/s9-world-data-model.integration.spec.ts',
    'packages/Server/src/create-space.resolver.ts',
    'packages/Server/src/ensure-space-for-record.resolver.ts',
    'packages/Server/src/index.ts',
    // Sub-Epic S10 Slice 1 strict-typed modules and tests
    'packages/Core/src/space-notices.ts',
    'packages/Core/src/space-notices.test.ts',
    'packages/EngineBase/src/space-notices.ts',
    'packages/EngineBase/src/__tests__/space-notices.spec.ts',
    'packages/CoreEntitiesServer/src/SpaceNoticeEventEntityServer.ts',
    'packages/CoreEntitiesServer/src/SpaceNoticeWatermarkEntityServer.ts',
    'packages/CoreEntitiesServer/src/SpaceDigestCheckpointEntityServer.ts',
    'packages/CoreEntitiesServer/src/__tests__/space-notices-server.spec.ts',
    'packages/Server/src/schema-entity-parity.test.ts',
    'packages/IntegrationTests/src/__tests__/s10-slice1-world-data-model.integration.spec.ts',
    // Sub-Epic S10 Slice 2 strict-typed modules and tests
    'packages/Core/src/notifications.ts',
    'packages/Core/src/notifications.test.ts',
    'packages/EngineBase/src/notifications.ts',
    'packages/EngineBase/src/CollaborationEngineBase.ts',
    'packages/EngineBase/src/__tests__/notifications.spec.ts',
    'packages/CoreEntitiesServer/src/comms-v2-notifications.ts',
    'packages/CoreEntitiesServer/src/CollaborationEngine.ts',
    'packages/CoreEntitiesServer/src/__tests__/comms-v2-notifications.spec.ts',
    'packages/Server/src/comms-v2-bridge.ts',
    'packages/Server/src/bootstrap-security-audits.test.ts',
    'packages/IntegrationTests/src/__tests__/s10-slice2-comms-v2-notifications.integration.spec.ts',
];

const STRICT_RULES = [
    {
        id: 'no-explicit-any',
        pattern: /(?::\s*any\b|\bas\s+any\b|<any>|Array<any>|Promise<any>|Record<[^,>\n]+,\s*any>)/g,
        description: 'explicit `any` type or cast is forbidden',
    },
    {
        id: 'no-unknown',
        pattern: /(?:\bas\s+unknown\b|:\s*unknown\b|<unknown>|Array<unknown>|Promise<unknown>|Record<[^,>\n]+,\s*unknown>)/g,
        description: '`unknown` type or cast is forbidden',
    },
    {
        id: 'no-base-entity-get-set',
        pattern: /\.(?:Get|Set)\s*\(\s*['"`]/g,
        description: 'string-keyed BaseEntity.Get()/Set() is forbidden',
    },
];

function stripCommentsAndStringsForScan(line) {
    return line.replace(/^\s*\/\/.*$/, '');
}

export function scanTextForViolations(filePath, text) {
    const violations = [];
    const lines = text.split('\n');
    lines.forEach((rawLine, index) => {
        const trimmed = rawLine.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
            return;
        }
        const line = stripCommentsAndStringsForScan(rawLine);
        for (const rule of STRICT_RULES) {
            rule.pattern.lastIndex = 0;
            if (rule.pattern.test(line)) {
                violations.push({
                    file: filePath,
                    line: index + 1,
                    rule: rule.id,
                    description: rule.description,
                    excerpt: trimmed,
                });
            }
        }
    });
    return violations;
}

function runSelfTest() {
    const clean = `
        export interface Sample { name: string; count: number; }
        export function ok(input: Sample): string { return input.name; }
    `;
    assert.deepEqual(scanTextForViolations('clean.ts', clean), []);

    const dirty = [
        'const a: any = 1;',
        'const b = value as unknown as Record<string, unknown>;',
        'const c = entity.Get("Name");',
        'entity.Set("Name", "test");',
    ].join('\n');
    const found = scanTextForViolations('dirty.ts', dirty);
    assert.equal(found.length, 4);
    assert.equal(found[0].rule, 'no-explicit-any');
    assert.equal(found[1].rule, 'no-unknown');
    assert.equal(found[2].rule, 'no-base-entity-get-set');
    assert.equal(found[3].rule, 'no-base-entity-get-set');
    console.log('check-strict-types: self-test passed (4/4 assertions)');
}

function main() {
    if (process.argv.includes('--self-test')) {
        runSelfTest();
        return;
    }

    const root = process.cwd();
    const allViolations = [];
    for (const relPath of S9_STRICT_TYPE_FILES) {
        const text = readFileSync(join(root, relPath), 'utf8');
        allViolations.push(...scanTextForViolations(relPath, text));
    }

    if (allViolations.length > 0) {
        console.error(`check-strict-types: found ${allViolations.length} violation(s):`);
        for (const v of allViolations) {
            console.error(`  ${v.file}:${v.line} [${v.rule}] ${v.description}: ${v.excerpt}`);
        }
        process.exit(1);
    }

    console.log(`check-strict-types: ok (${S9_STRICT_TYPE_FILES.length} files verified cleanly)`);
}

main();
