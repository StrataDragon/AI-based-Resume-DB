from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Iterable

from sqlalchemy import event
from sqlalchemy.inspection import inspect as sa_inspect

try:
    from .models import AuditLog, Candidate, JDSkill, JobDescription, MatchResult, Resume, ResumeSkill, ResumeVersion, Skill
except ImportError:
    from models import AuditLog, Candidate, JDSkill, JobDescription, MatchResult, Resume, ResumeSkill, ResumeVersion, Skill


_REGISTERED = False

TRACKED_MODELS: Iterable[type] = (
    Candidate,
    Resume,
    Skill,
    ResumeSkill,
    JobDescription,
    JDSkill,
    MatchResult,
    ResumeVersion,
)


def _serialize_value(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, list):
        return [_serialize_value(v) for v in value]
    if isinstance(value, dict):
        return {str(k): _serialize_value(v) for k, v in value.items()}
    return str(value)


def _snapshot(target: Any) -> Dict[str, Any]:
    state = sa_inspect(target)
    row: Dict[str, Any] = {}
    for attr in state.mapper.column_attrs:
        key = attr.key
        row[key] = _serialize_value(getattr(target, key))
    return row


def _pk_string(target: Any) -> str:
    state = sa_inspect(target)
    parts = []
    for col in state.mapper.primary_key:
        key = col.key
        parts.append(f"{key}={_serialize_value(getattr(target, key, None))}")
    return ", ".join(parts) if parts else "unknown"


def _changed_values(target: Any) -> tuple[Dict[str, Any], Dict[str, Any]]:
    state = sa_inspect(target)
    old_values: Dict[str, Any] = {}
    new_values: Dict[str, Any] = {}

    for attr in state.mapper.column_attrs:
        key = attr.key
        hist = state.attrs[key].history
        if not hist.has_changes():
            continue

        old_val = hist.deleted[0] if hist.deleted else None
        new_val = hist.added[0] if hist.added else getattr(target, key, None)
        old_values[key] = _serialize_value(old_val)
        new_values[key] = _serialize_value(new_val)

    return old_values, new_values


def _write_log(connection, action: str, target: Any, old_values: Dict[str, Any] | None, new_values: Dict[str, Any] | None) -> None:
    connection.execute(
        AuditLog.__table__.insert().values(
            table_name=target.__table__.name,
            action=action,
            record_pk=_pk_string(target),
            changed_by="system",
            old_values=old_values,
            new_values=new_values,
        )
    )


def _after_insert(mapper, connection, target) -> None:
    if isinstance(target, AuditLog):
        return
    _write_log(connection, "INSERT", target, None, _snapshot(target))


def _after_update(mapper, connection, target) -> None:
    if isinstance(target, AuditLog):
        return
    old_values, new_values = _changed_values(target)
    if not old_values and not new_values:
        return
    _write_log(connection, "UPDATE", target, old_values, new_values)


def _after_delete(mapper, connection, target) -> None:
    if isinstance(target, AuditLog):
        return
    _write_log(connection, "DELETE", target, _snapshot(target), None)


def register_audit_listeners() -> None:
    global _REGISTERED
    if _REGISTERED:
        return

    for model in TRACKED_MODELS:
        event.listen(model, "after_insert", _after_insert, propagate=True)
        event.listen(model, "after_update", _after_update, propagate=True)
        event.listen(model, "after_delete", _after_delete, propagate=True)

    _REGISTERED = True
