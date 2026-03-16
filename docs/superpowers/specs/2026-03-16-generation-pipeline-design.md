# Design: Generation Pipeline (`generate.py`)

**Date:** 2026-03-16
**Status:** Approved
**Scope:** `generate.py`, GitHub Actions workflow, `README.md`

## Problem

`nicholas.yaml` is the single source of truth but only one consumer exists (`render.js` for the website). Generated prose in `outputs/site-content.yaml` is manually maintained. There's no pipeline to produce bios, LinkedIn drafts, or other text artifacts from the structured data.

## Solution

A single Python script (`generate.py`) that reads `nicholas.yaml` + `identity/voice.md` + `identity/positioning.md`, calls an LLM to generate text artifacts, and writes them to `outputs/`. A GitHub Actions workflow auto-runs the script when source files change on `main`.

## Architecture

```
nicholas.yaml ─────────────────┐
identity/voice.md ──────────── │ ──→ generate.py ──→ outputs/
identity/positioning.md ───────┘         │
                                         ├── site-content.yaml  (→ render.js)
                                         ├── bio-short.md
                                         ├── bio-long.md
                                         └── linkedin-draft.md

GitHub Actions: on push to main (when source files change)
  → runs generate.py
  → auto-commits changed outputs back to repo
```

## `generate.py` Design

### CLI Interface

```bash
python generate.py                          # generate all artifacts
python generate.py --only site-content      # generate one
python generate.py --only bio-short,bio-long  # comma-separated subset
python generate.py --provider openai        # override default provider
python generate.py --dry-run                # print prompts without calling LLM
```

### Provider Selection

Priority: `--provider` flag > `GENERATE_PROVIDER` env var > default `anthropic`

Supported providers:
- `anthropic` — Claude (default)
- `openai` — GPT-4o (fallback)

### Dependencies

`requirements.txt`:
```
anthropic
openai
pyyaml
```

### Model Configuration

Models are configurable via env vars, with sensible defaults:

```python
MODELS = {
    "anthropic": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
    "openai": os.environ.get("OPENAI_MODEL", "gpt-4o"),
}
```

### Script Structure

```python
# generate.py — generates text artifacts from nicholas.yaml

import argparse
import os
import re
import sys
from pathlib import Path
import yaml

# Resolve paths relative to script location (works from any CWD)
ROOT = Path(__file__).parent

MODELS = {
    "anthropic": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
    "openai": os.environ.get("OPENAI_MODEL", "gpt-4o"),
}

# --- Data loading ---

def load_sources():
    """Load nicholas.yaml, voice.md, positioning.md. Returns dict + two strings."""
    with open(ROOT / "nicholas.yaml") as f:
        nicholas = yaml.safe_load(f)
    with open(ROOT / "identity" / "voice.md") as f:
        voice = f.read()
    with open(ROOT / "identity" / "positioning.md") as f:
        positioning = f.read()
    return nicholas, voice, positioning

# --- LLM client ---

def get_client(provider):
    """Return an LLM call function based on provider name."""
    # Returns a function: call(system_prompt, user_prompt) -> str
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
    """Strip markdown code fences (```yaml ... ```) from LLM output."""
    text = re.sub(r"^```\w*\n", "", text.strip())
    text = re.sub(r"\n```$", "", text.strip())
    return text

# --- Artifact generators ---
# Each receives (nicholas, voice, positioning, call_llm)
# Each returns (output_path, content_string)

def generate_site_content(nicholas, voice, positioning, call_llm):
    """Generate about prose for the website."""
    ...

def generate_bio_short(nicholas, voice, positioning, call_llm):
    """Generate 1-2 sentence bio."""
    ...

def generate_bio_long(nicholas, voice, positioning, call_llm):
    """Generate full paragraph bio for speaker pages / consulting."""
    ...

def generate_linkedin_draft(nicholas, voice, positioning, call_llm):
    """Generate LinkedIn About section draft."""
    ...

# --- Registry ---

ARTIFACTS = {
    "site-content": generate_site_content,
    "bio-short": generate_bio_short,
    "bio-long": generate_bio_long,
    "linkedin-draft": generate_linkedin_draft,
}

# --- Main ---

def main():
    parser = argparse.ArgumentParser(description="Generate text artifacts from nicholas.yaml")
    parser.add_argument("--only", help="Comma-separated artifact names to generate")
    parser.add_argument("--provider", help="LLM provider (anthropic or openai)")
    parser.add_argument("--dry-run", action="store_true", help="Print prompts without calling LLM")
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
        call_llm = None  # generators print prompts and return placeholder

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

