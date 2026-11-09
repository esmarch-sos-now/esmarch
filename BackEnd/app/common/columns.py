from sqlalchemy import Column, DateTime


def tstz(nullable: bool = True) -> Column:
    return Column(DateTime(timezone=True), nullable=nullable)
