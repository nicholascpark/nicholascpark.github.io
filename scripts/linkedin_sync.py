"""LinkedIn profile sync via Playwright.

Reads nicholas.yaml and outputs/linkedin-about.md, then updates
LinkedIn profile sections using a persistent browser session.
"""

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# All LinkedIn DOM selectors isolated here for easy maintenance.
# When LinkedIn changes their markup, update ONLY this dict.
SELECTORS = {
    # Profile page
    "profile_url": "https://www.linkedin.com/in/me/",
    "login_redirect_pattern": "linkedin.com/login",

    # About section
    "about_edit_pencil": 'button[aria-label="Edit about"]',
    "about_textarea": 'textarea[id*="about"]',
    "about_save_button": 'button[aria-label="Save"]',

    # Headline (part of intro card)
    "intro_edit_pencil": 'button[aria-label="Edit intro"]',
    "headline_input": 'input[id*="headline"]',
    "intro_save_button": 'button[aria-label="Save"]',

    # Experience section
    "experience_section": 'section:has(#experience)',
    "experience_edit_pencil": 'button[aria-label*="Edit experience"]',

    # Education section
    "education_section": 'section:has(#education)',

    # Skills section
    "skills_section": 'section:has(#skills)',

    # Certifications section
    "certifications_section": 'section:has(#licenses)',
}


