"""Makes an existing account an administrator, for the very first admin (later ones are promoted on the admin page).

The account must have signed in on the site once, so the backend knows it:

python -m app.modules.admin.promote 0912345678
"""

import re
import sys

from sqlmodel import Session, select

from app.core import registry  # noqa: F401  (loads every table model)
from app.core.db import get_engine
from app.core.supabase import AuthAdminError, update_auth_user
from app.modules.auth.models import Account, Role


def normalize_phone(value: str) -> str | None:
    """Vietnamese mobile number as E.164 (+84…), from 09…, 849… or +849…; None if it is not one."""
    digits = re.sub(r"[\s.()-]", "", value)
    if digits.startswith("+"):
        digits = digits[1:]
    elif digits.startswith("0"):
        digits = "84" + digits[1:]
    return f"+{digits}" if re.fullmatch(r"84[1-9][0-9]{8}", digits) else None


def promote(login: str) -> str:
    phone = normalize_phone(login)
    if phone is None:
        return f"Not a Vietnamese mobile number: {login}"
    with Session(get_engine()) as session:
        account = session.exec(select(Account).where(Account.phone == phone)).first()
        if account is None:
            return f"No account for {phone}. Sign up and sign in on the site first."
        account.role = Role.ADMIN
        session.commit()
        try:
            update_auth_user(account.id, {"app_metadata": {"role": Role.ADMIN.value}})
        except AuthAdminError:
            pass  # the backend reads the role from the database; the copy only routes the browser to /admin
        return f"{phone} is now an administrator."


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    message = promote(sys.argv[1])
    print(message)
    sys.exit(0 if message.endswith("administrator.") else 1)
