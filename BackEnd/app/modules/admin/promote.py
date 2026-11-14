"""Makes an existing account an administrator, for the very first admin (later ones are promoted on the admin page).

docker compose exec backend python -m app.modules.admin.promote 0912345678
docker compose exec backend python -m app.modules.admin.promote someone@example.com
"""

import sys

from sqlmodel import Session, select

from app.core import registry  # noqa: F401  (loads every table model)
from app.core.db import get_engine
from app.modules.auth import security
from app.modules.auth.models import Role, User


def promote(login: str) -> str:
    phone = security.normalize_phone(login)
    email = None if phone else security.normalize_email(login)
    if phone is None and email is None:
        return f"Not a phone number or email: {login}"
    with Session(get_engine()) as session:
        where = User.phone == phone if phone else User.email == email
        user = session.exec(select(User).where(where)).first()
        if user is None:
            return f"No account for {phone or email}. Sign up on the site first."
        user.role = Role.ADMIN
        session.commit()
        return f"{phone or email} is now an administrator."


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    message = promote(sys.argv[1])
    print(message)
    sys.exit(0 if message.endswith("administrator.") else 1)
