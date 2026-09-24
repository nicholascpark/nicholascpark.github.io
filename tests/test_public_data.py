import unittest

from scripts.check_public_data import private_tracked_paths, validate_public_profile


class PublicDataTests(unittest.TestCase):
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
