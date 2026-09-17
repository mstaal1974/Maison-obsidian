#!/usr/bin/env python3
import argparse, json
from sqlalchemy import create_engine, text

CHECKS = {
 "duplicate_brands": "SELECT lower(name),count(*) FROM brands GROUP BY lower(name) HAVING count(*)>1",
 "duplicate_fragrances": "SELECT brand_id,lower(name),concentration,count(*) FROM fragrances GROUP BY 1,2,3 HAVING count(*)>1",
 "missing_notes": "SELECT f.id,f.name FROM fragrances f LEFT JOIN fragrance_notes n ON n.fragrance_id=f.id WHERE n.fragrance_id IS NULL",
 "missing_descriptions": "SELECT id,name FROM fragrances WHERE description IS NULL OR btrim(description)=''",
 "orphan_products": "SELECT p.id,p.sku FROM products p LEFT JOIN fragrances f ON f.id=p.fragrance_id WHERE f.id IS NULL",
 "invalid_clone_links": "SELECT id,clone_id,original_id FROM clone_relationships WHERE clone_id=original_id",
 "duplicate_aliases": "SELECT entity_type,lower(alias),count(*) FROM aliases GROUP BY 1,2 HAVING count(*)>1",
}

def validate(url):
    engine=create_engine(url); report={}
    with engine.connect() as db:
        for name, query in CHECKS.items(): report[name]=[list(row) for row in db.execute(text(query))]
    return report

if __name__ == "__main__":
    p=argparse.ArgumentParser(); p.add_argument("database_url"); args=p.parse_args()
    result=validate(args.database_url); print(json.dumps(result,indent=2,default=str)); raise SystemExit(any(result.values()))
