---
name: Website architecture — command center design
description: This repo is a personal identity infrastructure, not just a website. Data-driven YAML content, JS rendering, zero build step. Designed for agentic maintenance.
type: project
---

The repo is Nicholas's "command center" for self-expression. Architecture: identity/ (profile, voice, positioning) + content/ (resume, projects, interests) in YAML -> site/ (HTML/CSS/JS) renders from data at runtime. Zero build step. GitHub Pages serves from root.

**Why:** Nicholas wants to agentically maintain this through conversations with Claude. The interface of "talking to Claude" is the primary editing mechanism. Content must be structured so agents can read/edit data files without touching HTML.

**How to apply:** Always read CLAUDE.md first. Content changes go to YAML files. Voice/positioning docs are the style guide for any generated text. Zealot Analytics is subtly integrated, not a separate section.
