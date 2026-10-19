#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const MAX_BYTES = 16 * 1024 * 1024;
const MAX_CASES = 1000;
const HEX = /^[a-f0-9]{64}$/;
const isDigest = (value) => typeof value === "string" && HEX.test(value);
const DECISIONS = ["allow", "deny", "review"];
const REJECTIONS = new Set(["invalid_input/native_input", "unsupported_profile/operation", "untrusted_evidence/missing_context", "untrusted_evidence/implementation_binding", "untrusted_evidence/description_binding"]);
const benchRoot = fileURLToPath(new URL("../", import.meta.url));
const specRoot = fileURLToPath(new URL("../../action-effect-spec/", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const encode = (value) => JSON.stringify(value, null, 2) + "\n";
const check = (condition, message) => { if (!condition) throw new Error(message); };
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const nonempty = (value) => typeof value === "string" && value.length > 0;
const issue = (value) => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;

function keys(value, required, optional = []) {
  check(object(value) && required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => [...required, ...optional].includes(key)), "schema keys or unknown options");
}

function jsonOnly(value, ancestors = new Set(), depth = 0) {
  check(depth <= 100, "JSON nesting limit exceeded");
  if (value === null || ["string", "boolean"].includes(typeof value)) return;
  if (typeof value === "number") { check(Number.isFinite(value), "nonfinite JSON output"); return; }
  check(typeof value === "object" && (Array.isArray(value) || [Object.prototype, null].includes(Object.getPrototypeOf(value))), "candidate output must be JSON only");
  check(!ancestors.has(value), "cyclic JSON output");
  ancestors.add(value);
  const ownKeys = Reflect.ownKeys(value);
  if (Array.isArray(value)) check(ownKeys.length === value.length + 1, "sparse or non-JSON array output");
  for (const key of ownKeys) {
    if (Array.isArray(value) && key === "length") continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    check(typeof key === "string" && !descriptor.get && !descriptor.set && descriptor.enumerable, "non-JSON output property");
    if (Array.isArray(value)) check(/^(0|[1-9]\d*)$/.test(key) && Number(key) < value.length, "non-JSON array output property");
    jsonOnly(descriptor.value, ancestors, depth + 1);
  }
  ancestors.delete(value);
}

function repository(value) {
  if (typeof value !== "string") return false;
  const parts = value.split("/");
  return parts.length === 2 && /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(parts[0]) && /^[A-Za-z0-9_.-]{1,100}$/.test(parts[1]) && ![".", ".."].includes(parts[1]);
}

function projection(value) {
  keys(value, ["operation", "repository", "issue_number", "endpoint", "body_sha256", "body_bytes", "data_class"]);
  check(value.operation === "create_issue_comment" && repository(value.repository) && issue(value.issue_number), "invalid projection target");
  check(value.endpoint === `https://api.github.com/repos/${value.repository}/issues/${value.issue_number}/comments`, "invalid projection endpoint");
  check(isDigest(value.body_sha256) && Number.isSafeInteger(value.body_bytes) && value.body_bytes > 0 && value.body_bytes <= 8192 && nonempty(value.data_class), "invalid projection body/class");
}

function mapping(value, exact = false) {
  check(object(value) && nonempty(value.status) && nonempty(value.reason), "invalid mapping output schema");
  if (value.status === "accepted_partial") {
    check(value.reason === "declared_partial", "invalid accepted mapping output reason");
    projection(value.projection);
    if (exact) keys(value, ["status", "reason", "projection"]);
  } else {
    check(REJECTIONS.has(`${value.status}/${value.reason}`), "invalid/evaluation-failure mapping output");
    check(!Object.hasOwn(value, "projection"), "nonaccepted mapping output includes projection");
    if (exact) keys(value, ["status", "reason"]);
  }
}

function expected(value) {
  keys(value, ["mapping", "decision"]);
  mapping(value.mapping, true);
  check(value.mapping.status === "accepted_partial" ? DECISIONS.includes(value.decision) : value.decision === "not_evaluated", "invalid expected decision schema");
}

function policy(value) {
  keys(value, ["revision", "principal", "revoked", "allow_partial_direct", "max_body_bytes", "grants"]);
  check(nonempty(value.revision) && nonempty(value.principal) && typeof value.revoked === "boolean" && typeof value.allow_partial_direct === "boolean", "invalid policy schema");
  check(Number.isSafeInteger(value.max_body_bytes) && value.max_body_bytes >= 0 && Array.isArray(value.grants), "invalid policy bounds/grants schema");
  for (const grant of value.grants) {
    keys(grant, ["repository", "issue_number", "data_class"]);
    check(repository(grant.repository) && issue(grant.issue_number) && nonempty(grant.data_class), "invalid grant schema");
  }
}

function ids(rows) {
  check(Array.isArray(rows) && rows.length > 0 && rows.length <= MAX_CASES, "invalid or missing rows");
  const values = rows.map((row) => {
    check(object(row) && typeof row.id === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(row.id), "invalid row ID schema");
    return row.id;
  });
  check(new Set(values).size === values.length, "duplicate row IDs");
  return values.sort();
}

function sameRows(rows, expectedIds) {
  check(isDeepStrictEqual(ids(rows), expectedIds), "missing or unexpected rows");
}

function inputPack(value) {
  keys(value, ["schema_version", "classification", "cases"]);
  check(value.schema_version === "external-evaluation-inputs/1" && value.classification === "synthetic-public", "only synthetic-public input schema is supported");
  ids(value.cases);
  for (const row of value.cases) {
    keys(row, ["id", "native", "context", "policy"]);
    check(object(row.native), "native envelope must be a JSON object");
    if (row.context !== null) {
      keys(row.context, [], ["principal", "data_class", "implementation"]);
      check(!Object.hasOwn(row.context, "data_class") || row.context.data_class === "synthetic-public", "input classification must be synthetic-public");
    }
    policy(row.policy);
  }
}

function labelPack(value) {
  keys(value, ["schema_version", "cases"]);
  check(value.schema_version === "external-evaluation-labels/1", "invalid labels schema");
  ids(value.cases);
  for (const row of value.cases) { keys(row, ["id", "expected"]); expected(row.expected); }
}

function pathArgument(value) {
  check(nonempty(value) && !value.includes("\0") && !/^[a-z][a-z0-9+.-]*:\/\//i.test(value), "expected a local file path, not a URL");
  return resolve(value);
}

function parseUniqueJSON(text) {
  const value = JSON.parse(text), containers = [];
  let lastString;
  // JSON.parse validates grammar but discards duplicate names; inspect original tokens.
  for (const [token] of text.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\]:]/g)) {
    if (token === "{" || token === "[") {
      check(containers.length <= 100, "JSON nesting limit exceeded");
      containers.push(token === "{" ? new Set() : null);
    } else if (token === "}" || token === "]") containers.pop();
    else if (token === ":") {
      const names = containers.at(-1), name = JSON.parse(lastString);
      check(!names.has(name), "duplicate JSON object key");
      names.add(name);
    } else lastString = token;
  }
  return value;
}