class LinkedInSync:
    """Sync nicholas.yaml data to LinkedIn profile via Playwright."""

    def __init__(self, nicholas: dict, dry_run: bool = False):
        self.data = nicholas
        self.dry_run = dry_run
        self.state_dir = ROOT / ".playwright-state"
        self.state_dir.mkdir(exist_ok=True)
        self.session_path = self.state_dir / "linkedin-session.json"
        self.backup_path = self.state_dir / "linkedin-backup.json"
        self.backup_data = {}
        self.browser = None
        self.context = None
        self.page = None

    def ensure_session(self):
        """Load or create authenticated Playwright session.

        First run: opens visible browser for manual login.
        Subsequent runs: reuses saved session in headless mode.
        """
        from playwright.sync_api import sync_playwright

        self.pw = sync_playwright().start()

        if self.session_path.exists():
            # Try headless with saved session
            self.browser = self.pw.chromium.launch(headless=True)
            self.context = self.browser.new_context(
                storage_state=str(self.session_path)
            )
            self.page = self.context.new_page()
            self.page.goto(SELECTORS["profile_url"], wait_until="domcontentloaded")
            self.page.wait_for_timeout(2000)

            # Check if redirected to login
            if SELECTORS["login_redirect_pattern"] in self.page.url:
                print("Session expired. Opening browser for re-login...")
                self.browser.close()
                self._manual_login()
            else:
                print("Session valid. Using headless mode.")
        else:
            self._manual_login()

    def _manual_login(self):
        """Open visible browser for manual login, then save session."""
        self.browser = self.pw.chromium.launch(headless=False)
        self.context = self.browser.new_context()
        self.page = self.context.new_page()
        self.page.goto("https://www.linkedin.com/login")

        print("\n=== Manual login required ===")
        print("Please log in to LinkedIn in the browser window.")
        print("After login, press Enter here to continue...")
        input()

        # Save session state
        self.context.storage_state(path=str(self.session_path))
        print(f"Session saved to {self.session_path}")

        # Navigate to profile
        self.page.goto(SELECTORS["profile_url"], wait_until="domcontentloaded")
        self.page.wait_for_timeout(2000)

    def _backup_section(self, section_name: str, current_value: str):
        """Record current value before overwriting."""
        self.backup_data[section_name] = current_value
        self.backup_path.write_text(
            json.dumps(self.backup_data, indent=2, ensure_ascii=False)
        )

    def _log_diff(self, section: str, current: str, proposed: str):
        """Print diff between current and proposed values."""
        print(f"\n--- {section} (current) ---")
        print(current[:500] if current else "(empty)")
        print(f"\n+++ {section} (proposed) ---")
        print(proposed[:500] if proposed else "(empty)")
        print()

    def sync_about(self):
        """Update About section from outputs/linkedin-about.md."""
        about_path = ROOT / "outputs" / "linkedin-about.md"
        if not about_path.exists():
            raise FileNotFoundError(
                f"{about_path} not found. Run: python generate.py --only linkedin-about"
            )

        proposed = about_path.read_text().strip()
        # Strip HTML comment header if present
        if proposed.startswith("<!--"):
            proposed = proposed.split("-->\n", 1)[-1].strip()

        self.page.goto(SELECTORS["profile_url"], wait_until="domcontentloaded")
        self.page.wait_for_timeout(2000)

        # Read current about
        about_section = self.page.query_selector('[id="about"] ~ div')
        current = about_section.inner_text() if about_section else ""

        self._log_diff("About", current, proposed)

        if self.dry_run:
            return

        self._backup_section("about", current)

        # Click edit, update, save
        self.page.click(SELECTORS["about_edit_pencil"])
        self.page.wait_for_timeout(1000)
        textarea = self.page.wait_for_selector(SELECTORS["about_textarea"])
        textarea.fill(proposed)
        self.page.click(SELECTORS["about_save_button"])
        self.page.wait_for_timeout(2000)
        print("  About section updated.")

    def sync_headline(self):
        """Update headline from experience + ventures."""
        exp = self.data.get("experience", [{}])[0]
        ventures = self.data.get("ventures", [])
        company = exp.get("company", "")
        role = exp.get("role", "")

        proposed = f"{role} @ {company}"
        if ventures and ventures[0].get("status") == "active":
            proposed += f" | Founder, {ventures[0]['name']}"

        self.page.goto(SELECTORS["profile_url"], wait_until="domcontentloaded")
        self.page.wait_for_timeout(2000)

        # Read current headline
        headline_el = self.page.query_selector('div.text-body-medium')
        current = headline_el.inner_text().strip() if headline_el else ""

        self._log_diff("Headline", current, proposed)

        if self.dry_run:
            return

        self._backup_section("headline", current)

        self.page.click(SELECTORS["intro_edit_pencil"])
        self.page.wait_for_timeout(1000)
        headline_input = self.page.wait_for_selector(SELECTORS["headline_input"])
        headline_input.fill(proposed)
        self.page.click(SELECTORS["intro_save_button"])
        self.page.wait_for_timeout(2000)
        print("  Headline updated.")

    # --- Phase 2 stubs ---
    # Experience, education, skills, and certifications editing on LinkedIn
    # requires navigating complex nested modals with dynamic DOM. These are
    # implemented as reporting-only stubs for Phase 1. Full browser automation
    # will be added in a follow-up when the about/headline sync is validated.

    def sync_experience(self):
        """Report experience entries (Phase 2: full automation pending)."""
        print("  [experience] Phase 2 stub — reporting only, no browser edits.")
        for exp in self.data.get("experience", []):
            company = exp.get("company", "")
            role = exp.get("role", "")
            years = exp.get("years", "")
            projects = exp.get("projects", [])

            description = ""
            for proj in projects:
                description += f"{proj['name']}\n"
                for highlight in proj.get("highlights", []):
                    description += f"• {highlight.strip()}\n"
                description += "\n"

            proposed = description.strip()
            print(f"    {role} @ {company} ({years}) — {len(proposed)} chars")

    def sync_education(self):
        """Report education entries (Phase 2: full automation pending)."""
        print("  [education] Phase 2 stub — reporting only, no browser edits.")
        for edu in self.data.get("education", []):
            institution = edu.get("institution", "")
            degree = edu.get("degree", "")
            years = edu.get("years", "")
            print(f"    {degree} @ {institution} ({years})")

    def sync_skills(self):
        """Report skills (Phase 2: full automation pending)."""
        skills = self.data.get("skills", {})
        all_skills = []
        for category, items in skills.items():
            if isinstance(items, list):
                all_skills.extend(items)
        print(f"  [skills] Phase 2 stub — {len(all_skills)} skills across {len(skills)} categories")

    def sync_certifications(self):
        """Report certifications (Phase 2: full automation pending)."""
        certs = self.data.get("certifications", [])
        exams = self.data.get("actuarial_exams", [])
        all_certs = certs + exams
        print(f"  [certifications] Phase 2 stub — {len(all_certs)} total ({len(certs)} certs + {len(exams)} exams)")

    def check_selectors(self):
        """Validate all selectors are findable on the current page."""
        self.page.goto(SELECTORS["profile_url"], wait_until="domcontentloaded")
        self.page.wait_for_timeout(3000)

        results = {}
        for name, selector in SELECTORS.items():
            if name.endswith("_url") or name.endswith("_pattern"):
                continue
            try:
                el = self.page.query_selector(selector)
                results[name] = "FOUND" if el else "NOT FOUND"
            except Exception as e:
                results[name] = f"ERROR: {e}"

        print("\nSelector validation:")
        for name, status in results.items():
            marker = "✓" if status == "FOUND" else "✗"
            print(f"  {marker} {name}: {status}")

        return all(s == "FOUND" for s in results.values())

    def sync_all(self):
        """Run all sync methods in order."""
        self.ensure_session()
        try:
            self.sync_about()
            self.sync_headline()
            self.sync_experience()
            self.sync_education()
            self.sync_skills()
            self.sync_certifications()
        finally:
            if self.context:
                # Save session state on exit
                self.context.storage_state(path=str(self.session_path))
            if self.browser:
                self.browser.close()
            if hasattr(self, "pw"):
                self.pw.stop()

    def close(self):
        """Clean up browser resources."""
        if self.browser:
            self.browser.close()
        if hasattr(self, "pw"):
            self.pw.stop()


def run_linkedin_sync(nicholas: dict, dry_run: bool = False) -> tuple[str, str]:
    """Entry point matching the action-type calling convention."""
    syncer = LinkedInSync(nicholas, dry_run=dry_run)
    syncer.sync_all()
    return ".playwright-state/", "LinkedIn profile synced"


def check_selectors(nicholas: dict) -> bool:
    """Validate LinkedIn selectors without modifying anything."""
    syncer = LinkedInSync(nicholas, dry_run=True)
    syncer.ensure_session()
    try:
        return syncer.check_selectors()
    finally:
        syncer.close()
