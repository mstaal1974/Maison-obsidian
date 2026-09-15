#!/usr/bin/env python3
import argparse, itertools
from sqlalchemy import create_engine, text
from build_vectors import DIMENSIONS
from math import sqrt

def similarity(a,b):
    dot=sum(x*y for x,y in zip(a,b)); norm=sqrt(sum(x*x for x in a)*sum(x*x for x in b)); return dot/norm if norm else 0

if __name__ == '__main__':
    p=argparse.ArgumentParser(); p.add_argument('database_url'); p.add_argument('--threshold',type=float,default=.75); args=p.parse_args(); engine=create_engine(args.database_url)
    with engine.connect() as db:
        rows=db.execute(text(f"SELECT fragrance_id,{','.join(DIMENSIONS)} FROM scent_vectors")).all()
    for a,b in itertools.combinations(rows,2):
        score=similarity(list(map(float,a[1:])),list(map(float,b[1:])))
        if score>=args.threshold: print(f'{a[0]},{b[0]},{score:.5f}')
