# nicholas.yaml Consolidation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate 4 YAML data files into a single `nicholas.yaml` source of truth, with `outputs/site-content.yaml` for generated prose, and update `render.js` to consume the new structure.

**Architecture:** Single YAML file at repo root holds all identity + content data. A companion `outputs/site-content.yaml` holds LLM-generated prose (manually seeded for now). `render.js` fetches both files instead of the previous three.

**Tech Stack:** YAML, vanilla JavaScript (no build step), GitHub Pages

**Spec:** `docs/superpowers/specs/2026-03-15-nicholas-yaml-consolidation-design.md`

---

## Chunk 1: Data files

### Task 1: Create `nicholas.yaml`

**Files:**
- Create: `nicholas.yaml`
- Reference: `identity/profile.yaml`, `content/resume.yaml`, `content/projects.yaml`, `content/interests.yaml`

- [ ] **Step 1: Create `nicholas.yaml` at repo root**

Merge all 4 source files into a single file. Use `profile.yaml` format for duplicated fields (`ventures`, `languages`). Add `about` structured points section. Add comments explaining which sections are rendered directly vs consumed by generators.

The complete file content is specified in the design spec under "`nicholas.yaml` Structure". Copy that exactly.

- [ ] **Step 2: Verify YAML is valid**

Run: `python3 -c "import yaml; yaml.safe_load(open('nicholas.yaml'))"`
Expected: No error, clean exit

- [ ] **Step 3: Commit**

```bash
git add nicholas.yaml
git commit -m "feat: create nicholas.yaml as single source of truth

Consolidates identity/profile.yaml, content/resume.yaml,
content/projects.yaml, and content/interests.yaml into one file."
```

### Task 2: Create `outputs/site-content.yaml`

**Files:**
- Create: `outputs/site-content.yaml`
- Delete: `outputs/.gitkeep`

- [ ] **Step 1: Create `outputs/site-content.yaml`**

Seed with the current hardcoded about prose from `render.js` lines 197-207. Content specified in spec under "`outputs/site-content.yaml`" section.

```yaml
# Auto-generated from nicholas.yaml + voice.md + positioning.md
# Do not edit directly — regenerate with: python generate.py
# (Until generate.py exists, this file is maintained manually)

about:
  - >
    I build intelligent systems and think about how they learn.
    My work sits at the intersection of software engineering, reinforcement learning,
    and multi-agent AI — grounded in nine years of building production systems
    and a graduate research foundation from Georgia Tech.
  - >
    Lately, I'm drawn to the harder questions: how agents coordinate,
    how humans think about thinking, and what subtraction can teach us about cognition.
    The through-line is a belief that rigorous thinking and practical building aren't
    separate pursuits — they're the same one.
```

- [ ] **Step 2: Delete `outputs/.gitkeep`**

```bash
rm outputs/.gitkeep
```

- [ ] **Step 3: Verify YAML is valid**

Run: `python3 -c "import yaml; yaml.safe_load(open('outputs/site-content.yaml'))"`
Expected: No error, clean exit

- [ ] **Step 4: Commit**

```bash
git add outputs/site-content.yaml
git rm outputs/.gitkeep
git commit -m "feat: add outputs/site-content.yaml with about prose"
```

---

## Chunk 2: Update render.js

### Task 3: Update `render.js` to consume new file structure

**Files:**
- Modify: `site/js/render.js`

- [ ] **Step 1: Update file header comment**

Change line 2 from:
```javascript
 * Site renderer — reads YAML data from identity/ and content/,
```
to:
```javascript
 * Site renderer — reads nicholas.yaml (source of truth) and
 * outputs/site-content.yaml (generated prose), renders the page into #root.
```

- [ ] **Step 2: Update data fetching (lines 25-29)**

Replace:
```javascript
    const [profile, interests, projects] = await Promise.all([
      fetchYAML('identity/profile.yaml'),
      fetchYAML('content/interests.yaml'),
      fetchYAML('content/projects.yaml'),
    ]);
```
with:
```javascript
    const [nicholas, siteContent] = await Promise.all([
      fetchYAML('nicholas.yaml'),
      fetchYAML('outputs/site-content.yaml'),
    ]);
```

- [ ] **Step 3: Update render calls (lines 32-39)**

