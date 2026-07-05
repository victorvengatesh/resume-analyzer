"""Add performance indexes and missing constraints

Revision ID: a2f3c8d1e904
Revises: 15c018e17e45
Create Date: 2026-07-05 00:00:00.000000

Adds:
- resumes.status index  (frequent filter in candidate list)
- resumes.job_applied index  (frequent filter)
- resumes.uploaded_at index  (sort/filter by date)
- resumes.match_level index  (distribution queries)
- batch_jobs.status index  (polling)
- batch_jobs.created_at index  (list ordering)
- audit_logs.created_at index  (time-range queries)
- interview_sessions.decision index  (analytics)
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a2f3c8d1e904'
down_revision: Union[str, Sequence[str], None] = '15c018e17e45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('resumes', schema=None) as batch_op:
        batch_op.create_index('ix_resumes_status',      ['status'],      unique=False)
        batch_op.create_index('ix_resumes_job_applied', ['job_applied'], unique=False)
        batch_op.create_index('ix_resumes_uploaded_at', ['uploaded_at'], unique=False)
        batch_op.create_index('ix_resumes_match_level', ['match_level'], unique=False)

    with op.batch_alter_table('batch_jobs', schema=None) as batch_op:
        batch_op.create_index('ix_batch_jobs_status',     ['status'],     unique=False)
        batch_op.create_index('ix_batch_jobs_created_at', ['created_at'], unique=False)

    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.create_index('ix_audit_logs_created_at', ['created_at'], unique=False)

    with op.batch_alter_table('interview_sessions', schema=None) as batch_op:
        batch_op.create_index('ix_interview_sessions_decision', ['decision'], unique=False)


def downgrade() -> None:
    with op.batch_alter_table('interview_sessions', schema=None) as batch_op:
        batch_op.drop_index('ix_interview_sessions_decision')

    with op.batch_alter_table('audit_logs', schema=None) as batch_op:
        batch_op.drop_index('ix_audit_logs_created_at')

    with op.batch_alter_table('batch_jobs', schema=None) as batch_op:
        batch_op.drop_index('ix_batch_jobs_created_at')
        batch_op.drop_index('ix_batch_jobs_status')

    with op.batch_alter_table('resumes', schema=None) as batch_op:
        batch_op.drop_index('ix_resumes_match_level')
        batch_op.drop_index('ix_resumes_uploaded_at')
        batch_op.drop_index('ix_resumes_job_applied')
        batch_op.drop_index('ix_resumes_status')
