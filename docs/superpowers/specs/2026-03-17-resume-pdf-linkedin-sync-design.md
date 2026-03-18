# Design: Resume PDF Generation & LinkedIn Profile Sync

**Date:** 2026-03-17
**Status:** Draft
**Scope:** `generate.py` extension, `scripts/resume_builder.py`, `scripts/linkedin_sync.py`, `templates/resume.tex.j2`

## Problem

`nicholas.yaml` is the single source of truth, but the resume exists as hand-maintained LaTeX files in `latex/` (not generated from YAML), and LinkedIn profile updates are manual. This creates drift between the canonical data and its downstream representations.

## Solution

Extend the existing `generate.py` with two new capabilities:
1. **Resume PDF pipeline:** `nicholas.yaml` → Jinja2 LaTeX template → single `outputs/resume.tex` → `pdflatex` → `outputs/resume.pdf`
2. **LinkedIn profile sync:** `nicholas.yaml` → Playwright automation → updates all LinkedIn profile sections with persistent session

## Constraints

- The generated `.tex` must produce output **identical** to the current `latex/` hand-maintained resume (same TLCresume template, same formatting, same spacing)
- The existing `generate.py` uses `--only` flag pattern (not subcommands) — new capabilities must extend this pattern
- LinkedIn About section is **distinct** from the website about — generated separately with LinkedIn-specific tone
- `nicholas.yaml` is read-only from the pipeline's perspective
- Zealot Analytics URL is `zealotanalytics.com`

## Architecture

```
nicholas.yaml ─────────────────┐
identity/voice.md ──────────── │
identity/positioning.md ───────┘
        │
        ├──→ generate.py --only resume
        │       └──→ scripts/resume_builder.py
        │               ├──→ templates/resume.tex.j2 (Jinja2)
        │               ├──→ outputs/resume.tex
        │               └──→ pdflatex → outputs/resume.pdf
        │
        ├──→ generate.py --only linkedin-about
        │       └──→ LLM generates LinkedIn-specific About
        │           └──→ outputs/linkedin-about.md
        │
        └──→ generate.py --only linkedin-sync
                └──→ scripts/linkedin_sync.py
                        ├──→ reads nicholas.yaml + outputs/linkedin-about.md
                        ├──→ Playwright (chromium, persistent session)
                        └──→ updates: About, Headline, Experience, Education, Skills, Certifications
```

## CLI Interface

Extends existing `generate.py --only` pattern:

```bash
python generate.py                              # all LLM artifacts (existing behavior)
python generate.py --only resume                # generate resume.tex + resume.pdf
python generate.py --only linkedin-about        # generate LinkedIn-specific About via LLM
python generate.py --only linkedin-sync         # sync profile to LinkedIn via Playwright
python generate.py --only resume,linkedin-sync  # both
python generate.py --all                        # everything: LLM artifacts + resume + linkedin-sync
python generate.py --dry-run --only linkedin-sync  # show what would change without touching browser
```

**Default behavior change:** `python generate.py` (no args) runs `--all`, which includes the existing LLM artifacts plus resume and linkedin-sync. The `--only` flag selects specific targets as before.

**New artifacts added to the registry:**

| Name | Type | Description |
|------|------|-------------|
| `resume` | template (no LLM) | Jinja2 → LaTeX → PDF |
| `linkedin-about` | LLM | LinkedIn-specific About section |
| `linkedin-sync` | automation | Playwright browser sync |

## Section 1: Resume Pipeline

### Data flow

`nicholas.yaml` → `scripts/resume_builder.py` → loads `templates/resume.tex.j2` → renders `outputs/resume.tex` → copies `TLCresume.sty` to `outputs/` → runs `pdflatex` → produces `outputs/resume.pdf`

### Jinja2 Template: `templates/resume.tex.j2`

Uses custom delimiters to avoid LaTeX conflicts:

