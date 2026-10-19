"""Send account emails: logged in console mode, sent through SMTP otherwise."""

import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage

from app.config import Settings

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


def verification_email(to: str, link: str) -> Email:
    return Email(
        to=to,
        subject="Confirm your email for Task Manager",
        text=(
            "Welcome to Task Manager.\n\n"
            f"Confirm your email address by opening this link:\n{link}\n\n"
            "The link works once and expires in 24 hours.\n"
            "If you did not create an account, you can ignore this email."
        ),
    )


def reset_email(to: str, link: str) -> Email:
    return Email(
        to=to,
        subject="Reset your Task Manager password",
        text=(
            "We received a request to reset your Task Manager password.\n\n"
            f"Choose a new password here:\n{link}\n\n"
            "The link works once and expires in 30 minutes.\n"
            "If you did not ask for this, ignore this email. Your password stays the same."
        ),
    )
