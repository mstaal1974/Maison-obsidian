from fastapi import Depends, FastAPI, HTTPException, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .engine import build_scentprint, cosine_similarity, vector_from_record
from .models import Brand, CloneRelationship, Fragrance, LayeringCompatibility, ScentVector
from .schemas import BrandOut, FragranceDetail, FragranceSummary, RecommendationRequest, ScentprintRequest

app = FastAPI(title=settings.api_title, version="1.0.0", docs_url="/docs")


def summary(f: Fragrance, score=None):
    return FragranceSummary(id=f.id, brand=f.brand.name, name=f.name, family=f.family, gender=f.gender, score=score)


def detail(f: Fragrance, clone=None):
    positions = {p: [x.note.name for x in sorted(f.notes, key=lambda n: n.order) if x.type == p] for p in ("top", "heart", "base")}
    vector = {field: float(getattr(f.vector, field)) for field in ScentVector.__table__.columns.keys() if field not in {"fragrance_id", "model_version", "updated_at"}} if f.vector else None
    return FragranceDetail(**summary(f).model_dump(), description=f.description, concentration=f.concentration,
        **positions, accords=[{"name": x.accord.name, "weight": float(x.weight)} for x in f.accords],
        scent_vector=vector, clone=clone, products=[{"id": p.id, "size": p.size, "type": p.product_type, "sku": p.sku, "price": float(p.price), "currency": p.currency} for p in f.products if p.active])


@app.get("/health")
def health(): return {"status": "ok"}


@app.get("/brands", response_model=list[BrandOut])
def brands(db: Session = Depends(get_db)): return db.scalars(select(Brand).order_by(Brand.name)).all()


@app.get("/fragrances", response_model=list[FragranceSummary])
def fragrances(brand_id: int | None = None, family: str | None = None, limit: int = Query(50, le=200), db: Session = Depends(get_db)):
    query = select(Fragrance)
    if brand_id: query = query.where(Fragrance.brand_id == brand_id)
    if family: query = query.where(func.lower(Fragrance.family) == family.lower())
    return [summary(f) for f in db.scalars(query.limit(limit)).unique()]


@app.get("/fragrance/{fragrance_id}", response_model=FragranceDetail)
def fragrance(fragrance_id: int, db: Session = Depends(get_db)):
    item = db.get(Fragrance, fragrance_id)
    if not item: raise HTTPException(404, "Fragrance not found")
    clone = db.scalar(select(CloneRelationship).where(CloneRelationship.clone_id == fragrance_id))
    clone_data = {"original_id": clone.original_id, "similarity": float(clone.accuracy_score), "differences": clone.differences} if clone else None
    return detail(item, clone_data)


@app.get("/search", response_model=list[FragranceSummary])
def search(q: str = Query(min_length=2), limit: int = Query(20, le=100), db: Session = Depends(get_db)):
    pattern = f"%{q}%"
    items = db.scalars(select(Fragrance).join(Brand).where(or_(Fragrance.name.ilike(pattern), Brand.name.ilike(pattern), Fragrance.family.ilike(pattern), Fragrance.description.ilike(pattern))).limit(limit)).unique()
    return [summary(f) for f in items]


def ranked(vector, db, limit, exclude=None):
    rows = db.execute(select(Fragrance, ScentVector).join(ScentVector)).all()
    scored = [(cosine_similarity(vector, vector_from_record(v)), f) for f, v in rows if f.id != exclude]
    return [summary(f, round(score, 5)) for score, f in sorted(scored, reverse=True, key=lambda x: x[0])[:limit]]


@app.get("/similar", response_model=list[FragranceSummary])
def similar(fragrance_id: int, limit: int = Query(10, le=50), db: Session = Depends(get_db)):
    vector = db.get(ScentVector, fragrance_id)
    if not vector: raise HTTPException(404, "Scent vector not found")
    return ranked(vector_from_record(vector), db, limit, fragrance_id)


@app.get("/clone")
def clones(fragrance_id: int, db: Session = Depends(get_db)):
    return db.execute(select(CloneRelationship).where(or_(CloneRelationship.clone_id == fragrance_id, CloneRelationship.original_id == fragrance_id))).scalars().all()


@app.get("/layering")
def layering(fragrance_id: int, db: Session = Depends(get_db)):
    return db.execute(select(LayeringCompatibility).where(or_(LayeringCompatibility.fragrance_a_id == fragrance_id, LayeringCompatibility.fragrance_b_id == fragrance_id)).order_by(LayeringCompatibility.compatibility.desc())).scalars().all()


@app.post("/recommend", response_model=list[FragranceSummary])
def recommend(request: RecommendationRequest, db: Session = Depends(get_db)):
    return ranked(request.vector.values, db, request.limit)


@app.post("/scentprint")
def scentprint(request: ScentprintRequest):
    vector = build_scentprint(request.preferences, request.explicit)
    return {"model_version": "mofip-v1", "vector": vector.model_dump()}
