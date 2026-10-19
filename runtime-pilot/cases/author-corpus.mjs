import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const CORPUS_ID = "github-issue-comment-public-development-v1";
const IMPLEMENTATION = "github-comment-bridge/1";
const CALL = {
  owner: "OndCo",
  repo: "Action-Effect-Bench",
  issue_number: 1,
  body: "Synthetic public development comment.\n",
};
const CONTEXT = {
  principal: "fixture-user",
  data_class: "synthetic-public",
  implementation: IMPLEMENTATION,
};
const GRANT = {
  repository: "OndCo/Action-Effect-Bench",
  issue_number: 1,
  data_class: "synthetic-public",
};
const POLICY = {
  revision: "p1",
  principal: "fixture-user",
  revoked: false,
  allow_partial_direct: true,
  max_body_bytes: 8192,
  grants: [GRANT],
};
const ARTIFACTS = [
  "runtime-pilot/cases/author-corpus.mjs",
  "runtime-pilot/cases/github-issue-comment.v1.json",
  "docs/runtime-case-custody.md",
  "runtime-pilot/cases/case-shape.md",
  "runtime-pilot/cases/historical/initial-freeze/freeze-manifest.json",
  "runtime-pilot/cases/historical/initial-freeze/freeze-manifest.sha256",
  "runtime-pilot/cases/freeze-manifest.v2.json",
  "runtime-pilot/cases/freeze-manifest.v2.sha256",
];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const nativePair = (call) => ({
  sdk: { lane: "sdk", call: structuredClone(call) },
  mcp: {
    lane: "mcp",
    call: { name: "add_issue_comment", arguments: structuredClone(call) },
  },
});

// Only explicitly accepted fixtures call this literal projection constructor.
// Neither mapping outcomes nor authorization labels are inferred by a mapper.
function projection(call, context) {
  const repository = `${call.owner}/${call.repo}`;
  return {
    operation: "create_issue_comment",
    repository,
    issue_number: call.issue_number,
    endpoint: `https://api.github.com/repos/${repository}/issues/${call.issue_number}/comments`,
    body_sha256: sha256(Buffer.from(call.body, "utf8")),
    body_bytes: Buffer.byteLength(call.body, "utf8"),
    data_class: context.data_class,
  };
}

function row(id, base_intent, scenario, expected, options = {}) {
  const call = options.call ?? CALL;
  const context = Object.hasOwn(options, "context") ? options.context : CONTEXT;
  return structuredClone({
    id,
    base_intent,
    scenario,
    native: options.native ?? nativePair(call),
    context,
    policy: options.policy ?? POLICY,
    expected,
  });
}

function mapped(id, intent, scenario, decision, options = {}) {
  return row(id, intent, scenario, {
    mapping: {
      status: "accepted_partial",
      reason: "declared_partial",
      projection: projection(options.call ?? CALL, options.context ?? CONTEXT),
    },
    decision,
  }, options);
}

function rejected(id, intent, scenario, status, reason, options = {}) {
  return row(id, intent, scenario, {
    mapping: { status, reason },
    decision: "not_evaluated",
  }, options);
}

function invalid(id, intent, scenario, options = {}) {
  return rejected(id, intent, scenario, "invalid_input", "native_input", options);
}

