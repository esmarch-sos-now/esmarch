"""Import every table module so SQLModel.metadata (Alembic, create_all) sees all tables."""

from app.modules.aeds import models as aeds  # noqa: F401
from app.modules.alerts import models as alerts  # noqa: F401
from app.modules.auth import models as auth  # noqa: F401
from app.modules.facilities import models as facilities  # noqa: F401
from app.modules.guides import models as guides  # noqa: F401
from app.modules.support import models as support  # noqa: F401
from app.voice import models as voice  # noqa: F401
