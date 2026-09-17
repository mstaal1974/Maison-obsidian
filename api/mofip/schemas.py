from pydantic import BaseModel, Field

from .models import VECTOR_FIELDS


class BrandOut(BaseModel):
    id: int; name: str; country: str | None = None; website: str | None = None; verified: bool
    model_config = {"from_attributes": True}


class Vector(BaseModel):
    warm: float = 0; fresh: float = 0; sweet: float = 0; dark: float = 0
    woody: float = 0; leather: float = 0; marine: float = 0; powdery: float = 0
    floral: float = 0; fruit: float = 0; green: float = 0; spicy: float = 0
    resinous: float = 0; luxury: float = 0; projection: float = 0; longevity: float = 0

    @property
    def values(self) -> list[float]:
        return [getattr(self, field) for field in VECTOR_FIELDS]


class RecommendationRequest(BaseModel):
    vector: Vector
    limit: int = Field(10, ge=1, le=50)
    season: str | None = None; weather: str | None = None; occasion: str | None = None
    personality: str | None = None; budget: float | None = Field(None, ge=0)
    collection: str | None = None; previous_purchases: list[int] = []


class ScentprintRequest(BaseModel):
    preferences: list[Vector] = []
    explicit: Vector | None = None


class FragranceSummary(BaseModel):
    id: int; brand: str; name: str; family: str | None; gender: str | None; score: float | None = None


class FragranceDetail(FragranceSummary):
    description: str | None; concentration: str | None
    top: list[str]; heart: list[str]; base: list[str]
    accords: list[dict]; scent_vector: dict | None; clone: dict | None; products: list[dict]
