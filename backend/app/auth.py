"""Session handling, the current-user dependency, and core auth routes."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field

from app.account import send_verification
from app.db import SessionDep
from app.models import User
from app.security import COOKIE, TOKEN_TTL, create_token, hash_password, read_token, verify_password
from app.users import create_user, find_by_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

Password = Annotated[str, Field(min_length=8, max_length=128)]


class Credentials(BaseModel):
    email: EmailStr
    password: Password


class UserOut(BaseModel):
    id: int
    email: str | None
    is_guest: bool
    email_verified: bool
    has_password: bool
    google_linked: bool


class PendingVerification(BaseModel):
    email: str
    verification_required: bool = True


def user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        is_guest=user.is_guest,
        email_verified=user.email_verified,
        has_password=user.password_hash is not None,
        google_linked=user.google_id is not None,
    )


def optional_user(request: Request, session: SessionDep) -> User | None:
    """The signed-in user, or None. Tokens from older token versions are rejected."""
    token = request.cookies.get(COOKIE)
    claims = read_token(token, request.app.state.settings.jwt_secret) if token else None
    if claims is None:
        return None
    user = session.get(User, claims[0])
    return user if user and user.token_version == claims[1] else None


def current_user(user: Annotated[User | None, Depends(optional_user)]) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    return user


CurrentUser = Annotated[User, Depends(current_user)]
OptionalUser = Annotated[User | None, Depends(optional_user)]


def start_session(request: Request, response: Response, user: User) -> UserOut:
    """Set the session cookie for `user` and return the account summary."""
    settings = request.app.state.settings
    response.set_cookie(
        COOKIE,
        create_token(user.id, user.token_version, settings.jwt_secret),
        max_age=int(TOKEN_TTL.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=settings.production,
        path="/",
    )
    return user_out(user)


def new_email(session: SessionDep, email: str) -> str:
    """Lower-case the email and make sure no account uses it yet."""
    email = email.lower()
    if find_by_email(session, email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    return email


@router.post("/signup", status_code=201)
def signup(creds: Credentials, request: Request, session: SessionDep) -> PendingVerification:
    user = create_user(session, new_email(session, creds.email), hash_password(creds.password))
    send_verification(request, session, user)
    return PendingVerification(email=user.email)


@router.post("/signin")
def signin(
    creds: Credentials, request: Request, response: Response, session: SessionDep
) -> UserOut:
    user = find_by_email(session, creds.email.lower())
    if not verify_password(creds.password, user.password_hash if user else None):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not user.email_verified:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "Please verify your email first. We can send a new link."
        )
    return start_session(request, response, user)


@router.post("/guest", status_code=201)
def guest(request: Request, response: Response, session: SessionDep) -> UserOut:
    return start_session(request, response, create_user(session, None, None))


@router.post("/upgrade")
def upgrade(
    creds: Credentials, request: Request, user: CurrentUser, session: SessionDep
) -> PendingVerification:
    """Attach email and password to a guest; it stays a guest until the email is verified."""
    if not user.is_guest:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Account is not a guest account")
    user.email = new_email(session, creds.email)
    user.password_hash = hash_password(creds.password)
    session.commit()
    send_verification(request, session, user)
    return PendingVerification(email=user.email)


@router.post("/signout", status_code=204)
def signout(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/")


@router.get("/me")
def me(user: CurrentUser) -> UserOut:
    return user_out(user)


@router.delete("/me", status_code=204)
def delete_account(user: CurrentUser, session: SessionDep, response: Response) -> None:
    session.delete(user)
    session.commit()
    response.delete_cookie(COOKIE, path="/")
