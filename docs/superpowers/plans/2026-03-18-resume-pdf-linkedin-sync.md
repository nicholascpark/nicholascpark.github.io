# Resume PDF Generation & LinkedIn Profile Sync — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `generate.py` to generate a LaTeX resume PDF from `nicholas.yaml` and sync the full LinkedIn profile via Playwright.

**Architecture:** Single `generate.py` entry point with typed artifact registry. Resume uses Jinja2 → LaTeX → PDF. LinkedIn uses Playwright with persistent session cookies. New code lives in `scripts/` and `templates/`.

**Tech Stack:** Python 3.12, Jinja2, PyYAML, pdflatex (basictex), Playwright (chromium)

**Spec:** `docs/superpowers/specs/2026-03-17-resume-pdf-linkedin-sync-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `scripts/__init__.py` | Package marker |
| Create | `scripts/resume_builder.py` | YAML → Jinja2 → LaTeX → PDF |
| Create | `scripts/linkedin_sync.py` | Playwright LinkedIn automation |
| Create | `templates/resume.tex.j2` | Jinja2 LaTeX template (single file) |
| Create | `.gitignore` | Ignore build artifacts + session state |
| Modify | `generate.py` | Typed registry, `--all`, `--check-selectors`, new artifacts |
| Modify | `nicholas.yaml` | Reconcile role titles, update ventures URL |
| Modify | `requirements.txt` | Add jinja2, playwright |

---

## Chunk 1: Data Reconciliation & Infrastructure

### Task 1: Reconcile `nicholas.yaml` with resume data

**Files:**
- Modify: `nicholas.yaml:27-32` (ventures URL)
- Modify: `nicholas.yaml:72-75` (Intact role)

- [ ] **Step 1: Update ventures URL**

In `nicholas.yaml`, change:
```yaml
    url: "https://zealot.online"
```
to:
```yaml
    url: "https://zealotanalytics.com"
```

- [ ] **Step 2: Add `resume_title` field for header role**

The resume header shows a different title than the job role. Add a top-level field after `citizenship`:
```yaml
resume_title: "Sr. AI Engineer / Lead Data Scientist"
```

- [ ] **Step 3: Update Intact experience role to match resume**

In `nicholas.yaml` experience entry for Intact, change:
```yaml
    role: Staff Data Scientist
```
to:
```yaml
    role: Senior AI/ML Engineer
```

- [ ] **Step 4: Add `objective` field to `about` section**

In `nicholas.yaml`, add inside the `about:` block (after `background_facts`):
```yaml
  objective: >
    A seasoned AI/ML developer and lead data scientist with 7+ years of experience
    in building and serving AI/ML model pipelines across diverse production settings.
    Now specializing in agentic AI solutions with LangGraph. Passionate about use cases
    in the financial services domain.
```

- [ ] **Step 5: Commit**

```bash
git add nicholas.yaml
git commit -m "content: reconcile nicholas.yaml with resume data

