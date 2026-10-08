// MJ's components are used as they are, by the input names they have now. Fails when a template binds a name MJ deprecated on
// `mjButton` or `mj-loading`. The names come from MJ's installed declaration files, where each deprecated input or output is
// marked `@deprecated` (as `check-mj-tokens.mjs` takes MJ's stylesheet), so a name MJ deprecates later is caught without a change
// here. Generated files are CodeGen's and are not scanned.
//
//   node scripts/check-mj-inputs.mjs
//   node scripts/check-mj-inputs.mjs --self-test
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'generated']);
const TEMPLATE_FILE = /\.(ts|html)$/;
/** A tag of the elements MJ's two components sit on. A `>` inside a quoted binding, as in `(click)="go(a => b)"`, does not end it. */
const TAG = /<(button|a|mj-loading)\b(?:[^>"']|"[^"]*"|'[^']*')*>/g;

/** Where each component's declaration file is: resolved from the widgets package, which depends on both. */
const require = createRequire(join(process.cwd(), 'packages', 'AngularWidgets', 'package.json'));
const DECLARATIONS = {
    mjButton: ['@memberjunction/ng-ui-components', 'dist/lib/button/button.directive.d.ts'],
    'mj-loading': ['@memberjunction/ng-shared-generic', 'dist/lib/loading/loading.component.d.ts'],
};

/** The inputs and outputs a declaration file marks `@deprecated`: each is the setter, getter or property right under a doc comment that says so. */
export function deprecatedNames(declaration) {
    const names = new Set();
    const pattern = /\/\*\*(?:(?!\*\/)[\s\S])*?@deprecated(?:(?!\*\/)[\s\S])*\*\/\s*(?:(?:set|get)\s+)?(\w+)\s*[(:]/g;
    for (const match of declaration.matchAll(pattern)) names.add(match[1]);
    return names;
}

function readDeprecatedNames() {
    const found = {};
    for (const [component, [packageName, file]] of Object.entries(DECLARATIONS)) {
        const path = join(dirname(require.resolve(`${packageName}/package.json`)), file);
        found[component] = deprecatedNames(readFileSync(path, 'utf8'));
        if (found[component].size === 0) throw new Error(`${path} marks nothing @deprecated: the check would test nothing`);
    }
    return found;
}

/** The attributes of one tag with their quoted values blanked, so a value's words are not read as names. */
function attributesOf(tag) {
    return tag.replace(/"[^"]*"|'[^']*'/g, '""');
}

/** The pattern for an attribute of one of the names: `name=`, `[name]=`, `(name)=` or `[(name)]=`, spaces allowed before `=`, or bare. */
function bindingOf(names) {
    const alternatives = [...names].map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    return new RegExp(`\\s(?:\\[\\(|\\[|\\()?(${alternatives})(?:\\)\\]|\\]|\\))?(?:\\s*=|(?=[\\s>/]))`);
}

/** The deprecated input names one file's templates bind, as "file:line: what". */
export function findDeprecatedInputs(text, file, deprecated) {
    const found = [];
    const patterns = { mjButton: bindingOf(deprecated.mjButton), 'mj-loading': bindingOf(deprecated['mj-loading']) };
    for (const match of text.matchAll(TAG)) {
        const attributes = attributesOf(match[0]);
        const line = text.slice(0, match.index).split('\n').length;
        const component = match[1] === 'mj-loading' ? 'mj-loading' : /\smjButton(?=[\s>/])/.test(attributes) ? 'mjButton' : null;
        if (!component) continue;
        const name = attributes.match(patterns[component])?.[1];
        if (name) found.push(`${file}:${line}: ${component} binds the deprecated "${name}"`);
    }
    return found;
}

function walk(dir, found, deprecated) {
    for (const name of readdirSync(dir)) {
        if (SKIPPED_DIRS.has(name)) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path, found, deprecated);
        else if (TEMPLATE_FILE.test(name)) found.push(...findDeprecatedInputs(readFileSync(path, 'utf8'), path, deprecated));
    }
}

function selfTest() {
    const names = deprecatedNames(`
        Variant: MjButtonVariant;
        /** @deprecated Use {@link Variant}. */
        set variant(value: MjButtonVariant);
        /** @deprecated Use {@link Variant}. */
        get variant(): MjButtonVariant;
        SelectedChange: EventEmitter<boolean>;
        /**
         * Emits with the new state.
         * @deprecated Use {@link SelectedChange}.
         */
        selectedChange: EventEmitter<boolean>;
        get isPrimary(): boolean;
    `);
    if ([...names].sort().join(',') !== 'selectedChange,variant') throw new Error(`self-test: deprecated names read as ${[...names]}`);

    // The names MJ's declarations carry today: a name that leaves this list is a change in MJ, and the check should say so
    const deprecated = readDeprecatedNames();
    const known = {
        mjButton: ['variant', 'size', 'toggleable', 'selected', 'selectedChange', 'ariaLabel'],
        'mj-loading': ['text', 'showText', 'size', 'animation', 'animationDuration', 'textColor', 'logoColor', 'logoGradient'],
    };
    for (const [component, expected] of Object.entries(known)) {
        for (const name of expected) if (!deprecated[component].has(name)) throw new Error(`self-test: MJ's ${component} declaration no longer marks "${name}" deprecated`);
    }

    const bad = [
        '<button mjButton variant="primary">x</button>',
        '<button\n  type="button"\n  mjButton\n  size="sm">x</button>',
        '<button mjButton [variant]="v">x</button>',
        '<button mjButton ariaLabel="Close">x</button>',
        '<button mjButton (click)="items.forEach(i => go(i))" variant="primary">x</button>',
        '<button mjButton [disabled]="count > 0" size="sm">x</button>',
        '<button mjButton variant = "primary">x</button>',
        '<button mjButton toggleable [Selected]="on">x</button>',
        '<button mjButton Toggleable (selectedChange)="on = $event">x</button>',
        '<button mjButton [(selected)]="on">x</button>',
        '<a mjButton Variant="flat" ariaLabel="Open">x</a>',
        '<mj-loading Size="small" [showText]="false"></mj-loading>',
        '<mj-loading text="Reading"></mj-loading>',
        '<mj-loading animation="spin"></mj-loading>',
        '<mj-loading [animationDuration]="2"></mj-loading>',
        '<mj-loading textColor="#fff"></mj-loading>',
        '<mj-loading logoColor="#000" [LogoGradient]="g"></mj-loading>',
        '<mj-loading [logoGradient]="g"></mj-loading>',
    ];
    const good = [
        '<button mjButton Variant="primary" Size="sm" AriaLabel="Close">x</button>',
        '<button class="plain" size="3">a plain button is not MJ\'s</button>',
        '<button mjButton class="text size" title="variant = size">x</button>',
        '<button mjButton (click)="go(size)" [disabled]="variant > 0">x</button>',
        '<button mjButton Toggleable [Selected]="on" (SelectedChange)="on = $event">x</button>',
        '<mj-loading Size="small" [ShowText]="false"></mj-loading>',
        '<mj-loading Animation="spin" [AnimationDuration]="2" TextColor="#fff"></mj-loading>',
        '<mj-dropdown size="x"></mj-dropdown>',
    ];
    for (const text of bad) if (findDeprecatedInputs(text, 't', deprecated).length !== 1) throw new Error(`self-test: not caught: ${text}`);
    for (const text of good) if (findDeprecatedInputs(text, 't', deprecated).length !== 0) throw new Error(`self-test: wrongly caught: ${text}`);
    console.log(`mj inputs check self-test ok (mjButton: ${[...deprecated.mjButton].join(', ')}; mj-loading: ${[...deprecated['mj-loading']].join(', ')})`);
}

if (process.argv.includes('--self-test')) {
    selfTest();
} else {
    const deprecated = readDeprecatedNames();
    const found = [];
    walk('packages', found, deprecated);
    if (found.length > 0) {
        console.error(found.join('\n'));
        console.error(`${found.length} deprecated MJ input name(s) found. Use the PascalCase name.`);
        process.exit(1);
    }
    console.log(`mj inputs ok (none of the ${deprecated.mjButton.size + deprecated['mj-loading'].size} deprecated names of mjButton and mj-loading is bound)`);
}
