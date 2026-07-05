from typing import TypeVar, Generic, Type, List, Optional, Any, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.db.database import Base

ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(Generic[ModelType]):
    """
    Generic repository providing standard CRUD operations.
    All domain repositories extend this class.
    """

    def __init__(self, model: Type[ModelType], db: Session):
        self.model = model
        self.db = db

    # ── Read ─────────────────────────────────────────────────────

    def get(self, id: Any) -> Optional[ModelType]:
        """Fetch a single record by primary key."""
        return self.db.query(self.model).filter(self.model.id == id).first()

    def get_all(self, limit: int = 100, offset: int = 0) -> List[ModelType]:
        """Fetch all records with pagination."""
        return self.db.query(self.model).offset(offset).limit(limit).all()

    def count(self) -> int:
        """Return total record count for this model."""
        return self.db.query(func.count(self.model.id)).scalar() or 0

    def exists(self, id: Any) -> bool:
        """Return True if a record with the given id exists."""
        return self.db.query(
            self.db.query(self.model).filter(self.model.id == id).exists()
        ).scalar()

    # ── Write ────────────────────────────────────────────────────

    def create(self, obj_in: ModelType) -> ModelType:
        """Persist a new model instance."""
        self.db.add(obj_in)
        self.db.commit()
        self.db.refresh(obj_in)
        return obj_in

    def create_no_commit(self, obj_in: ModelType) -> ModelType:
        """Add a model instance without committing (for bulk operations)."""
        self.db.add(obj_in)
        return obj_in

    def update(self, db_obj: ModelType, obj_in: Dict[str, Any]) -> ModelType:
        """Update an existing model instance with a dict of new values."""
        for field, value in obj_in.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)
        self.db.commit()
        self.db.refresh(db_obj)
        return db_obj

    def delete(self, id: Any) -> bool:
        """Delete a record by primary key. Returns True if found and deleted."""
        obj = self.get(id)
        if obj:
            self.db.delete(obj)
            self.db.commit()
            return True
        return False

    def bulk_create(self, objects: List[ModelType]) -> List[ModelType]:
        """Persist multiple records in a single transaction."""
        for obj in objects:
            self.db.add(obj)
        self.db.commit()
        for obj in objects:
            self.db.refresh(obj)
        return objects
