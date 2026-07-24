from sqlalchemy import String, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

class Routing(Base):
    __tablename__ = "routing"                                   # pyright: ignore[reportUnannotatedClassAttribute]

    id: Mapped[int] = mapped_column(primary_key=True)
    xray_json: Mapped[str]                                         # pyright: ignore[reportUninitializedInstanceVariable]

