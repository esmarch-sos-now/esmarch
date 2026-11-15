from sqlalchemy import Column, DateTime


def tstz(nullable: bool = True, index: bool = False) -> Column:
    return Column(DateTime(timezone=True), nullable=nullable, index=index)