```python
jinja_env = jinja2.Environment(
    block_start_string=r'\BLOCK{',
    block_end_string='}',
    variable_start_string=r'\VAR{',
    variable_end_string='}',
    comment_start_string=r'\#{',
    comment_end_string='}',
    loader=jinja2.FileSystemLoader('templates'),
)
```

The template is a single self-contained `.tex` file (no `\input` statements) that reproduces the exact structure of the current `latex/resume.tex` + all `latex/sections/*.tex` inlined. It uses:

- `TLCresume.sty` for styling (unchanged)
- `fancyhdr` header with `\def\name`, `\def\phone`, etc. from YAML
- `\subsection` with `\hfill` date alignment for experience
- `\subtext` for project titles with technologies
- `zitemize` environments for bullet points
- `\skills{}` command in the tabular skills section
- All `\vspace` tweaks matching the current hand-written files

### LaTeX escaping

A Jinja2 filter `latex_escape` handles special characters in YAML content:

```python
LATEX_SPECIAL = {
    '&': r'\&', '%': r'\%', '$': r'\$', '#': r'\#',
    '_': r'\_', '{': r'\{', '}': r'\}', '~': r'\textasciitilde{}',
    '^': r'\textasciicircum{}',
}
```

Applied to all YAML string values before template rendering.

### Page breaks

Configurable via a `page_break_after` field — the template inserts `\pagebreak` after a specified company's projects. Default: after ClearOne Advantage (matching current resume).

### `scripts/resume_builder.py`

```python
def build_resume(nicholas: dict, dry_run: bool = False) -> tuple[str, str]:
    """Generate resume.tex and compile to PDF.

    Returns (output_path, status_message).
    """
    # 1. Load Jinja2 template with custom delimiters
    # 2. Render template with nicholas data
    # 3. Write outputs/resume.tex
    # 4. Copy TLCresume.sty to outputs/
    # 5. Run pdflatex (twice for references) in outputs/
    # 6. Clean up aux files
    # 7. Return path to PDF
```

### Outputs

- `outputs/resume.tex` — generated, **checked into git** (diffable)
- `outputs/resume.pdf` — generated, **gitignored**
- `outputs/TLCresume.sty` — copied from `latex/`, gitignored (build artifact)
- `outputs/*.aux`, `outputs/*.log`, `outputs/*.out` — cleaned up after build

### Dependencies

- `basictex` — `brew install basictex` (provides `pdflatex`)
- `jinja2` (already installed)
- `pyyaml` (already installed)

## Section 2: LinkedIn About Generation

A new LLM artifact `linkedin-about` added to the existing `ARTIFACTS` registry in `generate.py`.

- **Distinct from website about:** Tuned for LinkedIn's professional audience. More direct, career-narrative focused, mentions Zealot Analytics explicitly.
- **System prompt:** Uses `voice.md` + `positioning.md` with instruction: "Write for LinkedIn. First person. 3-4 short paragraphs. Professional but not corporate. No hashtags, no emoji, no markdown. Mention the consulting practice (Zealot Analytics) naturally."
- **Output:** `outputs/linkedin-about.md` (replaces existing `outputs/linkedin-draft.md`)

## Section 3: LinkedIn Sync Pipeline

### Data flow

`nicholas.yaml` + `outputs/linkedin-about.md` → `scripts/linkedin_sync.py` → Playwright chromium → LinkedIn profile

### Profile sections synced

| LinkedIn Section | Source |
|-----------------|--------|
| About/Summary | `outputs/linkedin-about.md` |
| Headline | `experience[0].role` + venture (e.g. "Staff Data Scientist @ Intact \| Founder, Zealot Analytics") |
| Experience | `experience[]` — company, role, dates, project descriptions (flattened highlights) |
| Education | `education[]` — institution, degree, dates, GPA |
| Skills | `skills.*` (flattened across categories) |
| Certifications | `certifications[]` + `actuarial_exams[]` |

### Session persistence