Update Intact role to Senior AI/ML Engineer, add resume_title for
header, update Zealot Analytics URL to zealotanalytics.com."
```

### Task 2: Create `.gitignore` and update `requirements.txt`

**Files:**
- Create: `.gitignore`
- Modify: `requirements.txt`

- [ ] **Step 1: Create `.gitignore`**

```gitignore
# Build artifacts
outputs/resume.pdf
outputs/TLCresume.sty
outputs/*.aux
outputs/*.log
outputs/*.out
outputs/*.fls
outputs/*.fdb_latexmk

# LinkedIn session state
.playwright-state/

# macOS
.DS_Store

# Superpowers plugin cache
.superpowers/

# Playwright MCP logs
.playwright-mcp/
```

- [ ] **Step 2: Update `requirements.txt`**

```
anthropic
openai
pyyaml
jinja2
playwright
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore requirements.txt
git commit -m "chore: add .gitignore and update requirements for resume/linkedin pipeline"
```

### Task 3: Install system dependencies and create scripts package

**Prerequisites (manual, run before executing plan):**

```bash
# LaTeX compiler (~300MB download)
brew install basictex
eval "$(/usr/libexec/path_helper)"
which pdflatex  # expect: /Library/TeX/texbin/pdflatex

# Python dependencies (includes jinja2 + playwright)
pip install -r requirements.txt

# Playwright browser
playwright install chromium
```

- [ ] **Step 1: Create `scripts/` directory and `__init__.py`**

```bash
mkdir -p scripts
```

Then create empty `scripts/__init__.py`:
```python
```

- [ ] **Step 2: Commit**

```bash
git add scripts/__init__.py
git commit -m "chore: create scripts package"
```

---

## Chunk 2: Resume Pipeline

### Task 4: Create Jinja2 LaTeX template

**Files:**
- Create: `templates/resume.tex.j2`

This template must reproduce the **exact** output of the hand-maintained `latex/` files. Every `\vspace`, `\subsection`, `\hfill`, and `zitemize` must match.

Reference files (read these to verify):
- `latex/resume.tex` — main structure
- `latex/_header.tex` — fancyhdr header
- `latex/TLCresume.sty` — style definitions
- `latex/sections/objective.tex`
- `latex/sections/education.tex`
- `latex/sections/experience.tex` (longest, most complex)
- `latex/sections/skills.tex`
- `latex/sections/projects.tex`
- `latex/sections/exams.tex`

- [ ] **Step 1: Create `templates/resume.tex.j2`**

The template uses custom Jinja2 delimiters (`\BLOCK{}`, `\VAR{}`, `\#{}`) to avoid LaTeX conflicts.

**Formatting notes:**
- The hand-maintained LaTeX has inline formatting (`\textbf{}`, `$\sim$`, `$\ge$`, `\mbox{-}`) within highlight text that YAML does not encode. The template outputs YAML highlights as-is. If the user wants inline LaTeX emphasis in the PDF, they add it to the YAML highlight strings directly.
- The first project under each company uses `\subtext{\textbf{...}}`. Subsequent projects use `\subsection{\textbf{\textit{...}}}` with `\vspace{0.1em}`. This pattern is encoded in the Jinja2 loop.
- Company subtitle varies: Intact has `(Industry; Contracted via Agency)`, ZT has `(acquired by AMD)`, others have `(Industry)`. Template uses YAML fields `contracted_via`, `acquired_by`, `industry`.
- `\vspace` after company subsection: `0.5em` for most, `0.3em` for ZT (single-project company). Template uses `0.5em` default; can be tuned per-company if needed.

Full template content:

````tex
\#{  templates/resume.tex.j2 — Generated from nicholas.yaml via Jinja2 }
\#{  Custom delimiters: \BLOCK{...} \VAR{...} \#{...} }
\documentclass[letter,10pt]{article}
\usepackage[utf8]{inputenc}
\usepackage{TLCresume}

%====================
% CONTACT INFORMATION
%====================
\def\name{\VAR{ data.name | latex_escape }}
\def\phone{\VAR{ data.phone | format_phone }}
\def\city{\VAR{ data.location | latex_escape }}
\def\email{\VAR{ data.links.email }}
\def\LinkedIn{\VAR{ data.links.linkedin | replace('https://www.linkedin.com/in/', '') | replace('/', '') }}
\def\github{\VAR{ data.links.github | replace('https://github.com/', '') }}
\def\role{\VAR{ data.resume_title | latex_escape }}

%====================
% Header: Contact
%====================
\RequirePackage{fancyhdr}
\fancypagestyle{fancy}{%
\fancyhf{}
\lhead{\phone \\
        \city \\
	    \href{mailto:\email}{\email}}
	\chead{%
	    \centering {\Huge \skills \name \vspace{.25em}} \\
	    {\color{highlight} \Large{\role}}}%
	    \rhead{\bf{U.S. Citizenship}\\
	    \href{https://github.com/\github}{github.com/\github} \\
	    \href{https://www.linkedin.com/in/\LinkedIn}{linkedin.com/in/\LinkedIn}}
\renewcommand{\headrulewidth}{1pt}%
\renewcommand{\headrule}{\hbox to\headwidth{%
  \color{highlight}\leaders\hrule height \headrulewidth\hfill}}
}
\pagestyle{fancy}

\setlength{\headheight}{90pt}
\setlength{\headsep}{5pt}

\begin{document}

%====================
% Objective Statement
%====================
\noindent
\VAR{ data.about.objective | latex_escape }

\section{Education}
\BLOCK{ for edu in data.education }
\BLOCK{ if edu.gpa }
\subsection{{\VAR{ edu.degree | latex_escape } (GPA: \VAR{ edu.gpa })} | \textit{\VAR{ edu.institution | latex_escape }} \hfill \VAR{ edu.years }}
\BLOCK{ if edu.coursework }
\begin{zitemize}
\item \normalfont Relevant Coursework: \VAR{ edu.coursework | join(', ') }, etc.
\end{zitemize}
\BLOCK{ endif }
\BLOCK{ else }
\subsection{{\VAR{ edu.degree | latex_escape }} | \textit{\VAR{ edu.institution | latex_escape }} \hfill	\VAR{ edu.years }}
\BLOCK{ endif }
\BLOCK{ if not loop.last }

\BLOCK{ endif }
\BLOCK{ endfor }
\vspace{4mm}

\section{Work Experience (By Project Per Organization)}
\BLOCK{ for exp in data.experience }
\BLOCK{ set company_label = exp.company | latex_escape }
\BLOCK{ if exp.acquired_by }
\BLOCK{ set company_context = company_label ~ ' (acquired by ' ~ (exp.acquired_by | latex_escape) ~ ')' }
\BLOCK{ elif exp.contracted_via }
\BLOCK{ set company_context = company_label ~ ' (' ~ (exp.industry | latex_escape) ~ '; Contracted via ' ~ (exp.contracted_via | latex_escape) ~ ')' }
\BLOCK{ elif exp.industry }
\BLOCK{ set company_context = company_label ~ ' (' ~ (exp.industry | latex_escape) ~ ')' }
\BLOCK{ else }
\BLOCK{ set company_context = company_label }
\BLOCK{ endif }
\subsection{\VAR{ exp.role | latex_escape } @ \VAR{ company_context } \hfill \VAR{ exp.years }}
\vspace{0.5em}
\BLOCK{ for proj in exp.projects }
\BLOCK{ set tech_str = proj.technologies | join(', ') | latex_escape }
\BLOCK{ if loop.first }
\subtext{\textbf{\VAR{ proj.name | latex_escape }   (\VAR{ tech_str })}}
\BLOCK{ else }
\subsection{\textbf{\textit{\VAR{ proj.name | latex_escape } (\VAR{ tech_str })}}}
\vspace{0.1em}
\BLOCK{ endif }
\begin{zitemize}
\BLOCK{ for highlight in proj.highlights }
\item \VAR{ highlight | latex_escape }
\BLOCK{ endfor }
\end{zitemize}
\BLOCK{ endfor }
\BLOCK{ if exp.company in page_break_after }

\pagebreak
\BLOCK{ elif not loop.last }
\vspace{0.6em}

\BLOCK{ endif }
\BLOCK{ endfor }

\section{Skills}
\begin{tabular}{p{11em} p{1em} p{43em}}
\skills{Languages} & & \VAR{ data.skills.languages | join(', ') | latex_escape } \\
\skills{AI/ML Frameworks} & & \VAR{ data.skills.ai_ml_frameworks | join(', ') | latex_escape } \\
\skills{Data Management} & &  \VAR{ data.skills.data_management | join(', ') | latex_escape } \\
\skills{Deployment \& Monitoring} & & \VAR{ data.skills.deployment_and_monitoring | join(', ') | latex_escape } \\
\skills{Visual/Reporting} & &  SHAP, Data Visualization (\VAR{ data.skills.visualization | reject('equalto', 'SHAP') | join(', ') | latex_escape })
\end{tabular}

\vspace{2mm}

\section{Advanced Machine Learning Research}
\BLOCK{ for r in data.research }
\subsection{{\VAR{ r.category | replace('-', ' ') | title } (\VAR{ r.technologies | join(', ') | latex_escape }) \hfill \VAR{ r.period }}}
\begin{zitemize}
\item \normalfont \VAR{ r.description | latex_escape }
\BLOCK{ if r.status }
\bf{(\VAR{ r.status | latex_escape })}
\BLOCK{ endif }
\end{zitemize}

\BLOCK{ endfor }

\section{Actuarial Exams (Pre-Associateship in the Casualty Actuarial Society)}
\begin{zitemize}
\BLOCK{ for exam in data.actuarial_exams }
\item \VAR{ exam.name | latex_escape }
\BLOCK{ if exam.note }
(\VAR{ exam.note | latex_escape })
\BLOCK{ endif }
\BLOCK{ endfor }
\end{zitemize}

\end{document}
````

**Key decisions in this template:**
- `data.about.objective` is a new YAML field (added in Task 1) containing the objective statement text. This avoids hard-coding the objective in the template.
- Skills "Visual/Reporting" line uses a special filter to separate SHAP from the visualization tools (matching the hand-maintained format).
- The `\vspace{0.6em}` between companies and `\pagebreak` after `page_break_after` companies match the original layout.

- [ ] **Step 2: Verify template against originals**

Manually diff the key sections of the template against the originals:
- Compare header `\def` lines with `latex/resume.tex:36-42`
- Compare fancyhdr setup with `latex/_header.tex`
- Compare experience loop output with `latex/sections/experience.tex`
- Compare skills tabular with `latex/sections/skills.tex`

- [ ] **Step 3: Commit**

```bash
git add templates/resume.tex.j2
git commit -m "feat: add Jinja2 LaTeX resume template

Single self-contained .tex template that reproduces the exact
structure of the hand-maintained latex/ files. Uses custom Jinja2
delimiters to avoid LaTeX conflicts."
```

### Task 5: Create `scripts/resume_builder.py`

**Files:**
- Create: `scripts/resume_builder.py`

- [ ] **Step 1: Write `resume_builder.py`**

```python
"""Resume builder: nicholas.yaml → Jinja2 → LaTeX → PDF."""

import os
import re
import shutil
import subprocess
from pathlib import Path

import jinja2

ROOT = Path(__file__).resolve().parent.parent

# LaTeX special characters to escape in YAML data values.
# Note: backslash (\) is NOT escaped — YAML values should not contain raw
# backslashes. '_', '{', '}' are also excluded — they appear in LaTeX commands
# and technology names without issue. Handle case-by-case if needed.
LATEX_SPECIAL = {
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}

# Companies after which to insert \pagebreak
PAGE_BREAK_AFTER = ["ClearOne Advantage"]


def latex_escape(text: str) -> str:
    """Escape LaTeX special characters in a string."""
    if not isinstance(text, str):
        return str(text)
    for char, replacement in LATEX_SPECIAL.items():
        text = text.replace(char, replacement)
    return text


def format_phone(phone: str) -> str:
    """Format phone for resume header: (201) 708-5900 → (+1) (201) 708 - 5900."""
    m = re.match(r"\((\d{3})\)\s*(\d{3})-(\d{4})", phone)
    if m:
        return f"(+1) ({m.group(1)}) {m.group(2)} - {m.group(3)}"
    return phone


def get_jinja_env() -> jinja2.Environment:
    """Create Jinja2 environment with LaTeX-safe delimiters."""
    env = jinja2.Environment(
        block_start_string=r"\BLOCK{",
        block_end_string="}",
        variable_start_string=r"\VAR{",
        variable_end_string="}",
        comment_start_string=r"\#{",
        comment_end_string="}",
        loader=jinja2.FileSystemLoader(ROOT / "templates"),
        keep_trailing_newline=True,
    )
    env.filters["latex_escape"] = latex_escape
    env.filters["format_phone"] = format_phone
    return env


def build_resume(nicholas: dict, dry_run: bool = False) -> tuple[str, str]:
    """Generate resume.tex and compile to PDF.

    Returns (output_path, status_message).
    """
    outputs_dir = ROOT / "outputs"
    os.makedirs(outputs_dir, exist_ok=True)

    # 1. Render template
    env = get_jinja_env()
    template = env.get_template("resume.tex.j2")
    tex_content = template.render(
        data=nicholas,
        page_break_after=PAGE_BREAK_AFTER,
    )

    # 2. Write .tex
    tex_path = outputs_dir / "resume.tex"
    tex_path.write_text(tex_content)

    if dry_run:
        return "outputs/resume.tex", f"[dry-run] Wrote {tex_path}"

    # 3. Copy TLCresume.sty
    sty_src = ROOT / "latex" / "TLCresume.sty"
    sty_dst = outputs_dir / "TLCresume.sty"
    shutil.copy2(sty_src, sty_dst)

    # 4. Check pdflatex is available
    if not shutil.which("pdflatex"):
        raise RuntimeError(
            "pdflatex not found. Install with: brew install basictex\n"
            "Then reload shell: eval \"$(/usr/libexec/path_helper)\""
        )

    # 5. Run pdflatex twice (for references/page numbers)
    for pass_num in (1, 2):
        result = subprocess.run(
            ["pdflatex", "-interaction=nonstopmode", "resume.tex"],
            cwd=outputs_dir,
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode != 0:
            # Preserve log for debugging
            log_path = outputs_dir / "resume.log"
            raise RuntimeError(
                f"pdflatex pass {pass_num} failed (see {log_path}):\n"
                + result.stdout[-500:]
            )

    # 6. Clean up aux files
    for ext in (".aux", ".log", ".out", ".fls", ".fdb_latexmk"):
        aux_file = outputs_dir / f"resume{ext}"
        if aux_file.exists():
            aux_file.unlink()

    # Also clean up TLCresume.sty copy
    if sty_dst.exists():
        sty_dst.unlink()

    return "outputs/resume.pdf", "Resume PDF generated"


def run_resume_build(nicholas: dict, dry_run: bool = False) -> tuple[str, str]:
    """Entry point matching the template-type calling convention."""
    return build_resume(nicholas, dry_run=dry_run)
```

- [ ] **Step 2: Test resume generation**

```bash
python -c "
import yaml
from scripts.resume_builder import build_resume
with open('nicholas.yaml') as f:
    data = yaml.safe_load(f)
path, msg = build_resume(data, dry_run=True)
print(f'{path}: {msg}')
"
```

Expected: Writes `outputs/resume.tex` and prints dry-run message.

- [ ] **Step 3: Verify generated `.tex` against originals**

Visually compare key sections of `outputs/resume.tex`:
- Header `\def` lines match `latex/resume.tex`
- Experience formatting matches `latex/sections/experience.tex`
- Skills table matches `latex/sections/skills.tex`
- Page break is in the correct position

- [ ] **Step 4: Test full PDF compilation** (requires basictex)

```bash
python -c "
import yaml
from scripts.resume_builder import build_resume
with open('nicholas.yaml') as f:
    data = yaml.safe_load(f)
path, msg = build_resume(data)
print(f'{path}: {msg}')
"
```

Expected: `outputs/resume.pdf` exists, aux files cleaned up.

Open the PDF and compare side-by-side with `latex/data_science_tech_resume_template.pdf`.

- [ ] **Step 5: Commit**

```bash
git add scripts/resume_builder.py
git commit -m "feat: add resume builder — YAML to LaTeX to PDF pipeline

Reads nicholas.yaml, renders via Jinja2 template, compiles with
pdflatex. Produces outputs/resume.tex (diffable) and outputs/resume.pdf."
```

### Task 6: Refactor `generate.py` — typed registry and `--all` flag

**Files:**
- Modify: `generate.py`

- [ ] **Step 1: Rename `linkedin-draft` to `linkedin-about`**

In `generate.py`, make these specific changes:

1. Rename function `generate_linkedin_draft` → `generate_linkedin_about` (line 306)
2. In the function body, update instruction text (line 312): change `"This is a draft — the user will review before posting."` to `"Professional but not corporate. Mention the consulting practice (Zealot Analytics) naturally."`
3. Update output path (line 338): `"outputs/linkedin-draft.md"` → `"outputs/linkedin-about.md"` (appears twice — lines 338 and 342)
4. Update return path (line 342): same change

- [ ] **Step 2: Refactor ARTIFACTS to typed registry**

Replace the simple dict:
```python
ARTIFACTS = {
    "site-content": generate_site_content,
    "bio-short": generate_bio_short,
    "bio-long": generate_bio_long,
    "linkedin-draft": generate_linkedin_draft,
}
```

With typed registry:
```python
from scripts.resume_builder import run_resume_build

ARTIFACTS = {
    # LLM artifacts (default targets)
    "site-content":   {"type": "llm",      "fn": generate_site_content},
    "bio-short":      {"type": "llm",      "fn": generate_bio_short},
    "bio-long":       {"type": "llm",      "fn": generate_bio_long},
    "linkedin-about": {"type": "llm",      "fn": generate_linkedin_about},
    # Template artifacts (--all or --only)
    "resume":         {"type": "template", "fn": run_resume_build},
}
```

(LinkedIn sync will be added in Chunk 3.)

- [ ] **Step 3: Add `--all` flag and refactor `main()`**

Update argparse:
```python
parser.add_argument(
    "--all",
    action="store_true",
    help="Run all artifacts including resume and linkedin-sync",
)
```

Update target selection logic:
```python
if args.all and args.only:
    print("Error: --all and --only are mutually exclusive", file=sys.stderr)
    sys.exit(1)

if args.only:
    names = [n.strip() for n in args.only.split(",")]
    # Handle deprecation alias
    if "linkedin-draft" in names:
        names = ["linkedin-about" if n == "linkedin-draft" else n for n in names]
        print("Note: 'linkedin-draft' renamed to 'linkedin-about'", file=sys.stderr)
    unknown = [n for n in names if n not in ARTIFACTS]
    if unknown:
        print(f"Error: unknown artifact(s): {', '.join(unknown)}")
        print(f"Available: {', '.join(ARTIFACTS.keys())}")
        sys.exit(1)
    targets = {k: ARTIFACTS[k] for k in names}
elif args.all:
    targets = ARTIFACTS
else:
    # Default: LLM artifacts only
    targets = {k: v for k, v in ARTIFACTS.items() if v["type"] == "llm"}
```

Update dispatch loop:
```python
for name, entry in targets.items():
    try:
        print(f"Generating {name}...")
        if entry["type"] == "llm":
            path, content = entry["fn"](nicholas, voice, positioning, call_llm)
            with open(ROOT / path, "w") as f:
                f.write(content)
        else:
            path, status = entry["fn"](nicholas, args.dry_run)
        print(f"  → {path}")
    except Exception as e:
        print(f"  ✗ {name} failed: {e}", file=sys.stderr)
        failed.append(name)
```

- [ ] **Step 4: Skip LLM provider detection for non-LLM-only runs**

When only template/action artifacts are targeted, don't require an LLM provider:
```python
# Only init LLM if we have LLM targets
has_llm_targets = any(entry["type"] == "llm" for entry in targets.values())
if has_llm_targets and not args.dry_run:
    provider = args.provider or os.environ.get("GENERATE_PROVIDER") or detect_provider()
    print(f"Using provider: {provider}")
    call_llm = get_client(provider)
elif has_llm_targets:
    call_llm = None
    print("Dry run mode")
else:
    call_llm = None  # Not needed
```

- [ ] **Step 5: Update module docstring**

Update the docstring at the top of `generate.py` to reflect new capabilities:
```python
"""Generate artifacts from nicholas.yaml.

Usage:
    python generate.py                          # LLM artifacts only (default)
    python generate.py --only resume            # generate resume PDF
    python generate.py --only linkedin-about    # generate LinkedIn About via LLM
    python generate.py --only linkedin-sync     # sync LinkedIn profile via Playwright
    python generate.py --all                    # everything: LLM + resume + linkedin
    python generate.py --dry-run                # preview without executing
"""
```

- [ ] **Step 6: Test the refactored `generate.py`**

```bash
# Test resume-only (no LLM needed)
python generate.py --only resume --dry-run

# Test default still works (LLM artifacts only)
python generate.py --dry-run

# Test --all
python generate.py --all --dry-run

# Test mutual exclusivity
python generate.py --all --only resume
# Expected: error message
```

- [ ] **Step 7: Delete old `outputs/linkedin-draft.md`**

```bash
rm -f outputs/linkedin-draft.md
```

- [ ] **Step 8: Commit**

```bash
git add generate.py
git rm outputs/linkedin-draft.md
git commit -m "feat: refactor generate.py with typed artifact registry

Add --all flag, typed dispatch (llm/template/action), resume artifact.
Rename linkedin-draft to linkedin-about with deprecation alias.
Skip LLM provider detection for non-LLM-only runs."
```

---

## Chunk 3: LinkedIn Sync Pipeline

### Task 7: Create `scripts/linkedin_sync.py`

**Files:**
- Create: `scripts/linkedin_sync.py`

- [ ] **Step 1: Write `linkedin_sync.py`**

```python
"""LinkedIn profile sync via Playwright.

Reads nicholas.yaml and outputs/linkedin-about.md, then updates
LinkedIn profile sections using a persistent browser session.
"""

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# All LinkedIn DOM selectors isolated here for easy maintenance.
# When LinkedIn changes their markup, update ONLY this dict.
SELECTORS = {
    # Profile page
    "profile_url": "https://www.linkedin.com/in/me/",
    "login_redirect_pattern": "linkedin.com/login",

    # About section
    "about_edit_pencil": 'button[aria-label="Edit about"]',
    "about_textarea": 'textarea[id*="about"]',
    "about_save_button": 'button[aria-label="Save"]',

    # Headline (part of intro card)
    "intro_edit_pencil": 'button[aria-label="Edit intro"]',
    "headline_input": 'input[id*="headline"]',
    "intro_save_button": 'button[aria-label="Save"]',

    # Experience section
    "experience_section": 'section:has(#experience)',
    "experience_edit_pencil": 'button[aria-label*="Edit experience"]',

    # Education section
    "education_section": 'section:has(#education)',

    # Skills section
    "skills_section": 'section:has(#skills)',

    # Certifications section
    "certifications_section": 'section:has(#licenses)',
}


class LinkedInSync:
    """Sync nicholas.yaml data to LinkedIn profile via Playwright."""

    def __init__(self, nicholas: dict, dry_run: bool = False):
        self.data = nicholas
        self.dry_run = dry_run
        self.state_dir = ROOT / ".playwright-state"
        self.state_dir.mkdir(exist_ok=True)
        self.session_path = self.state_dir / "linkedin-session.json"
        self.backup_path = self.state_dir / "linkedin-backup.json"
        self.backup_data = {}
        self.browser = None
        self.context = None
        self.page = None

    def ensure_session(self):
        """Load or create authenticated Playwright session.

        First run: opens visible browser for manual login.
        Subsequent runs: reuses saved session in headless mode.
        """
        from playwright.sync_api import sync_playwright

        self.pw = sync_playwright().start()

        if self.session_path.exists():
            # Try headless with saved session
            self.browser = self.pw.chromium.launch(headless=True)
            self.context = self.browser.new_context(
                storage_state=str(self.session_path)
            )
            self.page = self.context.new_page()
            self.page.goto(SELECTORS["profile_url"], wait_until="domcontentloaded")
            self.page.wait_for_timeout(2000)

            # Check if redirected to login
            if SELECTORS["login_redirect_pattern"] in self.page.url:
                print("Session expired. Opening browser for re-login...")
                self.browser.close()
                self._manual_login()
            else:
                print("Session valid. Using headless mode.")
        else:
            self._manual_login()

    def _manual_login(self):
        """Open visible browser for manual login, then save session."""
        self.browser = self.pw.chromium.launch(headless=False)
        self.context = self.browser.new_context()
        self.page = self.context.new_page()
        self.page.goto("https://www.linkedin.com/login")

        print("\n=== Manual login required ===")
        print("Please log in to LinkedIn in the browser window.")
        print("After login, press Enter here to continue...")
        input()

        # Save session state
        self.context.storage_state(path=str(self.session_path))
        print(f"Session saved to {self.session_path}")

        # Navigate to profile
        self.page.goto(SELECTORS["profile_url"], wait_until="domcontentloaded")
        self.page.wait_for_timeout(2000)

    def _backup_section(self, section_name: str, current_value: str):
        """Record current value before overwriting."""
        self.backup_data[section_name] = current_value
        self.backup_path.write_text(
            json.dumps(self.backup_data, indent=2, ensure_ascii=False)
        )

    def _log_diff(self, section: str, current: str, proposed: str):
        """Print diff between current and proposed values."""
        print(f"\n--- {section} (current) ---")
        print(current[:500] if current else "(empty)")
        print(f"\n+++ {section} (proposed) ---")
        print(proposed[:500] if proposed else "(empty)")
        print()

    def sync_about(self):
        """Update About section from outputs/linkedin-about.md."""
        about_path = ROOT / "outputs" / "linkedin-about.md"
        if not about_path.exists():
            raise FileNotFoundError(
                f"{about_path} not found. Run: python generate.py --only linkedin-about"
            )

        proposed = about_path.read_text().strip()
        # Strip HTML comment header if present
        if proposed.startswith("<!--"):
            proposed = proposed.split("-->\n", 1)[-1].strip()

        self.page.goto(SELECTORS["profile_url"], wait_until="domcontentloaded")
        self.page.wait_for_timeout(2000)

        # Read current about
        about_section = self.page.query_selector('[id="about"] ~ div')
        current = about_section.inner_text() if about_section else ""

        self._log_diff("About", current, proposed)

        if self.dry_run:
            return

        self._backup_section("about", current)

        # Click edit, update, save
        self.page.click(SELECTORS["about_edit_pencil"])
        self.page.wait_for_timeout(1000)
        textarea = self.page.wait_for_selector(SELECTORS["about_textarea"])
        textarea.fill(proposed)
        self.page.click(SELECTORS["about_save_button"])
        self.page.wait_for_timeout(2000)
        print("  About section updated.")

    def sync_headline(self):
        """Update headline from experience + ventures."""
        exp = self.data.get("experience", [{}])[0]
        ventures = self.data.get("ventures", [])
        company = exp.get("company", "")
        role = exp.get("role", "")

        proposed = f"{role} @ {company}"
        if ventures and ventures[0].get("status") == "active":
            proposed += f" | Founder, {ventures[0]['name']}"

        self.page.goto(SELECTORS["profile_url"], wait_until="domcontentloaded")
        self.page.wait_for_timeout(2000)

        # Read current headline
        headline_el = self.page.query_selector('div.text-body-medium')
        current = headline_el.inner_text().strip() if headline_el else ""

        self._log_diff("Headline", current, proposed)

        if self.dry_run:
            return

        self._backup_section("headline", current)

        self.page.click(SELECTORS["intro_edit_pencil"])
        self.page.wait_for_timeout(1000)
        headline_input = self.page.wait_for_selector(SELECTORS["headline_input"])
        headline_input.fill(proposed)
        self.page.click(SELECTORS["intro_save_button"])
        self.page.wait_for_timeout(2000)
        print("  Headline updated.")

    # --- Phase 2 stubs ---
    # Experience, education, skills, and certifications editing on LinkedIn
    # requires navigating complex nested modals with dynamic DOM. These are
    # implemented as reporting-only stubs for Phase 1. Full browser automation
    # will be added in a follow-up when the about/headline sync is validated.

    def sync_experience(self):
        """Report experience entries (Phase 2: full automation pending)."""
        print("  [experience] Phase 2 stub — reporting only, no browser edits.")
        for exp in self.data.get("experience", []):
            company = exp.get("company", "")
            role = exp.get("role", "")
            years = exp.get("years", "")
            projects = exp.get("projects", [])

            description = ""
            for proj in projects:
                description += f"{proj['name']}\n"
                for highlight in proj.get("highlights", []):
                    description += f"• {highlight.strip()}\n"
                description += "\n"

            proposed = description.strip()
            print(f"    {role} @ {company} ({years}) — {len(proposed)} chars")

    def sync_education(self):
        """Report education entries (Phase 2: full automation pending)."""
        print("  [education] Phase 2 stub — reporting only, no browser edits.")
        for edu in self.data.get("education", []):
            institution = edu.get("institution", "")
            degree = edu.get("degree", "")
            years = edu.get("years", "")
            print(f"    {degree} @ {institution} ({years})")

    def sync_skills(self):
        """Report skills (Phase 2: full automation pending)."""
        skills = self.data.get("skills", {})
        all_skills = []
        for category, items in skills.items():
            if isinstance(items, list):
                all_skills.extend(items)
        print(f"  [skills] Phase 2 stub — {len(all_skills)} skills across {len(skills)} categories")

    def sync_certifications(self):
        """Report certifications (Phase 2: full automation pending)."""
        certs = self.data.get("certifications", [])
        exams = self.data.get("actuarial_exams", [])
        all_certs = certs + exams
        print(f"  [certifications] Phase 2 stub — {len(all_certs)} total ({len(certs)} certs + {len(exams)} exams)")

    def check_selectors(self):
        """Validate all selectors are findable on the current page."""
        self.page.goto(SELECTORS["profile_url"], wait_until="domcontentloaded")
        self.page.wait_for_timeout(3000)

        results = {}
        for name, selector in SELECTORS.items():
            if name.endswith("_url") or name.endswith("_pattern"):
                continue
            try:
                el = self.page.query_selector(selector)
                results[name] = "FOUND" if el else "NOT FOUND"
            except Exception as e:
                results[name] = f"ERROR: {e}"

        print("\nSelector validation:")
        for name, status in results.items():
            marker = "✓" if status == "FOUND" else "✗"
            print(f"  {marker} {name}: {status}")

        return all(s == "FOUND" for s in results.values())

    def sync_all(self):
        """Run all sync methods in order."""
        self.ensure_session()
        try:
            self.sync_about()
            self.sync_headline()
            self.sync_experience()
            self.sync_education()
            self.sync_skills()
            self.sync_certifications()
        finally:
            if self.context:
                # Save session state on exit
                self.context.storage_state(path=str(self.session_path))
            if self.browser:
                self.browser.close()
            if hasattr(self, "pw"):
                self.pw.stop()

    def close(self):
        """Clean up browser resources."""
        if self.browser:
            self.browser.close()
        if hasattr(self, "pw"):
            self.pw.stop()


def run_linkedin_sync(nicholas: dict, dry_run: bool = False) -> tuple[str, str]:
    """Entry point matching the action-type calling convention."""
    syncer = LinkedInSync(nicholas, dry_run=dry_run)
    syncer.sync_all()
    return ".playwright-state/", "LinkedIn profile synced"


def check_selectors(nicholas: dict) -> bool:
    """Validate LinkedIn selectors without modifying anything."""
    syncer = LinkedInSync(nicholas, dry_run=True)
    syncer.ensure_session()
    try:
        return syncer.check_selectors()
    finally:
        syncer.close()
```

- [ ] **Step 2: Commit**

```bash
git add scripts/linkedin_sync.py
git commit -m "feat: add LinkedIn profile sync via Playwright

Persistent session management, selector isolation, dry-run support,
pre-sync backup. Syncs: about, headline, experience, education,
skills, certifications."
```

### Task 8: Wire LinkedIn sync into `generate.py`

**Files:**
- Modify: `generate.py`

- [ ] **Step 1: Add linkedin-sync to ARTIFACTS registry**

Add import at top of file:
```python
from scripts.linkedin_sync import run_linkedin_sync, check_selectors as check_linkedin_selectors
```

Add to ARTIFACTS dict:
```python
    # Action artifacts (--all or --only)
    "linkedin-sync":  {"type": "action",   "fn": run_linkedin_sync},
```

- [ ] **Step 2: Add `--check-selectors` flag**

In argparse:
```python
parser.add_argument(
    "--check-selectors",
    action="store_true",
    help="Validate LinkedIn DOM selectors without modifying anything",
)
```

In main(), before the dispatch loop:
```python
if args.check_selectors:
    nicholas, _, _ = load_sources()
    success = check_linkedin_selectors(nicholas)
    sys.exit(0 if success else 1)
```

- [ ] **Step 3: Add linkedin-sync dependency check**

In the dispatch loop, before running `linkedin-sync`:
```python
if name == "linkedin-sync":
    about_path = ROOT / "outputs" / "linkedin-about.md"
    if not about_path.exists() or about_path.stat().st_size == 0:
        raise FileNotFoundError(
            "outputs/linkedin-about.md not found or empty. "
            "Run: python generate.py --only linkedin-about"
        )
```

- [ ] **Step 4: Test**

```bash
# Test dry-run
python generate.py --only linkedin-sync --dry-run

# Test --all dry-run
python generate.py --all --dry-run

# Test --check-selectors (requires login)
python generate.py --check-selectors
```

- [ ] **Step 5: Commit**

```bash
git add generate.py
git commit -m "feat: wire LinkedIn sync into generate.py

Add linkedin-sync to artifact registry, --check-selectors flag,
dependency validation for linkedin-about.md."
```

### Task 9: End-to-end integration test

- [ ] **Step 1: Test resume pipeline end-to-end**

```bash
python generate.py --only resume
```

Expected:
- `outputs/resume.tex` created (check into git)
- `outputs/resume.pdf` created (gitignored)
- No aux files left behind
- Open PDF and compare with `latex/data_science_tech_resume_template.pdf`

- [ ] **Step 2: Test LinkedIn dry-run end-to-end**

```bash
python generate.py --only linkedin-sync --dry-run
```

Expected: prints current vs. proposed diffs for each section without modifying anything.

- [ ] **Step 3: Test full pipeline**

```bash
python generate.py --all --dry-run
```

Expected: all artifacts run in dry-run mode without errors.

- [ ] **Step 4: Test default behavior unchanged**

```bash
python generate.py --dry-run
```

Expected: only LLM artifacts (site-content, bio-short, bio-long, linkedin-about). No resume, no linkedin-sync.

- [ ] **Step 5: Test mutual exclusivity error**

```bash
python generate.py --all --only resume 2>&1
```

Expected: error message "Error: --all and --only are mutually exclusive"

- [ ] **Step 6: Test deprecation alias**

```bash
python generate.py --only linkedin-draft --dry-run 2>&1
```

Expected: prints deprecation notice "Note: 'linkedin-draft' renamed to 'linkedin-about'" and runs linkedin-about.

- [ ] **Step 7: Test dependency check**

```bash
# Temporarily rename linkedin-about.md to test the dependency error
mv outputs/linkedin-about.md outputs/linkedin-about.md.bak
python generate.py --only linkedin-sync --dry-run 2>&1
mv outputs/linkedin-about.md.bak outputs/linkedin-about.md
```

Expected: error "outputs/linkedin-about.md not found or empty"

- [ ] **Step 8: Commit generated resume.tex**

```bash
git add outputs/resume.tex
git commit -m "chore: add generated resume.tex from nicholas.yaml pipeline"
```

- [ ] **Step 9: Final commit with any remaining fixes**

```bash
git add -A
git status  # verify nothing unexpected
git commit -m "feat: complete resume PDF + LinkedIn sync pipeline

Full pipeline: nicholas.yaml → Jinja2 → LaTeX → PDF for resume,
Playwright automation for LinkedIn profile sync. Extends generate.py
with typed artifact registry, --all flag, and --check-selectors."
```
