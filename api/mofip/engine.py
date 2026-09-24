from math import sqrt

from .models import VECTOR_FIELDS
from .schemas import Vector


def cosine_similarity(left: list[float], right: list[float]) -> float:
    dot = sum(a * b for a, b in zip(left, right, strict=True))
    norm = sqrt(sum(x*x for x in left)) * sqrt(sum(x*x for x in right))
    return dot / norm if norm else 0.0


def vector_from_record(record) -> list[float]:
    return [float(getattr(record, field)) for field in VECTOR_FIELDS]


def build_scentprint(preferences: list[Vector], explicit: Vector | None) -> Vector:
    if explicit:
        return explicit
    if not preferences:
        return Vector()
    count = len(preferences)
    return Vector(**{field: sum(getattr(v, field) for v in preferences) / count for field in VECTOR_FIELDS})
