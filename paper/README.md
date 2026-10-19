# Working Paper

**Action-Effect: An Empirical Protocol for Interchanging Effect Descriptions
Without Conflating Evidence and Permission**

Ond Holdings Inc., Toronto, Ontario, Canada.

- [Extended manuscript](manuscript.md): motivation, related standards,
  semantics, evaluation and bounded measured results.
- [Standalone LaTeX](manuscript.tex): condensed paper with embedded references
  and diagram; no external figure, BibTeX or shell-escape dependency.
- [PDF](manuscript.pdf): rendered condensed edition of the same working draft.
- [Source register](sources.json): retrieved official sources, immutable pins
  where available, and measured project artifacts.
- [Measurement contract](measurement-contract.md): evidence requirements,
  implemented reporting fields and explicitly unmeasured areas.
- [Results and replay](../reports/runtime-pilot-summary.md): the executable
  evidence, including preserved failures and current-content limitations.

This is a public methods/pilot working paper accompanying an experimental
protocol, not a standards-body document or a completed external validation
study. It has not been submitted to a journal or conference by this release.
Formal submission and any individual-author byline remain separate decisions.

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
