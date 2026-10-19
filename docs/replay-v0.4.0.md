# Reproduce v0.4 Without Sending Actions

This guide reconstructs captured evidence. It does not rerun the model, create
an issue, publish a comment or require an OSuite account. Installation downloads
public source, npm packages and a hash-pinned OPA binary; subsequent commands
below perform no network requests. New timings describe your replay, not the
original provider latency.

Use Git, Node.js 22 or newer, npm and Python 3.9 or newer on macOS or Linux.
The tested CI combinations are Node 22/Python 3.11 on Linux and Node 24/Python
3.13 on macOS. Windows and hosted-MCP authentication are not qualified here.

## Get the Complete Source History

Use full public clones in a new directory. No login is needed:

```sh
git clone https://github.com/OndCo/Action-Effect-Spec.git action-effect-spec
git clone https://github.com/OndCo/Action-Effect-Bench.git action-effect-bench
cd action-effect-bench
git checkout --detach v0.4.0-draft.1
git -C ../action-effect-spec checkout --detach "$(node -p "require('./spec-lock.json').commit")"
```

The Spec pin is `a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40`. The release's
Bench tree adds analysis and documentation; the live study's original execution
source is `f93b1cfcbf2c2665b4acc7c5dc8fb92d1ba8d6b6`. Replay reads historical
blobs as data and verifies them against the recorded inventories. It does not
execute arbitrary historical code or attribute the old run to the new tree.

**Do not use GitHub's automatic source ZIP or a shallow clone.** Those may lack
the historical objects required to verify the reports. Missing history is a
verification failure, not permission to skip source checks.

As an alternative, the [release](https://github.com/OndCo/Action-Effect-Bench/releases/tag/v0.4.0-draft.1)
attaches `Action-Effect-Bench-v0.4.0-draft.1.bundle` and
`Action-Effect-Spec-a9b86f4.bundle`. Download those, the remaining attached
assets and `SHA256SUMS` into a new directory. On macOS verify the manifest with
`shasum -a 256 -c SHA256SUMS`; on Linux use `sha256sum -c SHA256SUMS`.
Then replace the two HTTPS clone commands with:

```sh
git clone Action-Effect-Spec-a9b86f4.bundle action-effect-spec
git clone Action-Effect-Bench-v0.4.0-draft.1.bundle action-effect-bench
cd action-effect-bench
git -C ../action-effect-spec checkout --detach "$(node -p "require('./spec-lock.json').commit")"
```

Each bundle contains the corresponding selected public main history. Bench's
bundle starts on the release commit, not a moving current branch. It contains
no npm installation, OPA binary, private configuration or credentials. Compare
its `git rev-parse HEAD` with the exact commit printed in the release notes.

## Install the Pinned Evaluation Dependencies

From the Bench root:

```sh
npm ci --prefix runtime-pilot --ignore-scripts --no-fund --no-audit
node runtime-pilot/install-tools.mjs
```

The lock selects Octokit 22.0.1 and MCP SDK 1.32.1. The OPA 1.21.2 installer
verifies the platform-specific SHA-256 in `runtime-pilot/tools.json`. Keep a
failed download or hash mismatch as a setup failure; do not replace OPA with a
stub. The official GitHub MCP executable and Azure access are not needed to
replay retained observations.

## Reconstruct and Audit

```sh
node field-study/write-replay.mjs reports/owned-write-study-2026-10-19T13-50-36.691Z-ff5e0a2c.json
node analysis/owned-write-audit.mjs
node field-study/replay.mjs reports/field-study-use-2026-10-19T06-33-57.736Z-0e238334.json
node field-study/replay.mjs reports/field-study-use-2026-10-19T07-15-38.744Z-a76953f1.json
```

Successful owned-write replay reports 21 journals, 20 workers, five native
comment calls, five observed objects, eight no-send duplicate probes, three
confirmed recoveries and one unknown. The two original read-only runs retain
their recorded task failures and normalized-release-envelope coverage gaps.
Replay writes new timestamped reports without replacing old measurements.
The arithmetic audit checks the published source-report hash before counting.

Optionally add `--public` to **only** `analysis/owned-write-audit.mjs` for six
anonymous GETs of the literal issue/comment URLs. That requests current public
content, not a rerun, POST or historical-provenance proof. An object changed or
removed after publication may no longer match; retain that result.

Never use `--setup`, `--execute` or `--adopt-unstarted` to reproduce this record.
No reader is authorized to repeat the experiment on the existing evidence issue.

## Check the Software Separately

```sh
node --test ../action-effect-spec/implementations/javascript/*.test.mjs conformance/runner.test.mjs conformance/entrypoints.test.mjs runtime-pilot/tests/*.test.mjs
node --test field-study/tests/*.test.mjs analysis/*.test.mjs
python3 -B -W error -m unittest discover -s ../action-effect-spec/implementations/python/tests
python3 -B -W error -m unittest discover -s runtime-pilot/tests -p 'test_*.py'
```

Software regressions, evidence reconstruction, public current-content checks,
semantic source review and user usefulness are different claims. Passing these
commands is not external certification, production qualification, independent
human acceptance or a proof of cross-provider exactly-once execution.
