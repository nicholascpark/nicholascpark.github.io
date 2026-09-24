"""Regression checks for publishing only successful resume compilations."""

import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import resume_builder


class ResumeBuildTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.root = Path(self.temp_dir.name)
        for directory in ("templates", "latex", "outputs"):
            (self.root / directory).mkdir()
        (self.root / "templates" / "resume.tex.j2").write_text(r"\VAR{data.name}")
        (self.root / "latex" / "TLCresume.sty").write_text("% test style")
        self.pdf_path = self.root / "outputs" / "resume.pdf"
        self.pdf_path.write_bytes(b"previous successful PDF")
        root_patch = patch.object(resume_builder, "ROOT", self.root)
        root_patch.start()
        self.addCleanup(root_patch.stop)
        compiler_patch = patch.object(resume_builder.shutil, "which", return_value="pdflatex")
        compiler_patch.start()
        self.addCleanup(compiler_patch.stop)

    def test_failed_pass_preserves_existing_pdf_and_diagnostics(self):
        for failing_pass in (1, 2):
            with self.subTest(failing_pass=failing_pass):
                calls = []

                def compile_pass(command, *, cwd, **kwargs):
                    calls.append(cwd)
                    self.assertIn("-halt-on-error", command)
                    self.assertNotEqual(cwd, self.pdf_path.parent)
                    self.assertEqual(self.pdf_path.read_bytes(), b"previous successful PDF")
                    # LaTeX may leave a partial PDF even on a failed invocation.
                    (cwd / "resume.pdf").write_bytes(b"partial PDF")
                    (cwd / "resume.log").write_text("compiler diagnostics")
                    code = 1 if len(calls) == failing_pass else 0
                    return subprocess.CompletedProcess(command, code, "stdout details", "stderr details")

                with patch.object(resume_builder.subprocess, "run", side_effect=compile_pass):
                    with self.assertRaisesRegex(RuntimeError, f"pass {failing_pass} failed") as error:
                        resume_builder.build_resume({"name": "Test Resume"})
                self.assertEqual(len(calls), failing_pass)
                self.assertEqual(self.pdf_path.read_bytes(), b"previous successful PDF")
                self.assertIn(str(calls[-1]), str(error.exception))
                self.assertEqual((calls[-1] / "resume.log").read_text(), "compiler diagnostics")
                self.assertEqual(
                    (calls[-1] / f"pdflatex-pass-{failing_pass}.txt").read_text(),
                    "stdout detailsstderr details",
                )

    def test_success_publishes_second_pass_and_removes_scratch_files(self):
        calls = []

        def compile_pass(command, *, cwd, **kwargs):
            calls.append(cwd)
            self.assertEqual(self.pdf_path.read_bytes(), b"previous successful PDF")
            self.assertEqual((cwd / "resume.tex").read_text(), "Test Resume")
            self.assertTrue((cwd / "TLCresume.sty").is_file())
            (cwd / "resume.pdf").write_bytes(f"PDF pass {len(calls)}".encode())
            return subprocess.CompletedProcess(command, 0, "compiled", "")

        with patch.object(resume_builder.subprocess, "run", side_effect=compile_pass):
            result = resume_builder.build_resume({"name": "Test Resume"})
        self.assertEqual(result, ("outputs/resume.pdf", "Resume PDF generated"))
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0], calls[1])
        self.assertEqual(self.pdf_path.read_bytes(), b"PDF pass 2")
        self.assertFalse(calls[0].exists())
        self.assertEqual((self.pdf_path.parent / "resume.tex").read_text(), "Test Resume")

    def test_zero_exit_without_output_cannot_accept_existing_pdf(self):
        with patch.object(
            resume_builder.subprocess,
            "run",
            return_value=subprocess.CompletedProcess("pdflatex", 0, "", ""),
        ):
            with self.assertRaisesRegex(RuntimeError, "produced no PDF"):
                resume_builder.build_resume({"name": "Test Resume"})
        self.assertEqual(self.pdf_path.read_bytes(), b"previous successful PDF")


class ResumeStructureTests(unittest.TestCase):
    def test_work_history_is_continuous_and_skill_labels_come_from_yaml(self):
        data = {
            "name": "Example Candidate", "phone": "(202) 555-0100",
            "location": "New York", "citizenship": "U.S. Citizen",
            "resume_title": "Data Scientist",
            "links": {"email": "example@example.com", "github": "https://github.com/example",
                      "linkedin": "https://www.linkedin.com/in/example/"},
            "about": {"objective": "Example profile"}, "education": [],
            "experience": [
                {"company": f"Organization {i}", "role": "Data Scientist",
                 "industry": "Analytics", "years": "2020 - 2021",
                 "projects": [{"name": f"Project {i}", "technologies": ["Python"],
                               "highlights": [f"Evidence marker {i}"]}]}
                for i in range(5)
            ],
            "skills": {"Methods & Measurement": ["Custom evaluation method"]},
            "research": [], "actuarial_exams": [],
        }
        tex = resume_builder.get_jinja_env().get_template("resume.tex.j2").render(data=data)
        positions = [tex.index(f"Evidence marker {i}") for i in range(5)]
        positions += [tex.index(r"\section{Skills}"),
                      tex.index(r"\section{Advanced Machine Learning Research}")]
        self.assertEqual(positions, sorted(positions))
        self.assertEqual(tex.count(r"\section{Work Experience"), 1)
        self.assertIn(r"Methods \& Measurement", tex)
        self.assertIn("Custom evaluation method", tex)


if __name__ == "__main__":
    unittest.main()
