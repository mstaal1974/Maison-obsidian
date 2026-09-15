#!/usr/bin/env python3
import argparse
import pandas as pd
from sqlalchemy import create_engine

if __name__ == '__main__':
    p=argparse.ArgumentParser(); p.add_argument('database_url'); p.add_argument('output'); args=p.parse_args(); engine=create_engine(args.database_url)
    with pd.ExcelWriter(args.output) as writer:
        for table in ('brands','fragrances','notes','accords','products','clone_relationships','scent_vectors'):
            pd.read_sql_table(table,engine).to_excel(writer,sheet_name=table,index=False)
