/**
 * @fileoverview Pins `scripts/check-publish-access.sh` to the shapes npm's trust
 * listing really takes, and to the verdicts its exit code promises.
 *
 * The guard decides whether a release may be tagged (`scripts/release-safe.sh`
 * aborts on exit 1) by reading the package's stored trusted-publisher configs, so
 * the shapes that matter are the ones npm actually prints — `npm/lib/trust-cmd.js`
 * writes `type:` then `id:`, then the config's own fields, `permissions:` last,
 * with a blank line before each config. Both defects this file keeps out were
 * mismatches against that parser:
 *
 * - A package may hold several records naming the same workflow file, and the
 *   guard judged only the first: a stale record (another repository, or stage
 *   publish only) reported "definitively broken" and aborted the release even
 *   when a later record was the one the registry would authorize, so the verdict
 *   depended on the registry's listing order (review finding 1). npm's own
 *   statements disagree on the count — its man page says "the registry only
 *   supports one configuration per package", its docs allow up to 10 and its API
 *   takes a list with per-config ids — so the guard judges every record that
 *   names the file: the defensive reading, and the only correct one if several
 *   are allowed.
 * - `npm trust list` also prints JSON (`--json`, or a `json=true` npm config) and
 *   honours neither `file:` nor `permissions: publish` there. The guard read no
 *   record, warned "not a trust listing" and exited 0 — permission to tag a
 *   release whose configs it never judged (review finding 2).
 *
 * Every case runs the committed script against a stub `npm` on a shimmed PATH in
 * its own temp directory: no session, no registry, no network, nothing written
 * into the repo. The stub reads `npm_config_json` and lets a command-line
 * `--no-json` override it, exactly as npm does, so a guard that stops pinning the
 * output mode fails the `npm_config_json=true` cases here instead of on a release.
 *
 * Local-only by design, like the tool class in media-checksum-corpus.test.ts:
 * every workflow runs `deno test` with `--allow-read --allow-write --allow-env`
 * and none grants `--allow-run`, so this file skips in CI. The invocation that
 * runs it:
 *
 *     deno test --allow-read --allow-write --allow-env --allow-run \
 *       tests/check-publish-access.test.ts
 *
 * `CHECK_PUBLISH_ACCESS_SCRIPT` points the harness at another revision's copy, so
 * a finding can be re-derived against the code that carried it:
 *
 *     git show acd6218:scripts/check-publish-access.sh > /tmp/guard.sh
 *     CHECK_PUBLISH_ACCESS_SCRIPT=/tmp/guard.sh deno test --allow-read \
 *       --allow-write --allow-env --allow-run tests/check-publish-access.test.ts
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { fromFileUrl, resolve } from "@std/path";

const WORKFLOW_FILE = "publish-everywhere.yml";
const REPOSITORY = "CharlesWiltgen/TagLib-Wasm";

const COMMITTED_GUARD = fromFileUrl(
  new URL("../scripts/check-publish-access.sh", import.meta.url),
);

/** The guard under test. `CHECK_PUBLISH_ACCESS_SCRIPT` is the harness's one knob
 * (see the file comment); it is not read anywhere in the guard. */
const GUARD = (() => {
  try {
    const override = Deno.env.get("CHECK_PUBLISH_ACCESS_SCRIPT");
    if (override !== undefined && override.length > 0) return override;
  } catch {
    // No --allow-env: the committed script is the only thing we can run anyway.
  }
  return COMMITTED_GUARD;
})();

/** One record of npm's human listing, in npm's own field order. A field that is
 * `undefined` is one npm did not print, which is a different thing from a field
 * that prints a different value — the guard's verdicts hinge on that. */
function record(fields: {
  id: string;
  type?: string;
  file?: string;
  repository?: string;
  permissions?: string;
  extra?: string[];
}): string {
  const lines = [
    `type: ${fields.type ?? "github"}`,
    `id: ${fields.id}`,
    ...(fields.file === undefined ? [] : [`file: ${fields.file}`]),
    ...(fields.repository === undefined
      ? []
      : [`repository: ${fields.repository}`]),
    ...(fields.extra ?? []),
    ...(fields.permissions === undefined
      ? []
      : [`permissions: ${fields.permissions}`]),
  ];
  return `\n${lines.join("\n")}\n`;
}

