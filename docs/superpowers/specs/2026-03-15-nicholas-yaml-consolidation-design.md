# Design: Consolidate Data Layer into `nicholas.yaml`

**Date:** 2026-03-15
**Status:** Approved
**Scope:** Data consolidation + render.js update (no generation pipeline)

## Problem

Identity and content data is spread across 4 YAML files (`identity/profile.yaml`, `content/resume.yaml`, `content/projects.yaml`, `content/interests.yaml`). This makes editing friction higher than necessary and complicates downstream consumers (future resume generator, bio generator, LinkedIn agent). The "About" section prose is hardcoded in `render.js`, not data-driven at all.

## Solution

Consolidate all 4 files into a single `nicholas.yaml` at repo root. Add structured `about` data points for future LLM-based prose generation. Create `outputs/site-content.yaml` as the rendered prose layer. Update `render.js` to consume the new structure.

## Architecture

```
nicholas.yaml (source of truth — you edit this)
    │
    ├──→ render.js reads directly (header, interests, projects, footer)
    │
    ├──→ outputs/site-content.yaml (LLM-generated prose for "About")
    │       └──→ render.js reads this for about section
    │
    └──→ [future] generate.py reads nicholas.yaml + voice.md + positioning.md
            ├──→ outputs/site-content.yaml (regenerated)
            ├──→ outputs/resume.pdf
            └──→ outputs/linkedin-draft.md

voice.md + positioning.md remain separate as style guides (not data)
```

## `nicholas.yaml` Structure

Top-level keys, in order:

