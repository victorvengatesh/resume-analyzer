import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Table, ForeignKey
from sqlalchemy.orm import relationship
from backend.db.database import Base

# Association table for User <-> Workspace many-to-many relationship
user_workspaces = Table(
    "user_workspaces",
    Base.metadata,
    Column("user_id", String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("workspace_id", String, ForeignKey("workspaces.id", ondelete="CASCADE"), primary_key=True),
)

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, unique=True, index=True)
    description = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    users = relationship("User", secondary=user_workspaces, back_populates="workspaces")
