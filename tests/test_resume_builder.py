"""Regression checks for publishing only successful resume compilations."""

import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import resume_builder


class LatexInlineTests(unittest.TestCase):
    def test_plain_text_keeps_existing_escaping(self):
        for value in ("Plain sentence.", "R&D improved 5% for $2 #1 ~ ^", "", 42):
            with self.subTest(value=value):
                self.assertEqual(resume_builder.latex_inline(value),
                                 resume_builder.latex_escape(value))

    def test_multiple_bold_spans(self):
        self.assertEqual(
            resume_builder.latex_inline("**Evaluation:** measured **error** on held-out data."),
            r"\textbf{Evaluation:} measured \textbf{error} on held-out data.",
        )

    def test_special_characters_are_escaped_inside_and_outside_bold(self):
        literal = r"\input{file_name} & 5% $2 #1 ~ ^"
        escaped = (r"\textbackslash{}input\{file\_name\} \& 5\% \$2 \#1 "
                   r"\textasciitilde{} \textasciicircum{}")
        self.assertEqual(resume_builder.latex_inline(literal + " **" + literal + "**"),
                         escaped + r" \textbf{" + escaped + "}")

    def test_unmatched_markers_stay_literal(self):
        for value in ("**unfinished & 5%", "unfinished**", "****"):
            with self.subTest(value=value):
                self.assertEqual(resume_builder.latex_inline(value),
                                 resume_builder.latex_escape(value))
        self.assertEqual(resume_builder.latex_inline("**Complete** and **unfinished"),
                         r"\textbf{Complete} and **unfinished")

    def test_other_markup_is_literal(self):
        value = "<b>literal HTML</b> and *single stars*"
        self.assertEqual(resume_builder.latex_inline(value), value)


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

    def test_inline_emphasis_is_limited_to_bullets_and_research_descriptions(self):
        data = {
            "name": "Example Candidate", "phone": "(202) 555-0100",
            "location": "Example City", "citizenship": "Example citizenship",
            "resume_title": "Example title",
            "links": {"email": "example@example.com",
                      "github": "https://github.com/example",
                      "linkedin": "https://www.linkedin.com/in/example/"},
            "about": {"objective": "**Literal objective**"},
            "education": [], "skills": {}, "actuarial_exams": [],
            "experience": [{
                "company": "Example Organization", "role": "Example Role",
                "industry": "Example Industry", "years": "2020 - 2021",
                "projects": [{
                    "name": "**Literal project name**", "technologies": [],
                    "highlights": ["**Evaluation:** reduced error & cost.",
                                   "Plain highlight stays unchanged."],
                }],
            }],
            "research": [
                {"name": "Example Study", "technologies": [], "period": "2020",
                 "description": "**Method:** compared model_a & model_b.",
                 "status": status}
                for status in ("", "In progress")
            ],
        }
        tex = resume_builder.get_jinja_env().get_template("resume.tex.j2").render(data=data)
        self.assertIn(r"\item \textbf{Evaluation:} reduced error \& cost.", tex)
        self.assertIn(r"\item Plain highlight stays unchanged.", tex)
        self.assertEqual(tex.count(r"\textbf{Method:} compared model\_a \& model\_b."), 2)
        self.assertIn("**Literal objective**", tex)
        self.assertIn("**Literal project name**", tex)


    def test_section_order_and_visibility_come_from_yaml(self):
        data = {
            "name": "Example Candidate", "phone": "(202) 555-0100",
            "location": "Example City", "citizenship": "Example citizenship",
            "resume_title": "Example title",
            "links": {"email": "example@example.com",
                      "github": "https://github.com/example",
                      "linkedin": "https://www.linkedin.com/in/example/"},
            "about": {"objective": "Profile marker"},
            "education": [{"degree": "Example Degree", "institution": "Example School",
                           "years": "2020", "gpa": "", "coursework": []}],
            "experience": [
                {"company": f"Organization {i}", "role": "Example Role",
                 "industry": "Example Industry", "years": "2020 - 2021",
                 "projects": [{"name": f"Project {i}", "technologies": [],
                               "highlights": [f"Work marker {i}"]}]}
                for i in range(2)
            ],
            "skills": {"Example Skills": ["Skill marker"]},
            "research": [{"name": "Example Study", "technologies": [], "period": "2020",
                          "description": "Research marker", "status": ""}],
            "actuarial_exams": [{"name": "Example Exam", "note": "Exam note"}],
            "resume_sections": {"work": "Work", "research": "Research", "exams": "Exams"},
        }
        template = resume_builder.get_jinja_env().get_template("resume.tex.j2")

        def headings(tex):
            return [line for line in tex.splitlines() if line.startswith(r"\section{")]

        default_tex = template.render(data=data)
        self.assertEqual(headings(default_tex), [
            r"\section{Education}", r"\section{Work}", r"\section{Skills}",
            r"\section{Research}", r"\section{Exams}",
        ])
        self.assertIn("Example Exam (Exam note)", default_tex)

        data["resume_section_order"] = ["skills", "work", "education", "research"]
        tex = template.render(data=data)
        self.assertEqual(headings(tex), [
            r"\section{Skills}", r"\section{Work}", r"\section{Education}",
            r"\section{Research}",
        ])
        markers = ["Profile marker", "Skill marker", "Work marker 0", "Work marker 1",
                   "Example Degree", "Research marker"]
        positions = [tex.index(marker) for marker in markers]
        self.assertEqual(positions, sorted(positions))
        self.assertNotIn("Example Exam", tex)
        self.assertEqual(data["actuarial_exams"],
                         [{"name": "Example Exam", "note": "Exam note"}])

        data["resume_section_order"] = []
        tex = template.render(data=data)
        self.assertEqual(headings(tex), [])
        self.assertIn("Profile marker", tex)
        self.assertIn(r"\def\name{Example Candidate}", tex)


if __name__ == "__main__":
    unittest.main()
