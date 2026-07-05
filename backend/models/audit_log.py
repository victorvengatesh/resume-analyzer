import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, JSON
from backend.db.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=True, index=True)
    user_email = Column(String, nullable=True)
    action = Column(String, nullable=False, index=True)
    details = Column(JSON, nullable=True)
    ip_address = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
