"""Build all Word files in Documentation/: `uv run python build_docs.py`, then `pwsh update_fields.ps1 ..\\*.docx`."""

from pathlib import Path

import build_readme
import docs_flows
import docs_md
import docs_pages
import docs_prompts
import docs_text

OUT = Path(__file__).parents[1]


def main() -> None:
    docs_text.build_overview(OUT / "01_Overview.docx")
    docs_text.build_documentation(OUT / "02_Documentation.docx")
    docs_md.build_test_plan(OUT / "03_Test_Plan.docx")
    docs_md.build_markdown(OUT / "04_Project_Plan.docx", "Project plan", "PLAN.md")
    docs_md.build_markdown(OUT / "05_Security.docx", "Security and non-functional checklist", "SECURITY.md")
    docs_flows.build(OUT / "06_User_Flows.docx")
    docs_pages.build(OUT / "07_Pages.docx")
    docs_prompts.build(OUT / "08_Build_Prompts.docx")
    docs_md.build_phase_checklist(OUT / "09_Phase_Checklist.docx")
    build_readme.build()
    print("built", len(list(OUT.glob("*.docx"))), "Word files")


if __name__ == "__main__":
    main()