Replace:
```javascript
    root.appendChild(wrapGlass(renderHeader(profile), 'glass-card-header'));
    root.appendChild(createSacredDivider());
    root.appendChild(wrapGlass(renderAbout()));
    root.appendChild(createSacredDivider());
    root.appendChild(wrapGlass(renderInterests(interests)));
    root.appendChild(createSacredDivider());
    root.appendChild(wrapGlass(renderProjects(projects)));
    root.appendChild(renderFooter(profile));
```
with:
```javascript
    root.appendChild(wrapGlass(renderHeader(nicholas), 'glass-card-header'));
    root.appendChild(createSacredDivider());
    root.appendChild(wrapGlass(renderAbout(siteContent)));
    root.appendChild(createSacredDivider());
    root.appendChild(wrapGlass(renderInterests(nicholas)));
    root.appendChild(createSacredDivider());
    root.appendChild(wrapGlass(renderProjects(nicholas)));
    root.appendChild(renderFooter(nicholas));
```

- [ ] **Step 4: Update `renderAbout()` function (lines 190-212)**

Replace the entire function with:
```javascript
function renderAbout(siteContent) {
  const section = el('section', 'section reveal');

  section.appendChild(elText('h2', 'About', 'section-title'));

  const prose = el('div', 'section-prose');
  siteContent.about.forEach(function (text) {
    const p = document.createElement('p');
    p.textContent = text.trim();
    prose.appendChild(p);
  });

  section.appendChild(prose);
  return section;
}
```

- [ ] **Step 5: Update `renderInterests()` function parameter and access**

Change function signature from `renderInterests(data)` to `renderInterests(nicholas)`.
Change `data.interests.forEach` to `nicholas.interests.forEach`.

- [ ] **Step 6: Update `renderProjects()` function parameter and access**

Change function signature from `renderProjects(data)` to `renderProjects(nicholas)`.
Change `data.featured.forEach` to `nicholas.projects.featured.forEach`.

- [ ] **Step 7: Commit**

```bash
git add site/js/render.js
git commit -m "refactor: update render.js to consume nicholas.yaml

Fetches nicholas.yaml + outputs/site-content.yaml instead of 3 separate
files. renderAbout() now reads from site-content.yaml instead of
hardcoded strings."
```

---

## Chunk 3: Cleanup and docs

### Task 4: Delete old data files

**Files:**
- Delete: `identity/profile.yaml`
- Delete: `content/resume.yaml`
- Delete: `content/projects.yaml`
- Delete: `content/interests.yaml`
- Delete: `content/` directory

- [ ] **Step 1: Delete the 4 absorbed YAML files and empty content/ directory**

```bash
git rm identity/profile.yaml
git rm content/resume.yaml content/projects.yaml content/interests.yaml
```

After git rm, the `content/` directory will be empty and git will stop tracking it automatically.

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: remove old data files absorbed into nicholas.yaml

identity/profile.yaml, content/resume.yaml, content/projects.yaml,
and content/interests.yaml are now consolidated in nicholas.yaml."
```

### Task 5: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Architecture section**

Replace the architecture code block with:
```
nicholas.yaml    → Single source of truth (identity + content data)
identity/        → Style guides (voice.md, positioning.md) for generation
outputs/         → Generated artifacts (site prose, future: PDFs, bios)
site/            → Website rendering layer (reads nicholas.yaml and outputs/)
schemas/         → Structural contracts (to be updated for new structure)
```

- [ ] **Step 2: Update "Key principle" paragraph**

Update to reflect that all content lives in `nicholas.yaml` (not "YAML files under `identity/` and `content/`"). Style guides remain in `identity/`.

- [ ] **Step 3: Update Agent Boundaries**

Change "Safe to change without asking" to reference `nicholas.yaml` instead of `content/ data files`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for nicholas.yaml architecture"
```

### Task 6: Verify site works

- [ ] **Step 1: Serve the site locally and verify**

```bash
cd /Users/nicholaspark/Documents/nicholascpark.github.io && python3 -m http.server 8000
```

Open browser to `http://localhost:8000`. Verify:
- Header shows name, tagline, venture line, links
- About section shows two paragraphs of prose
- Interests section shows all 5 interests with descriptions
- Projects section shows all 4 featured projects
- Footer shows name and rotation coordinates
- Theme toggle works
- No console errors

- [ ] **Step 2: Check for broken YAML references**

Open browser console, look for any fetch errors or YAML parse errors. There should be none.