```yaml
# nicholas.yaml — Single source of truth for all artifacts
# ┌─────────────────────────────────────────────────────┐
# │ DOWNSTREAM CONSUMERS:                                │
# │   render.js  → website (header, interests, projects) │
# │   generate.py → about prose, resume PDF, bios        │
# │   voice.md + positioning.md guide all LLM generation │
# └─────────────────────────────────────────────────────┘

name: Nicholas C. Park
location: New York City Metropolitan Area

languages:
  - language: English
    proficiency: Native
  - language: Korean
    proficiency: Native

links:
  github: https://github.com/nicholascpark
  linkedin: https://www.linkedin.com/in/nicholas-c-park/
  email: nickpark1209@gmail.com

ventures:
  - name: Zealot Analytics
    role: Founder
    type: LLC
    focus: AI consulting and hands-on engineering
    url: ""
    status: active

# --- Structured points for LLM prose generation ---
# NOT rendered directly. generate.py reads these alongside
# voice.md and positioning.md to produce about prose.
about:
  themes:
    - building intelligent systems and understanding how they learn
    - intersection of software engineering, RL, and multi-agent AI
    - subtraction as a lens for cognition
  through_line: "rigorous thinking and practical building are the same pursuit"
  background_facts:
    - 9+ years building production systems
    - graduate research at Georgia Tech
    - trajectory from actuarial to ML to RL to AI agents

education:
  - institution: Georgia Institute of Technology
    degree: Master's
    years: 2020-2022
    gpa: "4.00/4.00"
    coursework:
      - Reinforcement Learning
      - Deep Learning
      - Machine Learning
      - Artificial Intelligence
      - Data Analytics
  - institution: ""  # TODO: undergraduate institution
    degree: ""
    years: "–2013"
    notes: "Alpha Delta Phi — Founding Father, Scarlet Chapter"

experience:
  - company: Consumer Edge
    role: ""  # TODO: exact title
    years: present
    description: ""
    technologies: []
  # TODO: prior roles (9+ years total)

certifications:
  - name: AI Agents in LangGraph
    issuer: DeepLearning.AI
    date: 2024-12
  - name: Reinforcement Learning From Human Feedback
    issuer: DeepLearning.AI
    date: 2024-12
  - name: D3.js for Data Visualization
    issuer: Udemy
    date: 2022-09
  - name: MAS-I
    issuer: Casualty Actuarial Society
    date: 2019-10
  - name: Exam IFM
    issuer: Society of Actuaries
    date: 2018-11
  - name: Exam FM
    issuer: Society of Actuaries
    date: 2018-07
  - name: Exam P
    issuer: Society of Actuaries
    date: 2018-06

# --- Rendered directly by render.js ---
interests:
  - name: AI Agents & Multi-Agent Systems
    depth: primary
    description: >
      Building and reasoning about autonomous agents — from single-agent RL
      to multi-agent coordination. Practical agent engineering (LangGraph,
      tool-use architectures) alongside theoretical foundations.
    projects:
      - claire-v0
      - claire-v1
      - Claims-Handler-Agent-v1

  - name: Reinforcement Learning
    depth: primary
    description: >
      Deep RL methods applied to complex environments. MADDPG in multi-agent
      settings, DDQN for control problems, SARSA for tabular methods.
      Interest spans from practical implementation to theoretical guarantees.
    projects:
      - MADDPGGoogleFootball
      - LunarLanderDDQN
      - SARSA-Frozen-Lake

  - name: Human Cognition & Metacognition
    depth: growing
    description: >
      How humans think about thinking. The via-negativa project explores
      negative perception as a metacognitive skill — applying subtraction
      to thought itself. Where AI meets cognitive science.
    projects:
      - via-negativa-free-form-stress

  - name: Category Theory & Mathematical Foundations
    depth: exploratory
    description: >
      Abstract mathematical structures as a lens for understanding
      computation, learning, and cognition. Compositional thinking
      applied beyond pure mathematics.
    projects: []

  - name: Natural Language Processing
    depth: foundation
    description: >
      Transformer architectures, sequence-to-sequence models, adversarial
      robustness in NLI. A foundation that informs current agent work.
    projects:
      - Transformers-and-Seq2Seq
      - adversarially-filter-ANLI-aflite

# --- Rendered directly by render.js ---
projects:
  featured:
    - name: Via Negativa
      repo: via-negativa-free-form-stress
      url: https://github.com/nicholascpark/via-negativa-free-form-stress
      tagline: A metacognitive skill applying negative perception to thinking itself
      category: cognition
      why_featured: >
        Demonstrates the philosophical/cognitive dimension — not just an engineer,
        but someone who thinks about the nature of thought.

    - name: MADDPG Google Football
      repo: MADDPGGoogleFootball
      url: https://github.com/nicholascpark/MADDPGGoogleFootball
      tagline: Multi-agent deep reinforcement learning in competitive environments
      category: reinforcement-learning
      why_featured: >
        Multi-agent RL is central to the positioning. Shows research depth
        and ability to work on complex coordination problems.

    - name: Adversarial NLI Filtering
      repo: adversarially-filter-ANLI-aflite
      url: https://github.com/nicholascpark/adversarially-filter-ANLI-aflite
      tagline: Improving accuracy through adversarial dataset filtering
      category: nlp
      why_featured: >
        Shows NLP research depth and adversarial robustness thinking —
        the rigor behind the applied work.

    - name: Claire
      repo: claire-v1
      url: https://github.com/nicholascpark/claire-v1
      tagline: AI agent system
      category: agents
      why_featured: >
        Direct evidence of agent-building practice. The applied side
        of the research interests.

  # Projects intentionally not featured:
  # - AzureBlobStorageTools (utility, doesn't serve narrative)
  # - ClusterVisualizer (minor, older)
  # - Time-Series-Analysis-in-R (actuarial era, de-emphasized per positioning)
```

## `outputs/site-content.yaml`

LLM-generated prose consumed by `render.js` for the About section. Initially populated manually with the current hardcoded text. Regenerated by `generate.py` in a future project.

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

## `render.js` Changes

### Data fetching

```javascript
// Before: 3 fetches from identity/ and content/
const [profile, interests, projects] = await Promise.all([
  fetchYAML('identity/profile.yaml'),
  fetchYAML('content/interests.yaml'),
  fetchYAML('content/projects.yaml'),
]);

// After: 2 fetches — source of truth + generated prose
const [nicholas, siteContent] = await Promise.all([
  fetchYAML('nicholas.yaml'),
  fetchYAML('outputs/site-content.yaml'),
]);
```

### Render calls

Sacred dividers between sections are preserved unchanged. Only the data-dependent calls change:

