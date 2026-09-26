# Nicholas C. Park

The public website and private professional artifacts have separate sources.
Public content lives in `site/profile.json`. The complete profile, resume, and
writing drafts are excluded from this public repository.

## Sources and rendering

| Path | Purpose | Published? |
|------|---------|------------|
| `site/profile.json` | Manually curated website content | Yes |
| `site/js/render.js`, `site/css/`, `index.html` | Website rendering and design | Yes |
| `nicholas.yaml` | Private resume and professional profile source | No |
| `identity/positioning.md` | Optional private writing strategy | No |
| `outputs/` | Generated resume, bios, and writing drafts | No |
| `templates/resume.tex.j2`, `latex/TLCresume.sty` | Reusable resume presentation | Yes |
| `scripts/resume_builder.py` | Resume build procedure | Yes |
| `generate.py` | Explicit local artifact generation | Yes |

There is no automatic synchronization from the private profile to the public
website. `generate.py --only site-content` produces an ignored local draft, not
live website content. Review any text before manually copying it into the public
JSON. Historical architecture notes describing automatic publication are obsolete;
this workflow is the current source of truth.

## Website updates

1. Edit `site/profile.json` for public wording, links, interests, and projects.
2. Preview the website locally and check desktop and mobile layouts.
3. Run `python3 scripts/check_public_data.py`, inspect the staged diff, then commit.

Keep content in the public JSON and presentation behavior in code. The JSON uses
an explicit field allowlist; it does not contain employment history, work dates,
resume sections, phone numbers, or private positioning notes. CI checks the tracked
file boundary, public JSON structure, copied profile notes, and phone examples
without generating or publishing content. Use fictional organizations and phone
examples in the reserved 555-0100–0199 range in code, tests, and documentation.
The old post-commit generation hook is disabled.

`.gitignore` prevents ordinary additions but does not remove previously tracked
files or erase Git history. Private files must also be untracked. Removing an
accidentally published file requires a separate history and hosting cleanup.

## Local resume updates

Restore your private `nicholas.yaml` into a fresh checkout from a separate private
repository or local backup. An ignored symlink to that private checkout also works,
so edits update one canonical source. Commit and push profile changes from the
private repository; public renderer commits do not back up the profile.
Optional personal writing strategy can be restored to ignored
`identity/positioning.md` from a private backup. Generation also works without it.
It is intentionally absent from the public repository. Install Python
dependencies with `pip install -r requirements.txt`; PDF generation also needs
`pdflatex` and the fonts/packages referenced by the LaTeX style.

Edit `nicholas.yaml` for resume wording, dates, project order, and skill categories.
The keys in `skills` are the displayed category labels, in display order. Work
project highlights and research descriptions support selective bold text using
paired `**` markers, for example `"**Evaluation:** Measured error on held-out data."`.
Quote YAML strings that start with `**`. Other Markdown, HTML, and raw LaTeX are
not interpreted in these fields; unmatched `**` markers remain literal.

Generate both LaTeX and PDF with:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 generate.py --only resume
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
```

Do not edit `outputs/resume.tex` directly. Keep all organizations in one continuous
Work Experience section. Set `resume_section_order` in the private YAML to order
sections using the keys `education`, `work`, `skills`, `research`, and `exams`.
Without that key, sections appear in the order listed here. An omitted section
does not render; its data stays in the YAML. For example,
`resume_section_order: [skills, work, education, research]` puts skills first and
hides exams. Add `exams` back to the list to show them again.

Routine content updates should not change the template or builder. Renderer
changes should fix general layout or build defects, without special cases for a
company or a resume revision.

The builder compiles in an isolated directory and replaces the PDF only after two
successful passes. Failed builds preserve the previous PDF and retain diagnostics
in the reported build directory. Before delivering a revision, render every page
with `pdftoppm` and check readability, page transitions, and text extraction against
the YAML. A successful compilation alone does not establish a correct layout.

## Local writing drafts

These commands read the private profile and write ignored files under `outputs/`.
They are never run automatically by Git hooks or CI.

```bash
python3 generate.py --only site-content         # local About-section draft
python3 generate.py --only bio-short,bio-long   # local bio drafts
python3 generate.py --only linkedin-about      # local LinkedIn draft
python3 generate.py --dry-run                  # placeholders, no LLM calls
```

LLM generation uses the Claude Code CLI if installed, then `ANTHROPIC_API_KEY`,
then `OPENAI_API_KEY`. Override selection with `--provider` or `GENERATE_PROVIDER`.
The optional `ANTHROPIC_MODEL` and `OPENAI_MODEL` variables select models. Running
an LLM draft command sends its source text to the selected provider. Resume
rendering does not use an LLM.
