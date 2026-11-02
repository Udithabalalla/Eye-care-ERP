"""Create an admin account, or make an existing account an admin.

Asks for the password at the prompt (it is never taken as an argument, echoed
or logged). The database comes from MONGODB_URL / MONGODB_DB_NAME, i.e. backend/.env
unless you set those variables when you run it.

    cd backend
    venv/Scripts/python.exe scripts/create_admin.py --name "Your Name" --email you@example.com
"""
import argparse
import asyncio
import getpass
import sys
from pathlib import Path
from urllib.parse import urlsplit

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import ValidationError

from app.config.settings import settings
from app.core.security import get_password_hash, verify_password
from app.schemas.user import UserCreate
from app.services.session_service import SessionService
from app.services.user_service import UserService
from app.utils.constants import UserRole

ACTOR = "script:create_admin"

# Seed accounts whose passwords are published in seed_data.py and the README
DEMO_ACCOUNTS = {
    "admin@eyecare.com": "admin123",
    "doctor@eyecare.com": "doctor123",
    "receptionist@eyecare.com": "reception123",
    "optometrist@eyecare.com": "optom123",
}
MIN_PASSWORD_LENGTH = 8


def database_label() -> str:
    """Where we'll write, without the credentials in the URL"""
    parts = urlsplit(settings.MONGODB_URL)
    host = parts.hostname or settings.MONGODB_URL
    if parts.port:
        host = f"{host}:{parts.port}"
    return f"{settings.MONGODB_DB_NAME} on {parts.scheme}://{host}"


def ask(prompt: str) -> str:
    value = input(prompt).strip()
    while not value:
        value = input(prompt).strip()
    return value


def ask_password() -> str:
    while True:
        password = getpass.getpass(f"Password (at least {MIN_PASSWORD_LENGTH} characters): ")
        if len(password) < MIN_PASSWORD_LENGTH:
            print(f"  Too short, use at least {MIN_PASSWORD_LENGTH} characters.")
            continue
        if getpass.getpass("Password again: ") != password:
            print("  The passwords didn't match, try again.")
            continue
        return password


def confirm(prompt: str) -> bool:
    return input(f"{prompt} [y/N] ").strip().lower() in {"y", "yes"}


async def offer_to_disable_demo_accounts(db, users: UserService, args: argparse.Namespace, keep: str) -> None:
    """Anyone can sign in to a seed account that still has its published password"""
    exposed = []
    for email, demo_password in DEMO_ACCOUNTS.items():
        user = await users.get_user_by_email(email)
        if user and user.is_active and email != keep and verify_password(demo_password, user.password_hash):
            exposed.append(user)
    if not exposed:
        return
    print("These accounts are active and still use the demo passwords published in the repo:")
    for user in exposed:
        print(f"  {user.email} ({user.role.value})")
    if args.yes:
        print("Left as they are (--yes). Deactivate them on the Users page, or run this again without --yes.")
        return
    if not confirm("Deactivate them and sign them out?"):
        print("Left as they are.")
        return
    for user in exposed:
        await users.user_repo.update_user(user.user_id, {"is_active": False})
        await SessionService(db).end_user_sessions(user.user_id, ACTOR)
        await users.audit.log(ACTOR, "deactivate_demo_account", "user", user.user_id)
    print(f"Deactivated {len(exposed)} demo account(s).")


async def run(args: argparse.Namespace) -> int:
    print(f"Database: {database_label()}")
    email = (args.email or ask("Email: ")).lower()

    client = AsyncIOMotorClient(settings.MONGODB_URL, serverSelectionTimeoutMS=10000)
    db = client[settings.MONGODB_DB_NAME]
    users = UserService(db)
    try:
        existing = await users.get_user_by_email(email)
        if existing:
            print(f"{email} already exists: {existing.name}, role {existing.role.value}, "
                  f"{'active' if existing.is_active else 'deactivated'}.")
            if not args.yes and not confirm("Make it an active admin and set a new password?"):
                print("Nothing changed.")
                return 1
            password = ask_password()
            await users.user_repo.update_user(existing.user_id, {
                "role": UserRole.ADMIN.value,
                "is_active": True,
                "password_hash": get_password_hash(password),
                "must_change_password": False,
                "granted_permissions": [],
                "revoked_permissions": [],
            })
            # Anyone signed in with the old password has to sign in again
            signed_out = await SessionService(db).end_user_sessions(existing.user_id, ACTOR)
            await users.audit.log(ACTOR, "make_admin", "user", existing.user_id,
                                  new_value={"sessions_signed_out": signed_out})
            print(f"Done: {email} is an admin ({existing.user_id}). Sign in with the new password.")
            await offer_to_disable_demo_accounts(db, users, args, keep=email)
            return 0

        name = args.name or ask("Full name: ")
        if not args.yes and not confirm(f"Create admin {name} <{email}>?"):
            print("Nothing changed.")
            return 1
        password = ask_password()
        try:
            data = UserCreate(email=email, password=password, name=name, role=UserRole.ADMIN,
                              must_change_password=False)
        except ValidationError as exc:
            print(f"Invalid details: {exc.errors()[0]['msg']}")
            return 1
        user = await users.create_user(data, ACTOR)
        print(f"Done: created admin {user.email} ({user.user_id}). Sign in with the password you chose.")
        await offer_to_disable_demo_accounts(db, users, args, keep=email)
        return 0
    finally:
        client.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Create an admin account (the password is asked for at the prompt).")
    parser.add_argument("--name", help="Full name (asked for if left out)")
    parser.add_argument("--email", help="Sign-in email (asked for if left out)")
    parser.add_argument("--yes", action="store_true", help="Don't ask before writing to the database")
    sys.exit(asyncio.run(run(parser.parse_args())))


if __name__ == "__main__":
    main()
