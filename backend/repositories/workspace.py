from typing import Optional
from sqlalchemy.orm import Session
from backend.repositories.base import BaseRepository
from backend.models.workspace import Workspace

class WorkspaceRepository(BaseRepository[Workspace]):
    def __init__(self, db: Session):
        super().__init__(Workspace, db)

    def get_by_name(self, name: str) -> Optional[Workspace]:
        return self.db.query(Workspace).filter(Workspace.name == name).first()
