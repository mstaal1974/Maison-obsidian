from sqlalchemy import BigInteger, Boolean, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Brand(Base):
    __tablename__ = "brands"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True)
    country: Mapped[str | None] = mapped_column(String)
    website: Mapped[str | None] = mapped_column(String)
    logo: Mapped[str | None] = mapped_column(String)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)


class Fragrance(Base):
    __tablename__ = "fragrances"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"))
    name: Mapped[str] = mapped_column(String)
    concentration: Mapped[str | None] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text)
    family: Mapped[str | None] = mapped_column(String)
    gender: Mapped[str | None] = mapped_column(String)
    release_year: Mapped[int | None]
    perfumer: Mapped[str | None] = mapped_column(String)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    brand: Mapped[Brand] = relationship(lazy="joined")
    notes: Mapped[list["FragranceNote"]] = relationship(lazy="selectin")
    accords: Mapped[list["FragranceAccord"]] = relationship(lazy="selectin")
    products: Mapped[list["Product"]] = relationship(lazy="selectin")
    vector: Mapped["ScentVector | None"] = relationship(lazy="joined")


class Note(Base):
    __tablename__ = "notes"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String)


class FragranceNote(Base):
    __tablename__ = "fragrance_notes"
    fragrance_id: Mapped[int] = mapped_column(ForeignKey("fragrances.id"), primary_key=True)
    note_id: Mapped[int] = mapped_column(ForeignKey("notes.id"), primary_key=True)
    type: Mapped[str] = mapped_column(String, primary_key=True)
    order: Mapped[int] = mapped_column("order")
    strength: Mapped[float] = mapped_column(Numeric)
    note: Mapped[Note] = relationship(lazy="joined")


class Accord(Base):
    __tablename__ = "accords"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String)


class FragranceAccord(Base):
    __tablename__ = "fragrance_accords"
    fragrance_id: Mapped[int] = mapped_column(ForeignKey("fragrances.id"), primary_key=True)
    accord_id: Mapped[int] = mapped_column(ForeignKey("accords.id"), primary_key=True)
    weight: Mapped[float] = mapped_column(Numeric)
    accord: Mapped[Accord] = relationship(lazy="joined")


class Product(Base):
    __tablename__ = "products"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    fragrance_id: Mapped[int] = mapped_column(ForeignKey("fragrances.id"))
    size: Mapped[str]; product_type: Mapped[str]; sku: Mapped[str]
    price: Mapped[float] = mapped_column(Numeric)
    currency: Mapped[str]; active: Mapped[bool]


VECTOR_FIELDS = ("warm", "fresh", "sweet", "dark", "woody", "leather", "marine", "powdery", "floral", "fruit", "green", "spicy", "resinous", "luxury", "projection", "longevity")


class ScentVector(Base):
    __tablename__ = "scent_vectors"
    fragrance_id: Mapped[int] = mapped_column(ForeignKey("fragrances.id"), primary_key=True)
    for field in VECTOR_FIELDS:
        locals()[field] = mapped_column(Numeric)
    model_version: Mapped[str]


class CloneRelationship(Base):
    __tablename__ = "clone_relationships"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    clone_id: Mapped[int] = mapped_column(ForeignKey("fragrances.id"))
    original_id: Mapped[int] = mapped_column(ForeignKey("fragrances.id"))
    accuracy_score: Mapped[float] = mapped_column(Numeric)
    differences: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)


class LayeringCompatibility(Base):
    __tablename__ = "layering_compatibility"
    fragrance_a_id: Mapped[int] = mapped_column(ForeignKey("fragrances.id"), primary_key=True)
    fragrance_b_id: Mapped[int] = mapped_column(ForeignKey("fragrances.id"), primary_key=True)
    compatibility: Mapped[float] = mapped_column(Numeric)
    reason: Mapped[str]
