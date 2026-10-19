# Action-Effect Runtime Pilot: Public Working Draft

This prerelease adds a runnable MCP/SDK effect-description, real OPA decision,
and controlled GitHub execution/readback path. It does not require OSuite.

- An explicit opt-in contract clarification and bounded GitHub-comment profile
  are published in the [companion Spec release](https://github.com/OndCo/Action-Effect-Spec/releases/tag/v0.2.0-draft.1).
- Separately written JavaScript/Python paths and a complete structured baseline
  each match 108/108 development mapping checks and 52/52 eligible decisions.
- All 32 planned live checks match, with 12 real public comments, four
  read-only lost-ack recoveries and four suppressed duplicate requests.
- Accepted-input cold median cost is 50.391 ms for the protocol versus
  48.468 ms for the structured baseline. This is not a speed-superiority claim.
- Raw attempts, failures, source pins, read-only replay, a working paper,
  adopter instructions and separate seal/run/score tooling are included.

[Results and replay](https://github.com/OndCo/Action-Effect-Bench/blob/v0.2.0-draft.1/reports/runtime-pilot-summary.md)
| [Working paper](https://github.com/OndCo/Action-Effect-Bench/blob/v0.2.0-draft.1/paper/manuscript.md)
| [Quickstart](https://github.com/OndCo/Action-Effect-Bench/blob/v0.2.0-draft.1/docs/adoption/quickstart.md)

These are same-project, bounded development results. External independently
authored evaluations remain zero. Direct comment readback does not establish
complete provider provenance or transitive effects. This is not an adopted
industry standard, certification or qualified production gateway. Original
frozen artifacts and the failed first offline attempt remain preserved.