function readJSON(path, trustedHash, trustedBytes) {
  path = pathArgument(path);
  const stat = lstatSync(path);
  check(stat.isFile() && stat.size <= MAX_BYTES, "JSON artifact must be a regular file within 16 MiB");
  const bytes = readFileSync(path);
  check(bytes.length <= MAX_BYTES, "JSON artifact exceeds size limit");
  if (trustedHash !== undefined) check(isDigest(trustedHash) && hash(bytes) === trustedHash, "artifact digest integrity mismatch");
  if (trustedBytes !== undefined) check(bytes.length === trustedBytes, "artifact byte-count integrity mismatch");
  const value = parseUniqueJSON(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  jsonOnly(value);
  return { value, sha256: hash(bytes), bytes: bytes.length };
}

function writeArtifact(path, value) {
  path = pathArgument(path);
  jsonOnly(value);
  const raw = encode(value);
  check(Buffer.byteLength(raw) <= MAX_BYTES, "output exceeds size limit");
  check(!existsSync(path) && !existsSync(`${path}.sha256`), "output artifact already exists");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, raw, { flag: "wx", mode: 0o600 });
  const digest = hash(raw);
  writeFileSync(`${path}.sha256`, `${digest}\n`, { flag: "wx", mode: 0o600 });
  return { path, sha256: digest };
}

