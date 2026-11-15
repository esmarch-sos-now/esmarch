from app.common.schemas import CamelModel


class UserOut(CamelModel):
    id: str
    phone: str | None
    email: str | None
    display_name: str | None
