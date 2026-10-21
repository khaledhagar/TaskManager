"""Create notifications and their emails (Phase 23; SEC-202, SEC-203).

Emails go out in the recipient's language and end with a link that turns them off. That link
carries a signed token (user id + HMAC with the app secret), so it works without signing in and
nothing has to be stored.
"""

import hashlib
import hmac
from contextlib import suppress

from sqlmodel import Session

from app.config import Settings
from app.mailer import Email, Mailer, MailError
from app.models import Board, Card, User
from app.models_notify import Notification, NotificationSetting
from app.sharing import membership

TEXTS = {
    "assigned": {
        "en": (
            "{actor} assigned you to a card on Task Manager",
            '{actor} assigned you to "{title}" on the board "{board}".\n\nOpen it:\n{link}',
        ),
        "ar": (
            "أسند إليك {actor} بطاقة في مدير المهام",
            'أسند إليك {actor} البطاقة "{title}" في اللوحة "{board}".\n\nافتحها:\n{link}',
        ),
    },
    "mentioned": {
        "en": (
            "{actor} mentioned you on Task Manager",
            '{actor} mentioned you in a comment on "{title}" (board "{board}").\n\n'
            "Open it:\n{link}",
        ),
        "ar": (
            "أشار إليك {actor} في مدير المهام",
            'أشار إليك {actor} في تعليق على "{title}" (اللوحة "{board}").\n\nافتحها:\n{link}',
        ),
    },
    "reminder": {
        "en": (
            "Reminder: cards that need you on Task Manager",
            "These cards assigned to you need attention:\n\n{lines}\n\nOpen Task Manager:\n{link}",
        ),
        "ar": (
            "تذكير: بطاقات تحتاجك في مدير المهام",
            "هذه البطاقات المسندة إليك تحتاج إلى متابعة:\n\n{lines}\n\nافتح مدير المهام:\n{link}",
        ),
    },
}
FOOTER = {
    "en": "\n\nTo stop these emails, open:\n{unsubscribe}",
    "ar": "\n\nلإيقاف هذه الرسائل، افتح:\n{unsubscribe}",
}
DUE = {
    "en": {"overdue": "overdue", "today": "due today", "tomorrow": "due tomorrow"},
    "ar": {"overdue": "متأخرة", "today": "موعدها اليوم", "tomorrow": "موعدها غدا"},
}


def unsubscribe_token(user_id: int, secret: str) -> str:
    mac = hmac.new(secret.encode(), f"unsubscribe:{user_id}".encode(), hashlib.sha256)
    return f"{user_id}.{mac.hexdigest()[:32]}"


def unsubscribe_user(token: str, secret: str) -> int | None:
    """The user id in a valid token (constant-time check), else None."""
    user_id, _, _ = token.partition(".")
    if not user_id.isdigit():
        return None
    return (
        int(user_id)
        if hmac.compare_digest(token, unsubscribe_token(int(user_id), secret))
        else None
    )


def emails_on(session: Session, user: User) -> bool:
    """Emails can go to verified, non-guest users who did not turn them off."""
    if user.is_guest or not user.email:
        return False
    setting = session.get(NotificationSetting, user.id)
    return setting is None or setting.email


def build_email(kind: str, user: User, settings: Settings, **params: str) -> Email:
    lang = user.language if user.language in ("en", "ar") else "en"
    subject, text = TEXTS[kind][lang]
    unsubscribe = (
        f"{settings.app_url}/unsubscribe#token={unsubscribe_token(user.id, settings.jwt_secret)}"
    )
    body = (text + FOOTER[lang]).format(unsubscribe=unsubscribe, **params)
    return Email(to=user.email, subject=subject.format(**params), text=body)


def card_link(settings: Settings, board_id: int, card_id: int) -> str:
    return f"{settings.app_url}/?board={board_id}&card={card_id}"


def notify(
    session: Session,
    mailer: Mailer,
    settings: Settings,
    user: User,
    kind: str,
    board: Board,
    card: Card,
    actor: User,
) -> None:
    """Tell a member about an assignment or a mention, in the app and by email."""
    if user.id == actor.id or membership(session, board.id, user.id) is None:
        return
    data = {"title": card.title, "board": board.title}
    session.add(
        Notification(
            user_id=user.id,
            kind=kind,
            board_id=board.id,
            card_id=card.id,
            actor_id=actor.id,
            data=data,
        )
    )
    if emails_on(session, user):
        link = card_link(settings, board.id, card.id)
        # The in-app notification is saved either way; a failed email is only logged.
        with suppress(MailError):
            mailer.send(
                build_email(kind, user, settings, actor=actor.email or "", link=link, **data)
            )
