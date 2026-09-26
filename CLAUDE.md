# Public website and private resume boundary

Read `README.md` for the current workflow.

## Public website

- `site/profile.json` is the only public content source.
- `site/js/`, `site/css/`, and `index.html` render the website.
- Edit public content deliberately. Do not copy full profile data into public files.
- Run `python3 scripts/check_public_data.py` before committing.
- Treat all tracked files as public, including docs, test fixtures, comments, and examples.

## Private local inputs and outputs

- Keep `nicholas.yaml` in the separate private repository. An ignored local symlink is allowed.
- Keep optional personal strategy in ignored `identity/positioning.md`.
- Generated resumes, bios, and writing drafts belong in ignored `outputs/`.
- Do not commit copies of private YAML in Markdown, design notes, or tests.
- Use fictional organizations and phone examples in the reserved 555-0100–0199 range.
- Reusable templates, schemas, renderer code, and the generic voice guide can be public.

`generate.py` runs explicitly for local artifacts. It never updates public website data.
The old automatic generation workflow and post-commit hook are disabled.
Historical architecture notes are not instructions to restore private publication.
