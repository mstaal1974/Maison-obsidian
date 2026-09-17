import pytest

from api.mofip.engine import build_scentprint, cosine_similarity
from api.mofip.schemas import Vector


def test_cosine_similarity():
    assert cosine_similarity([1, 0], [1, 0]) == 1
    assert cosine_similarity([1, 0], [0, 1]) == 0
    assert cosine_similarity([0, 0], [1, 0]) == 0


def test_scentprint_averages_preferences():
    result = build_scentprint([Vector(warm=1), Vector(warm=0, fresh=1)], None)
    assert result.warm == pytest.approx(.5)
    assert result.fresh == pytest.approx(.5)


def test_explicit_scentprint_wins():
    explicit = Vector(dark=.8)
    assert build_scentprint([Vector(fresh=1)], explicit) is explicit
