"""Auth routes and the current-user dependency."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field

from app.db import SessionDep
from app.models import User
from app.security import COOKIE, TOKEN_TTL, create_token, hash_password, read_token, verify_password
from app.users import create_user, find_by_email

router = APIRouter(prefix="/api/auth", tags=["auth"])


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserOut(BaseModel):
    id: int
    email: str | None
    is_guest: bool


def current_user(request: Request, session: SessionDep) -> User:
    """Resolve the signed-in user from the session cookie, or raise 401."""
    token = request.cookies.get(COOKIE)
    user_id = read_token(token, request.app.state.settings.jwt_secret) if token else None
    user = session.get(User, user_id) if user_id else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in")
    return user


CurrentUser = Annotated[User, Depends(current_user)]


def _out(user: User) -> UserOut:
    return UserOut.model_validate(user, from_attributes=True)


def _start_session(request: Request, response: Response, user: User) -> UserOut:
    settings = request.app.state.settings
    response.set_cookie(
        COOKIE,
        create_token(user.id, settings.jwt_secret),
        max_age=int(TOKEN_TTL.total_seconds()),
        httponly=True,
        samesite="lax",
        secure=settings.production,
        path="/",
    )
    return _out(user)


def _new_email(session: SessionDep, email: str) -> str:
    email = email.lower()
    if find_by_email(session, email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    return email


@router.post("/signup", status_code=201)
def signup(
    creds: Credentials, request: Request, response: Response, session: SessionDep
) -> UserOut:
    email = _new_email(session, creds.email)
    user = create_user(session, email, hash_password(creds.password))
    return _start_session(request, response, user)


@router.post("/signin")
def signin(
    creds: Credentials, request: Request, response: Response, session: SessionDep
) -> UserOut:
    user = find_by_email(session, creds.email.lower())
    if not verify_password(creds.password, user.password_hash if user else None):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return _start_session(request, response, user)


@router.post("/guest", status_code=201)
def guest(request: Request, response: Response, session: SessionDep) -> UserOut:
    return _start_session(request, response, create_user(session, None, None))


@router.post("/upgrade")
def upgrade(creds: Credentials, user: CurrentUser, session: SessionDep) -> UserOut:
    if not user.is_guest:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Account is not a guest account")
    user.email = _new_email(session, creds.email)
    user.password_hash = hash_password(creds.password)
    user.is_guest = False
    session.add(user)
    session.commit()
    return _out(user)


@router.post("/signout", status_code=204)
def signout(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/")


@router.get("/me")
def me(user: CurrentUser) -> UserOut:
    return _out(user)


@router.delete("/me", status_code=204)
def delete_account(user: CurrentUser, session: SessionDep, response: Response) -> None:
    session.delete(user)
    session.commit()
    response.delete_cookie(COOKIE, path="/")
