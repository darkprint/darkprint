Bring docs/ARCHITECTURE.md back in sync with the code. Do not rewrite what did not change.

1. Read the `Last verified against commit <sha>` line in the document header.
2. Run `git diff <sha>..HEAD --stat` and group changed files by area
   (routes, components, types, fixtures, styles, config).
3. Map each area to the affected sections using the table in CLAUDE.md.
4. Re-derive from the code, independently of the document: the route table, the entity
   list with fields, and the list of mocks and fixtures. Diff each against what the
   document claims, and report the drift before patching anything.
5. Patch only the affected sections. Leave every untouched section byte identical.
6. Recompile every diagram you touched with
   `npx -y @mermaid-js/mermaid-cli -i tmp.mmd -o tmp.svg`.
7. Update the Last verified line to current HEAD and add a revision log row.
8. Report: sections changed, drift found, new TBD lines opened, new SEAM ids created.

Never invent content to fill a gap. An open question written down beats a plausible sentence.
