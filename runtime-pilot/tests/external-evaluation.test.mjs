import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const moduleUrl = new URL("../external-evaluation.mjs", import.meta.url);
const cliPath = fileURLToPath(moduleUrl);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const write = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
const read = (path) => JSON.parse(readFileSync(path, "utf8"));
const pin = (path) => hash(readFileSync(path));
function duplicateKey(path, name, encodedName) {
  const raw = readFileSync(path, "utf8"), key = `${JSON.stringify(name)}:`;
  assert(raw.includes(key));
  writeFileSync(path, raw.replace(key, `${encodedName}: null, ${key}`));
}
const context = { principal: "fixture-user", data_class: "synthetic-public", implementation: "github-comment-bridge/1" };
const call = { owner: "ExampleOrg", repo: "public-fixtures", issue_number: 7, body: "Synthetic custody CLI example." };
const policy = { revision: "p1", principal: "fixture-user", revoked: false, allow_partial_direct: true, max_body_bytes: 8192, grants: [{ repository: "ExampleOrg/public-fixtures", issue_number: 7, data_class: "synthetic-public" }] };
function projection(c) {
  const repository = `${c.owner}/${c.repo}`;
  return { operation: "create_issue_comment", repository, issue_number: c.issue_number, endpoint: `https://api.github.com/repos/${repository}/issues/${c.issue_number}/comments`, body_sha256: hash(Buffer.from(c.body, "utf8")), body_bytes: Buffer.byteLength(c.body, "utf8"), data_class: "synthetic-public" };
}
function example() {
  return structuredClone({
    inputs: { schema_version: "external-evaluation-inputs/1", classification: "synthetic-public", cases: [
      { id: "allowed", native: { lane: "sdk", call }, context, policy },
      { id: "denied", native: { lane: "sdk", call }, context, policy: { ...policy, revoked: true } },
      { id: "invalid", native: { lane: "mcp", call: { name: "add_issue_comment", arguments: { ...call, body: "" } } }, context, policy },
    ] },
    labels: { schema_version: "external-evaluation-labels/1", cases: [
      { id: "allowed", expected: { mapping: { status: "accepted_partial", reason: "declared_partial", projection: projection(call) }, decision: "allow" } },
      { id: "denied", expected: { mapping: { status: "accepted_partial", reason: "declared_partial", projection: projection(call) }, decision: "deny" } },
      { id: "invalid", expected: { mapping: { status: "invalid_input", reason: "native_input" }, decision: "not_evaluated" } },
    ] },
  });
}
function workspace(t) {
  const dir = mkdtempSync(join(tmpdir(), "external-evaluation-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const paths = { inputsPath: join(dir, "inputs.json"), labelsPath: join(dir, "labels.json"), sealPath: join(dir, "seal.json"), runDir: join(dir, "run"), outputPath: join(dir, "score.json") };
  const data = example();
  write(paths.inputsPath, data.inputs);
  write(paths.labelsPath, data.labels);
  return { dir, paths, data };
}
function fakeRuntime() {
  const calls = { preparations: [], authorizations: [] };
  return {
    calls,
    sourceSnapshot: () => [{ path: "bench/runtime-pilot/gate.mjs", sha256: "a".repeat(64) }],
    prepareAction(native, ctx, strategy) {
      calls.preparations.push({ native: structuredClone(native), context: structuredClone(ctx), strategy });
      const c = native.lane === "sdk" ? native.call : native.call.arguments;
      return c.body === "" ? { status: "invalid_input", reason: "native_input", authority: "not_evaluated" }
        : { status: "accepted_partial", reason: "declared_partial", projection: projection(c), authority: "not_evaluated", description: { synthetic_test_output: true }, mapping_ms: 0.25 };
    },
    authorize(p, ctx, state) {
      calls.authorizations.push({ projection: p, context: ctx, policy: state });
      return { decision: state.revoked ? "deny" : "allow", reason: "synthetic-test-stub" };
    },
  };
}
async function sealed(t) {
  const api = await import(moduleUrl);
  const w = workspace(t);
  const seal = api.sealEvaluation({ inputsPath: w.paths.inputsPath, labelsPath: w.paths.labelsPath, outputPath: w.paths.sealPath });
  return { ...w, api, seal };
}
async function executed(t, runtime = fakeRuntime()) {
  const w = await sealed(t);
  const run = await w.api.runEvaluation({ inputsPath: w.paths.inputsPath, sealPath: w.paths.sealPath, sealSha256: w.seal.seal_sha256, runDir: w.paths.runDir, strategy: "protocol" }, runtime);
  return { ...w, runtime, run };
}
function scoreOptions(w, resultsSha256 = w.run.results_sha256) {
  return { labelsPath: w.paths.labelsPath, sealPath: w.paths.sealPath, sealSha256: w.seal.seal_sha256, resultsPath: w.run.results_path, resultsSha256, outputPath: w.paths.outputPath };
}
function failureArtifact(w) {
  const path = join(w.paths.runDir, "failure.json");
  assert(existsSync(path), "run discarded failure evidence");
  const failure = read(path), sha256 = pin(path);
  assert.equal(failure.schema_version, "external-evaluation-failure/1");
  assert.equal(failure.seal_sha256, w.seal.seal_sha256);
  assert.equal(failure.inputs_sha256, pin(w.paths.inputsPath));
  assert.equal(readFileSync(`${path}.sha256`, "utf8"), `${sha256}\n`);
  assert.deepEqual(failure.scheduled_ids, w.data.inputs.cases.map((row) => row.id));
  assert(!existsSync(join(w.paths.runDir, "results.json")));
  return { failure, path, sha256 };
}
function rejectFailureScore(w, artifact) {
  assert.throws(() => w.api.scoreEvaluation({ labelsPath: w.paths.labelsPath, sealPath: w.paths.sealPath, sealSha256: w.seal.seal_sha256, resultsPath: artifact.path, resultsSha256: artifact.sha256, outputPath: w.paths.outputPath }), /schema/i);
  assert(!existsSync(w.paths.outputPath));
}

test("the scoped executable CLI exists", () => {
  assert(existsSync(cliPath), "external-evaluation.mjs has not been implemented");
});

test("symlink CLI --help genuinely emits the three-phase command contract", (t) => {
  const { dir } = workspace(t);
  const link = join(dir, "external-cli.mjs");
  symlinkSync(cliPath, link);
  const out = spawnSync(process.execPath, [link, "--help"], { encoding: "utf8", timeout: 30000 });
  assert.equal(out.status, 0, out.stderr || out.error?.message);
  assert.equal(out.stderr, "");
  assert.match(out.stdout, /^seal --inputs FILE --labels FILE --out FILE\nrun --inputs FILE --seal FILE --seal-sha256 HEX --run-dir NEW_DIR \[--strategy protocol\|structured\]\nscore --labels FILE --seal FILE --seal-sha256 HEX --results FILE --results-sha256 HEX --out FILE\n$/);
});

test("import from stdin stays silent even with importer --help arguments", () => {
  const out = spawnSync(process.execPath, ["--input-type=module", "-", "--help"], {
    input: `await import(${JSON.stringify(moduleUrl.href)});`, encoding: "utf8", timeout: 30000,
  });
  assert.equal(out.status, 0, out.stderr || out.error?.message);
  assert.equal(out.stdout, "");
  assert.equal(out.stderr, "");
});

test("seal/run/score preserve raw outputs and separate semantic decisions from not_evaluated", async (t) => {
  const w = await executed(t);
  const publicSeal = read(w.paths.sealPath);
  assert.equal(publicSeal.inputs.sha256, pin(w.paths.inputsPath));
  assert.equal(publicSeal.labels.sha256, pin(w.paths.labelsPath));
  assert(!JSON.stringify(publicSeal).includes(w.paths.labelsPath));
  assert(!JSON.stringify(publicSeal).includes("declared_partial"));
  const raw = read(w.run.results_path);
  assert.deepEqual(raw.rows[0].preparation.description, { synthetic_test_output: true });
  assert.equal(raw.rows[2].authorization, null);
  assert.equal(raw.run_directory, w.paths.runDir);
  assert.equal(w.runtime.calls.preparations.length, 3);
  assert.equal(w.runtime.calls.authorizations.length, 2);
  assert(w.runtime.calls.preparations.every((x) => x.strategy === "protocol"));
  assert.deepEqual(w.runtime.calls.authorizations[0].context, context);
  w.runtime.prepareAction = () => assert.fail("score reran the candidate");
  w.runtime.authorize = () => assert.fail("score reran authorization");
  rmSync(w.paths.inputsPath);
  const scored = w.api.scoreEvaluation(scoreOptions(w));
  assert.deepEqual(scored.summary, { cases: 3, matched: 3, mismatched: 0, semantic_decisions: 2, semantic_matches: 2, correct_denials: 1, not_evaluated_cases: 1, not_evaluated_matches: 1 });
  assert.equal(read(w.paths.outputPath).source_drift, false);
});

test("run works when labels are absent and rejects label options before executing", async (t) => {
  const w = await sealed(t);
  const runtime = fakeRuntime();
  rmSync(w.paths.labelsPath);
  const options = { inputsPath: w.paths.inputsPath, sealPath: w.paths.sealPath, sealSha256: w.seal.seal_sha256, runDir: w.paths.runDir };
  await assert.rejects(w.api.runEvaluation({ ...options, labelsPath: "must-not-be-read" }, runtime), /unknown|option/i);
  assert.equal(runtime.calls.preparations.length, 0);
  await w.api.runEvaluation(options, runtime);
  assert.equal(runtime.calls.preparations.length, 3);
});

test("tampered input or seal is rejected before any candidate call", async (t) => {
  const w = await sealed(t);
  const runtime = fakeRuntime();
  w.data.inputs.cases[0].native.call.body += " altered";
  write(w.paths.inputsPath, w.data.inputs);
  const options = { inputsPath: w.paths.inputsPath, sealPath: w.paths.sealPath, sealSha256: w.seal.seal_sha256, runDir: w.paths.runDir };
  await assert.rejects(w.api.runEvaluation(options, runtime), /digest|hash|integrity/i);
  const manifest = read(w.paths.sealPath);
  manifest.inputs.sha256 = pin(w.paths.inputsPath);
  write(w.paths.sealPath, manifest);
  await assert.rejects(w.api.runEvaluation(options, runtime), /digest|hash|integrity/i);
  assert.equal(runtime.calls.preparations.length, 0);
});

test("tampered labels and raw results are rejected against independently supplied pins", async (t) => {
  const w = await executed(t);
  w.data.labels.cases[0].expected.decision = "deny";
  write(w.paths.labelsPath, w.data.labels);
  assert.throws(() => w.api.scoreEvaluation(scoreOptions(w)), /digest|hash|integrity/i);
  write(w.paths.labelsPath, example().labels);
  const raw = read(w.run.results_path);
  raw.rows[0].authorization.decision = "deny";
  write(w.run.results_path, raw);
  assert.throws(() => w.api.scoreEvaluation(scoreOptions(w)), /digest|hash|integrity/i);
});

test("seal rejects duplicate IDs, missing label rows, and expected values in inputs", async (t) => {
  const { api } = await sealed(t);
  for (const mutation of [
    (x) => x.inputs.cases.push(x.inputs.cases[0]),
    (x) => x.labels.cases.push(x.labels.cases[0]),
    (x) => x.labels.cases.pop(),
    (x) => { x.inputs.cases[0].expected = x.labels.cases[0].expected; },
  ]) {
    const w = workspace(t);
    mutation(w.data);
    write(w.paths.inputsPath, w.data.inputs);
    write(w.paths.labelsPath, w.data.labels);
    assert.throws(() => api.sealEvaluation({ inputsPath: w.paths.inputsPath, labelsPath: w.paths.labelsPath, outputPath: w.paths.sealPath }), /duplicate|rows|keys|schema/i);
  }
});

test("seal rejects duplicate decoded object names in inputs and labels", async (t) => {
  const api = await import(moduleUrl);
  for (const [path, name, encodedName] of [
    ["inputsPath", "id", '"i\\u0064"'],
    ["inputsPath", "body", '"b\\u006fdy"'],
    ["labelsPath", "id", '"i\\u0064"'],
    ["labelsPath", "status", '"st\\u0061tus"'],
  ]) {
    const w = workspace(t);
    duplicateKey(w.paths[path], name, encodedName);
    assert.throws(() => api.sealEvaluation({ inputsPath: w.paths.inputsPath, labelsPath: w.paths.labelsPath, outputPath: w.paths.sealPath }), /duplicate JSON object key/i);
    assert(!existsSync(w.paths.sealPath));
  }
});

test("run and score reject duplicate decoded names in every artifact even with matching pins", async (t) => {
  for (const target of ["inputs", "seal", "labels", "results"]) {
    const w = await executed(t);
    if (["inputs", "labels"].includes(target)) {
      const path = w.paths[`${target}Path`];
      duplicateKey(path, "id", '"i\\u0064"');
      const manifest = read(w.paths.sealPath);
      manifest[target] = { sha256: pin(path), bytes: readFileSync(path).length };
      write(w.paths.sealPath, manifest);
    } else if (target === "seal") duplicateKey(w.paths.sealPath, "sha256", '"\\u0073ha256"');
    else duplicateKey(w.run.results_path, "decision", '"deci\\u0073ion"');
    const sealSha256 = pin(w.paths.sealPath);
    if (["inputs", "seal"].includes(target)) {
      const runtime = fakeRuntime();
      const runDir = join(w.dir, "duplicate-run");
      await assert.rejects(w.api.runEvaluation({ inputsPath: w.paths.inputsPath, sealPath: w.paths.sealPath, sealSha256, runDir }, runtime), /duplicate JSON object key/i);
      assert.equal(runtime.calls.preparations.length, 0);
      assert(!existsSync(runDir));
    } else {
      if (target === "labels") {
        const raw = read(w.run.results_path);
        raw.seal_sha256 = sealSha256;
        write(w.run.results_path, raw);
      }
      assert.throws(() => w.api.scoreEvaluation({ ...scoreOptions(w, pin(w.run.results_path)), sealSha256 }), /duplicate JSON object key/i);
      assert(!existsSync(w.paths.outputPath));
    }
  }
});

test("JSON parsing preserves fractional negative native values and ignores key-like string contents", async (t) => {
  const w = workspace(t), api = await import(moduleUrl);
  const numbers = [-1.5, 0.25, -2e-7];
  w.data.inputs.cases.forEach((row, i) => {
    (row.native.lane === "sdk" ? row.native.call : row.native.call.arguments).issue_number = numbers[i];
    w.data.labels.cases[i].expected = { mapping: { status: "invalid_input", reason: "native_input" }, decision: "not_evaluated" };
  });
  w.data.inputs.cases[0].native.call.body = '{"id": 1, "\\u0069d": 2}: [ ]';
  write(w.paths.inputsPath, w.data.inputs);
  write(w.paths.labelsPath, w.data.labels);
  const seal = api.sealEvaluation({ inputsPath: w.paths.inputsPath, labelsPath: w.paths.labelsPath, outputPath: w.paths.sealPath });
  const runtime = fakeRuntime(), seen = [];
  runtime.prepareAction = (native) => { seen.push(native); return { status: "invalid_input", reason: "native_input" }; };
  runtime.authorize = () => assert.fail("negative native input reached authorization");
  await api.runEvaluation({ inputsPath: w.paths.inputsPath, sealPath: w.paths.sealPath, sealSha256: seal.seal_sha256, runDir: w.paths.runDir }, runtime);
  assert.deepEqual(seen, w.data.inputs.cases.map((row) => row.native));
});

test("score rejects duplicate or missing result rows even with a matching result digest", async (t) => {
  for (const mutate of [(r) => r.rows.push(r.rows[0]), (r) => r.rows.pop()]) {
    const w = await executed(t);
    const raw = read(w.run.results_path);
    mutate(raw);
    write(w.run.results_path, raw);
    assert.throws(() => w.api.scoreEvaluation(scoreOptions(w, pin(w.run.results_path))), /duplicate|rows/i);
  }
});

test("invalid candidate outputs fail rather than becoming denials", async (t) => {
  for (const fault of ["mapping", "projection", "authorization", "non-json", "array-extra"]) {
    const w = await sealed(t);
    const runtime = fakeRuntime();
    if (fault === "mapping") runtime.prepareAction = () => ({ status: "evaluation_failure", reason: "bad_config" });
    if (fault === "projection") runtime.prepareAction = () => ({ status: "accepted_partial", reason: "declared_partial", projection: {} });
    if (fault === "authorization") runtime.authorize = () => ({ decision: "evaluation_failure", reason: "bad_config" });
    if (fault === "non-json") runtime.authorize = () => ({ decision: "allow", ignored: undefined });
    if (fault === "array-extra") runtime.authorize = () => ({ decision: "allow", samples: Object.assign([1], { ignored: "silently lost by JSON.stringify" }) });
    await assert.rejects(w.api.runEvaluation({ inputsPath: w.paths.inputsPath, sealPath: w.paths.sealPath, sealSha256: w.seal.seal_sha256, runDir: w.paths.runDir }, runtime), /output|projection|schema|JSON|evaluation/i);
    assert(!existsSync(join(w.paths.runDir, "results.json")));
  }
});

test("runtime faults retain only validated completed rows, a sanitized phase, and the remaining schedule", async (t) => {
  const marker = "synthetic-error-detail-must-not-leak";
  for (const phase of ["preparation", "preparation_output", "authorization", "authorization_output"]) {
    const w = await sealed(t), runtime = fakeRuntime();
    const prepare = runtime.prepareAction, authorize = runtime.authorize;
    runtime.prepareAction = (...args) => {
      const prepared = prepare(...args);
      if (runtime.calls.preparations.length === 2 && phase.startsWith("preparation")) {
        if (phase === "preparation") throw new Error(marker);
        return { status: "evaluation_failure", reason: marker };
      }
      return prepared;
    };
    runtime.authorize = (...args) => {
      const authorized = authorize(...args);
      if (runtime.calls.authorizations.length === 2 && phase.startsWith("authorization")) {
        if (phase === "authorization") throw new Error(marker);
        return { decision: "evaluation_failure", reason: marker };
      }
      return authorized;
    };
    let thrown;
    await assert.rejects(w.api.runEvaluation({ inputsPath: w.paths.inputsPath, sealPath: w.paths.sealPath, sealSha256: w.seal.seal_sha256, runDir: w.paths.runDir }, runtime), (error) => { thrown = error; return true; });
    const artifact = failureArtifact(w), { failure } = artifact;
    assert.equal(failure.failure_phase, phase);
    assert.equal(failure.failed_case_id, "denied");
    assert.deepEqual(failure.rows.map((row) => row.id), ["allowed"]);
    assert.deepEqual(failure.rows[0].preparation.projection, projection(call));
    assert.deepEqual(failure.rows[0].preparation.description, { synthetic_test_output: true });
    assert.equal(failure.rows[0].authorization.decision, "allow");
    assert.deepEqual(failure.not_started_ids, ["invalid"]);
    assert.equal(failure.source_after, null);
    assert.equal(failure.source_drift, null);
    assert.equal(thrown.failure_path, artifact.path);
    assert.equal(thrown.failure_sha256, artifact.sha256);
    assert(!JSON.stringify(failure).includes(marker));
    assert(!thrown.message.includes(marker));
    assert.equal(runtime.calls.preparations.length, 2);
    assert.equal(runtime.calls.authorizations.length, phase.startsWith("preparation") ? 1 : 2);
    rmSync(w.paths.inputsPath);
    rejectFailureScore(w, artifact);
    assert.equal(runtime.calls.preparations.length, 2);
  }
});

test("setup and source-finalization faults retain evidence without inventing a failed case or rerunning", async (t) => {
  for (const phase of ["source_before", "runtime_configuration", "source_after"]) {
    const w = await sealed(t), runtime = fakeRuntime();
    const snapshot = runtime.sourceSnapshot;
    let snapshots = 0;
    runtime.sourceSnapshot = () => {
      snapshots++;
      if (phase === "source_before" || (phase === "source_after" && snapshots === 2)) throw new Error("synthetic snapshot fault");
      return snapshot();
    };
    if (phase === "runtime_configuration") runtime.authorize = null;
    await assert.rejects(w.api.runEvaluation({ inputsPath: w.paths.inputsPath, sealPath: w.paths.sealPath, sealSha256: w.seal.seal_sha256, runDir: w.paths.runDir }, runtime));
    const artifact = failureArtifact(w), { failure } = artifact;
    assert.equal(failure.failure_phase, phase);
    assert.equal(failure.failed_case_id, null);
    assert.equal(failure.rows.length, phase === "source_after" ? 3 : 0);
    assert.deepEqual(failure.not_started_ids, phase === "source_after" ? [] : failure.scheduled_ids);
    assert.equal(runtime.calls.preparations.length, failure.rows.length);
    assert.equal(snapshots, phase === "source_after" ? 2 : 1);
    rmSync(w.paths.inputsPath);
    rejectFailureScore(w, artifact);
  }
});

test("projection digest types are validated without coercion", async (t) => {
  const w = await sealed(t);
  const runtime = fakeRuntime();
  runtime.prepareAction = () => ({ status: "accepted_partial", reason: "declared_partial", projection: { ...projection(call), body_sha256: [projection(call).body_sha256] } });
  await assert.rejects(w.api.runEvaluation({ inputsPath: w.paths.inputsPath, sealPath: w.paths.sealPath, sealSha256: w.seal.seal_sha256, runDir: w.paths.runDir }, runtime), /preparation_output/);
});

test("score rejects fabricated denial for a nonaccepted mapping", async (t) => {
  const w = await executed(t);
  const raw = read(w.run.results_path);
  raw.rows[2].authorization = { decision: "deny", reason: "must-not-count" };
  write(w.run.results_path, raw);
  assert.throws(() => w.api.scoreEvaluation(scoreOptions(w, pin(w.run.results_path))), /not_evaluated|nonaccepted|authorization/i);
});

test("source drift retains an explicitly exploratory raw report", async (t) => {
  const runtime = fakeRuntime();
  let snapshots = 0;
  runtime.sourceSnapshot = () => [{ path: "bench/runtime-pilot/gate.mjs", sha256: (++snapshots === 1 ? "a" : "b").repeat(64) }];
  const w = await executed(t, runtime);
  assert.equal(w.run.source_drift, true);
  assert.equal(read(w.run.results_path).source_drift, true);
  const scored = w.api.scoreEvaluation(scoreOptions(w));
  assert.equal(scored.evidence_use, "exploratory-source-drift");
});

test("artifact outputs are exclusive and CLI rejects arbitrary flags", async (t) => {
  const w = await sealed(t);
  assert.throws(() => w.api.sealEvaluation({ inputsPath: w.paths.inputsPath, labelsPath: w.paths.labelsPath, outputPath: w.paths.sealPath }), /exist/i);
  for (const args of [["run", "--labels", w.paths.labelsPath], ["run", "--module", "untrusted.mjs"], ["score", "--strategy", "protocol"]]) {
    const out = spawnSync(process.execPath, [cliPath, ...args], { encoding: "utf8" });
    assert.notEqual(out.status, 0);
    assert.match(out.stderr, /unknown|option/i);
  }
});

test("real CLI runs only the fixed offline APIs and scores saved results", async (t) => {
  const w = workspace(t);
  write(w.paths.inputsPath, w.data.inputs);
  write(w.paths.labelsPath, w.data.labels);
  const cli = (args) => {
    const out = spawnSync(process.execPath, [cliPath, ...args], { encoding: "utf8", timeout: 30000 });
    assert.equal(out.status, 0, out.stderr || out.error?.message);
    return JSON.parse(out.stdout);
  };
  const seal = cli(["seal", "--inputs", w.paths.inputsPath, "--labels", w.paths.labelsPath, "--out", w.paths.sealPath]);
  const savedLabels = readFileSync(w.paths.labelsPath);
  rmSync(w.paths.labelsPath);
  const run = cli(["run", "--inputs", w.paths.inputsPath, "--seal", w.paths.sealPath, "--seal-sha256", seal.seal_sha256, "--run-dir", w.paths.runDir]);
  const raw = read(run.results_path);
  assert(raw.source_before.files.length > 0);
  assert(raw.source_before.files.every((x) => !x.path.includes("/cases/") && !x.path.includes("/tests/")));
  writeFileSync(w.paths.labelsPath, savedLabels);
  rmSync(w.paths.inputsPath);
  const score = cli(["score", "--labels", w.paths.labelsPath, "--seal", w.paths.sealPath, "--seal-sha256", seal.seal_sha256, "--results", run.results_path, "--results-sha256", run.results_sha256, "--out", w.paths.outputPath]);
  assert.equal(score.summary.matched, 3);
  assert.equal(score.summary.semantic_decisions, 2);
  assert.equal(score.summary.correct_denials, 1);
  assert.equal(score.summary.not_evaluated_matches, 1);
});

test("real CLI retains an operational-invalid zero-byte policy fault and exits nonzero", async (t) => {
  const w = workspace(t);
  w.api = await import(moduleUrl);
  w.data.inputs.cases[1].policy.max_body_bytes = 0;
  write(w.paths.inputsPath, w.data.inputs);
  w.seal = w.api.sealEvaluation({ inputsPath: w.paths.inputsPath, labelsPath: w.paths.labelsPath, outputPath: w.paths.sealPath });
  const savedLabels = readFileSync(w.paths.labelsPath);
  rmSync(w.paths.labelsPath);
  const out = spawnSync(process.execPath, [cliPath, "run", "--inputs", w.paths.inputsPath, "--seal", w.paths.sealPath, "--seal-sha256", w.seal.seal_sha256, "--run-dir", w.paths.runDir], { encoding: "utf8", timeout: 30000 });
  assert.equal(out.status, 1, out.stderr || out.error?.message);
  assert.equal(out.stdout, "");
  const artifact = failureArtifact(w), { failure } = artifact;
  assert.equal(failure.failure_phase, "authorization_output");
  assert.equal(failure.failed_case_id, "denied");
  assert.deepEqual(failure.rows.map((row) => row.id), ["allowed"]);
  assert.deepEqual(failure.not_started_ids, ["invalid"]);
  assert.match(out.stderr, /EXTERNAL_EVALUATION_FAILURE: run evaluation failure at authorization_output/);
  assert.deepEqual(JSON.parse(out.stderr.trim().split("\n").at(-1)), { failure_path: artifact.path, failure_sha256: artifact.sha256 });
  writeFileSync(w.paths.labelsPath, savedLabels);
  rmSync(w.paths.inputsPath);
  rejectFailureScore(w, artifact);
});
