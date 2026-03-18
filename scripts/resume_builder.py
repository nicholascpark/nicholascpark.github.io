"""Resume builder: nicholas.yaml → Jinja2 → LaTeX → PDF."""

import os
import re
import shutil
import subprocess
from pathlib import Path

import jinja2

ROOT = Path(__file__).resolve().parent.parent

# LaTeX special characters to escape in YAML data values.
# Note: backslash (\) is NOT escaped — YAML values should not contain raw
# backslashes. '_', '{', '}' are also excluded — they appear in LaTeX commands
# and technology names without issue. Handle case-by-case if needed.
LATEX_SPECIAL = {
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}

# Companies after which to insert \pagebreak
PAGE_BREAK_AFTER = ["ClearOne Advantage"]


def latex_escape(text: str) -> str:
    """Escape LaTeX special characters in a string."""
    if not isinstance(text, str):
        return str(text)
    for char, replacement in LATEX_SPECIAL.items():
        text = text.replace(char, replacement)
    return text


def format_phone(phone: str) -> str:
    """Format phone for resume header: (201) 708-5900 → (+1) (201) 708 - 5900."""
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
    tex_content = template.render(
        data=nicholas,
        page_break_after=PAGE_BREAK_AFTER,
    )

    # 2. Write .tex
    tex_path = outputs_dir / "resume.tex"
    tex_path.write_text(tex_content)

    if dry_run:
        return "outputs/resume.tex", f"[dry-run] Wrote {tex_path}"

    # 3. Copy TLCresume.sty
    sty_src = ROOT / "latex" / "TLCresume.sty"
    sty_dst = outputs_dir / "TLCresume.sty"
    shutil.copy2(sty_src, sty_dst)

    # 4. Check pdflatex is available
    if not shutil.which("pdflatex"):
        raise RuntimeError(
            "pdflatex not found. Install with: brew install basictex\n"
            'Then reload shell: eval "$(/usr/libexec/path_helper)"'
        )

    # 5. Run pdflatex twice (for references/page numbers)
    for pass_num in (1, 2):
        result = subprocess.run(
            ["pdflatex", "-interaction=nonstopmode", "resume.tex"],
            cwd=outputs_dir,
            capture_output=True,
            text=True,
            timeout=60,
        )
        # pdflatex returns non-zero on warnings too; only fail if no PDF produced
        pdf_path = outputs_dir / "resume.pdf"
        if result.returncode != 0 and not pdf_path.exists():
            log_path = outputs_dir / "resume.log"
            raise RuntimeError(
                f"pdflatex pass {pass_num} failed (see {log_path}):\n"
                + result.stdout[-500:]
            )

    # 6. Clean up aux files
    for ext in (".aux", ".log", ".out", ".fls", ".fdb_latexmk"):
        aux_file = outputs_dir / f"resume{ext}"
        if aux_file.exists():
            aux_file.unlink()

    # Also clean up TLCresume.sty copy
    if sty_dst.exists():
        sty_dst.unlink()

    return "outputs/resume.pdf", "Resume PDF generated"


def run_resume_build(nicholas: dict, dry_run: bool = False) -> tuple[str, str]:
    """Entry point matching the template-type calling convention."""
    return build_resume(nicholas, dry_run=dry_run)
