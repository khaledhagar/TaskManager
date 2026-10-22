"""Server languages: messages, saved choice, emails, demo data, AI prompts (T-190 to T-194)."""

import ast
import importlib
import string
from pathlib import Path

import pytest
from helpers import PASSWORD, column_titles, first_board, outbox, sign_up

from app import limits
from app.assistant import BoardDraft, ChatDraft, ChecklistDraft, ColumnDraft
from app.i18n import AR
from app.templates import TEMPLATES

APP = Path(__file__).parent.parent / "app"
AR_HEADER = {"Accept-Language": "ar"}


def bad_signin(client, headers=None):
    body = {"email": "nobody@example.com", "password": PASSWORD}
    return client.post("/api/auth/signin", json=body, headers=headers or {})


# --- T-190 server messages --------------------------------------------------------


def test_sign_in_failure_is_in_arabic(client):
    assert bad_signin(client).json()["detail"] == "Invalid email or password"
    assert (
        bad_signin(client, AR_HEADER).json()["detail"]
        == "البريد الإلكتروني أو كلمة المرور غير صحيحة"
    )


@pytest.mark.parametrize("header", ["ar-EG,ar;q=0.9,en;q=0.8", "AR"])
def test_arabic_variants_choose_arabic(client, header):
    detail = bad_signin(client, {"Accept-Language": header}).json()["detail"]
    assert detail == "البريد الإلكتروني أو كلمة المرور غير صحيحة"


@pytest.mark.parametrize("header", ["fr-FR", "", "*", "en-US,ar;q=0.5"])
def test_other_languages_fall_back_to_english(client, header):
    assert bad_signin(client, {"Accept-Language": header}).json()["detail"] == (
        "Invalid email or password"
    )


def test_not_found_and_not_signed_in_are_in_arabic(client):
    assert client.get("/api/auth/me", headers=AR_HEADER).json()["detail"] == "لم تسجل الدخول"
    sign_up(client)
    assert client.get("/api/boards/9999", headers=AR_HEADER).json()["detail"] == "غير موجود"


def test_limit_message_is_in_arabic(client, monkeypatch):
    sign_up(client)
    monkeypatch.setattr(limits, "BOARDS_PER_USER", 1)
    r = client.post("/api/boards", json={"title": "Two"}, headers=AR_HEADER)
    assert r.status_code == 400
    assert r.json()["detail"] == "تم بلوغ الحد: 1 لوحة كحد أقصى"


def _fields(text: str) -> list[str]:
    return sorted(name for _, name, _, _ in string.Formatter().parse(text) if name)


def _calls(*names: str):
    """(module, call) for every call to one of `names` (plain or attribute) in the app source."""
    for path in sorted(APP.rglob("*.py")):
        module = importlib.import_module(
            ".".join(path.relative_to(APP.parent).with_suffix("").parts)
        )
        for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
            if isinstance(node, ast.Call):
                func = node.func
                if getattr(func, "id", None) in names or getattr(func, "attr", None) in names:
                    yield module, node


def _texts():
    """Message texts passed to tr() or to the helpers that forward to it."""
    for module, call in _calls("tr", "_bad", "check", "enforce"):
        for arg in call.args:
            if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                yield arg.value
            elif isinstance(arg, ast.Name) and isinstance(getattr(module, arg.id, None), str):
                yield getattr(module, arg.id)
            elif isinstance(arg, ast.Attribute) and isinstance(arg.value, ast.Name):
                value = getattr(getattr(module, arg.value.id, None), arg.attr, None)
                if isinstance(value, str):
                    yield value


def test_every_error_message_is_translated():
    """HTTPException details go through tr(); every text has Arabic with the same fields."""
    for _, call in _calls("HTTPException"):
        detail = call.args[1] if len(call.args) > 1 else call.keywords[-1].value
        forwarded = isinstance(detail, ast.Name)
        assert forwarded or getattr(detail.func, "id", None) == "tr", ast.unparse(call)
    texts = list(_texts())
    assert len(texts) > 20
    for text in texts:
        assert text in AR, text
        assert _fields(AR[text]) == _fields(text), text


# --- T-191 saved language -------------------------------------------------------------


def test_language_is_saved_on_the_account(client):
    sign_up(client)
    assert client.get("/api/auth/me").json()["language"] == "en"
    r = client.patch("/api/auth/me", json={"language": "ar"})
    assert r.status_code == 200
    assert r.json()["language"] == "ar"
    assert client.get("/api/auth/me").json()["language"] == "ar"


