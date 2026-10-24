# Checked report preflight, field-study edition three

This opt-in edition responds to a real usability failure: four of six
edition-two Markdown reports exceeded the unchanged 6000-byte task limit.
It does not alter those reports, the six tasks, the thirty source-review facts,
their source pins or the published manuscript baseline.

## What changes

The model receives one additional local function, `check_report_contract`.
It supplies its complete proposed final report and receives exact decoded
UTF-8 byte count, format and observed-citation feedback. Revisions are explicit
model/tool calls inside the existing 12-round and 18-tool-call budget. The
function neither truncates text nor rewrites it, fetches data, publishes a
comment or grants authority.

A completed model loop is counted separately from a report ready for maintainer
review. Readiness requires a valid final report matching a successful recorded
draft, including conclusion and citations. A draft checked before a source was
read cannot borrow that later observation. Each task has fresh state. A journal
failure stops work; an unrecorded check cannot become reusable evidence.

The contract is frozen in [amendment-3.json](amendment-3.json). Final fields are
`task_id`, `report_markdown`, `conclusion`, `citations`; the report body limit
is 6000 UTF-8 bytes, conclusion limit 4096 bytes and citation limit 128. Exact
observed source URLs may carry ordered positive line anchors. URL observation
does not establish that a quotation, line range or conclusion is correct.

## Run and replay

Install the same pinned runtime dependencies and official GitHub MCP binary
as [the existing field-use guide](README.md). Node 22+ is required. No production
Hook, customer data or protected collaboration cases are involved.

Offline regressions:

```sh
node --test field-study/tests/report-contract.test.mjs field-study/tests/third-edition-replay.test.mjs field-study/tests/runner-journal.test.mjs
node --test --test-name-pattern=compound runtime-pilot/tests/gate.test.mjs
```

The first command uses synthetic model/transport fixtures. The second runs the
actual mapper, Python consumer, OPA and filesystem ledger with a synthetic
provider; it is not a new GitHub side-effect experiment.

Explicit paid model use and real public reads, with no write tool:

```sh
node field-study/run.mjs --real-readonly --report-preflight
```

Run only after selecting an immutable, tested source revision. Keep the printed
report, checksum, referenced freeze and entire journal even if the exit code is
nonzero. The report format is `field-study-use/2`; the study amendment is 3.
These are format and study identities, not a new Action Effect wire version.
The existing command without `--report-preflight` retains edition-two behavior.

```sh
node field-study/replay.mjs reports/REPORT_FILENAME.json
```

Replace `REPORT_FILENAME.json` with the actual printed filename. Replay requires
the recorded Git histories locally, verifies the frozen inputs, trace order,
model/tool counters, native read evidence and contract feedback. It performs
no model request or provider write and does not execute recorded source blobs.
It is an integrity/mechanical reconstruction, not an independent witness that
the original run happened or a reproduction of stochastic model output.

## Interpret separately

Report initial draft acceptance, failed drafts, final readiness, local check
calls, actual read-tool calls, model requests/tokens and total duration. Retain
source-review limitations and do not convert contract readiness into semantic
accuracy, partner acceptance, successful publication or protocol authorization.

This is a sequential repeat of six exposed tasks, not a randomized experiment,
a held-out sample or external validation. No new public comments are posted.
The comparison can show whether this explicit feedback worked on these tasks;
it cannot by itself establish causal improvement or customer-wide success.
