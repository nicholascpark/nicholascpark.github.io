# Nicholas C. Park — Personal Identity Infrastructure

## Purpose
This repo is Nicholas's **command center** for self-expression across professional, intellectual, and business contexts. The website (GitHub Pages) is one projection of the data. The structured content layer is the source of truth.

## Architecture

```
identity/       → Who Nicholas is (profile, voice, positioning)
content/        → What Nicholas has done and thinks (resume, projects, interests, writing)
schemas/        → Structural contracts for data files
site/           → Website rendering layer (reads identity/ and content/)
outputs/        → Generated artifacts (tailored resumes, bios, etc.)
```

### Key principle: content is separate from rendering
Never put content directly in HTML. All content lives in YAML files under `identity/` and `content/`. The site reads these at runtime.

## Conventions

### Data files
- All content/identity data is in **YAML** format
- Follow the schemas in `schemas/` when editing data files
- Use comments in YAML to annotate context that isn't rendered but helps agents

### Voice & positioning
- Before generating any public-facing text (bios, intros, descriptions), read `identity/voice.md` and `identity/positioning.md`
- These files are the style guide — never contradict them

### Site rendering
- `index.html` lives at repo root (GitHub Pages requirement)
- It loads `site/css/style.css` and `site/js/render.js`
- `render.js` fetches YAML from `identity/` and `content/`, renders the page
- js-yaml is loaded from CDN for browser-side YAML parsing
- Zero build step — everything runs client-side

### Business: Zealot Analytics
- Nicholas's LLC for AI consulting/engineering
- Integrated subtly in the site (not a separate section — appears as a natural part of his identity)
- Will have its own website in the future, linked from this site
- That repo will be maintained hierarchically from this one

### Git
- Commit messages should be descriptive of what changed and why
- Content changes and site changes should be separate commits when possible

## Agent boundaries
- **Safe to change without asking:** content/ data files (adding/updating entries), outputs/
- **Ask first:** identity/ files (voice, positioning — these are strategic), site/ rendering logic, schemas/
- **Never change without explicit request:** this file (CLAUDE.md)

## Future extensions
- `content/writing/` — essays, reflections (markdown files)
- `outputs/` — generated tailored resumes, cover letters, bios
- Zealot Analytics separate site repo (linked hierarchically)
- Multi-format resume generation (PDF, LaTeX)