function readSeal(path, digest) {
  check(isDigest(digest), "a separately retained seal SHA-256 is required");
  const { value } = readJSON(path, digest);
  keys(value, ["schema_version", "classification", "sealed_at", "inputs", "labels", "case_ids"]);
  check(value.schema_version === "external-evaluation-seal/1" && value.classification === "synthetic-public", "invalid seal schema");
  check(nonempty(value.sealed_at) && Number.isFinite(Date.parse(value.sealed_at)), "invalid seal timestamp");
  for (const item of [value.inputs, value.labels]) {
    keys(item, ["sha256", "bytes"]);
    check(isDigest(item.sha256) && Number.isSafeInteger(item.bytes) && item.bytes > 0 && item.bytes <= MAX_BYTES, "invalid sealed digest schema");
  }
  check(Array.isArray(value.case_ids), "invalid sealed row IDs");
  sameRows(value.case_ids.map((id) => ({ id })), value.case_ids);
  return value;
}

export function sealEvaluation(options) {
  keys(options, ["inputsPath", "labelsPath", "outputPath"]);
  const inputs = readJSON(options.inputsPath), labels = readJSON(options.labelsPath);
  inputPack(inputs.value);
  labelPack(labels.value);
  const caseIds = ids(inputs.value.cases);
  sameRows(labels.value.cases, caseIds);
  const seal = { schema_version: "external-evaluation-seal/1", classification: "synthetic-public", sealed_at: new Date().toISOString(), inputs: { sha256: inputs.sha256, bytes: inputs.bytes }, labels: { sha256: labels.sha256, bytes: labels.bytes }, case_ids: caseIds };
  const artifact = writeArtifact(options.outputPath, seal);
  return { seal_path: artifact.path, seal_sha256: artifact.sha256, cases: caseIds.length };
}

// Fixed code roots only: never traverse fixture directories or hash label JSON.
function sourceSnapshot() {
  const files = [];
  const excluded = new Set(["cases", "tests", "reports", "node_modules", ".tools", ".runtime-private", ".git", "__pycache__"]);
  const record = (root, path, prefix) => {
    check(lstatSync(path).isFile(), "source identity requires regular files");
    files.push({ path: `${prefix}/${relative(root, path).split(sep).join("/")}`, sha256: hash(readFileSync(path)) });
  };
  const walk = (root, directory, prefix) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (excluded.has(entry.name)) continue;
      check(!entry.isSymbolicLink(), "source identity does not follow symlinks");
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(root, path, prefix);
      else if (/\.(mjs|js|py|rego)$/.test(entry.name)) record(root, path, prefix);
    }
  };
  walk(benchRoot, join(benchRoot, "runtime-pilot"), "bench");
  for (const directory of ["profiles/github-issue-comment", "implementations/javascript", "implementations/python/offline_consumer"]) walk(specRoot, join(specRoot, directory), "spec");
  for (const file of ["profiles/github-issue-comment/profile.json", "schemas/effect-description.schema.json"]) record(specRoot, join(specRoot, file), "spec");
  return files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