function authorCorpus() {
  const noIssue = { owner: CALL.owner, repo: CALL.repo, body: CALL.body };
  const crossGrants = [GRANT, {
    repository: "ExampleOrg/Other-Repo", issue_number: 2, data_class: "synthetic-public",
  }];
  const threeWayGrants = [
    { ...GRANT, data_class: "synthetic-other" },
    { ...GRANT, issue_number: 2 },
    { ...GRANT, repository: "ExampleOrg/Other-Repo" },
  ];
  const extraArgument = nativePair({ ...CALL, method: "DELETE" });
  const extraOuter = nativePair(CALL);
  extraOuter.sdk.execute = true;
  extraOuter.mcp.execute = true;
  const extraMcpCall = nativePair(CALL).mcp;
  extraMcpCall.call.confirm = true;
  const missingLane = nativePair(CALL);
  delete missingLane.sdk.lane;
  delete missingLane.mcp.lane;

  const cases = [
    mapped("ascii-comment", "ascii-content", "Post a nonempty ASCII comment to the exact granted issue.", "allow"),
    mapped("unicode-comment", "unicode-content", "Preserve BMP text and a supplementary scalar in UTF-8.", "allow", {
      call: { ...CALL, body: "Synthetic: caf\u00e9 \u516c\u5f00 \ud83e\uddea" },
    }),
    mapped("unicode-nfc", "unicode-content", "Hash precomposed text without normalization.", "allow", {
      call: { ...CALL, body: "caf\u00e9" },
    }),
    mapped("unicode-nfd", "unicode-content", "Canonically equivalent decomposed text has different bytes and hash.", "allow", {
      call: { ...CALL, body: "cafe\u0301" },
    }),
    mapped("verbatim-whitespace", "verbatim-content", "A nonempty whitespace-only body is preserved, including CRLF and tab.", "allow", {
      call: { ...CALL, body: " \r\n\t\n" },
    }),
    mapped("verbatim-nul", "verbatim-content", "An escaped NUL is a valid scalar and remains part of the body digest.", "allow", {
      call: { ...CALL, body: "synthetic\u0000public" },
    }),
    mapped("different-repository", "repository-target", "A path-safe but ungranted repository is mapped literally and denied.", "deny", {
      call: { ...CALL, repo: "Other-Repo" },
    }),
    mapped("different-owner", "repository-target", "Changing the owner does not inherit the original repository grant.", "deny", {
      call: { ...CALL, owner: "ExampleOrg" },
    }),
    mapped("different-issue", "issue-target", "A valid issue number outside the exact grant is denied.", "deny", {
      call: { ...CALL, issue_number: 2 },
    }),
    mapped("different-issue-granted", "issue-target", "An exact replacement grant permits the changed issue.", "allow", {
      call: { ...CALL, issue_number: 2 },
      policy: { ...POLICY, grants: [{ ...GRANT, issue_number: 2 }] },
    }),
    mapped("grant-cross-repository-issue", "coupled-grants", "Repository and issue values from different grants cannot be recombined.", "deny", {
      call: { ...CALL, issue_number: 2 },
      policy: { ...POLICY, grants: crossGrants },
    }),
    mapped("grant-cross-data-class", "coupled-grants", "Pairwise matches do not replace one exact repository/issue/data-class tuple.", "deny", {
      policy: { ...POLICY, grants: threeWayGrants },
    }),
    mapped("grant-exact-among-decoys", "coupled-grants", "One fully coupled grant is sufficient even when decoy grants are present.", "allow", {
      policy: { ...POLICY, grants: [...threeWayGrants, GRANT] },
    }),
    mapped("grant-empty", "coupled-grants", "An empty, well-formed grant list provides no authorization.", "deny", {
      policy: { ...POLICY, grants: [] },
    }),
    mapped("revoked-policy", "revocation", "Revocation denies a call that otherwise matches every grant condition.", "deny", {
      policy: { ...POLICY, revoked: true },
    }),
    mapped("revoked-before-partial-review", "revocation", "Known revocation takes precedence over unaccepted partial scope.", "deny", {
      policy: { ...POLICY, revoked: true, allow_partial_direct: false },
    }),
    mapped("policy-utf8-bound-equal", "policy-body-bound", "The narrowed byte bound is inclusive: cafe with an accent occupies five bytes.", "allow", {
      call: { ...CALL, body: "caf\u00e9" }, policy: { ...POLICY, max_body_bytes: 5 },
    }),
    mapped("policy-utf8-bound-exceeded", "policy-body-bound", "Four UTF-16 code units are five UTF-8 bytes and exceed a four-byte policy bound.", "deny", {
      call: { ...CALL, body: "caf\u00e9" }, policy: { ...POLICY, max_body_bytes: 4 },
    }),
    mapped("principal-mismatch", "principal-binding", "The separate context principal must match the trusted policy principal.", "deny", {
      context: { ...CONTEXT, principal: "fixture-other" },
    }),
    mapped("partial-not-accepted", "partial-scope", "Otherwise authorized partial direct scope requires review when explicitly not accepted.", "review", {
      policy: { ...POLICY, allow_partial_direct: false },
    }),
    mapped("no-grant-before-partial-review", "partial-scope", "A known absent grant denies rather than being softened to partial-scope review.", "deny", {
      policy: { ...POLICY, grants: [], allow_partial_direct: false },
    }),
    mapped("byte-denial-before-partial-review", "partial-scope", "A known body-byte violation denies before partial-scope review.", "deny", {
      call: { ...CALL, body: "caf\u00e9" },
      policy: { ...POLICY, max_body_bytes: 4, allow_partial_direct: false },
    }),
    rejected("unsupported-mcp-operation", "operation-profile", "A different MCP tool name is unsupported, not silently translated into a comment.",
      "unsupported_profile", "operation", {
        native: { mcp: { lane: "mcp", call: { name: "delete_issue_comment", arguments: CALL } } },
      }),
    invalid("extra-executable-argument", "exact-keys", "An extra executable argument is invalid and must not be ignored.", { native: extraArgument }),
    invalid("extra-outer-parameter", "exact-keys", "The outer envelope also rejects extra keys.", { native: extraOuter }),
    invalid("extra-mcp-call-parameter", "exact-keys", "MCP call keys are exactly name and arguments; extra confirmation parameters are invalid.", {
      native: { mcp: extraMcpCall },
    }),
    rejected("context-absent", "missing-context", "Null encodes absent context evidence; authorization is not evaluated.",
      "untrusted_evidence", "missing_context", { context: null }),
    rejected("implementation-mismatch", "implementation-binding", "Evidence bound to a different implementation identifier is not trusted.",
      "untrusted_evidence", "implementation_binding", {
        context: { ...CONTEXT, implementation: "github-comment-bridge/2" },
      }),
    invalid("empty-body", "body-shape", "An empty string is outside the native body domain.", { call: { ...CALL, body: "" } }),
    invalid("nonstring-body", "body-shape", "A structured body is not coerced into a comment string.", { call: { ...CALL, body: { text: "synthetic" } } }),
    invalid("unknown-issue-missing", "unknown-issue", "A missing issue is invalid native input, not a wildcard or reviewable authorization target.", { call: noIssue }),
    invalid("unknown-issue-null", "unknown-issue", "Null cannot identify an issue.", { call: { ...CALL, issue_number: null } }),
    invalid("unknown-issue-string", "unknown-issue", "Numeric strings are not coerced to issue numbers.", { call: { ...CALL, issue_number: "1" } }),
    mapped("repository-owner-case", "repository-case", "Owner case is preserved and compared exactly even if the provider might resolve it equivalently.", "deny", {
      call: { ...CALL, owner: "ondco" },
    }),
    mapped("repository-name-case", "repository-case", "Repository case is preserved and does not match the differently cased grant.", "deny", {
      call: { ...CALL, repo: "action-effect-bench" },
    }),
    invalid("owner-empty", "identifier-safety", "An empty owner is not a GitHub path identifier.", { call: { ...CALL, owner: "" } }),
    invalid("repository-empty", "identifier-safety", "An empty repository is not a GitHub path identifier.", { call: { ...CALL, repo: "" } }),
    invalid("owner-path-separator", "identifier-safety", "A path separator cannot change the fixed endpoint structure.", { call: { ...CALL, owner: "OndCo/extra" } }),
    invalid("repository-dot-segment", "identifier-safety", "A traversal dot segment is not a path-safe repository identifier.", { call: { ...CALL, repo: ".." } }),
    invalid("repository-percent-escape", "identifier-safety", "Encoded separators are not decoded or accepted as identifiers.", { call: { ...CALL, repo: "Action%2FEffect" } }),
    invalid("owner-nonascii", "identifier-safety", "Unicode body text is allowed but Unicode owner identifiers are not.", { call: { ...CALL, owner: "OndC\u00f6" } }),
    invalid("repository-whitespace", "identifier-safety", "Repository identifiers are not trimmed into a valid value.", { call: { ...CALL, repo: " Action-Effect-Bench" } }),
    mapped("issue-maximum", "issue-numeric-bounds", "The inclusive 2147483647 issue limit maps exactly and can receive an exact grant.", "allow", {
      call: { ...CALL, issue_number: 2147483647 },
      policy: { ...POLICY, grants: [{ ...GRANT, issue_number: 2147483647 }] },
    }),
    invalid("issue-zero", "issue-numeric-bounds", "Issue numbers must be positive.", { call: { ...CALL, issue_number: 0 } }),
    invalid("issue-negative", "issue-numeric-bounds", "Negative issue numbers are invalid.", { call: { ...CALL, issue_number: -1 } }),
    invalid("issue-fractional", "issue-numeric-bounds", "Fractional issue numbers are not rounded.", { call: { ...CALL, issue_number: 1.5 } }),
    invalid("issue-above-maximum", "issue-numeric-bounds", "A safe integer above the explicit issue cap is still invalid.", { call: { ...CALL, issue_number: 2147483648 } }),
    invalid("issue-unsafe-integer", "issue-numeric-bounds", "An unsafe JavaScript integer is not an issue identifier.", { call: { ...CALL, issue_number: 9007199254740992 } }),
    mapped("native-body-8192-bytes", "native-body-cap", "A scalar-valid mixed body at exactly 8192 UTF-8 bytes is accepted.", "allow", {
      call: { ...CALL, body: "a".repeat(8188) + "\ud83e\uddea" },
    }),
    invalid("native-body-8193-bytes", "native-body-cap", "A body below 8192 UTF-16 code units but above 8192 UTF-8 bytes is invalid before policy.", {
      call: { ...CALL, body: "a".repeat(8189) + "\ud83e\uddea" },
    }),
    invalid("body-lone-high-surrogate", "scalar-validity", "An unpaired high surrogate must not be replaced before hashing.", { call: { ...CALL, body: "synthetic\ud800" } }),
    invalid("body-lone-low-surrogate", "scalar-validity", "An unpaired low surrogate is not a Unicode scalar string.", { call: { ...CALL, body: "synthetic\udc00" } }),
    invalid("envelope-missing-lane", "envelope-shape", "A missing native lane cannot be inferred from a fixture's lane label.", { native: missingLane }),
    invalid("envelope-null-call", "envelope-shape", "The native call must be an object.", {
      native: { sdk: { lane: "sdk", call: null }, mcp: { lane: "mcp", call: null } },
    }),
    invalid("envelope-unknown-lane", "envelope-shape", "An unknown outer lane is invalid rather than routed to a supported lane.", {
      native: { sdk: { lane: "other", call: CALL }, mcp: { lane: "other", call: { name: "add_issue_comment", arguments: CALL } } },
    }),
  ];

  return {
    schema_version: "github-issue-comment-corpus/1",
    corpus_id: CORPUS_ID,
    provenance: {
      use: "public-development",
      authorship: "same-project-ai-assisted",
      source: "supplied-interface-only",
      external: false,
      held_out: false,
      independent_lab: false,
      candidate_runtime_read: false,
      provider_execution: false,
    },
    scope: { kind: "partial_direct", provider_descendants: "unobserved", principal_source: "context" },
    format: {
      native_lanes: "nonempty-subset-of-sdk-mcp",
      expected_applies_to: "every-present-native-lane",
      omitted_lane: "not-applicable",
      absent_context: "null",
      schema_or_config_error: "evaluation-failure-not-a-decision",
    },
    counts: counts(cases),
    cases,
  };
}