```javascript
// Before
root.appendChild(wrapGlass(renderHeader(profile), 'glass-card-header'));
root.appendChild(createSacredDivider());
root.appendChild(wrapGlass(renderAbout()));
root.appendChild(createSacredDivider());
root.appendChild(wrapGlass(renderInterests(interests)));
root.appendChild(createSacredDivider());
root.appendChild(wrapGlass(renderProjects(projects)));
root.appendChild(renderFooter(profile));

// After
root.appendChild(wrapGlass(renderHeader(nicholas), 'glass-card-header'));
root.appendChild(createSacredDivider());
root.appendChild(wrapGlass(renderAbout(siteContent)));
root.appendChild(createSacredDivider());
root.appendChild(wrapGlass(renderInterests(nicholas)));
root.appendChild(createSacredDivider());
root.appendChild(wrapGlass(renderProjects(nicholas)));
root.appendChild(renderFooter(nicholas));
```

### `renderAbout()` update

```javascript
// Before: hardcoded prose
function renderAbout() {
  // ... two hardcoded paragraphs
}

// After: reads from site-content.yaml
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

### `renderInterests()` update

```javascript
// Before: data.interests
data.interests.forEach(...)

// After: nicholas.interests (same shape, just different variable name)
nicholas.interests.forEach(...)
```

### `renderProjects()` update

```javascript
// Before: data.featured
data.featured.forEach(...)

// After: nicholas.projects.featured
nicholas.projects.featured.forEach(...)
```

## Files Changed

| Action | Path | Reason |
|--------|------|--------|
| **Create** | `nicholas.yaml` | Consolidated source of truth |
| **Create** | `outputs/site-content.yaml` | Generated prose for about section |
| **Update** | `site/js/render.js` | Consume new file structure |
| **Delete** | `identity/profile.yaml` | Absorbed into nicholas.yaml |
| **Delete** | `content/resume.yaml` | Absorbed into nicholas.yaml |
| **Delete** | `content/projects.yaml` | Absorbed into nicholas.yaml |
| **Delete** | `content/interests.yaml` | Absorbed into nicholas.yaml |
| **Keep** | `identity/voice.md` | Style guide, not data |
| **Keep** | `identity/positioning.md` | Style guide, not data |
| **Delete** | `outputs/.gitkeep` | No longer needed once `outputs/site-content.yaml` exists |
| **Delete** | `content/` directory | Empty after YAML files removed; no `.gitkeep` needed |

## Deduplication Notes

Both `profile.yaml` and `resume.yaml` contain `ventures` and `languages`. The consolidated file uses:
- **`ventures`**: `profile.yaml` format (includes `url` and `status` fields) — the richer version
- **`languages`**: `profile.yaml` format (`{language, proficiency}` objects) — structured over flat strings
- Empty fields like `notes: ""` on education entries are dropped unless they contain data

## Error Handling

If `outputs/site-content.yaml` is missing or malformed, the site fails the same way it would today if any YAML file were missing — the catch block shows "Failed to load." This is acceptable: the file is committed to the repo and served statically. It won't disappear in production.

## Files NOT Changed

- `index.html` — no changes needed
- `site/css/style.css` — no changes
- `site/js/scene.js` — no changes
- `site/js/breathe.js` — no changes
- `schemas/` — will need updating in a future pass to match new structure (becomes stale immediately)

**Note:** The `render.js` file header comment ("reads YAML data from identity/ and content/") should be updated to reference the new paths.

## Out of Scope

- `generate.py` / LLM prose generation pipeline (next project)
- Resume PDF generation (low priority)
- LinkedIn agent (future)
- Schema updates (follow-up)
- Filling in TODO data (Nicholas provides when ready)

## CLAUDE.md Update

Update the Architecture section to reflect the new structure:

```
nicholas.yaml    → Single source of truth (identity + content)
identity/        → Style guides (voice, positioning) for generation
outputs/         → Generated artifacts (site prose, future: PDFs, bios)
site/            → Website rendering layer
schemas/         → Structural contracts (to be updated)
```

Update Agent Boundaries:
- **Safe to change without asking:** `nicholas.yaml` (adding/updating entries), `outputs/`
