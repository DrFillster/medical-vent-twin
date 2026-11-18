#!/usr/bin/env python3
from pathlib import Path
import duckdb

DER=Path("/Users/philipbernard/mimic-data/derived")
src=DER/"pilot_review_sample_100.parquet"
out=DER/"pilot_review_sheet_100.csv"
con=duckdb.connect()
con.execute(f"""
COPY (
 SELECT
   printf('EVT-%03d', row_number() over(order by itemid,transition_time,stay_id)) event_id,
   itemid, transition_time, prev_x, new_x, valueuom,
   pre_abg_minutes, post_abg_minutes,
   pre_ph,post_ph,pre_pco2,post_pco2,pre_po2,post_po2,
   pre_hr,post_hr,pre_map,post_map,pre_spo2,post_spo2,
   '' review_status, '' exclusion_reason, '' reviewer_notes
 FROM read_parquet('{src}')
 ORDER BY itemid,transition_time,stay_id
) TO '{out}' (HEADER, DELIMITER ',')
""")
print(out)
