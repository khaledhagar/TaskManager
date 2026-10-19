"""Tick a finished phase, its tests and security items, and rebuild the Progress table.

Run from the project root (files are read and written as UTF-8):

    PYTHONUTF8=1 uv run --no-project python Planning/tick_phase.py \
        "<phase heading prefix>" "T-001,T-002" "SEC-60,SEC-61" ["old text=>new text" ...]

The phase prefix matches the start of a heading, e.g. "Phase 11 - Languages".
Pass "" for tests or security items when there are none. Optional "old=>new" pairs
replace a plan line (each old text must appear exactly once).
"""

import sys
from pathlib import Path

PHASE_6_NOTE = "Done (live Gmail/Google check moved to Phase 16)"


def progress_table(plan: str) -> str:
    rows, name, done, total = [], None, 0, 0
    for line in plan[plan.index("## Phase 1 -") :].splitlines():
        if line.startswith("## Phase "):
            if name:
                rows.append((name, done, total))
            name, done, total = line[3:], 0, 0
        elif line.startswith("- [x]"):
            done, total = done + 1, total + 1
        elif line.startswith("- [ ]"):
            total += 1
    rows.append((name, done, total))

    def status(n: str, d: int, t: int) -> str:
        if n.startswith("Phase 6"):
            return PHASE_6_NOTE
        return "Done" if d == t else ("Not started" if d == 0 else "In progress")

    body = "\n".join(f"| {n} | {d} / {t} | {status(n, d, t)} |" for n, d, t in rows)
    header = "| Phase | Tasks done | Status |\n|-------|-----------|--------|"
    return f"## Progress\n\n{header}\n{body}\n\n"


def main() -> None:
    phase, tests, secs = sys.argv[1], sys.argv[2], sys.argv[3]
    renames = [r.split("=>", 1) for r in sys.argv[4:]]

    plan_path = Path("Planning/PLAN.md")
    plan = plan_path.read_text(encoding="utf-8")
    for old, new in renames:
        assert plan.count(old) == 1, old
        plan = plan.replace(old, new)
    start = plan.index(f"## {phase}")
    end = plan.index("\n## Phase", start + 5) if "\n## Phase" in plan[start + 5 :] else len(plan)
    plan = plan[:start] + plan[start:end].replace("- [ ]", "- [x]") + plan[end:]
    table = progress_table(plan)
    plan = plan[: plan.index("## Progress")] + table + plan[plan.index("## Stack") :]
    plan_path.write_text(plan, encoding="utf-8")

    tests_path = Path("Planning/TEST_PLAN.md")
    text = tests_path.read_text(encoding="utf-8")
    for tid in filter(None, tests.split(",")):
        assert f"- [ ] {tid} " in text, tid
        text = text.replace(f"- [ ] {tid} ", f"- [x] {tid} ")
    tests_path.write_text(text, encoding="utf-8")

    sec_path = Path("Planning/SECURITY.md")
    sec = sec_path.read_text(encoding="utf-8")
    for sid in filter(None, secs.split(",")):
        i = sec.index(f"({sid})")
        j = sec.rindex("- [ ]", 0, i)
        sec = sec[:j] + "- [x]" + sec[j + 5 :]
    sec_path.write_text(sec, encoding="utf-8")
    print(table)


if __name__ == "__main__":
    main()
