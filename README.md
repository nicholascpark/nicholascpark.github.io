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

On commit, a post-commit hook runs `generate.py` via Claude Code CLI (Max subscription).
On push to `main`, GitHub Actions runs `generate.py` via Anthropic API as a fallback.

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
2. `git commit` — post-commit hook runs `generate.py` via Claude Code CLI, auto-commits outputs
3. `git push` — GitHub Pages deploys the site

That's it. One file to edit, everything downstream regenerates.

## Setup

Enable the post-commit hook (one-time):

```bash
git config core.hooksPath .githooks
```

## Running Locally

```bash
pip install -r requirements.txt

python generate.py                          # generate all (auto-detects provider)
python generate.py --only site-content      # one artifact
python generate.py --only bio-short,bio-long  # subset
python generate.py --provider anthropic     # use API instead of CLI
python generate.py --dry-run                # print prompts, no LLM calls
```

### Provider Auto-Detection

`generate.py` automatically selects the best available provider:

1. **`claude-code`** — Claude Code CLI (uses Max subscription, no API key needed)
2. **`anthropic`** — Anthropic API (requires `ANTHROPIC_API_KEY`)
3. **`openai`** — OpenAI API (requires `OPENAI_API_KEY`)

Override with `--provider` flag or `GENERATE_PROVIDER` env var.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Only for CI / API provider | — | Anthropic API key |
| `OPENAI_API_KEY` | Only if using OpenAI | — | OpenAI API key |
| `GENERATE_PROVIDER` | No | auto-detect | LLM provider (`claude-code`, `anthropic`, or `openai`) |
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
