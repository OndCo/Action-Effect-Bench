We have published an experimental Action-Effect interface and a runnable
comparison harness. We are seeking counterexamples and independent
implementations, not endorsements or product integrations by default.

The [Spec release](https://github.com/OndCo/Action-Effect-Spec/releases/tag/v0.2.0-draft.1)
keeps effect descriptions separate from current permission and observed results.
The [Bench repository](https://github.com/OndCo/Action-Effect-Bench) contains the
original refund-profile consumer comparison and a direct, partial GitHub-comment
profile with MCP, Octokit and OPA. No OSuite account or service is needed.

Useful contributions are:

1. A minimal synthetic counterexample: native input, expected coupled effect,
   evidence/unknown scope, and the exact point where the draft is ambiguous.
2. A third consumer written from the normative contract, with a capability
   statement and explicit unsupported cases. Another language is useful, but
   does not itself establish an independent institution or soundness.
3. A small independently authored evaluation pack. Keep expected outcomes away
   from the candidate runner; agree on semantics, custody, scoring, operational
   failure handling and disclosure before any confirmatory execution.
4. A narrow domain profile whose requirements cannot be expressed by the current
   tuples. Explain why an extension is necessary rather than silently treating
   an unknown value as an empty effect or a permission grant.

Start with the [quickstart](https://github.com/OndCo/Action-Effect-Bench/blob/main/docs/adoption/quickstart.md),
[results and limitations](https://github.com/OndCo/Action-Effect-Bench/blob/main/reports/runtime-pilot-summary.md),
and [separate seal/run/score interface](https://github.com/OndCo/Action-Effect-Bench/blob/main/docs/adoption/external-evaluation-cli.md).
The development cases are public and same-project; hashing them does not make
them independent heldouts. No external evaluation is claimed to have happened.

Before sharing, confirm rights to release the material under the applicable
repository license. Use synthetic public data only. Do not paste secrets,
customer traces, unpublished protected cases or vulnerability details here.
This is a public working draft, not an adopted standard or certification scheme.
Participation does not require a purchase or paid membership.
