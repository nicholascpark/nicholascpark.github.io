#!/usr/bin/env python3
"""Generate artifacts from nicholas.yaml.

Usage:
    python generate.py                          # LLM artifacts only (default)
    python generate.py --only resume            # generate resume PDF
    python generate.py --only linkedin-about    # generate LinkedIn About via LLM
    python generate.py --only linkedin-sync     # sync LinkedIn profile via Playwright
    python generate.py --all                    # everything: LLM + resume + linkedin
    python generate.py --dry-run                # preview without executing
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).parent

MODELS = {
    "anthropic": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
    "openai": os.environ.get("OPENAI_MODEL", "gpt-4o"),
}


def detect_provider():
    """Auto-detect the best available provider.

    Priority: claude-code CLI (Max subscription) → anthropic API → error.
    """
    if shutil.which("claude"):
        return "claude-code"
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "anthropic"
    if os.environ.get("OPENAI_API_KEY"):
        return "openai"
    print(
        "Error: no LLM provider available.\n"
        "  - Install Claude Code CLI (uses Max subscription): https://docs.anthropic.com/en/docs/claude-code\n"
        "  - Or set ANTHROPIC_API_KEY for API access\n"
        "  - Or set OPENAI_API_KEY for OpenAI fallback",
        file=sys.stderr,
    )
    sys.exit(1)

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
    if provider == "claude-code":
        # Uses Claude Code CLI — powered by Max subscription, no API key needed
        def call(system, user):
            prompt = f"{system}\n\n---\n\n{user}"
            result = subprocess.run(
                ["claude", "-p", prompt],
                capture_output=True,
                text=True,
                timeout=120,
            )
            if result.returncode != 0:
                raise RuntimeError(f"claude CLI failed: {result.stderr.strip()}")
            return result.stdout
        return call
    elif provider == "anthropic":
        from anthropic import Anthropic

        model = MODELS["anthropic"]
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

        model = MODELS["openai"]
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


def generate_linkedin_about(nicholas, voice, positioning, call_llm):
    """Generate LinkedIn About section draft."""
    instruction = (
        "Write a LinkedIn About section. First person. 3-4 short paragraphs. "
        "No hashtags, no emoji, no markdown formatting. "
        "Optimize for the 'business audience' guidance in the positioning strategy. "
        "Professional but not corporate. Mention the consulting practice (Zealot Analytics) naturally."
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
        return "outputs/linkedin-about.md", "[dry-run placeholder]"

    result = call_llm(system, user)
    header = "<!-- Draft generated from nicholas.yaml — review before posting -->\n\n"
    return "outputs/linkedin-about.md", header + result.strip() + "\n"


# --- Registry ---

from scripts.resume_builder import run_resume_build
from scripts.linkedin_sync import run_linkedin_sync, check_selectors as check_linkedin_selectors

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


# --- Main ---


def main():
    parser = argparse.ArgumentParser(
        description="Generate text artifacts from nicholas.yaml"
    )
    parser.add_argument(
        "--only", help="Comma-separated artifact names to generate"
    )
    parser.add_argument(
        "--provider",
        help="LLM provider: claude-code (default, uses Max subscription), anthropic, or openai",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print prompts without calling LLM",
    )
    parser.add_argument("--all", action="store_true", help="Run all artifacts including resume and linkedin-sync")
    parser.add_argument("--check-selectors", action="store_true", help="Validate LinkedIn DOM selectors without modifying anything")
    args = parser.parse_args()

    if args.check_selectors:
        nicholas, _, _ = load_sources()
        success = check_linkedin_selectors(nicholas)
        sys.exit(0 if success else 1)

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

    # load_sources() stays unconditional (nicholas is needed by all artifacts)
    nicholas, voice, positioning = load_sources()

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
        call_llm = None  # Not needed for template/action artifacts

    os.makedirs(ROOT / "outputs", exist_ok=True)
    failed = []

    for name, entry in targets.items():
        try:
            # Dependency check for linkedin-sync
            if name == "linkedin-sync":
                about_path = ROOT / "outputs" / "linkedin-about.md"
                if not about_path.exists() or about_path.stat().st_size == 0:
                    raise FileNotFoundError(
                        "outputs/linkedin-about.md not found or empty. "
                        "Run: python generate.py --only linkedin-about"
                    )
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

    if failed:
        print(f"\nFailed artifacts: {', '.join(failed)}", file=sys.stderr)
        sys.exit(1)
    else:
        print(f"\nDone. Generated {len(targets)} artifact(s).")


if __name__ == "__main__":
    main()
