# Generation Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `generate.py` to produce text artifacts from `nicholas.yaml` via LLM, with a GitHub Actions workflow for auto-generation on push, and a developer-facing `README.md`.

**Architecture:** Single Python script reads `nicholas.yaml` + style guides, calls Claude (default) or OpenAI (fallback) per artifact, writes to `outputs/`. GitHub Actions triggers on source file changes, runs the script, auto-commits results.

**Tech Stack:** Python 3.12, `anthropic` SDK, `openai` SDK, `pyyaml`, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-03-16-generation-pipeline-design.md`

---

## Chunk 1: Core script and infrastructure

### Task 1: Create `requirements.txt`

**Files:**
- Create: `requirements.txt`

- [ ] **Step 1: Create the file**

```
anthropic
openai
pyyaml
```

- [ ] **Step 2: Install dependencies**

Run: `pip install -r requirements.txt`

- [ ] **Step 3: Commit**

```bash
git add requirements.txt
git commit -m "chore: add requirements.txt for generate.py"
```

### Task 2: Create `generate.py` scaffold with data loading, CLI, and provider client

**Files:**
- Create: `generate.py`

- [ ] **Step 1: Create `generate.py` with full scaffold**

The complete script with all infrastructure (CLI parsing, data loading, provider client, strip_fences helper, error handling, dry-run support) and placeholder generator functions that will be filled in by subsequent tasks.

```python
#!/usr/bin/env python3
"""Generate text artifacts from nicholas.yaml.

Reads nicholas.yaml + identity/voice.md + identity/positioning.md,
calls an LLM to generate text artifacts, writes to outputs/.

Usage:
    python generate.py                          # generate all artifacts
    python generate.py --only site-content      # generate one
    python generate.py --only bio-short,bio-long  # comma-separated subset
    python generate.py --provider openai        # override default provider
    python generate.py --dry-run                # print prompts without calling LLM
"""

import argparse
import os
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).parent

MODELS = {
    "anthropic": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
    "openai": os.environ.get("OPENAI_MODEL", "gpt-4o"),
}

SITE_CONTENT_HEADER = (
    "# Auto-generated from nicholas.yaml + voice.md + positioning.md\n"
    "# Do not edit directly — regenerate with: python generate.py\n\n"
)


# --- Data loading ---


def load_sources():
    """Load nicholas.yaml, voice.md, positioning.md."""
    with open(ROOT / "nicholas.yaml") as f:
        nicholas = yaml.safe_load(f)
    with open(ROOT / "identity" / "voice.md") as f:
        voice = f.read()
    with open(ROOT / "identity" / "positioning.md") as f:
        positioning = f.read()
    return nicholas, voice, positioning


# --- LLM client ---