function sourceIdentity(files) {
  check(Array.isArray(files) && files.length > 0, "missing source identity");
  for (const item of files) {
    keys(item, ["path", "sha256"]);
    check(nonempty(item.path) && /^(bench|spec)\//.test(item.path) && !item.path.split("/").includes("..") && isDigest(item.sha256), "invalid source identity");
  }
  check(new Set(files.map((x) => x.path)).size === files.length, "duplicate source identity paths");
  return { files: structuredClone(files), sha256: hash(encode(files)) };
}

async function runtimeAPIs() {
  const { prepareAction } = await import("./gate.mjs");
  const { authorize } = await import("./authorization.mjs");
  return { prepareAction, authorize, sourceSnapshot };
}

function rawRow(row) {
  keys(row, ["id", "preparation", "authorization"]);
  mapping(row.preparation);
  if (row.preparation.status === "accepted_partial") {
    check(object(row.authorization) && DECISIONS.includes(row.authorization.decision), "invalid/evaluation-failure authorization output");
  } else check(row.authorization === null, "nonaccepted mapping must have null authorization (not_evaluated)");
}

export async function runEvaluation(options, runtime) {
  keys(options, ["inputsPath", "sealPath", "sealSha256", "runDir"], ["strategy"]);
  const strategy = options.strategy ?? "protocol";
  check(["protocol", "structured"].includes(strategy), "unknown strategy option");
  const seal = readSeal(options.sealPath, options.sealSha256);
  const inputs = readJSON(options.inputsPath, seal.inputs.sha256, seal.inputs.bytes).value;
  inputPack(inputs);
  sameRows(inputs.cases, seal.case_ids);
  const runDir = pathArgument(options.runDir);
  mkdirSync(runDir, { mode: 0o700 });
  const metadata = {
    classification: "synthetic-public",
    seal_sha256: options.sealSha256, inputs_sha256: seal.inputs.sha256, strategy,
    run_directory: runDir, started_at: new Date().toISOString(),
    environment: { node: process.version, platform: process.platform, architecture: process.arch },
  };
  const rows = [];
  let before = null, after = null, phase = "source_before", failedCaseId = null, startedCount = 0;
  try {
    before = sourceIdentity(await (runtime?.sourceSnapshot ?? sourceSnapshot)());
    phase = "runtime_configuration";
    runtime ??= await runtimeAPIs();
    check(["prepareAction", "authorize", "sourceSnapshot"].every((name) => typeof runtime[name] === "function"), "invalid runtime API configuration");
    for (const item of inputs.cases) {
      failedCaseId = item.id;
      startedCount++;
      phase = "preparation";
      const prepared = await runtime.prepareAction(structuredClone(item.native), structuredClone(item.context), strategy);
      phase = "preparation_output";
      jsonOnly(prepared);
      const preparation = structuredClone(prepared);
      mapping(preparation);
      let authorization = null;
      if (preparation.status === "accepted_partial") {
        phase = "authorization";
        authorization = await runtime.authorize(structuredClone(preparation.projection), structuredClone(item.context), structuredClone(item.policy));
      }
      phase = "authorization_output";
      jsonOnly(authorization);
      const row = { id: item.id, preparation, authorization: structuredClone(authorization) };
      rawRow(row);
      rows.push(row);
      failedCaseId = null;
    }
    phase = "source_after";
    after = sourceIdentity(await runtime.sourceSnapshot());
    phase = "results_write";
    const results = {
      schema_version: "external-evaluation-results/1", ...metadata, finished_at: new Date().toISOString(),
      source_before: before, source_after: after, source_drift: before.sha256 !== after.sha256, rows,
    };
    const artifact = writeArtifact(join(runDir, "results.json"), results);
    return { results_path: artifact.path, results_sha256: artifact.sha256, source_drift: results.source_drift, cases: rows.length };
  } catch {
    const failure = {
      schema_version: "external-evaluation-failure/1", ...metadata, finished_at: new Date().toISOString(),
      source_before: before, source_after: after, source_drift: before && after ? before.sha256 !== after.sha256 : null,
      failure_phase: phase, failed_case_id: failedCaseId,
      scheduled_ids: inputs.cases.map((item) => item.id),
      not_started_ids: inputs.cases.slice(startedCount).map((item) => item.id), rows,
    };
    let artifact;
    try { artifact = writeArtifact(join(runDir, "failure.json"), failure); }
    catch { throw new Error(`run evaluation failure at ${phase}; failure evidence could not be retained`); }
    throw Object.assign(new Error(`run evaluation failure at ${phase}`), { failure_path: artifact.path, failure_sha256: artifact.sha256 });
  }
}

function resultPack(value, seal, sealHash) {
  keys(value, ["schema_version", "classification", "seal_sha256", "inputs_sha256", "strategy", "run_directory", "started_at", "finished_at", "environment", "source_before", "source_after", "source_drift", "rows"]);
  check(value.schema_version === "external-evaluation-results/1" && value.classification === "synthetic-public", "invalid results schema");
  check(value.seal_sha256 === sealHash && value.inputs_sha256 === seal.inputs.sha256, "results seal/input binding mismatch");
  check(["protocol", "structured"].includes(value.strategy) && nonempty(value.run_directory), "invalid run metadata");
  check([value.started_at, value.finished_at].every((x) => typeof x === "string" && Number.isFinite(Date.parse(x))), "invalid run timestamps");
  keys(value.environment, ["node", "platform", "architecture"]);
  check(Object.values(value.environment).every(nonempty), "invalid run environment");
  for (const identity of [value.source_before, value.source_after]) {
    keys(identity, ["files", "sha256"]);
    check(sourceIdentity(identity.files).sha256 === identity.sha256, "source identity digest mismatch");
  }
  check(value.source_drift === (value.source_before.sha256 !== value.source_after.sha256), "incorrect source drift marker");
  sameRows(value.rows, seal.case_ids);
  value.rows.forEach(rawRow);
}

export function scoreEvaluation(options) {
  keys(options, ["labelsPath", "sealPath", "sealSha256", "resultsPath", "resultsSha256", "outputPath"]);
  const seal = readSeal(options.sealPath, options.sealSha256);
  const labels = readJSON(options.labelsPath, seal.labels.sha256, seal.labels.bytes).value;
  labelPack(labels);
  sameRows(labels.cases, seal.case_ids);
  check(isDigest(options.resultsSha256), "a separately retained results SHA-256 is required");
  const results = readJSON(options.resultsPath, options.resultsSha256).value;
  resultPack(results, seal, options.sealSha256);
  const byId = new Map(results.rows.map((row) => [row.id, row]));
  const rows = labels.cases.map(({ id, expected: target }) => {
    const actual = byId.get(id);
    const mappingMatch = actual.preparation.status === target.mapping.status && actual.preparation.reason === target.mapping.reason;
    const projectionMatch = isDeepStrictEqual(actual.preparation.projection, target.mapping.projection);
    const decision = actual.authorization?.decision ?? "not_evaluated";
    const decisionMatch = decision === target.decision;
    return { id, mapping_match: mappingMatch, projection_match: projectionMatch, decision_match: decisionMatch, matched: mappingMatch && projectionMatch && decisionMatch, expected_decision: target.decision, actual_decision: decision };
  });
  const count = (predicate) => rows.filter(predicate).length;
  const report = {
    schema_version: "external-evaluation-score/1", seal_sha256: options.sealSha256,
    results_sha256: options.resultsSha256, labels_sha256: seal.labels.sha256,
    source_drift: results.source_drift, evidence_use: results.source_drift ? "exploratory-source-drift" : "synthetic-public-development",
    summary: { cases: rows.length, matched: count((x) => x.matched), mismatched: count((x) => !x.matched), semantic_decisions: count((x) => x.expected_decision !== "not_evaluated"), semantic_matches: count((x) => x.expected_decision !== "not_evaluated" && x.matched), correct_denials: count((x) => x.expected_decision === "deny" && x.matched), not_evaluated_cases: count((x) => x.expected_decision === "not_evaluated"), not_evaluated_matches: count((x) => x.expected_decision === "not_evaluated" && x.matched) }, rows,
  };
  const artifact = writeArtifact(options.outputPath, report);
  return { ...report, score_path: artifact.path, score_sha256: artifact.sha256 };
}

const CLI = {
  seal: { "--inputs": "inputsPath", "--labels": "labelsPath", "--out": "outputPath" },
  run: { "--inputs": "inputsPath", "--seal": "sealPath", "--seal-sha256": "sealSha256", "--run-dir": "runDir", "--strategy": "strategy" },
  score: { "--labels": "labelsPath", "--seal": "sealPath", "--seal-sha256": "sealSha256", "--results": "resultsPath", "--results-sha256": "resultsSha256", "--out": "outputPath" },
};

function isMain() {
  try { return process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (isMain()) {
  try {
    const [phase, ...args] = process.argv.slice(2);
    if (phase === "--help" || phase === undefined) {
      process.stdout.write("seal --inputs FILE --labels FILE --out FILE\nrun --inputs FILE --seal FILE --seal-sha256 HEX --run-dir NEW_DIR [--strategy protocol|structured]\nscore --labels FILE --seal FILE --seal-sha256 HEX --results FILE --results-sha256 HEX --out FILE\n");
    } else {
      check(Object.hasOwn(CLI, phase), "unknown phase");
      const options = {};
      for (let i = 0; i < args.length; i += 2) {
        const key = CLI[phase][args[i]];
        check(key && !Object.hasOwn(options, key) && nonempty(args[i + 1]) && !args[i + 1].startsWith("--"), "unknown, duplicate, or missing option");
        options[key] = args[i + 1];
      }
      const result = await { seal: sealEvaluation, run: runEvaluation, score: scoreEvaluation }[phase](options);
      process.stdout.write(JSON.stringify(result) + "\n");
      if (phase === "score" && result.summary.mismatched > 0) process.exitCode = 2;
    }
  } catch (error) {
    process.stderr.write(`EXTERNAL_EVALUATION_FAILURE: ${error.message}\n`);
    if (error.failure_path && isDigest(error.failure_sha256)) process.stderr.write(JSON.stringify({ failure_path: error.failure_path, failure_sha256: error.failure_sha256 }) + "\n");
    process.exitCode = 1;
  }
}
