# Working Paper

**Action-Effect: An Empirical Protocol for Interchanging Effect Descriptions
Without Conflating Evidence and Permission**

Ond Holdings Inc., Toronto, Ontario, Canada.

- [Extended manuscript](manuscript.md): motivation, related standards,
  semantics, evaluation and bounded measured results.
- [Standalone LaTeX](manuscript.tex): full manuscript with embedded references,
  algorithms, diagrams, case analyses and appendices; no external figure,
  BibTeX or shell-escape dependency.
- [PDF](manuscript.pdf): 39-page full manuscript with eight figures. The earlier nine-page edition
  remains unchanged in the v0.2.0-draft.1 release.
- [Source register](sources.json): retrieved official sources, immutable pins
  where available, and measured project artifacts.
- [Measurement contract](measurement-contract.md): evidence requirements,
  implemented reporting fields and explicitly unmeasured areas.
- [Results and replay](../reports/runtime-pilot-summary.md): the executable
  evidence, including preserved failures and current-content limitations.
- [Real maintainer use](../reports/field-study-summary.md): separate deployed-model
  and official GitHub MCP observations, output-quality review and post-review
  follow-up. These are not new customer deployments or independent labels.
- [Release verification](../reports/release-verification-v0.3.0.md): regression,
  artifact integrity and page-by-page PDF checks.

This is a public methods/pilot working paper accompanying an experimental
protocol, not a standards-body document or a completed external validation
study. It has not been submitted to a journal or conference by this release.
Formal submission and any individual-author byline remain separate decisions.

The full edition does not replace the original runtime results with the field
study. Scripted mutation checks, autonomous read-only maintenance, packaging
checks and internal source review have different denominators and guarantees.
The first real-use run, its output-contract conflict and factual error remain
inspectable. Passing a request's semantic or byte checks does not establish
that the report inside that request is factually correct.

The scope is independent of the Studio application and does not publish
protected joint-research cases. No external collaborator is assigned authorship
or endorsement. Reviewers can contribute counterexamples, independent
implementations or an independently authored evaluation cohort through the
[adoption materials](../docs/adoption/external-evaluation.md).

To rebuild with TeX Live:

```sh
latexmk -norc -pdf -interaction=nonstopmode -halt-on-error manuscript.tex
```

The original material follows the repository's MIT license; third-party
standards and sources retain their own rights. A protocol draft is not itself
a standards patent covenant or a compliance certification.
