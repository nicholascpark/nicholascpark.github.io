"""Resume builder: nicholas.yaml → Jinja2 → LaTeX → PDF."""

import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

import jinja2

ROOT = Path(__file__).resolve().parent.parent

# LaTeX special characters to escape in YAML data values.
# Note: backslash (\) is NOT escaped; YAML values should not contain raw
# backslashes. '_', '{', '}' are also excluded; they appear in LaTeX commands
# and technology names without issue. Handle case-by-case if needed.
LATEX_SPECIAL = {
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}


def latex_escape(text: str) -> str:
    """Escape LaTeX special characters in a string."""
    if not isinstance(text, str):
        return str(text)
    for char, replacement in LATEX_SPECIAL.items():
        text = text.replace(char, replacement)
    return text


def latex_inline(text: str) -> str:
    """Render paired **bold** spans, escaping all input as literal LaTeX text."""
    replacements = {
        **LATEX_SPECIAL,
        "\\": r"\textbackslash{}",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
    }
    # Captured spans alternate with literal text. Unmatched markers stay literal.
    parts = re.split(r"\*\*(.+?)\*\*", str(text), flags=re.DOTALL)
    rendered = []
    for index, part in enumerate(parts):
        escaped = "".join(replacements.get(char, char) for char in part)
        rendered.append(r"\textbf{" + escaped + "}" if index % 2 else escaped)
    return "".join(rendered)


def format_phone(phone: str) -> str:
    """Format phone for resume header: (202) 555-0100 → (+1) (202) 555 - 0100."""
    m = re.match(r"\((\d{3})\)\s*(\d{3})-(\d{4})", phone)
    if m:
        return f"(+1) ({m.group(1)}) {m.group(2)} - {m.group(3)}"
    return phone


def get_jinja_env() -> jinja2.Environment:
    """Create Jinja2 environment with LaTeX-safe delimiters."""
    env = jinja2.Environment(
        block_start_string=r"\BLOCK{",
        block_end_string="}",
        variable_start_string=r"\VAR{",
        variable_end_string="}",
        comment_start_string=r"\#{",
        comment_end_string="}",
        loader=jinja2.FileSystemLoader(ROOT / "templates"),
        keep_trailing_newline=True,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.filters["latex_escape"] = latex_escape
    env.filters["latex_inline"] = latex_inline
    env.filters["format_phone"] = format_phone
    return env


def build_resume(nicholas: dict, dry_run: bool = False) -> tuple[str, str]:
    """Generate resume.tex and compile to PDF.

    Returns (output_path, status_message).
    """
    outputs_dir = ROOT / "outputs"
    os.makedirs(outputs_dir, exist_ok=True)

    # 1. Render template
    env = get_jinja_env()
    template = env.get_template("resume.tex.j2")
    tex_content = template.render(data=nicholas)

    # 2. Write .tex
    tex_path = outputs_dir / "resume.tex"
    tex_path.write_text(tex_content)

    if dry_run:
        return "outputs/resume.tex", f"[dry-run] Wrote {tex_path}"

    # 3. Check pdflatex before creating a compilation directory.
    if not shutil.which("pdflatex"):
        raise RuntimeError(
            "pdflatex not found. Install with: brew install basictex\n"
            'Then reload shell: eval "$(/usr/libexec/path_helper)"'
        )

    # 4. Compile in isolation so failures cannot overwrite the last good PDF.
    # Keep failed builds and their logs available for diagnosis.
    build_dir = Path(tempfile.mkdtemp(prefix=".resume-build-", dir=outputs_dir))
    shutil.copy2(tex_path, build_dir / "resume.tex")
    shutil.copy2(ROOT / "latex" / "TLCresume.sty", build_dir / "TLCresume.sty")
    for pass_num in (1, 2):
        console_path = build_dir / f"pdflatex-pass-{pass_num}.txt"
        try:
            result = subprocess.run(
                ["pdflatex", "-interaction=nonstopmode", "-halt-on-error", "resume.tex"],
                cwd=build_dir,
                capture_output=True,
                text=True,
                timeout=60,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            console_path.write_text(str(exc))
            raise RuntimeError(
                f"pdflatex pass {pass_num} could not complete (see {build_dir})"
            ) from exc
        console_path.write_text(result.stdout + result.stderr)
        if result.returncode != 0:
            raise RuntimeError(
                f"pdflatex pass {pass_num} failed (see {build_dir}):\n"
                + (result.stdout + result.stderr)[-500:]
            )

    pdf_path = build_dir / "resume.pdf"
    if not pdf_path.is_file():
        raise RuntimeError(f"pdflatex produced no PDF (see {build_dir})")

    # 5. Publish only a successful two-pass build, then discard its scratch files.
    os.replace(pdf_path, outputs_dir / "resume.pdf")
    shutil.rmtree(build_dir)

    return "outputs/resume.pdf", "Resume PDF generated"


def run_resume_build(nicholas: dict, dry_run: bool = False) -> tuple[str, str]:
    """Entry point matching the template-type calling convention."""
    return build_resume(nicholas, dry_run=dry_run)
