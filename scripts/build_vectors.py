#!/usr/bin/env python3
"""Build deterministic v1 vectors by weighted accord-to-dimension mappings."""
import argparse
from sqlalchemy import create_engine, text

DIMENSIONS=("warm","fresh","sweet","dark","woody","leather","marine","powdery","floral","fruit","green","spicy","resinous","luxury","projection","longevity")
MAP={"woody":{"woody":1,"warm":.4},"floral":{"floral":1,"powdery":.3},"fresh":{"fresh":1,"green":.4},"marine":{"marine":1,"fresh":.7},"amber":{"resinous":.8,"warm":.8,"sweet":.4},"leather":{"leather":1,"dark":.6}}

def vectorise(accords):
    values={d:0.0 for d in DIMENSIONS}
    for name,weight in accords:
        for dim,factor in MAP.get(name.lower(),{}).items(): values[dim]+=float(weight)*factor
    peak=max(values.values(),default=0)
    return {k:min(1,round(v/peak,3)) if peak else 0 for k,v in values.items()}

if __name__ == "__main__":
    p=argparse.ArgumentParser(); p.add_argument("database_url"); args=p.parse_args(); engine=create_engine(args.database_url)
    with engine.begin() as db:
        ids=db.scalars(text("SELECT id FROM fragrances")).all()
        for fid in ids:
            accords=db.execute(text("SELECT a.name,fa.weight FROM fragrance_accords fa JOIN accords a ON a.id=fa.accord_id WHERE fa.fragrance_id=:id"),{"id":fid}).all(); v=vectorise(accords)
            cols=','.join(DIMENSIONS); vals=','.join(':'+x for x in DIMENSIONS); updates=','.join(f'{x}=EXCLUDED.{x}' for x in DIMENSIONS)
            db.execute(text(f"INSERT INTO scent_vectors(fragrance_id,{cols}) VALUES(:id,{vals}) ON CONFLICT(fragrance_id) DO UPDATE SET {updates},updated_at=now()"),{"id":fid,**v})
