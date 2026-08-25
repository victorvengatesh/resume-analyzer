"""Add deep ATS analysis fields.

Revision ID: b7e40c3d12a1
Revises: a2f3c8d1e904
Create Date: 2026-08-25 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b7e40c3d12a1"
down_revision: Union[str, Sequence[str], None] = "a2f3c8d1e904"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("resumes", schema=None) as batch_op:
        batch_op.add_column(sa.Column("semantic_alignment", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("impact_analysis", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("critical_gaps", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("actionable_feedback", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("resumes", schema=None) as batch_op:
        batch_op.drop_column("actionable_feedback")
        batch_op.drop_column("critical_gaps")
        batch_op.drop_column("impact_analysis")
        batch_op.drop_column("semantic_alignment")