function counts(cases) {
  const sdk = cases.filter((item) => Object.hasOwn(item.native, "sdk")).length;
  const mcp = cases.filter((item) => Object.hasOwn(item.native, "mcp")).length;
  return { cases: cases.length, base_intents: new Set(cases.map((item) => item.base_intent)).size, sdk, mcp, lane_instances: sdk + mcp };
}

function render(corpus) {
  return JSON.stringify(corpus, null, 2).replace(/[\u007f-\uffff]/g, (char) =>
    `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`) + "\n";
}

function exactKeys(object, keys, label) {
  assert(object !== null && typeof object === "object" && !Array.isArray(object), label);
  assert.deepEqual(Object.keys(object).sort(), [...keys].sort(), label);
}

function validate(corpus) {
  const ids = new Set();
  assert.equal(corpus.counts.base_intents, 22);
  assert.deepEqual(corpus.counts, counts(corpus.cases));
  for (const item of corpus.cases) {
    exactKeys(item, ["id", "base_intent", "scenario", "native", "context", "policy", "expected"], item.id);
    assert.match(item.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert(!ids.has(item.id), `duplicate id: ${item.id}`);
    ids.add(item.id);
    assert(item.base_intent.length > 0 && item.scenario.length > 0);
    assert(Object.keys(item.native).length > 0);
    assert(Object.keys(item.native).every((lane) => ["sdk", "mcp"].includes(lane)));
    exactKeys(item.policy, ["revision", "principal", "revoked", "allow_partial_direct", "max_body_bytes", "grants"], item.id);
    assert.equal(item.policy.revision, "p1");
    assert.equal(typeof item.policy.principal, "string");
    assert.equal(typeof item.policy.revoked, "boolean");
    assert.equal(typeof item.policy.allow_partial_direct, "boolean");
    assert(Number.isSafeInteger(item.policy.max_body_bytes) && item.policy.max_body_bytes > 0);
    assert(Array.isArray(item.policy.grants));
    for (const grant of item.policy.grants) {
      exactKeys(grant, ["repository", "issue_number", "data_class"], item.id);
      assert.equal(typeof grant.repository, "string");
      assert(Number.isSafeInteger(grant.issue_number) && grant.issue_number > 0 && grant.issue_number <= 2147483647);
      assert.equal(typeof grant.data_class, "string");
    }
    exactKeys(item.expected, ["mapping", "decision"], item.id);
    const { mapping, decision } = item.expected;
    if (mapping.status === "accepted_partial") {
      assert.equal(mapping.reason, "declared_partial");
      assert(["allow", "deny", "review"].includes(decision));
      exactKeys(mapping, ["status", "reason", "projection"], item.id);
      exactKeys(mapping.projection, ["operation", "repository", "issue_number", "endpoint", "body_sha256", "body_bytes", "data_class"], item.id);
      assert.equal(item.context.implementation, IMPLEMENTATION);
      for (const [lane, native] of Object.entries(item.native)) {
        assert.equal(native.lane, lane);
        const call = lane === "sdk" ? native.call : native.call.arguments;
        assert.deepEqual(mapping.projection, projection(call, item.context), item.id);
        assert(call.body.isWellFormed() && Buffer.byteLength(call.body, "utf8") > 0);
        assert(Buffer.byteLength(call.body, "utf8") <= 8192);
      }
    } else {
      exactKeys(mapping, ["status", "reason"], item.id);
      assert.equal(decision, "not_evaluated");
      assert([
        "invalid_input/native_input",
        "unsupported_profile/operation",
        "untrusted_evidence/missing_context",
        "untrusted_evidence/implementation_binding",
      ].includes(`${mapping.status}/${mapping.reason}`));
    }
  }
}

function check(corpus) {
  const corpusBytes = readFileSync(new URL("./github-issue-comment.v1.json", import.meta.url));
  assert.equal(corpusBytes.toString("utf8"), render(corpus), "frozen JSON differs from deterministic authored cases");
  const manifestBytes = readFileSync(new URL("./freeze-manifest.json", import.meta.url));
  const manifest = JSON.parse(manifestBytes);
  exactKeys(manifest, ["schema_version", "freeze_revision", "corpus_id", "frozen_at", "status", "authorship", "source", "ordering", "custody", "supersedes", "normative_sources", "counts", "artifacts"], "manifest");
  assert.equal(manifest.schema_version, "github-issue-comment-freeze/3");
  assert.equal(manifest.freeze_revision, 3);
  assert.equal(manifest.corpus_id, CORPUS_ID);
  assert.equal(manifest.status, "frozen");
  assert.equal(manifest.authorship, "same-project-ai-assisted");
  assert.equal(manifest.source, "supplied-interface-only");
  assert.equal(manifest.ordering, "case-author-did-not-read-candidate; parent-did-not-read-corpus-until-freeze; implementation-parallel-from-agreed-interface");
  assert.deepEqual(manifest.custody, {
    implementation_timing: "parent-began-implementing-during-case-authoring",
    pre_implementation_freeze: false,
    case_author_inspected_candidate: false,
    parent_inspected_case_json_or_expected_before_revised_freeze: false,
    parent_read_custody_document_before_revised_freeze: true,
    parent_read_freeze_metadata_before_revised_freeze: true,
    candidate_run_on_corpus_before_revised_freeze: false,
    result_comparison_before_revised_freeze: false,
    provenance_basis: "direct-user-correction",
  });
  assert.equal(manifest.supersedes.manifest_sha256, "3774e734d8d58c4aa3e9e63159e383a9c90463c0404feb2a24d69a591441bf76");
  assert.deepEqual(manifest.normative_sources.map((entry) => entry.path), [
    "../action-effect-spec/profiles/github-issue-comment/README.md",
    "../action-effect-spec/profiles/github-issue-comment/profile.json",
  ]);
  for (const entry of manifest.normative_sources) {
    exactKeys(entry, ["path", "bytes", "sha256"], entry.path);
    assert(Number.isSafeInteger(entry.bytes) && entry.bytes > 0);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  }
  assert.match(manifest.frozen_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  assert.deepEqual(manifest.counts, corpus.counts);
  assert.deepEqual(manifest.artifacts.map((entry) => entry.path), ARTIFACTS);
  for (const entry of manifest.artifacts) {
    exactKeys(entry, ["path", "bytes", "sha256"], entry.path);
    const bytes = readFileSync(new URL(`../../${entry.path}`, import.meta.url));
    assert.equal(entry.bytes, bytes.length, `${entry.path}: byte count mismatch`);
    assert.equal(entry.sha256, sha256(bytes), `${entry.path}: SHA-256 mismatch`);
  }
  const digest = sha256(manifestBytes);
  assert.equal(readFileSync(new URL("./freeze-manifest.sha256", import.meta.url), "utf8"), `${digest}  freeze-manifest.json\n`, "freeze anchor mismatch");
  process.stdout.write(JSON.stringify({ result: "ok", corpus_id: CORPUS_ID, ...corpus.counts, frozen_at: manifest.frozen_at, manifest_sha256: digest }) + "\n");
}

try {
  const args = process.argv.slice(2);
  assert(args.length <= 1 && [undefined, "--print", "--check"].includes(args[0]), "usage: node author-corpus.mjs [--print|--check]");
  const corpus = authorCorpus();
  validate(corpus);
  if (args[0] === "--check") check(corpus);
  else process.stdout.write(render(corpus));
} catch (error) {
  process.stderr.write(`CORPUS_EVALUATION_FAILURE: ${error.message}\n`);
  process.exitCode = 1;
}
