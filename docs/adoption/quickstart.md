# Action-Effect Runtime Pilot Quickstart

Editorial revision: 19 October 2026, America/Toronto (EDT, UTC-04:00);
first drafted 18 October. The bounded offline and live runs and both replays
are complete. See the [measured results](../../reports/runtime-pilot-summary.md)
and [working paper](../../paper/manuscript.md). No external evaluation occurred.

This bounded, interface-only pilot compares SDK and MCP issue-comment inputs
through effect-wire and complete structured OPA adapters. No OSuite account,
code, or purchase is required. Start offline; live execution is a separate
authorization, not the default installation check.

## 1. Install Without Provider Writes

Use Git, Node.js >=22 with npm, and Python >=3.9. The OPA installer supports
macOS and Linux on arm64/x64. Setup downloads source, packages, and an OPA
binary; it does not post GitHub comments.

The published Spec prerelease [v0.2.0-draft.1](https://github.com/OndCo/Action-Effect-Spec/releases/tag/v0.2.0-draft.1)
is at `a9b86f4b529a5e330c2a9bf1b8c4c259a7b36e40`, the current Bench
[spec-lock.json](../../spec-lock.json) pin. For a fresh checkout, create two
lowercase sibling clones and use that lock:

```sh
git clone https://github.com/OndCo/Action-Effect-Spec.git action-effect-spec
git clone https://github.com/OndCo/Action-Effect-Bench.git action-effect-bench
cd action-effect-bench
git checkout --detach cecde389637be4f5fd3482e4942ce3fd1a623ac6
git -C ../action-effect-spec checkout --detach "$(node -p "require('./spec-lock.json').commit")"
```

That Bench revision reproduces the published **v0.2 runtime pilot**. Select the
Bench revision before reading its companion lock. The later real-model field
study has a separate source freeze and reproduction guide; do not attribute a
current-branch run to the historical pilot.

Run every remaining command from the Bench root:

```sh
npm ci --prefix runtime-pilot --ignore-scripts --no-fund --no-audit
node runtime-pilot/install-tools.mjs
```

The dependency lock pins `@modelcontextprotocol/sdk` 1.32.1 and `@octokit/rest`
22.0.1. The installer verifies OPA 1.21.2 against the platform-specific SHA-256
in `runtime-pilot/tools.json`. Do not substitute a policy-engine stub.
If downloading fails, do not bypass verification; an existing binary is usable
only when its hash matches that manifest.
Proceed to evaluation only after dependency setup succeeds. A partial download,
missing binary or failed hash check is a setup failure, not evidence that an
adapter or policy passed. The published local clean-clone check retained an
OPA download timeout before recovering with an already cached, same-hash binary.
It did not demonstrate a second successful fresh download.

## 2. Test Offline and Replay

These tests and the offline evaluation need no GitHub credential and perform
no provider writes:

```sh
node --test runtime-pilot/tests/*.test.mjs
python3 -B -W error -m unittest discover -s runtime-pilot/tests -p 'test_*.py'
node runtime-pilot/offline-run.mjs
```

The runner prints a new report path under `reports/`. Keep its JSON and adjacent
`.sha256`, including failures. To check the published measured offline report:

```sh
node runtime-pilot/replay.mjs reports/runtime-pilot-offline-2026-10-19T04-23-54.715Z-6bb423.json
```

Replay checks report integrity, recorded inputs, source identity, mapping, and
OPA decisions; it does not repeat provider writes or reproduce original timing.
It refuses source or checksum mismatches. Use the recorded source revision,
retain nonzero exits, and never replace a failed report with a successful rerun.

## 3. Explicitly Authorized Live Run

**This command posts public comments. Do not run it without repository-owner
authorization.** It is fixed to `OndCo/Action-Effect-Bench`, not arbitrary
customer repositories.

The completed study used [issue #1](https://github.com/OndCo/Action-Effect-Bench/issues/1)
and created 12 comments. **Do not rerun that issue.** It is an evidence resource,
not a reusable public test target or permission for readers to post.

- Use a fresh, open dedicated issue, not a pull request, with the exact title
  `Action-Effect controlled runtime pilot`. Obtain its numeric issue number
  from the authorized owner; do not reuse an ordinary project issue.
- Authenticate GitHub CLI (`gh`) as the authorized account with appropriately
  narrow permissions. The runner obtains its credential from `gh`; never put
  tokens in commands, public bodies, or reports.
- Agree on synthetic public content, notification exposure, rate/cost limits,
  and cleanup. The live plan permits at most **12 new comment posts**. The
  runner refuses an issue containing an `action-effect-run:` marker.

Replace `NUMBER` with that approved issue number:

```sh
node runtime-pilot/live-run.mjs --issue NUMBER --confirm-owned-repo OndCo/Action-Effect-Bench
```

Lost-ACK recovery is automatically **read-only** in the runner. There is no
separate reconciliation CLI; exported `reconcileAction` operates on the original
ledger/occurrence. Preserve `runtime-pilot/.runtime-private/` privately and retain
the attempt journal and reports. Never retry an uncertain POST, delete markers
to bypass the guard, or rerun a used issue for recovery.

For a retained live report, optionally check current public GitHub content:

```sh
node runtime-pilot/replay.mjs reports/runtime-pilot-live-2026-10-19T04-26-11.245Z-731e54.json --github
```

`--github` adds read-only GETs, not new comments. It checks current content, not
historical wall-clock execution or complete provider provenance.
ID-less recovery requires complete preflight and unique new exact body/actor
matching on a dedicated single-writer issue. It is not execution attribution.

## 4. Interpret the Boundary

The pinned Spec's `profiles/github-issue-comment/README.md` binds the exact
resource, destination, body digest, and UTF-8 byte count.
`accepted_partial/declared_partial` is evidence processing, **not permission**;
authority remains separately evaluated. Applicable denials take precedence;
otherwise the owned-test policy needs explicit `allow_partial_direct: true`
to admit the partial direct scope. Notifications/webhooks remain unknown even
after comment readback.

Adopt in stages: interface review, offline adapter, non-dispatching comparison,
then a separately authorized owned-resource test. This is not customer deployment
readiness. Use the [protocol](../../PROTOCOL.md),
[measurement record](../../paper/measurement-contract.md), and
[external custody procedure](external-evaluation.md); propose concrete tests
through [CONTRIBUTING.md](../../CONTRIBUTING.md), not protected inputs in public.
Both repositories retain MIT for selected original work, with upstream notices;
this makes no standards-body, patent, or legal-clearance claim.
