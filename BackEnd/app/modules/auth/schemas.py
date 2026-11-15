from app.common.schemas import CamelModel
from app.modules.auth.models import Role


class UserOut(CamelModel):
    id: str
    phone: str | None
    email: str | None
    display_name: str | None
    role: Role