/** The same config as npm's `--json` branch prints it: quoted keys, and
 * `permissions` as registry codes rather than the `publish` label. */
function jsonRecord(fields: {
  id: string;
  file?: string;
  repository?: string;
  permissions?: "createPackage" | "createStagedPackage";
}): string {
  const object: Record<string, unknown> = {
    id: fields.id,
    type: "github",
    ...(fields.file === undefined ? {} : { file: fields.file }),
    ...(fields.repository === undefined
      ? {}
      : { repository: fields.repository }),
    ...(fields.permissions === undefined
      ? {}
      : { permissions: [fields.permissions] }),
  };
  return `${JSON.stringify(object, null, 2)}\n`;
}

const STALE = "SomebodyElse/TagLib-Wasm";
const ours = (id: string, permissions: string) =>
  record({ id, file: WORKFLOW_FILE, repository: REPOSITORY, permissions });
const stale = (id: string, permissions = "publish") =>
  record({ id, file: WORKFLOW_FILE, repository: STALE, permissions });
const staged = (id: string) =>
  record({
    id,
    file: WORKFLOW_FILE,
    repository: REPOSITORY,
    permissions: "stage publish",
  });

type Case = {
  name: string;
  /** What the stub prints for `npm trust list` in the human format. */
  listing: string;
  /** What it prints when `json` mode wins — npm's JSON shape. Defaults to the
   * human listing, so any case that reaches JSON mode by accident is visible. */
  jsonListing?: string;
  env?: Record<string, string>;
  code: number;
  includes?: string[];
  omits?: string[];
};

