"""AI column suggestions from board names (T-725, T-726; SEC-216)."""

import pytest
from fastapi import HTTPException
from helpers import sign_up

from app import ai, ratelimit
from app.columns_ai import BoardColumnsDraft, ColumnsDraft


@pytest.fixture
def alice(client, llm):
    sign_up(client, "alice@example.com")
    return client


def ask(client, boards, workspace=None, **kw):
    return client.post("/api/ai/columns", json={"boards": boards, "workspace": workspace}, **kw)


def test_columns_for_each_board_cleaned_to_the_limits(alice, llm):
    llm.result = ColumnsDraft(
        boards=[
            BoardColumnsDraft(title="Design", columns=["Ideas", " Drafts ", "", "x" * 60, "Ideas"]),
            BoardColumnsDraft(title="Dev", columns=[f"Step {i}" for i in range(12)]),
        ]
    )
    r = ask(alice, ["Design", "Dev"], "Website relaunch")
    assert r.status_code == 200
    body = r.json()
    assert body["ai"] is True
    design, dev = body["boards"]
    assert design["title"] == "Design"
    assert design["columns"][:2] == ["Ideas", "Drafts"]
    assert len(design["columns"][2]) == 40
    assert len(design["columns"]) >= 3
    assert len(dev["columns"]) == 8
    prompt = llm.prompt
    assert "Website relaunch" in prompt and "Design" in prompt
    assert "cards" not in body["boards"][0]


def test_too_few_names_are_filled_and_missing_boards_get_defaults(alice, llm):
    llm.result = ColumnsDraft(boards=[BoardColumnsDraft(title="Design", columns=["Only"])])
    body = ask(alice, ["Design", "Marketing"]).json()
    assert len(body["boards"][0]["columns"]) >= 3
    assert body["boards"][0]["columns"][0] == "Only"
    assert body["boards"][1] == {"title": "Marketing", "columns": ["To Do", "In Progress", "Done"]}


def test_arabic_request_asks_for_arabic(alice, llm):
    llm.result = ColumnsDraft(boards=[BoardColumnsDraft(title="x", columns=["أ", "ب", "ج"])])
    ask(alice, ["تسويق"], headers={"Accept-Language": "ar"})
    assert "Arabic" in llm.prompt


@pytest.mark.parametrize("status", [429, 502])
def test_model_failure_falls_back_to_default_columns(alice, monkeypatch, status):
    def fail(*_args):
        raise HTTPException(status, "nope")

    monkeypatch.setattr(ai, "complete", fail)
    body = ask(alice, ["Design"], headers={"Accept-Language": "ar"}).json()
    assert body["ai"] is False
    assert body["boards"] == [{"title": "Design", "columns": ["المطلوب", "قيد التنفيذ", "تم"]}]


def test_the_daily_ai_limit_also_falls_back(alice, llm, monkeypatch):
    monkeypatch.setattr(ratelimit, "AI_PER_DAY", ratelimit.Limit(0, 86400))
    body = ask(alice, ["Design"]).json()
    assert body["ai"] is False
    assert llm.calls == []


def test_input_is_limited(alice):
    assert ask(alice, []).status_code == 422
    assert ask(alice, [f"B{i}" for i in range(11)]).status_code == 422
    assert ask(alice, ["x" * 201]).status_code == 422
    assert ask(alice, ["ok"], "p" * 101).status_code == 422
