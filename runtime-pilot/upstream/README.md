# Upstream Interface Provenance

`github-comment-openapi.json` contains the exact comment POST operation and
referenced component definitions from a pinned revision of GitHub's own OpenAPI
repository. Its MIT notice is retained in `github-LICENSE.md`. Re-extract using
`node runtime-pilot/upstream/import-github.mjs` only when intentionally updating
the dataset; normal test/replay runs do not access the network.

This is externally authored **interface data**, not independently annotated
authorization outcomes. It constrains parameter and response compatibility; it
cannot establish completeness of effects or that our governance labels are
correct. The pilot's case labels remain exposed same-project development data.
