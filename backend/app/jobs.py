"""Scheduled jobs (Phase 23): plain functions, run by the cron endpoint or from the command line.

uv run python -m app.jobs reminders
"""

import sys
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta

from sqlmodel import Session, select

from app.config import Settings
from app.mailer import Mailer
from app.models import Board, BoardColumn, Card, CardAssignee, User
from app.models_notify import Notification, NotificationSetting
from app.notify import DUE, build_email, emails_on


def _when(due: date, today: date) -> str:
    return "overdue" if due < today else "today" if due == today else "tomorrow"


def send_reminders(session: Session, mailer: Mailer, settings: Settings, today: date) -> int:
    """Notify assignees of open cards due today, tomorrow or overdue; one email per user per day.

    Returns how many emails were sent (SEC-203).
    """
    rows = session.exec(
        select(Card, CardAssignee.user_id, BoardColumn.board_id)
        .join(CardAssignee, CardAssignee.card_id == Card.id)
        .join(BoardColumn, BoardColumn.id == Card.column_id)
        .join(Board, Board.id == BoardColumn.board_id)
        .where(Card.archived_at == None, Board.archived_at == None)  # noqa: E711
        .where(Card.completed == False, Card.due_date != None)  # noqa: E711, E712
        .where(Card.due_date <= today + timedelta(days=1))
        .order_by(Card.due_date)
    ).all()
    start = datetime.combine(today, datetime.min.time(), UTC)
    due_by_user: dict[int, list[tuple[Card, str]]] = defaultdict(list)
    for card, user_id, board_id in rows:
        when = _when(card.due_date, today)
        kind = "overdue" if when == "overdue" else "due_soon"
        due_by_user[user_id].append((card, when))
        seen = select(Notification.id).where(
            Notification.user_id == user_id,
            Notification.card_id == card.id,
            Notification.kind == kind,
            Notification.created_at >= start,
        )
        if session.exec(seen).first() is None:
            data = {"title": card.title, "board": card.column.board.title}
            session.add(
                Notification(
                    user_id=user_id, kind=kind, board_id=board_id, card_id=card.id, data=data
                )
            )
    sent = 0
    for user_id, cards in due_by_user.items():
        user = session.get(User, user_id)
        setting = session.get(NotificationSetting, user_id) or NotificationSetting(user_id=user_id)
        if not emails_on(session, user) or setting.last_reminder_on == today:
            continue
        lang = user.language if user.language in DUE else "en"
        lines = "\n".join(
            f"- {card.title} ({card.column.board.title}): {DUE[lang][when]}" for card, when in cards
        )
        mailer.send(build_email("reminder", user, settings, lines=lines, link=settings.app_url))
        setting.last_reminder_on = today
        session.add(setting)
        sent += 1
    session.commit()
    return sent


def main(argv: list[str]) -> None:
    from app.config import load_settings
    from app.db import make_engine

    if argv != ["reminders"]:
        sys.exit("usage: python -m app.jobs reminders")
    settings = load_settings()
    engine = make_engine(settings.database_url)
    with Session(engine) as session:
        sent = send_reminders(session, Mailer(settings), settings, date.today())
    print(f"{sent} reminder emails sent")


if __name__ == "__main__":
    main(sys.argv[1:])
