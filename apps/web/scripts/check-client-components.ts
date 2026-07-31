import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A component that calls a hook has to be a client component.
 *
 * Nothing else catches this: types pass, the build passes, and the page only
 * fails when it is actually rendered — WorkoutTable shipped this way and broke
 * every session with a workout attached. Cheap to check, so check it.
 */
const HOOKS = [
  "useI18n",
  "useState",
  "useEffect",
  "useLayoutEffect",
  "useMemo",
  "useCallback",
  "useRef",
  "useReducer",
  "useContext",
  "useRouter",
  "useSearchParams",
  "usePathname",
  "useForm",
  "useFieldArray",
  "useChartTokens",
  "useToast",
];
const CALLS = new RegExp(`\\b(${HOOKS.join("|")})\\s*\\(`);

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (path.endsWith(".tsx") || path.endsWith(".ts")) yield path;
  }
}

const offenders: string[] = [];
for (const dir of ["app", "components", "hooks", "lib"]) {
  for (const file of walk(dir)) {
    const source = readFileSync(file, "utf8");
    if (!CALLS.test(source)) continue;
    // The directive has to be the first statement in the file.
    if (/^\s*("use client"|'use client')/.test(source)) continue;
    offenders.push(file);
  }
}

if (offenders.length > 0) {
  console.log("Files calling a hook without the \"use client\" directive:\n");
  for (const f of offenders) console.log(`  FAIL ${f}`);
  console.log("\nRendering one of these from a server component throws at request time.");
  process.exit(1);
}

console.log("  ok   every file calling a hook is a client component");
