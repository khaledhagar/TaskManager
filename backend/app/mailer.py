"""Send account emails: logged in console mode, sent through SMTP otherwise."""

import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage

from app.config import Settings
from app.i18n import current_language

log = logging.getLogger("taskmanager.mail")


MAIL_FAILED = "We couldn't send the email right now. Please try again in a few minutes."


class MailError(Exception):
    """The mail server could not be reached or refused the email."""


@dataclass(frozen=True)
class Email:
    to: str
    subject: str
    text: str


class Mailer:
    """Console mode keeps sent emails in `outbox` (used by tests and development)."""

    def __init__(self, settings: Settings):
        self.settings = settings
        self.outbox: list[Email] = []

    def send(self, email: Email) -> None:
        if self.settings.email_mode == "console":
            self.outbox.append(email)
            # The text holds a sign-in link: only shown in development logs.
            if self.settings.production:
                log.info("Email to %s: %s", email.to, email.subject)
            else:
                log.info("Email to %s: %s\n%s", email.to, email.subject, email.text)
            return
        message = EmailMessage()
        message["From"] = f"Task Manager <{self.settings.smtp_user}>"
        message["To"] = email.to
        message["Subject"] = email.subject
        message.set_content(email.text)
        try:
            with smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port, timeout=20) as smtp:
                smtp.starttls()
                smtp.login(self.settings.smtp_user, self.settings.smtp_password)
                smtp.send_message(message)
        except (smtplib.SMTPException, OSError) as exc:
            log.warning("Email to %s not sent: %s", email.to, type(exc).__name__)
            raise MailError(str(exc)) from exc


VERIFY = {
    "en": (
        "Confirm your email for Task Manager",
        "Welcome to Task Manager.\n\n"
        "Confirm your email address by opening this link:\n{link}\n\n"
        "The link works once and expires in 24 hours.\n"
        "If you did not create an account, you can ignore this email.",
    ),
    "ar": (
        "أكّد بريدك الإلكتروني في مدير المهام",
        "مرحبا بك في مدير المهام.\n\n"
        "أكّد عنوان بريدك الإلكتروني بفتح هذا الرابط:\n{link}\n\n"
        "يعمل الرابط مرة واحدة وتنتهي صلاحيته خلال 24 ساعة.\n"
        "إذا لم تنشئ حسابا، يمكنك تجاهل هذه الرسالة.",
    ),
}

RESET = {
    "en": (
        "Reset your Task Manager password",
        "We received a request to reset your Task Manager password.\n\n"
        "Choose a new password here:\n{link}\n\n"
        "The link works once and expires in 30 minutes.\n"
        "If you did not ask for this, ignore this email. Your password stays the same.",
    ),
    "ar": (
        "إعادة تعيين كلمة مرور مدير المهام",
        "تلقينا طلبا لإعادة تعيين كلمة مرور حسابك في مدير المهام.\n\n"
        "اختر كلمة مرور جديدة من هنا:\n{link}\n\n"
        "يعمل الرابط مرة واحدة وتنتهي صلاحيته خلال 30 دقيقة.\n"
        "إذا لم تطلب ذلك، تجاهل هذه الرسالة. ستبقى كلمة مرورك كما هي.",
    ),
}


INVITE = {
    "en": (
        "{inviter} invited you to a board on Task Manager",
        '{inviter} invited you to join the board "{board}" on Task Manager.\n\n'
        "Open this link to accept:\n{link}\n\n"
        "Sign in, or create an account, with this email address ({email}).\n"
        "The link works once and expires in 7 days.\n"
        "If you were not expecting this, you can ignore this email.",
    ),
    "ar": (
        "دعاك {inviter} إلى لوحة في مدير المهام",
        'دعاك {inviter} للانضمام إلى اللوحة "{board}" في مدير المهام.\n\n'
        "افتح هذا الرابط لقبول الدعوة:\n{link}\n\n"
        "سجّل الدخول، أو أنشئ حسابا، بعنوان البريد هذا ({email}).\n"
        "يعمل الرابط مرة واحدة وتنتهي صلاحيته خلال 7 أيام.\n"
        "إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذه الرسالة.",
    ),
}

ACCESS = {
    "en": (
        "{requester} asks for more access to {board}",
        '{requester} is a member of the board "{board}" and asks you for more access.\n\n'
        "Open the board's members panel to approve or decline:\n{link}",
    ),
    "ar": (
        "يطلب {requester} صلاحيات أكثر في {board}",
        '{requester} عضو في اللوحة "{board}" ويطلب منك صلاحيات أكثر.\n\n'
        "افتح قائمة أعضاء اللوحة للموافقة أو الرفض:\n{link}",
    ),
}


def _email(texts: dict[str, tuple[str, str]], to: str, **params: str) -> Email:
    """The email in the request language, with the parameters filled in."""
    subject, text = texts[current_language()]
    return Email(to=to, subject=subject.format(**params), text=text.format(**params))


def verification_email(to: str, link: str) -> Email:
    return _email(VERIFY, to, link=link)


def reset_email(to: str, link: str) -> Email:
    return _email(RESET, to, link=link)


def invite_email(to: str, inviter: str, board: str, link: str) -> Email:
    return _email(INVITE, to, inviter=inviter, board=board, link=link, email=to)


def access_email(to: str, requester: str, board: str, link: str) -> Email:
    return _email(ACCESS, to, requester=requester, board=board, link=link)


MEETING = {
    "en": (
        "Meeting for {board}",
        '{admin} invites you to a meeting for the board "{board}".\n\nJoin here:\n{link}',
    ),
    "ar": (
        "اجتماع للوحة {board}",
        'يدعوك {admin} إلى اجتماع للوحة "{board}".\n\nانضم من هنا:\n{link}',
    ),
}


def meeting_email(to: str, admin: str, board: str, link: str) -> Email:
    return _email(MEETING, to, admin=admin, board=board, link=link)
