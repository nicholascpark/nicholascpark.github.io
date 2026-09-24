#!/usr/bin/env python3
"""Check the Git boundary and explicit public website data shape.

This catches accidental file additions and profile fields. Public prose still
requires human review; this check is not a semantic privacy classifier.
"""

import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_PROFILE = "site/profile.json"
PUBLIC_SCHEMA = {
    "name": str,
    "tagline": str,
    "description": str,
    "links": {"github": str, "linkedin": str, "email": str},
    "ventures": [{"name": str, "url": str}],
    "interests": [{"name": str, "description": str}],
    "projects": {"featured": [{"name": str, "url": str, "tagline": str}]},
    "about": [str],
}


def private_tracked_paths(paths):
    """Return private artifacts/caches that must not appear in Git's index."""
    private = []
    for name in paths:
        path = Path(name)
        if (
            path.name == "nicholas.yaml"
            or (name.startswith("outputs/") and name != "outputs/.gitkeep")
            or (name.startswith("docs/superpowers/") and "resume" in path.name and path.suffix == ".md")
            or (name.startswith("latex/") and path.suffix in {".tex", ".pdf", ".aux", ".log", ".out", ".fls", ".fdb_latexmk"})
            or ".claude" in path.parts
            or "__pycache__" in path.parts
            or any(part.startswith(".resume-build-") for part in path.parts)
            or (path.stem == "resume" and path.suffix in {".pdf", ".tex", ".docx"})
        ):
            private.append(name)
    return private


def validate_public_profile(data, schema=PUBLIC_SCHEMA, location="profile"):
    """Reject unexpected fields recursively, including private profile sections."""
    errors = []
    if isinstance(schema, dict):
        if not isinstance(data, dict):
            return [f"{location} must be an object"]
        for key, value in data.items():
            if key not in schema:
                errors.append(f"{location}.{key} is not an allowed public field")
            else:
                errors.extend(validate_public_profile(value, schema[key], f"{location}.{key}"))
    elif isinstance(schema, list):
        if not isinstance(data, list):
            return [f"{location} must be an array"]
        for index, value in enumerate(data):
            errors.extend(validate_public_profile(value, schema[0], f"{location}[{index}]"))
    elif not isinstance(data, schema):
        errors.append(f"{location} must be a {schema.__name__}")
    return errors


def inspect_json(text, label):
    try:
        data = json.loads(text)
    except json.JSONDecodeError as error:
        return [f"{label}: invalid JSON ({error})"]
    return [f"{label}: {error}" for error in validate_public_profile(data)]


def main():
    tracked = subprocess.check_output(
        ["git", "ls-files", "-z"], cwd=ROOT, text=True
    ).split("\0")
    errors = [
        f"Private file is tracked: {name}. Remove it from the index while keeping the local copy."
        for name in private_tracked_paths(filter(None, tracked))
    ]
    profile_path = ROOT / PUBLIC_PROFILE
    if not profile_path.is_file():
        errors.append(f"Public website data is missing: {PUBLIC_PROFILE}")
    else:
        errors.extend(inspect_json(profile_path.read_text(), PUBLIC_PROFILE))
    # Check the staged version too, so a safe working copy cannot hide a bad index.
    if PUBLIC_PROFILE in tracked:
        staged = subprocess.check_output(
            ["git", "show", f":{PUBLIC_PROFILE}"], cwd=ROOT, text=True
        )
        errors.extend(inspect_json(staged, f"staged {PUBLIC_PROFILE}"))
    if errors:
        print("Public repository check failed:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
        return 1
    print("Public repository boundary passed. Review public prose before publishing.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
