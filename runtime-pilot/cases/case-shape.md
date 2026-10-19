# Exact Case Shape and Scoring

The retained corpus is `github-issue-comment.v1.json`, with
`schema_version: "github-issue-comment-corpus/1"`. Active freeze metadata is in
`freeze-manifest.json` (revision 3); custody revisions do not change cases or labels.
Read `root.cases`, not every JSON file in this directory. There are 55 rows in
22 base-intent groups. Of these, 53 have both lanes and two are MCP-only, giving
108 lane instances. Paired lanes and variants are not independent samples.

The root has exactly `schema_version`, `corpus_id`, `provenance`, `scope`,
`format`, `counts`, and `cases`. The first two are strings. The metadata objects
are not native arguments. `counts` contains integer fields `cases`,
`base_intents`, `sdk`, `mcp`, and `lane_instances`.

Every case has exactly the fields below; `?` means an optional key, not null:

```typescript
type Case = {
  id: string;
  base_intent: string;
  scenario: string;
  native: { sdk?: object; mcp?: object }; // Nonempty; no other lane keys.
  context: {
    principal: string;
    data_class: string;
    implementation: string;
  } | null;
  policy: {
    revision: "p1";
    principal: string;
    revoked: boolean;
    allow_partial_direct: boolean;
    max_body_bytes: number;
    grants: {
      repository: string;
      issue_number: number;
      data_class: string;
    }[];
  };
  expected: {
    mapping: {
      status: "accepted_partial";
      reason: "declared_partial";
      projection: {
        operation: "create_issue_comment";
        repository: string;
        issue_number: number;
        endpoint: string;
        body_sha256: string;
        body_bytes: number;
        data_class: string;
      };
    };
    decision: "allow" | "deny" | "review";
  } | {
    mapping:
      | { status: "invalid_input"; reason: "native_input" }
      | { status: "unsupported_profile"; reason: "operation" }
      | { status: "untrusted_evidence"; reason: "missing_context" | "implementation_binding" };
    decision: "not_evaluated";
  };
};
```

Case and expected-object keys are exact. Every retained policy is well formed:
principal is nonempty, byte bounds are positive safe integers, and grant issue
numbers are positive safe integers at most 2147483647. An empty grants array is
valid and supplies no authorization. No fixture asks the scorer to treat a
policy/schema error as a correct semantic decision.

Native values are intentionally typed as objects, not as valid-call schemas:
malformed native envelopes are deliberate negative tests. They may have extra
or missing keys, a null call, malformed arguments, or invalid values. Do not
discard, repair, normalize, trim, coerce, or fill defaults into these objects.
ASCII JSON escapes preserve exact Unicode, including lone-surrogate negatives.

For each `[lane, outer]` in `Object.entries(case.native)`, evaluate the supplied
outer object unchanged with the corresponding runtime and separately supply
`case.context`. The metadata lane must not repair a missing `outer.lane`.
`context: null` means absent evidence. An omitted native lane is not applicable;
do not invent another input or count a fabricated skipped/successful execution.

Compare mapping status and reason exactly with the shared `expected.mapping`.
For an accepted mapping, deep-compare all seven checked projection fields, then
authorize with separately supplied context principal and trusted `case.policy`.
Compare that decision with `expected.decision`. For a nonaccepted mapping,
projection is absent and authorization is not evaluated. Do not conflate a
mapping's own authority `not_evaluated` with the separately expected policy
decision. Candidate results may contain additional description/evidence fields;
this corpus specifies only the mapping status/reason, checked projection, and
separate decision. Full description digests are not cross-lane semantic IDs.

Malformed case records, invalid policy/configuration, integrity failures, and
candidate/harness exceptions are evaluation failures, not correct `deny`,
`review`, or `not_evaluated` labels. Report them separately from behavior
mismatches. Read retained expected literals during scoring; never derive or
rewrite labels from candidate results.
