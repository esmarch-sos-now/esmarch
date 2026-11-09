from typing import Annotated

from fastapi import Query

Lat = Annotated[float, Query(ge=-90, le=90, allow_inf_nan=False)]
Lng = Annotated[float, Query(ge=-180, le=180, allow_inf_nan=False)]
Radius = Annotated[int, Query(ge=1, le=50_000)]
Limit = Annotated[int, Query(ge=1, le=50)]