def get_client(provider):
    """Return an LLM call function for the given provider."""
    model = MODELS[provider]
    if provider == "anthropic":
        from anthropic import Anthropic

        client = Anthropic()

        def call(system, user):
            response = client.messages.create(
                model=model,
                max_tokens=2048,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            return response.content[0].text

        return call
    elif provider == "openai":
        from openai import OpenAI

        client = OpenAI()

        def call(system, user):
            response = client.chat.completions.create(
                model=model,
                max_tokens=2048,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            )
            return response.choices[0].message.content

        return call
    else:
        raise ValueError(f"Unknown provider: {provider}")


# --- Output helpers ---


def strip_fences(text):
    """Strip markdown code fences from LLM output."""
    text = re.sub(r"^```\w*\n", "", text.strip())
    text = re.sub(r"\n```$", "", text.strip())
    return text


def build_system_prompt(voice, positioning, instruction):
    """Build a system prompt from voice + positioning + artifact-specific instruction."""
    return (
        "You are a writing assistant generating text for Nicholas C. Park's "
        "personal identity infrastructure. Follow these style guides exactly.\n\n"
        "## Voice Guide\n\n"
        f"{voice}\n\n"
        "## Positioning Strategy\n\n"
        f"{positioning}\n\n"
        "## Your Task\n\n"
        f"{instruction}"
    )


def format_experience_summary(nicholas):
    """Format experience as companies/roles/years for prompts (no full highlights)."""
    lines = []
    for exp in nicholas.get("experience", []):
        company = exp["company"]
        role = exp.get("role", "")
        years = exp.get("years", "")
        industry = exp.get("industry", "")
        projects = [p["name"] for p in exp.get("projects", [])]
        line = f"- {role} @ {company}"
        if industry:
            line += f" ({industry})"
        line += f", {years}"
        if projects:
            line += f". Projects: {', '.join(projects)}"
        lines.append(line)
    return "\n".join(lines)


def format_education_summary(nicholas):
    """Format education for prompts."""
    lines = []
    for edu in nicholas.get("education", []):
        inst = edu.get("institution", "")
        if not inst:
            continue
        degree = edu.get("degree", "")
        years = edu.get("years", "")
        gpa = edu.get("gpa", "")
        line = f"- {degree}, {inst}, {years}"
        if gpa:
            line += f" (GPA: {gpa})"
        lines.append(line)
    return "\n".join(lines)


# --- Artifact generators ---


def generate_site_content(nicholas, voice, positioning, call_llm):
    """Generate about prose for the website."""
    raise NotImplementedError("Task 3")


def generate_bio_short(nicholas, voice, positioning, call_llm):
    """Generate 1-2 sentence bio."""
    raise NotImplementedError("Task 4")


def generate_bio_long(nicholas, voice, positioning, call_llm):
    """Generate full paragraph bio."""
    raise NotImplementedError("Task 5")


def generate_linkedin_draft(nicholas, voice, positioning, call_llm):
    """Generate LinkedIn About section draft."""
    raise NotImplementedError("Task 6")


# --- Registry ---

ARTIFACTS = {
    "site-content": generate_site_content,
    "bio-short": generate_bio_short,
    "bio-long": generate_bio_long,
    "linkedin-draft": generate_linkedin_draft,
}


# --- Main ---


def main():
    parser = argparse.ArgumentParser(
        description="Generate text artifacts from nicholas.yaml"
    )
    parser.add_argument(
        "--only", help="Comma-separated artifact names to generate"
    )
    parser.add_argument(
        "--provider", help="LLM provider: anthropic (default) or openai"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print prompts without calling LLM",
    )
    args = parser.parse_args()

    provider = args.provider or os.environ.get("GENERATE_PROVIDER", "anthropic")
    nicholas, voice, positioning = load_sources()

    # Validate --only names
    targets = ARTIFACTS
    if args.only:
        names = [n.strip() for n in args.only.split(",")]
        unknown = [n for n in names if n not in ARTIFACTS]
        if unknown:
            print(f"Error: unknown artifact(s): {', '.join(unknown)}")
            print(f"Available: {', '.join(ARTIFACTS.keys())}")
            sys.exit(1)
        targets = {k: v for k, v in ARTIFACTS.items() if k in names}

    if not args.dry_run:
        call_llm = get_client(provider)
    else:
        call_llm = None

    os.makedirs(ROOT / "outputs", exist_ok=True)
    failed = []

    for name, gen_fn in targets.items():
        try:
            print(f"Generating {name}...")
            path, content = gen_fn(nicholas, voice, positioning, call_llm)
            with open(ROOT / path, "w") as f:
                f.write(content)
            print(f"  → {path}")
        except Exception as e:
            print(f"  ✗ {name} failed: {e}", file=sys.stderr)
            failed.append(name)

    if failed:
        print(f"\nFailed artifacts: {', '.join(failed)}", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"\nDone. Generated {len(targets)} artifact(s).")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify scaffold runs (dry-run with --only pointing at non-implemented artifact should fail gracefully)**

Run: `python generate.py --dry-run --only site-content`
Expected: Prints "Generating site-content..." then fails with NotImplementedError (expected — generators not yet implemented)

- [ ] **Step 3: Verify CLI validation works**

Run: `python generate.py --only bogus-name`
Expected: "Error: unknown artifact(s): bogus-name" and exit code 1

- [ ] **Step 4: Commit**

```bash
git add generate.py
git commit -m "feat: add generate.py scaffold with CLI, data loading, provider client"
```

---

## Chunk 2: Artifact generators

### Task 3: Implement `generate_site_content`

**Files:**
- Modify: `generate.py` (replace `generate_site_content` function)

- [ ] **Step 1: Implement the generator**

Replace the `generate_site_content` function with:

```python
def generate_site_content(nicholas, voice, positioning, call_llm):
    """Generate about prose for the website."""
    instruction = (
        "Write exactly 2 paragraphs for a personal website About section. "
        "Each paragraph should be 2-4 sentences. First person. No markdown formatting.\n\n"
        "Output ONLY valid YAML with an `about:` key containing a list of exactly 2 strings, "
        "each using the YAML block scalar `>` syntax. No other keys. No code fences.\n\n"
        "Example format:\n"
        "about:\n"
        "  - >\n"
        "    First paragraph text here.\n"
        "  - >\n"
        "    Second paragraph text here."
    )
    system = build_system_prompt(voice, positioning, instruction)

    about = nicholas.get("about", {})
    user = (
        f"Themes: {yaml.dump(about.get('themes', []), default_flow_style=True).strip()}\n"
        f"Through-line: {about.get('through_line', '')}\n"
        f"Background facts: {yaml.dump(about.get('background_facts', []), default_flow_style=True).strip()}\n\n"
        f"Education:\n{format_education_summary(nicholas)}\n\n"
        f"Experience:\n{format_experience_summary(nicholas)}"
    )

    if call_llm is None:
        print(f"  [dry-run] System prompt ({len(system)} chars)")
        print(f"  [dry-run] User prompt ({len(user)} chars)")
        return "outputs/site-content.yaml", SITE_CONTENT_HEADER + "about:\n  - >\n    [dry-run placeholder]\n"

    raw = call_llm(system, user)
    cleaned = strip_fences(raw)

    # Validate YAML
    parsed = yaml.safe_load(cleaned)
    if not isinstance(parsed, dict) or "about" not in parsed:
        raise ValueError("LLM output missing 'about' key")
    if not isinstance(parsed["about"], list) or len(parsed["about"]) < 1:
        raise ValueError("LLM output 'about' is not a list")

    # Rebuild clean YAML from parsed data to ensure consistency
    content = SITE_CONTENT_HEADER
    content += "about:\n"
    for paragraph in parsed["about"]:
        text = paragraph.strip()
        content += f"  - >\n    {text}\n"

    return "outputs/site-content.yaml", content
```

- [ ] **Step 2: Test with dry-run**

Run: `python generate.py --dry-run --only site-content`
Expected: Prints system/user prompt char counts, writes placeholder to `outputs/site-content.yaml`

- [ ] **Step 3: Test with real LLM call**

Run: `python generate.py --only site-content`
Expected: Calls Claude, writes valid YAML to `outputs/site-content.yaml`

- [ ] **Step 4: Verify output is valid YAML consumed by render.js**

Run: `python3 -c "import yaml; d=yaml.safe_load(open('outputs/site-content.yaml')); assert 'about' in d and len(d['about']) >= 1; print('Valid')"`

- [ ] **Step 5: Commit**

```bash
git add generate.py outputs/site-content.yaml
git commit -m "feat: implement site-content generator"
```

### Task 4: Implement `generate_bio_short`

**Files:**
- Modify: `generate.py` (replace `generate_bio_short` function)

- [ ] **Step 1: Implement the generator**

```python
def generate_bio_short(nicholas, voice, positioning, call_llm):
    """Generate 1-2 sentence bio."""
    instruction = (
        "Write a 1-2 sentence professional bio. Plain text, no markdown, no formatting. "
        "First person. This is for email signatures, conference badges, and social profiles."
    )
    system = build_system_prompt(voice, positioning, instruction)

    about = nicholas.get("about", {})
    ventures = nicholas.get("ventures", [])
    current = nicholas["experience"][0] if nicholas.get("experience") else {}
    user = (
        f"Themes: {yaml.dump(about.get('themes', []), default_flow_style=True).strip()}\n"
        f"Through-line: {about.get('through_line', '')}\n"
        f"Current role: {current.get('role', '')} @ {current.get('company', '')}\n"
        f"Venture: {ventures[0]['name'] if ventures else 'N/A'} — {ventures[0].get('focus', '') if ventures else ''}"
    )

    if call_llm is None:
        print(f"  [dry-run] System prompt ({len(system)} chars)")
        print(f"  [dry-run] User prompt ({len(user)} chars)")
        return "outputs/bio-short.md", "[dry-run placeholder]"

    result = call_llm(system, user)
    return "outputs/bio-short.md", result.strip() + "\n"
```

- [ ] **Step 2: Test with real LLM**

Run: `python generate.py --only bio-short`
Expected: Writes 1-2 sentences to `outputs/bio-short.md`

- [ ] **Step 3: Commit**

```bash
git add generate.py outputs/bio-short.md
git commit -m "feat: implement bio-short generator"
```

### Task 5: Implement `generate_bio_long`

**Files:**
- Modify: `generate.py` (replace `generate_bio_long` function)

- [ ] **Step 1: Implement the generator**

```python
def generate_bio_long(nicholas, voice, positioning, call_llm):
    """Generate full paragraph bio for speaker pages / consulting."""
    instruction = (
        "Write a full paragraph professional bio for speaker pages or consulting profiles. "
        "4-6 sentences. Third person (use 'Nicholas' or 'Park'). No markdown formatting."
    )
    system = build_system_prompt(voice, positioning, instruction)

    about = nicholas.get("about", {})
    ventures = nicholas.get("ventures", [])
    user = (
        f"Themes: {yaml.dump(about.get('themes', []), default_flow_style=True).strip()}\n"
        f"Through-line: {about.get('through_line', '')}\n"
        f"Background facts: {yaml.dump(about.get('background_facts', []), default_flow_style=True).strip()}\n\n"
        f"Education:\n{format_education_summary(nicholas)}\n\n"
        f"Experience:\n{format_experience_summary(nicholas)}\n\n"
        f"Venture: {ventures[0]['name'] if ventures else 'N/A'} — {ventures[0].get('focus', '') if ventures else ''}\n\n"
        f"Research:\n"
    )
    for r in nicholas.get("research", []):
        user += f"- {r['name']}: {r.get('description', '').strip()}\n"

    if call_llm is None:
        print(f"  [dry-run] System prompt ({len(system)} chars)")
        print(f"  [dry-run] User prompt ({len(user)} chars)")
        return "outputs/bio-long.md", "[dry-run placeholder]"

    result = call_llm(system, user)
    return "outputs/bio-long.md", result.strip() + "\n"
```

- [ ] **Step 2: Test with real LLM**

Run: `python generate.py --only bio-long`
Expected: Writes 4-6 sentence paragraph to `outputs/bio-long.md`

- [ ] **Step 3: Commit**

```bash
git add generate.py outputs/bio-long.md
git commit -m "feat: implement bio-long generator"
```

### Task 6: Implement `generate_linkedin_draft`

**Files:**
- Modify: `generate.py` (replace `generate_linkedin_draft` function)

- [ ] **Step 1: Implement the generator**

```python
def generate_linkedin_draft(nicholas, voice, positioning, call_llm):
    """Generate LinkedIn About section draft."""
    instruction = (
        "Write a LinkedIn About section. First person. 3-4 short paragraphs. "
        "No hashtags, no emoji, no markdown formatting. "
        "Optimize for the 'business audience' guidance in the positioning strategy. "
        "This is a draft — the user will review before posting."
    )
    system = build_system_prompt(voice, positioning, instruction)

    about = nicholas.get("about", {})
    ventures = nicholas.get("ventures", [])
    skills = nicholas.get("skills", {})
    user = (
        f"Themes: {yaml.dump(about.get('themes', []), default_flow_style=True).strip()}\n"
        f"Through-line: {about.get('through_line', '')}\n"
        f"Background facts: {yaml.dump(about.get('background_facts', []), default_flow_style=True).strip()}\n\n"
        f"Experience:\n{format_experience_summary(nicholas)}\n\n"
        f"Skills:\n"
    )
    for category, items in skills.items():
        if isinstance(items, list):
            user += f"- {category}: {', '.join(items[:8])}\n"

    user += (
        f"\nVenture: {ventures[0]['name'] if ventures else 'N/A'} — "
        f"{ventures[0].get('focus', '') if ventures else ''}"
    )

    if call_llm is None:
        print(f"  [dry-run] System prompt ({len(system)} chars)")
        print(f"  [dry-run] User prompt ({len(user)} chars)")
        return "outputs/linkedin-draft.md", "[dry-run placeholder]"

    result = call_llm(system, user)
    header = "<!-- Draft generated from nicholas.yaml — review before posting -->\n\n"
    return "outputs/linkedin-draft.md", header + result.strip() + "\n"
```

- [ ] **Step 2: Test with real LLM**

Run: `python generate.py --only linkedin-draft`
Expected: Writes 3-4 paragraphs to `outputs/linkedin-draft.md` with draft header

- [ ] **Step 3: Commit**

```bash
git add generate.py outputs/linkedin-draft.md
git commit -m "feat: implement linkedin-draft generator"
```

### Task 7: Run full generation and verify all artifacts

- [ ] **Step 1: Run all generators**

Run: `python generate.py`
Expected: All 4 artifacts generated successfully

- [ ] **Step 2: Verify site still works with regenerated site-content.yaml**

```bash
python3 -m http.server 8000 &
# Open http://localhost:8000 and verify About section renders
# Check browser console for errors
kill %1
```

- [ ] **Step 3: Verify all output files exist and have content**

```bash
cat outputs/site-content.yaml
cat outputs/bio-short.md
cat outputs/bio-long.md
cat outputs/linkedin-draft.md
```

- [ ] **Step 4: Commit all outputs**

```bash
git add outputs/
git commit -m "chore: regenerate all output artifacts via generate.py"
```

---

## Chunk 3: GitHub Actions and README

### Task 8: Create GitHub Actions workflow

**Files:**
- Create: `.github/workflows/generate.yml`

- [ ] **Step 1: Create directory and workflow file**

```bash
mkdir -p .github/workflows
```

Create `.github/workflows/generate.yml`:

```yaml
name: Generate artifacts

on:
  push:
    branches: [main]
    paths:
      - nicholas.yaml
      - identity/voice.md
      - identity/positioning.md

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Run generate.py
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: python generate.py

      - name: Commit and push if outputs changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add outputs/
          if git diff --staged --quiet; then
            echo "No changes to outputs"
          else
            git commit -m "chore: regenerate outputs from nicholas.yaml [skip ci]"
            git push
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/generate.yml
git commit -m "ci: add GitHub Actions workflow for auto-generation"
```

### Task 9: Create README.md

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write README.md**

```markdown
# Nicholas C. Park — Personal Identity Infrastructure

Single source of truth for all professional artifacts: website, bios, LinkedIn, resumes.

## Architecture

```
nicholas.yaml                  ← edit this (single source of truth)
identity/voice.md              ← how Nicholas sounds (tone, style)
identity/positioning.md        ← what to emphasize (strategic framing)
        │
        ▼
   generate.py                 ← LLM-powered artifact generation
        │
        ├── outputs/site-content.yaml   → render.js (website about section)
        ├── outputs/bio-short.md        → email sigs, conference badges
        ├── outputs/bio-long.md         → speaker pages, consulting profiles
        └── outputs/linkedin-draft.md   → review & post to LinkedIn
```

On push to `main`, GitHub Actions runs `generate.py` and auto-commits updated outputs.

## File Structure

| Path | Purpose |
|------|---------|
| `nicholas.yaml` | All identity + content data (the one file you edit) |
| `identity/voice.md` | Tone guide for LLM generation |
| `identity/positioning.md` | Strategic emphasis guide for LLM generation |
| `outputs/` | Generated artifacts (committed to repo) |
| `site/` | Website rendering layer (HTML/CSS/JS) |
| `site/js/render.js` | Fetches `nicholas.yaml` + `outputs/site-content.yaml`, renders page |
| `generate.py` | Reads source files, calls LLM, writes outputs |
| `index.html` | GitHub Pages entry point |

## Editing Workflow

1. Edit `nicholas.yaml`
2. `git commit && git push`
3. GitHub Actions runs `generate.py`, commits updated outputs
4. GitHub Pages deploys the site

That's it. One file to edit, everything downstream regenerates.

## Running Locally

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=your-key-here

python generate.py                          # generate all artifacts
python generate.py --only site-content      # one artifact
python generate.py --only bio-short,bio-long  # subset
python generate.py --provider openai        # use OpenAI instead
python generate.py --dry-run                # print prompts, no LLM calls
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes (for default provider) | — | Anthropic API key |
| `OPENAI_API_KEY` | Only if using OpenAI | — | OpenAI API key |
| `GENERATE_PROVIDER` | No | `anthropic` | LLM provider (`anthropic` or `openai`) |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-20250514` | Anthropic model ID |
| `OPENAI_MODEL` | No | `gpt-4o` | OpenAI model ID |

## Downstream Artifacts

| Artifact | Output Path | Consumer | Description |
|----------|-------------|----------|-------------|
| Site prose | `outputs/site-content.yaml` | `render.js` | About section on website |
| Short bio | `outputs/bio-short.md` | Manual copy-paste | 1-2 sentences for email sigs |
| Long bio | `outputs/bio-long.md` | Manual copy-paste | Full paragraph for speaker pages |
| LinkedIn draft | `outputs/linkedin-draft.md` | Review → LinkedIn | About section draft |

## Future Work

- **LinkedIn Playwright agent** — auto-update LinkedIn profile from `outputs/linkedin-draft.md` using [microsoft/playwright](https://github.com/microsoft/playwright)
- **Resume PDF** — generate printable resume from `nicholas.yaml`
- **Zealot Analytics site** — separate repo, linked hierarchically from this one
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add developer-facing README with architecture overview"
```

### Task 10: Final verification

- [ ] **Step 1: Run full generation one more time**

Run: `python generate.py`
Expected: All 4 artifacts succeed

- [ ] **Step 2: Serve site locally and verify About section**

```bash
python3 -m http.server 8000 &
```

Open `http://localhost:8000`. Verify:
- About section renders the generated prose (not the old hardcoded text)
- No console errors
- All other sections still work (header, interests, projects, footer)

```bash
kill %1
```

- [ ] **Step 3: Review all generated outputs**

Read each file in `outputs/` and verify they match the voice/positioning guides:
- `site-content.yaml` — 2 paragraphs, YAML format, no buzzwords
- `bio-short.md` — 1-2 sentences, plain text
- `bio-long.md` — 4-6 sentences, third person
- `linkedin-draft.md` — 3-4 paragraphs, first person, draft header present