const CASES: Case[] = [
  {
    name: "single record: our repository and publish permission",
    listing: ours("1", "publish"),
    code: 0,
    includes: ["npm publish path verified.", "✓ repository: " + REPOSITORY],
  },
  {
    name: "correct record second, stale first (finding 1)",
    listing: stale("1") + ours("2", "publish"),
    code: 0,
    includes: ["npm publish path verified."],
  },
  {
    name: "correct record first, stale second: same listing, order swapped",
    listing: ours("1", "publish") + stale("2"),
    code: 0,
    includes: ["npm publish path verified."],
  },
  {
    name: "stale only: no record names our repository",
    listing: stale("1"),
    code: 1,
    includes: [
      "no record naming " + WORKFLOW_FILE + " grants publish to " +
      REPOSITORY,
      `id: 1`,
      "npm trust revoke",
    ],
  },
  {
    name: "stage-only first, publish second (finding 1)",
    listing: staged("1") + ours("2", "publish"),
    code: 0,
    includes: ["npm publish path verified."],
  },
  {
    name: "publish first, stage-only second: same listing, order swapped",
    listing: ours("1", "publish") + staged("2"),
    code: 0,
    includes: ["npm publish path verified."],
  },
  {
    name: "stage-only only: publish is not granted",
    listing: staged("1"),
    code: 1,
    includes: ["no record naming " + WORKFLOW_FILE + " grants publish"],
  },
  {
    // Both fields the verdict needs are in this listing, but no single record
    // carries both: record 1 has our repository and no publish permission,
    // record 2 has publish and another repository. Judging the listing as one
    // block would find both and pass — the cross-record vouching the guard's
    // comment and this file's docstring both promise cannot happen.
    name:
      "fields split across records: our repository staged, another's publish",
    listing: staged("1") + stale("2"),
    code: 1,
    includes: ["no record naming " + WORKFLOW_FILE + " grants publish"],
  },
  {
    name: "record naming our file with no repository or permissions field",
    listing: record({ id: "1", file: WORKFLOW_FILE }),
    code: 0,
    includes: [
      "not verified",
      "npm publish path verified where npm reports it",
    ],
  },
  {
    name: "no record names our workflow file at all",
    listing: record({
      id: "1",
      file: "ci.yml",
      repository: REPOSITORY,
      permissions: "publish",
    }),
    code: 1,
    includes: [
      "trusted-publisher entries exist, but none names " + WORKFLOW_FILE,
    ],
  },
  {
    name: "providers-only listing: a provider record carries no file field",
    listing: record({
      id: "1",
      type: "circleci",
      extra: ["orgId: 6c1f", "projectId: 2b9d"],
      permissions: "publish",
    }),
    code: 1,
    includes: [
      "trusted-publisher entries exist, but none names " + WORKFLOW_FILE,
    ],
  },
  {
    name: "no trust configurations",
    listing: "No trust configurations found for package (taglib-wasm)\n",
    code: 1,
    includes: ["NO trusted-publisher entry"],
  },
  {
    name: "npm trust list fails: fail-soft, not a verdict",
    listing: "npm error network request failed\n",
    env: { NPM_STUB_TRUST_RC: "1" },
    code: 0,
    includes: ["could not read trust configs (npm exited 1) — not verified"],
  },
  {
    name: "output that is not a trust listing: warn, do not judge",
    listing: "some text npm never prints\n",
    code: 0,
    includes: ["does not look like a trust listing"],
  },
  {
    name: "npm_config_json=true, correct record: the mode pin still reads it",
    listing: ours("1", "publish"),
    jsonListing: jsonRecord({
      id: "1",
      file: WORKFLOW_FILE,
      repository: REPOSITORY,
      permissions: "createPackage",
    }),
    env: { npm_config_json: "true" },
    code: 0,
    includes: ["npm publish path verified."],
    omits: ["returned the JSON trust listing"],
  },
  {
    name:
      "npm_config_json=true, wrong repository: judged from the human listing",
    listing: stale("1"),
    jsonListing: jsonRecord({
      id: "1",
      file: WORKFLOW_FILE,
      repository: STALE,
      permissions: "createPackage",
    }),
    env: { npm_config_json: "true" },
    code: 1,
    includes: ["no record naming " + WORKFLOW_FILE + " grants publish"],
    omits: ["returned the JSON trust listing"],
  },
  {
    name: "JSON listing despite the mode pin, wrong repository (finding 2)",
    listing: stale("1"),
    jsonListing: jsonRecord({
      id: "1",
      file: WORKFLOW_FILE,
      repository: STALE,
      permissions: "createPackage",
    }),
    env: { NPM_STUB_JSON_ALWAYS: "1" },
    code: 1,
    includes: ["returned the JSON trust listing"],
  },
  {
    name:
      "JSON listing despite the mode pin, our repository: refused, not judged",
    listing: ours("1", "publish"),
    jsonListing: jsonRecord({
      id: "1",
      file: WORKFLOW_FILE,
      repository: REPOSITORY,
      permissions: "createPackage",
    }),
    env: { NPM_STUB_JSON_ALWAYS: "1" },
    code: 1,
    includes: ["returned the JSON trust listing"],
  },
];

/** The stub `npm` the guard finds on PATH. It answers the only two commands the
 * guard runs, from files, so the guard's parsing meets npm's *shape* with no
 * session, no registry and no network. */
const STUB_NPM = `#!/bin/sh
# Stub npm for tests/check-publish-access.test.ts. Not a general npm.
case "\${1:-}" in
  whoami)
    printf '%s\\n' "\${NPM_STUB_USER:-testuser}"
    exit 0
    ;;
  trust)
    if [ "\${2:-}" != "list" ]; then
      printf 'stub npm: unexpected trust subcommand: %s\\n' "$*" >&2
      exit 64
    fi
    if [ -n "\${NPM_STUB_TRUST_RC:-}" ]; then
      printf '%s\\n' "\${NPM_STUB_TRUST_ERR:-npm error network request failed}" >&2
      exit "\$NPM_STUB_TRUST_RC"
    fi
    # npm reads \`json\` from npmrc (and \`npm_config_json\` from the environment) and
    # lets the command line override it. A guard that stops passing --no-json gets
    # the JSON shape here, which is what the npm_config_json cases detect.
    json=0
    [ "\${npm_config_json:-}" = "true" ] && json=1
    for arg in "$@"; do
      [ "$arg" = "--no-json" ] && json=0
    done
    # ...and NPM_STUB_JSON_ALWAYS stands in for an npm that ignores the flag.
    [ "\${NPM_STUB_JSON_ALWAYS:-}" = "1" ] && json=1
    if [ "$json" = "1" ]; then
      cat "\${NPM_STUB_JSON_LISTING:?}"
    else
      cat "\${NPM_STUB_LISTING:?}"
    fi
    exit 0
    ;;
  *)
    printf 'stub npm: unexpected invocation: %s\\n' "$*" >&2
    exit 64
    ;;
esac
`;