@pytest.mark.parametrize("body", [{"language": "fr"}, {"language": ""}, {"language": "ar", "x": 1}])
def test_language_must_be_en_or_ar(client, body):
    sign_up(client)
    assert client.patch("/api/auth/me", json=body).status_code == 422


def test_new_accounts_start_in_the_request_language(client):
    client.post("/api/auth/guest", headers=AR_HEADER)
    assert client.get("/api/auth/me").json()["language"] == "ar"


# --- T-192 emails ---------------------------------------------------------------------


def test_verification_email_is_in_arabic(client):
    client.post(
        "/api/auth/signup", json={"email": "a@example.com", "password": PASSWORD}, headers=AR_HEADER
    )
    email = outbox(client)[-1]
    assert email.subject == "أكّد بريدك الإلكتروني في مدير المهام"
    assert "http://app.test/verify#token=" in email.text
    assert "24 ساعة" in email.text


def test_reset_email_is_in_arabic(client):
    sign_up(client)
    client.post("/api/auth/forgot-password", json={"email": "alice@example.com"}, headers=AR_HEADER)
    email = outbox(client)[-1]
    assert email.subject == "إعادة تعيين كلمة مرور مدير المهام"
    assert "http://app.test/reset-password#token=" in email.text


def test_emails_stay_english_by_default(client):
    sign_up(client)
    assert outbox(client)[-1].subject == "Confirm your email for Task Manager"


# --- T-193 demo board and templates ---------------------------------------------------


@pytest.mark.real_start
def test_guest_gets_the_arabic_demo_board(client):
    client.post("/api/auth/guest", headers=AR_HEADER)
    board = first_board(client)
    assert board["title"] == "إطلاق الموقع"
    assert column_titles(board) == ["المطلوب", "قيد التنفيذ", "تم"]
    assert all(c["cards"] == [] for c in board["columns"])


def test_templates_are_created_in_the_request_language(client):
    sign_up(client)
    r = client.post("/api/boards", json={"title": "س", "template": "sprint"}, headers=AR_HEADER)
    board = client.get(f"/api/boards/{r.json()['id']}").json()
    assert column_titles(board) == ["المهام المؤجلة", "المطلوب", "قيد التنفيذ", "المراجعة", "تم"]


@pytest.mark.parametrize("name", list(TEMPLATES["en"]))
def test_arabic_templates_match_english_shape(name):
    en, ar = TEMPLATES["en"][name], TEMPLATES["ar"][name]
    assert [c for _, c in en["labels"]] == [c for _, c in ar["labels"]]
    assert [len(c["cards"]) for c in en["columns"]] == [len(c["cards"]) for c in ar["columns"]]
    names = {n for n, _ in ar["labels"]}
    for column in ar["columns"]:
        for card in column["cards"]:
            assert set(card.get("labels", [])) <= names


# --- T-194 AI prompts -----------------------------------------------------------------


def test_ai_prompts_ask_for_the_request_language(client, llm):
    sign_up(client)
    board = first_board(client)
    card = board["columns"][0]["cards"][0]

    llm.result = ChecklistDraft(items=["a"])
    assert client.post(f"/api/ai/cards/{card['id']}/checklist").status_code == 200
    assert "Answer in English." in llm.prompt
    assert (
        client.post(f"/api/ai/cards/{card['id']}/checklist", headers=AR_HEADER).status_code == 200
    )
    assert "Answer in Arabic." in llm.prompt

    llm.result = BoardDraft(title="ب", columns=[ColumnDraft(title="أ")])
    r = client.post("/api/ai/boards", json={"description": "a small project"}, headers=AR_HEADER)
    assert r.status_code == 201
    assert "Answer in Arabic." in llm.prompt

    llm.result = ChatDraft(reply="ok")
    body = {"board_id": board["id"], "messages": [{"role": "user", "content": "hi"}]}
    assert client.post("/api/ai/chat", json=body, headers=AR_HEADER).status_code == 200
    assert "Answer in Arabic." in llm.prompt


def test_board_starter_fills_arabic_default_columns(client, llm):
    sign_up(client)
    llm.result = BoardDraft(title="ب", columns=[ColumnDraft(title="أفكار")])
    r = client.post("/api/ai/boards", json={"description": "a small project"}, headers=AR_HEADER)
    board = client.get(f"/api/boards/{r.json()['id']}").json()
    assert column_titles(board) == ["أفكار", "المطلوب", "قيد التنفيذ"]
