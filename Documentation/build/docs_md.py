"""03_Test_Plan, 04_Project_Plan and 05_Security from the Markdown files in Planning/."""

import ast
import re
from pathlib import Path

from docstyle import bullets, contents, new_document, para, simple_table
from mdocx import render

ROOT = Path(__file__).parents[2]
PLANNING = ROOT / "Planning"

# Final results, filled in from the last full runs (see SESSION_LOG.md).
RESULTS = [
    ["Backend (pytest)", "550 passed, 1 live AI test run on demand; 99% line coverage (floor 90%)"],
    ["Backend on Supabase Postgres", "546 passed (2 SQLite-only checks skipped)"],
    ["Frontend unit (Vitest)", "390 passed in 49 files"],
    ["End to end (Playwright)", "128 passed: Edge full suite, Firefox and WebKit smoke (3 WebKit tests passed on a rerun alone; they time out under full load)"],
    ["Live site (Playwright)", "2 passed against the deployed address"],
    ["Documentation (pytest)", "Every Word file and the video checked (T-620 to T-629)"],
    ["Lighthouse", "Performance 92-96, accessibility 100"],
    ["Audits", "`npm audit --omit=dev` and `pip-audit`: no known vulnerabilities"],
]

APPROACH = [
    "**Test first**: every feature started with its tests (T-xxx in the plan), ticked only when the test exists and passes.",
    "**Backend unit and API tests** (pytest + FastAPI TestClient): every endpoint, including that one user can never reach "
    "another user's data (404), rate limits, emails (captured in memory) and AI calls (mocked).",
    "**Frontend unit tests** (Vitest + Testing Library): components, forms, validation, filters, language and theme.",
    "**End-to-end tests** (Playwright): real browsers against the real app on a fresh database, with a fake Google provider; "
    "the full suite in Edge, smoke tests in Firefox and WebKit.",
    "**Accessibility**: axe checks on every main screen in light and dark, English and Arabic (WCAG 2.2 AA).",
    "**Layout**: no sideways scroll and no cut-off controls at 360, 768, 1024 and 1440 px.",
    "**Performance**: a 500-card board loads in under 300 ms; Lighthouse on the sign-in page and a board.",
    "**Security**: headers, cookies, Origin check, CSRF, input limits and secrets are tested; see 05_Security.",
    "**Production**: the backend suite also runs against Supabase Postgres, and a live smoke suite runs against the deployed site.",
]

HOW_TO_RUN = """```
cd backend && uv run pytest -q                  # backend (live AI test skipped)
cd backend && uv run pytest -m live             # one real AI call
cd frontend && npx vitest run                   # frontend unit tests
cd frontend && npm run build && npx playwright test     # end to end
cd frontend && npm run e2e:live                 # smoke tests on the live site
cd Documentation/build && uv run pytest         # documentation checks
```"""


def describe(path: Path) -> tuple[str, int]:
    """What a test file covers and how many tests it holds."""
    text = path.read_text(encoding="utf-8")
    if path.suffix == ".py":
        doc = ast.get_docstring(ast.parse(text)) or ""
        return (doc.splitlines()[0] if doc else path.stem), len(re.findall(r"^def test_", text, re.M))
    count = len(re.findall(r"\b(?:test|it)\(\s*[`'\"]", text))
    ids = sorted(set(re.findall(r"\bT-\d{3}\b", text)))
    if ids:
        shown = ", ".join(ids[:8]) + (f" and {len(ids) - 8} more" if len(ids) > 8 else "")
        return f"Tests {shown}", count
    first = re.search(r"\b(?:describe|test|it)\(\s*[`'\"](.+?)[`'\"]", text)
    return (first.group(1) if first else path.stem), count


def test_files() -> list[tuple[str, list[Path]]]:
    return [
        ("Backend (backend/tests)", sorted(ROOT.glob("backend/tests/test_*.py"))),
        ("Frontend unit (frontend/src)", sorted(ROOT.glob("frontend/src/**/*.test.ts*"))),
        ("End to end (frontend/e2e)", sorted(ROOT.glob("frontend/e2e/*.spec.ts"))),
        ("Live site (frontend/e2e-live)", sorted(ROOT.glob("frontend/e2e-live/*.spec.ts"))),
        (
            "Documentation (frontend/e2e-docs and Documentation/build/tests)",
            sorted([*ROOT.glob("frontend/e2e-docs/*.spec.ts"), *ROOT.glob("Documentation/build/tests/test_*.py")]),
        ),
    ]


def build_test_plan(out: Path) -> None:
    doc = new_document("Task Manager", "Test plan and results")
    contents(doc)
    doc.add_heading("Approach", level=1)
    bullets(doc, APPROACH)
    doc.add_heading("Final results", level=1)
    simple_table(doc, ["Suite", "Result"], RESULTS, [5.5, 11.5])
    doc.add_heading("How to run the tests", level=1)
    render(doc, HOW_TO_RUN)
    doc.add_heading("Test files", level=1)
    for group, files in test_files():
        doc.add_heading(group, level=2)
        rows = [[f.name, *(lambda d: [d[0], str(d[1])])(describe(f))] for f in files]
        simple_table(doc, ["File", "What it covers", "Tests"], rows, [5.2, 10.3, 1.5])
    doc.add_heading("Every test", level=1)
    para(doc, "All tests from Planning/TEST_PLAN.md with their IDs. Done means the test exists and passes.")
    body = (PLANNING / "TEST_PLAN.md").read_text(encoding="utf-8").split("\n## ", 1)[1]
    render(doc, "## " + body, top=1)
    doc.save(str(out))


def build_markdown(out: Path, subtitle: str, source: str) -> None:
    doc = new_document("Task Manager", subtitle)
    text = (PLANNING / source).read_text(encoding="utf-8")
    intro, rest = text.split("\n## ", 1)
    render(doc, intro.split("\n", 1)[1], top=2)
    contents(doc)
    render(doc, "## " + rest, top=2)
    doc.save(str(out))


def build_phase_checklist(out: Path) -> None:
    """09_Phase_Checklist: the Progress table and every phase with each task marked Done or Open."""
    doc = new_document("Task Manager", "Phase checklist")
    text = (PLANNING / "PLAN.md").read_text(encoding="utf-8")
    para(doc, "Every phase of the project plan with its tasks. Done means the task is finished and checked; Open means it is still to do.")
    progress = text.split("\n## Progress", 1)[1].split("\n## ", 1)[0]
    doc.add_heading("Progress", level=1)
    render(doc, progress, top=2)
    contents(doc)
    render(doc, "## Phase 1 - " + text.split("\n## Phase 1 - ", 1)[1], top=2)
    doc.save(str(out))
