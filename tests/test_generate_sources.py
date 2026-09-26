import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import generate


class PrivateSourceTests(unittest.TestCase):
    def test_missing_private_strategy_does_not_block_local_generation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "nicholas.yaml").write_text("name: Example Candidate\n")
            (root / "identity").mkdir()
            (root / "identity" / "voice.md").write_text("Use clear language.")
            with patch.object(generate, "ROOT", root):
                profile, voice, positioning = generate.load_sources()
            self.assertEqual(profile, {"name": "Example Candidate"})
            self.assertEqual(voice, "Use clear language.")
            self.assertEqual(positioning, "")


if __name__ == "__main__":
    unittest.main()