if __name__ == "__main__":
    main()
```

### Error Handling

- Each artifact generation is wrapped in try/except. If one fails, the others still run.
- Failed artifacts are reported to stderr, and the script exits with code 1 so CI surfaces the failure.
- No retry logic — LLM failures are rare enough that re-running the workflow is sufficient.

### Output Validation

For `site-content` specifically, the generator must:
1. Strip markdown code fences from LLM output (via `strip_fences()`)
2. Validate the result parses as YAML with an `about` key containing a list
3. Prepend the header comment (`# Auto-generated from...`)
4. If validation fails, raise an error rather than writing broken YAML

### Artifact-Specific Prompts

Each generator builds a **system prompt** from `voice.md` + `positioning.md` + artifact-specific instructions, and a **user prompt** from relevant sections of `nicholas.yaml`.

**`site-content`:**
- System: voice + positioning + "Write exactly 2 paragraphs for a personal website About section. Output as YAML with `about:` key containing a list of 2 strings."
- User: `about` section (themes, through_line, background_facts) + education summary + experience summary (companies/roles/years only, not full highlights)
- Output: `outputs/site-content.yaml`

**`bio-short`:**
- System: voice + positioning + "Write a 1-2 sentence professional bio. Plain text, no markdown."
- User: `about` section + `ventures` + current role
- Output: `outputs/bio-short.md`

**`bio-long`:**
- System: voice + positioning + "Write a full paragraph professional bio for speaker pages or consulting profiles. 4-6 sentences."
- User: `about` + `experience` highlights + `ventures` + `research` + `education`
- Output: `outputs/bio-long.md`

**`linkedin-draft`:**
- System: voice + positioning (specifically "business audience" guidance) + "Write a LinkedIn About section. Use first person. 3-4 short paragraphs. No hashtags or emoji."
- User: `about` + `experience` + `skills` (category names + top items) + `ventures`
- Output: `outputs/linkedin-draft.md`

### What gets sent to the LLM

Only relevant sections of `nicholas.yaml` per artifact — not the whole file. This keeps prompts focused and token-efficient. Each generator function extracts and formats just what it needs into the user prompt.

## GitHub Actions Workflow

### `.github/workflows/generate.yml`

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

### Key details:
- **Trigger:** only on push to `main` when source files change
- **No infinite loop:** commit message uses `[skip ci]`, and the `paths` filter only watches source files, not `outputs/`
- **Secrets:** `ANTHROPIC_API_KEY` required in GitHub repo settings. Optionally add `OPENAI_API_KEY` for fallback.

## `README.md`

Developer-facing documentation covering:
- Architecture diagram (nicholas.yaml → generate.py → outputs/ → consumers)
- File structure with descriptions
- How to edit (edit nicholas.yaml, push, done)
- How to run locally (`pip install -r requirements.txt && python generate.py`)
- Environment variables (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GENERATE_PROVIDER`)
- Downstream artifacts table (artifact, output path, consumer, description)
- Future work (LinkedIn Playwright agent, resume PDF, Zealot Analytics site)

## Files Changed

| Action | Path | Reason |
|--------|------|--------|
| **Create** | `generate.py` | Generation pipeline script |
| **Create** | `requirements.txt` | Python dependencies |
| **Create** | `.github/workflows/generate.yml` | Auto-generation on push |
| **Create** | `README.md` | Developer-facing architecture docs |
| **Update** | `outputs/site-content.yaml` | Regenerated by generate.py |
| **Create** | `outputs/bio-short.md` | New artifact |
| **Create** | `outputs/bio-long.md` | New artifact |
| **Create** | `outputs/linkedin-draft.md` | New artifact |

## Files NOT Changed

- `nicholas.yaml` — source of truth, not modified by generator
- `identity/voice.md`, `identity/positioning.md` — read-only inputs
- `site/js/render.js` — already consumes `outputs/site-content.yaml`
- `site/css/style.css`, `site/js/scene.js`, `site/js/breathe.js` — untouched
- `index.html` — untouched

## Out of Scope

- Resume PDF generation (low priority, future project)
- LinkedIn Playwright agent (future project — will consume `outputs/linkedin-draft.md` via `microsoft/playwright-cli` to auto-update LinkedIn profile)
- Zealot Analytics website (separate repo)
- Schema updates for nicholas.yaml
