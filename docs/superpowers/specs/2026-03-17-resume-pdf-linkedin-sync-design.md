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

### Data reconciliation required before implementation

The following discrepancies exist between `nicholas.yaml` and the hand-maintained `latex/` files. These must be resolved in `nicholas.yaml` **before** building the template, so that YAML is the true source of truth and the generated `.tex` matches the intended resume:

| Field | `nicholas.yaml` | `latex/` | Resolution |
|-------|-----------------|----------|------------|
| Role title (header) | `Staff Data Scientist` | `Sr. AI Engineer / Lead Data Scientist` | Update YAML: add `resume_title` field or update `role` |
| Intact role in experience | `Staff Data Scientist` | `Senior AI/ML Engineer` | Update YAML `role` to match intended resume |
| Phone format | `(201) 708-5900` | `(+1) (201) 708 - 5900` | Add `phone_formatted` to YAML or use template filter |
| Ventures URL | `https://zealot.online` | N/A | Update to `https://zealotanalytics.com` (per user) |

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
python generate.py                              # LLM artifacts only (existing default, unchanged)
python generate.py --only resume                # generate resume.tex + resume.pdf
python generate.py --only linkedin-about        # generate LinkedIn-specific About via LLM
python generate.py --only linkedin-sync         # sync profile to LinkedIn via Playwright
python generate.py --only resume,linkedin-sync  # multiple targets
python generate.py --all                        # everything: LLM artifacts + resume + linkedin-sync
python generate.py --dry-run --only linkedin-sync  # show what would change without touching browser
python generate.py --check-selectors            # validate LinkedIn DOM selectors without modifying anything
```

**Default behavior preserved:** `python generate.py` (no args) continues to run only `llm`-type artifacts, keeping CI compatibility. Note: `linkedin-about` replaces the existing `linkedin-draft` as a default LLM artifact — this is a rename, not a new cost. The `--all` flag is an explicit opt-in that runs all artifact types (llm + template + action). `--all` and `--only` are mutually exclusive; passing both is an error.

**Artifact types in the registry:**

| Name | Type | Runs by default? | Description |
|------|------|-------------------|-------------|
| `site-content` | `llm` | yes | Website about prose |
| `bio-short` | `llm` | yes | 1-2 sentence bio |
| `bio-long` | `llm` | yes | Full paragraph bio |
| `linkedin-about` | `llm` | yes | LinkedIn-specific About section |
| `resume` | `template` | no (--all or --only) | Jinja2 → LaTeX → PDF |
| `linkedin-sync` | `action` | no (--all or --only) | Playwright browser sync |

The existing `ARTIFACTS` dict is replaced by a registry that tracks artifact type alongside the generator function:

```python
ARTIFACTS = {
    # LLM artifacts (default targets)
    "site-content":   {"type": "llm",      "fn": generate_site_content},
    "bio-short":      {"type": "llm",      "fn": generate_bio_short},
    "bio-long":       {"type": "llm",      "fn": generate_bio_long},
    "linkedin-about": {"type": "llm",      "fn": generate_linkedin_about},
    # Template artifacts (--all or --only)
    "resume":         {"type": "template", "fn": run_resume_build},
    # Action artifacts (--all or --only)
    "linkedin-sync":  {"type": "action",   "fn": run_linkedin_sync},
}
```

**Calling convention and main() loop refactor:**

The existing `generate.py` artifact functions use signature `(nicholas, voice, positioning, call_llm) -> (path, content)` where `content` is written to disk by the `main()` loop. The new artifacts don't fit this pattern — `resume` writes its own files (`.tex` + `.pdf`), and `linkedin-sync` performs browser side effects.

The registry refactor introduces a `type` field that the `main()` loop uses to dispatch differently:

- **`llm` type:** Called with `(nicholas, voice, positioning, call_llm)` → returns `(path, content)` → `main()` writes `content` to `path`. *No signature change to existing functions.*
- **`template` type:** Called with `(nicholas, dry_run)` → handles its own I/O → returns `(path, status_message)` → `main()` prints status only.
- **`action` type:** Called with `(nicholas, dry_run)` → handles its own I/O → returns `(path, status_message)` → `main()` prints status only.

The `main()` loop becomes:

```python
for name, entry in targets.items():
    try:
        if entry["type"] == "llm":
            path, content = entry["fn"](nicholas, voice, positioning, call_llm)
            with open(ROOT / path, "w") as f:
                f.write(content)
        else:
            path, status = entry["fn"](nicholas, args.dry_run)
        print(f"  → {path}")
    except Exception as e:
        ...
