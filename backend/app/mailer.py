"""Send account emails: logged in console mode, sent through SMTP otherwise."""

import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage

from app.config import Settings
from app.i18n import current_language

log = logging.getLogger("taskmanager.mail")


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
            log.info("Email to %s: %s\n%s", email.to, email.subject, email.text)
            return
        message = EmailMessage()
        message["From"] = f"Task Manager <{self.settings.smtp_user}>"
        message["To"] = email.to
        message["Subject"] = email.subject
        message.set_content(email.text)
        with smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port, timeout=20) as smtp:
            smtp.starttls()
            smtp.login(self.settings.smtp_user, self.settings.smtp_password)
            smtp.send_message(message)


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


def _email(texts: dict[str, tuple[str, str]], to: str, link: str) -> Email:
    """The email in the request language, with the link filled in."""
    subject, text = texts[current_language()]
    return Email(to=to, subject=subject, text=text.format(link=link))


def verification_email(to: str, link: str) -> Email:
    return _email(VERIFY, to, link)


def reset_email(to: str, link: str) -> Email:
    return _email(RESET, to, link)