- Playwright browser state saved to `.playwright-state/linkedin-session.json`
- `.playwright-state/` is gitignored
- On first run or expired session: opens visible browser for manual login, waits for user to complete login, then saves cookies
- Subsequent runs reuse the saved session in headless mode
- If session is expired (detected by redirect to login page), falls back to visible browser for re-authentication

### `scripts/linkedin_sync.py`

```python
class LinkedInSync:
    SELECTORS = {
        # All LinkedIn DOM selectors isolated here for easy maintenance
        'about_edit_button': '...',
        'about_textarea': '...',
        'headline_edit': '...',
        # ...
    }

    def __init__(self, nicholas: dict, dry_run: bool = False):
        self.data = nicholas
        self.dry_run = dry_run
        self.state_dir = ROOT / '.playwright-state'

    def ensure_session(self) -> Browser:
        """Load or create authenticated session."""

    def sync_about(self):
        """Update About section from outputs/linkedin-about.md."""

    def sync_headline(self):
        """Update headline from experience + ventures."""

    def sync_experience(self):
        """Update experience entries from nicholas.yaml."""

    def sync_education(self):
        """Update education entries from nicholas.yaml."""

    def sync_skills(self):
        """Update skills from nicholas.yaml."""

    def sync_certifications(self):
        """Update certifications from nicholas.yaml."""

    def sync_all(self):
        """Run all sync methods in order."""
```

### Dry-run behavior

With `--dry-run`, for each section:
1. Navigates to the profile section
2. Reads the current value
3. Prints a diff (current vs. proposed) to stdout
4. Does NOT modify anything

### Safety

- Before each section update, logs current value vs. proposed value
- If a selector fails (LinkedIn DOM change), stops with a clear error identifying which selector broke
- No destructive operations — only edits existing fields, never deletes entries
- Experience/education sync only updates entries that match by company/institution name — does not create or delete entries (this can be relaxed later)

### Fragility acknowledgment

LinkedIn's DOM changes frequently. The `SELECTORS` dict isolates all selectors in one place. When LinkedIn changes markup, updating selectors is the only change needed. The script includes a `--check-selectors` flag that validates all selectors are findable without modifying anything.

## Section 4: File Layout

### New files

```
scripts/__init__.py              # package marker
scripts/resume_builder.py       # YAML → LaTeX → PDF logic
scripts/linkedin_sync.py        # Playwright LinkedIn automation
templates/resume.tex.j2         # Jinja2 LaTeX template (single file)
```

### Modified files

```
generate.py                     # add resume, linkedin-about, linkedin-sync to registry
nicholas.yaml                   # update ventures[0].url to zealotanalytics.com
.gitignore                      # create: .playwright-state/, outputs/resume.pdf, outputs/*.aux, etc.
```

### Generated outputs

```
outputs/resume.tex              # checked into git (diffable)
outputs/resume.pdf              # gitignored
outputs/linkedin-about.md       # checked into git (replaces linkedin-draft.md)
.playwright-state/              # gitignored (session cookies)
```

### Untouched

```
latex/                          # historical reference, not consumed by pipeline
identity/                       # read-only inputs
site/                           # website rendering layer
```

## Dependencies

### Python (add to requirements.txt)

```
playwright    # LinkedIn sync
```

(`jinja2` and `pyyaml` already present)

### System

```bash
brew install basictex            # ~300MB, provides pdflatex
playwright install chromium      # headless browser for LinkedIn
```

## Error Handling

- Resume build: if `pdflatex` is not installed, print install instructions and exit 1
- Resume build: if `pdflatex` fails, preserve the `.log` file and print the relevant error lines
- LinkedIn sync: if session expired, prompt for re-login (open visible browser)
- LinkedIn sync: if a selector is not found, stop and report which selector broke
- Each artifact in `generate.py` is independently try/excepted — one failure doesn't block others

## Out of Scope

- LLM-generated resume content (objective statement is templated, not LLM-generated)
- LinkedIn post automation
- Automatic scheduled syncs
- Multiple resume variants/tailoring
