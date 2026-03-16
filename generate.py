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