/** Why the harness cannot run here, or `undefined` when it can. It drives a bash
 * script through a `npm` stub on a shimmed PATH, and the suite's CI invocation
 * grants neither `--allow-run` nor (on Windows) a stub script PATH lookup can
 * execute. Folding the reason into the test's name is the pattern
 * media-checksum-corpus.test.ts uses, since `ignore` takes only a boolean. */
function skipReason(): string | undefined {
  if (Deno.build.os === "windows") {
    return "POSIX-only harness: the guard is a bash script";
  }
  let path: string | undefined;
  try {
    path = Deno.env.get("PATH");
  } catch {
    return "cannot read PATH (needs --allow-env)";
  }
  if (path === undefined || path.length === 0) return "PATH is unset";
  const granted = Deno.permissions.querySync({
    name: "run",
    command: "bash",
  }).state === "granted";
  return granted ? undefined : "--allow-run not granted for: bash";
}

/** Runs the guard once, with the case's listing behind the stub. Answers the exit
 * code and everything the guard printed (its report is the operator's only
 * evidence, so both streams are the assertion surface). */
async function runGuard(
  guard: string,
  testCase: Case,
): Promise<{ code: number; output: string }> {
  const dir = await Deno.makeTempDir({ prefix: "taglib-guard-" });
  try {
    await Deno.writeTextFile(resolve(dir, "npm"), STUB_NPM, { mode: 0o755 });
    await Deno.writeTextFile(resolve(dir, "listing.txt"), testCase.listing);
    await Deno.writeTextFile(
      resolve(dir, "listing.json"),
      testCase.jsonListing ?? testCase.listing,
    );
    const output = await new Deno.Command("bash", {
      args: [guard],
      clearEnv: true,
      env: {
        PATH: `${dir}${Deno.build.os === "windows" ? ";" : ":"}${
          Deno.env.get("PATH") ?? ""
        }`,
        HOME: dir,
        NPM_STUB_LISTING: resolve(dir, "listing.txt"),
        NPM_STUB_JSON_LISTING: resolve(dir, "listing.json"),
        ...testCase.env,
      },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const decoder = new TextDecoder();
    return {
      code: output.code,
      output: decoder.decode(output.stdout) + decoder.decode(output.stderr),
    };
  } finally {
    await Deno.remove(dir, { recursive: true }).catch(() => {});
  }
}

const SKIP = skipReason();

Deno.test({
  name: SKIP === undefined
    ? "check-publish-access.sh verdicts over npm trust listing shapes"
    : `check-publish-access.sh verdicts [skipped: ${SKIP}]`,
  ignore: SKIP !== undefined,
  fn: async (t) => {
    for (const testCase of CASES) {
      await t.step(testCase.name, async () => {
        const { code, output } = await runGuard(GUARD, testCase);
        assertEquals(
          code,
          testCase.code,
          `${testCase.name}: exit ${code}, wanted ${testCase.code}.\n${output}`,
        );
        for (const expected of testCase.includes ?? []) {
          assertStringIncludes(output, expected);
        }
        for (const unexpected of testCase.omits ?? []) {
          assertEquals(
            output.includes(unexpected),
            false,
            `${testCase.name}: output should not contain ${unexpected}.\n${output}`,
          );
        }
      });
    }
  },
});
