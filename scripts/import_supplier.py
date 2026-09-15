#!/usr/bin/env python3
"""Normalise and import supplier price lists with an auditable report."""
from __future__ import annotations

import argparse
import json
import re
import uuid
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

REQUIRED = {"brand", "name", "sku", "price"}


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def normalise(frame: pd.DataFrame) -> pd.DataFrame:
    frame = frame.rename(columns=lambda c: clean(c).lower().replace(" ", "_"))
    missing = REQUIRED - set(frame.columns)
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")
    for field in ("brand", "name", "sku"):
        frame[field] = frame[field].map(clean)
    frame["price"] = pd.to_numeric(frame["price"], errors="coerce")
    frame = frame.drop_duplicates(subset=["sku"], keep="last")
    frame = frame[(frame.brand != "") & (frame.name != "") & frame.price.notna() & (frame.price >= 0)]
    return frame


def read_supplier(path: Path) -> pd.DataFrame:
    if path.suffix.lower() in {".xlsx", ".xls"}:
        return pd.read_excel(path)
    return pd.read_csv(path)


def load(frame: pd.DataFrame, database_url: str, source: str) -> dict:
    engine, run_id = create_engine(database_url), str(uuid.uuid4())
    report = {"run_id": run_id, "received": len(frame), "loaded": 0, "errors": []}
    with engine.begin() as db:
        db.execute(text("INSERT INTO import_runs(id,source_name,status,rows_received,started_at) VALUES(:id,:source,'running',:rows,now())"), {"id": run_id, "source": source, "rows": len(frame)})
        for row in frame.to_dict("records"):
            try:
                brand_id = db.scalar(text("INSERT INTO brands(name) VALUES(:name) ON CONFLICT(name) DO UPDATE SET name=EXCLUDED.name RETURNING id"), {"name": row["brand"]})
                fragrance_id = db.scalar(text("""INSERT INTO fragrances(brand_id,name,concentration) VALUES(:brand,:name,:concentration)
                  ON CONFLICT(brand_id,name,concentration) DO UPDATE SET name=EXCLUDED.name RETURNING id"""),
                  {"brand": brand_id, "name": row["name"], "concentration": row.get("concentration", "")})
                db.execute(text("""INSERT INTO products(fragrance_id,size,product_type,sku,price,currency,active)
                  VALUES(:fragrance,:size,:type,:sku,:price,:currency,true) ON CONFLICT(sku) DO UPDATE SET price=EXCLUDED.price,active=true"""),
                  {"fragrance": fragrance_id, "size": row.get("size", "Unknown"), "type": row.get("product_type", "Fragrance"), "sku": row["sku"], "price": row["price"], "currency": row.get("currency", "GBP")})
                report["loaded"] += 1
            except Exception as exc:  # preserve a row-level audit without exposing database details
                report["errors"].append({"sku": row.get("sku"), "error": type(exc).__name__})
        status = "completed" if not report["errors"] else "failed"
        db.execute(text("UPDATE import_runs SET status=:status,rows_loaded=:loaded,report=CAST(:report AS jsonb),completed_at=now() WHERE id=:id"),
                   {"status": status, "loaded": report["loaded"], "report": json.dumps(report), "id": run_id})
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path); parser.add_argument("--database-url"); parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    raw = read_supplier(args.source); frame = normalise(raw)
    report = load(frame, args.database_url, args.source.name) if args.database_url else {"received": len(raw), "valid": len(frame), "preview": frame.head(10).to_dict("records")}
    output = json.dumps(report, indent=2, default=str)
    if args.report: args.report.write_text(output)
    print(output)


if __name__ == "__main__": main()
