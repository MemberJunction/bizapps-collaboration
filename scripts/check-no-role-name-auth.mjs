// Collaboration must evaluate declarative MemberJunction Authorizations instead of hardcoded MJ role names (CT-5).
// Scans server and client production TypeScript source files under packages/ and fails if hardcoded role-name
// authorization comparisons or hardcoded staff/issuer role-name allowlists are introduced.
//
//   node scripts/check-no-role-name-auth.mjs
//   node scripts/check-no-role-name-auth.mjs --self-test
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'generated', '__tests__', 'IntegrationTests', 'ExampleSpaceTypes', 'UXGallery']);
const TEST_FILE = /\.(test|spec|test-support)\.ts$/;

/** Strip single-line and block comments while keeping string literals intact. */
function stripComments(source) {
    let out = '';
    let quote = null;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        const next = source[i + 1];

        if (inLineComment) {
            if (ch === '\n') {
                inLineComment = false;
                out += ch;
            }
            continue;
        }
        if (inBlockComment) {
            if (ch === '*' && next === '/') {
                inBlockComment = false;
                i++;
            } else if (ch === '\n') {
                out += '\n';
            }
            continue;
        }
        if (quote) {
            out += ch;
            if (ch === '\\') {
                out += source[i + 1] ?? '';
                i++;
            } else if (ch === quote) {
                quote = null;
            }
            continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') {
            quote = ch;
            out += ch;
            continue;
        }
        if (ch === '/' && next === '/') {
            inLineComment = true;
            i++;
            continue;
        }
        if (ch === '/' && next === '*') {
            inBlockComment = true;
            i++;
            continue;
        }
        out += ch;
    }
    return out;
}

const ROLE_NAME_LITERALS = ['UI', 'Developer', 'Integration', 'Space Participant', 'Staff', 'Administrator', 'Agent Administrator'];
const ROLE_NAME_ALT = ROLE_NAME_LITERALS.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

const VIOLATION_PATTERNS = [
    {
        reason: 'hardcoded staff/issuer role-name Set or array',
        regex: new RegExp(
            `(?:STAFF|inviteIssuerRoleNames|staffRoleNames)\\s*(?::[^=\\n]+)?[:=][^\\n;]*\\[(?=[^\\]]*['"\`](?:ui|developer|integration|staff|administrator|space participant)['"\`])[^\\]]*\\]`,
            'i',
        ),
    },
    {
        reason: 'direct comparison of UserRoles.Role / RoleName against a hardcoded MJ role name',
        regex: new RegExp(
            `(?:UserRoles[^;\\n]*?\\.Role(?:Name)?|\\b(?:userRole|roleEntry|roleInfo|r|role)\\.Role(?:Name)?(?:\\?\\.trim\\(\\))?(?:\\?\\.toLowerCase\\(\\))?)\\s*(?:===|!==|==|!=)\\s*['"\`](?:${ROLE_NAME_ALT})['"\`]`,
            'i',
        ),
    },
    {
        reason: 'UserRoles role-name lookup via Set.has or Array.includes against hardcoded MJ role name',
        regex: new RegExp(
            `['"\`](?:${ROLE_NAME_ALT})['"\`]\\s*===\\s*(?:[\\w.]+\\.Role(?:Name)?(?:\\?\\.trim\\(\\))?(?:\\?\\.toLowerCase\\(\\))?)|(?:\\.has|\\.includes)\\(\\s*['"\`](?:${ROLE_NAME_ALT})['"\`]`,
            'i',
        ),
    },
    {
        reason: 'hardcoded MJ role-name Set.has/Array.includes check on role row Name',
        regex: new RegExp(
            `\\[(?=[^\\]]*['"\`](?:ui|developer|integration|staff|space participant)['"\`])[^\\]]*\\]\\s*\\.includes\\(\\s*[\\w.?]+\\.(?:Role|RoleName|Name)`,
            'i',
        ),
    },
];

/** Returns an array of "file:line: reason" strings for any hardcoded role-name auth patterns found. */
export function findRoleNameAuthViolations(source, file) {
    const clean = stripComments(source);
    const lines = clean.split('\n');
    const violations = [];

    lines.forEach((line, idx) => {
        for (const { reason, regex } of VIOLATION_PATTERNS) {
            if (regex.test(line)) {
                violations.push(`${file}:${idx + 1}: ${reason}: ${line.trim().slice(0, 120)}`);
                break;
            }
        }
    });

    return violations;
}

function walk(dir, found) {
    for (const name of readdirSync(dir)) {
        if (SKIPPED_DIRS.has(name)) continue;
        const fullPath = join(dir, name);
        if (statSync(fullPath).isDirectory()) {
            walk(fullPath, found);
        } else if (name.endsWith('.ts') && !TEST_FILE.test(name)) {
            found.push(...findRoleNameAuthViolations(readFileSync(fullPath, 'utf8'), fullPath));
        }
    }
}

function selfTest() {
    const bad = [
        "const STAFF = new Set(['ui', 'developer', 'integration']);",
        "inviteIssuerRoleNames: ['UI', 'Developer', 'Integration'],",
        "inviteIssuerRoleNames: magic?.inviteIssuerRoleNames ?? ['UI', 'Developer', 'Integration'],",
        "const isStaff = user.UserRoles.some(r => r.Role === 'UI');",
        "if (role.Role?.toLowerCase() === 'space participant') return true;",
        "if (['UI', 'Developer'].includes(row.Name.trim())) return true;",
        "if (user.UserRoles.map(r => r.Role).includes('Staff')) return false;",
    ];
    const good = [
        "const ok = CollaborationEngine.Instance.UserCanIssueSpaceInviteLinks(user, provider);",
        "const staff = CollaborationEngine.Instance.UserHasStaffAuthorization(inviteeUser, provider);",
        "grantableRoleNames: ['Space Participant'],",
        "detail.Role = 'User';",
        "const isAssistant = row.Role === 'AI';",
        "// Comment mentioning const STAFF = new Set(['ui', 'developer', 'integration']);",
    ];

    const failures = [
        ...bad
            .filter((line) => findRoleNameAuthViolations(line, 'bad.ts').length === 0)
            .map((line) => `should be flagged: ${line}`),
        ...good
            .flatMap((line) => findRoleNameAuthViolations(line, 'good.ts'))
            .map((hit) => `false positive: ${hit}`),
    ];

    if (failures.length > 0) {
        for (const failure of failures) console.error(failure);
        process.exit(1);
    }
    console.log('no-role-name-auth check self-test ok');
}

if (process.argv.includes('--self-test')) {
    selfTest();
    process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith('check-no-role-name-auth.mjs')) {
    const violations = [];
    walk('packages', violations);
    if (violations.length > 0) {
        for (const v of violations) console.error(v);
        console.error(`${violations.length} hardcoded role-name authorization check(s) found. Use declarative MJ Authorizations instead.`);
        process.exit(1);
    }
    console.log('No hardcoded role-name authorization checks found in packages/.');
}