```

This preserves the existing LLM artifact signatures unchanged while cleanly supporting the new artifact types.

**Dependency chain:** `linkedin-sync` depends on `outputs/linkedin-about.md` existing. If the file is missing or empty when `--only linkedin-sync` is run, the script errors with a message: "Run `python generate.py --only linkedin-about` first, or use `--all`."

**Migration:** The existing `linkedin-draft` artifact is renamed to `linkedin-about`. The old `outputs/linkedin-draft.md` file is deleted. If `--only linkedin-draft` is passed, the script prints a deprecation notice pointing to `linkedin-about`.

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

A Jinja2 filter `latex_escape` handles special characters in YAML **data values** interpolated into the template. It does NOT apply to template content (LaTeX commands):

```python
LATEX_SPECIAL = {
    '&': r'\&', '%': r'\%', '$': r'\$', '#': r'\#',
    '~': r'\textasciitilde{}',
    '^': r'\textasciicircum{}',
}
# Note: '_', '{', '}' are NOT escaped — they appear in LaTeX commands
# and technology names (e.g., Scikit-Learn) don't contain them problematically.
# If a YAML value contains these, handle case-by-case.
```

### Phone formatting

The template applies a formatting filter to normalize the phone from YAML (`(201) 708-5900`) to the resume format (`(+1) (201) 708 - 5900`). This is a Jinja2 filter, not a YAML change — keeps the YAML format clean for other consumers.

### Page breaks

Configurable via a `page_break_after` list in the template context — the template inserts `\pagebreak` after a specified company's last project. Default: after ClearOne Advantage (matching current resume).

**Limitation:** This is a manual setting. If experience entries are added or reordered, the page break position may need adjustment. This is acceptable — resume layout is inherently a manual concern.

### `scripts/resume_builder.py`

```python
def build_resume(nicholas: dict, dry_run: bool = False) -> tuple[str, str]:
    """Generate resume.tex and compile to PDF.

    Returns (output_path, status_message).
    """
    # 1. Load Jinja2 template with custom delimiters
    # 2. Render template with nicholas data + latex_escape filter
    # 3. Write outputs/resume.tex
    # 4. If dry_run, return here
    # 5. Copy TLCresume.sty to outputs/
    # 6. Run pdflatex (twice for references) in outputs/
    # 7. Clean up aux/log/out files
    # 8. Return path to PDF


def run_resume_build(nicholas, dry_run=False):
    """Entry point matching the template-type calling convention."""
    return build_resume(nicholas, dry_run=dry_run)
```

### Outputs

- `outputs/resume.tex` — generated, **checked into git** (diffable)
- `outputs/resume.pdf` — generated, **gitignored**
- `outputs/TLCresume.sty` — copied from `latex/`, gitignored (build artifact)
- `outputs/*.aux`, `outputs/*.log`, `outputs/*.out` — cleaned up after build

### Dependencies

- `basictex` — `brew install basictex` (provides `pdflatex`)
- `jinja2` (already installed locally; **must be added to `requirements.txt`**)
- `pyyaml` (already in `requirements.txt`)

## Section 2: LinkedIn About Generation

The existing `linkedin-draft` artifact is **renamed** to `linkedin-about` in the `ARTIFACTS` registry.

- **Distinct from website about:** Tuned for LinkedIn's professional audience. More direct, career-narrative focused, mentions Zealot Analytics explicitly.
- **System prompt:** Uses `voice.md` + `positioning.md` with instruction: "Write for LinkedIn. First person. 3-4 short paragraphs. Professional but not corporate. No hashtags, no emoji, no markdown. Mention the consulting practice (Zealot Analytics) naturally."
- **Output:** `outputs/linkedin-about.md` (replaces `outputs/linkedin-draft.md`)
- **Migration:** Delete `outputs/linkedin-draft.md`. Add deprecation alias so `--only linkedin-draft` prints a notice and runs `linkedin-about`.

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


def run_linkedin_sync(nicholas, dry_run=False):
    """Entry point matching the action-type calling convention."""
    syncer = LinkedInSync(nicholas, dry_run=dry_run)
    syncer.sync_all()
    return ".playwright-state/", "LinkedIn profile synced"
```

### Pre-sync backup

Before modifying any section, the sync logs the current LinkedIn value to `.playwright-state/linkedin-backup.json`. This provides a record of what was overwritten, enabling manual rollback if needed.

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

LinkedIn's DOM changes frequently. The `SELECTORS` dict isolates all selectors in one place. When LinkedIn changes markup, updating selectors is the only change needed. The `--check-selectors` flag (available via `python generate.py --check-selectors`) validates all selectors are findable without modifying anything.

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
generate.py                     # add resume, linkedin-about, linkedin-sync to registry; refactor registry to typed dict
nicholas.yaml                   # update ventures[0].url to https://zealotanalytics.com; reconcile role titles
requirements.txt                # add jinja2, playwright
.gitignore                      # create: .playwright-state/, outputs/resume.pdf, outputs/*.aux, etc.
```

### Generated outputs

```
outputs/resume.tex              # checked into git (diffable)
outputs/resume.pdf              # gitignored
outputs/linkedin-about.md       # checked into git (replaces linkedin-draft.md)
.playwright-state/              # gitignored (session cookies + backup)
```

### Deleted

```
outputs/linkedin-draft.md       # replaced by outputs/linkedin-about.md
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
jinja2        # LaTeX template rendering
playwright    # LinkedIn sync
```

(`pyyaml` already present)

### System

```bash
brew install basictex            # ~300MB, provides pdflatex
playwright install chromium      # headless browser for LinkedIn
```

## Error Handling

- Resume build: if `pdflatex` is not installed, print install instructions and exit 1
- Resume build: if `pdflatex` fails, preserve the `.log` file and print the relevant error lines
- LinkedIn sync: if `outputs/linkedin-about.md` is missing, error with instructions to generate it first
- LinkedIn sync: if session expired, prompt for re-login (open visible browser)
- LinkedIn sync: if a selector is not found, stop and report which selector broke
- Each artifact in `generate.py` is independently try/excepted — one failure doesn't block others
- CI compatibility: default `python generate.py` does not trigger resume or linkedin-sync, so CI never needs `pdflatex` or Playwright

## Out of Scope

- LLM-generated resume content (objective statement is templated, not LLM-generated)
- LinkedIn post automation
- Automatic scheduled syncs
- Multiple resume variants/tailoring
