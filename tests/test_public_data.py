import unittest

from scripts.check_public_data import (
    inspect_public_text, private_tracked_paths, validate_public_profile,
)


class PublicDataTests(unittest.TestCase):
    def test_old_source_paths_and_profile_copy_notes_are_private(self):
        paths = [
            "identity/profile.yaml", "identity/positioning.md", "content/resume.yaml",
            "content/projects.yaml", "content/interests.yaml",
            "docs/superpowers/specs/2026-03-15-nicholas-yaml-consolidation-design.md",
            "docs/superpowers/plans/2026-03-16-nicholas-yaml-consolidation.md",
        ]
        self.assertEqual(private_tracked_paths(paths), paths)

    def test_renamed_markdown_copy_of_profile_is_rejected(self):
        copied_note = "# Design example\n```yaml\neducation:\n  - institution: Example College\n```\n"
        errors = inspect_public_text(copied_note, "docs/ordinary-design.md")
        self.assertTrue(any("copied profile fields" in error for error in errors))

    def test_phone_scan_allows_fictional_examples_and_does_not_echo_numbers(self):
        # Assemble the disallowed fixture so it cannot itself be mistaken for public prose.
        phone = "(202) " + "234" + "-" + "5678"
        errors = inspect_public_text(phone, "notes.md")
        self.assertEqual(len(errors), 1)
        self.assertNotIn(phone, errors[0])
        self.assertEqual(inspect_public_text("(202) 555-0100", "example.py"), [])
        self.assertEqual(inspect_public_text("(+1) (202) 555 - 0100", "example.py"), [])

    def test_private_artifacts_are_rejected_but_generic_renderer_sources_are_allowed(self):
        paths = [
            "nicholas.yaml", "outputs/resume.pdf", "outputs/nested/draft.md",
            ".claude/memory.md", "scripts/__pycache__/render.pyc", "resume.tex",
            "outputs/.gitkeep", "templates/resume.tex.j2", "scripts/resume_builder.py",
            "schemas/resume.schema.yaml", "site/profile.json",
        ]
        self.assertEqual(private_tracked_paths(paths), paths[:6])

    def test_nested_private_fields_are_rejected(self):
        profile = {
            "experience": [],
            "links": {"email": "hello@example.com", "phone": "555-1234"},
            "projects": {"featured": [{"name": "Demo", "years": "2025-present"}]},
            "interests": [{"name": "Learning", "depth": "strategy"}],
        }
        errors = validate_public_profile(profile)
        self.assertEqual(len(errors), 4)
        for key in ("experience", "phone", "years", "depth"):
            self.assertTrue(any(key in error for error in errors))

    def test_expected_public_fields_pass_and_wrong_shapes_fail(self):
        profile = {
            "name": "Example", "tagline": "Research", "description": "Public work",
            "links": {"github": "https://example.com", "linkedin": "", "email": ""},
            "ventures": [], "interests": [{"name": "Learning", "description": "Feedback"}],
            "projects": {"featured": [{"name": "Demo", "url": "https://example.com", "tagline": "Play"}]},
            "about": ["Public writing."],
        }
        self.assertEqual(validate_public_profile(profile), [])
        self.assertTrue(validate_public_profile({"about": "Wrong shape"}))


if __name__ == "__main__":
    unittest.main()
