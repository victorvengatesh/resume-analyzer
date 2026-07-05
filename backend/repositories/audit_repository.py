from sqlalchemy.orm import Session
from backend.repositories.base import BaseRepository
from backend.models.audit_log import AuditLog

class AuditRepository(BaseRepository[AuditLog]):
    def __init__(self, db: Session):
        super().__init__(AuditLog, db)

    def log_action(self, action: str, user_id: str, user_email: str, ip_address: str, details: dict = None) -> AuditLog:
        log = AuditLog(
            action=action,
            user_id=user_id,
            user_email=user_email,
            ip_address=ip_address,
            details=details
        )
        return self.create(log)
