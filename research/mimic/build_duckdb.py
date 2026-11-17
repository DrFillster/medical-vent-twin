#!/usr/bin/env python3
from pathlib import Path
import argparse
import duckdb

RAW = Path("/Users/philipbernard/mimic-data/raw/mimiciv/3.1/mimiciv-3.1")
BOOT = Path("/Users/philipbernard/mimic-data/bootstrap/mimiciv-3.1")
OUT = Path("/Users/philipbernard/mimic-data/derived")
DB = OUT / "mimic.duckdb"

OUT.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument("--metadata-only", action="store_true")
args = parser.parse_args()
con = duckdb.connect(str(DB))

tables = {
    "patients": "hosp/patients.csv.gz",
    "admissions": "hosp/admissions.csv.gz",
    "labevents": "hosp/labevents.csv.gz",
    "d_labitems": "hosp/d_labitems.csv.gz",
    "transfers": "hosp/transfers.csv.gz",
    "icustays": "icu/icustays.csv.gz",
    "d_items": "icu/d_items.csv.gz",
    "chartevents": "icu/chartevents.csv.gz",
    "inputevents": "icu/inputevents.csv.gz",
    "outputevents": "icu/outputevents.csv.gz",
    "procedureevents": "icu/procedureevents.csv.gz",
}

def source_for(rel):
    for base in (RAW, BOOT):
        p = base / rel
        if p.exists():
            return p
    return None

loaded = []
metadata_tables = {"patients", "admissions", "d_labitems", "d_items", "icustays"}
for name, rel in tables.items():
    if args.metadata_only and name not in metadata_tables:
        continue
    p = source_for(rel)
    if not p:
        continue
    esc = str(p).replace("'", "''")
    con.execute(
        f"CREATE OR REPLACE VIEW {name} AS "
        f"SELECT * FROM read_csv_auto('{esc}', header=true, sample_size=200000)"
    )
    loaded.append(name)

if "d_items" in loaded:
    con.execute("""
        CREATE OR REPLACE TABLE vent_item_candidates AS
        SELECT itemid, label, abbreviation, linksto, category, unitname
        FROM d_items
        WHERE regexp_matches(
          lower(coalesce(label,'')),
          '(vent|peep|fio2|fraction inspired|tidal|respiratory rate|minute volume|minute ventilation|plateau|airway pressure|pressure support|inspiratory pressure|ventilator mode|set rate|o2 saturation|spo2|heart rate|arterial.*mean|mean arterial)'
        )
        ORDER BY lower(label), itemid
    """)
    con.execute(
        f"COPY vent_item_candidates TO '{OUT / 'vent_item_candidates.csv'}' "
        "(HEADER, DELIMITER ',')"
    )

if "d_labitems" in loaded:
    con.execute("""
        CREATE OR REPLACE TABLE abg_item_candidates AS
        SELECT itemid, label, fluid, category
        FROM d_labitems
        WHERE regexp_matches(
          lower(coalesce(label,'')),
          '(^ph$|pco2|po2|oxygen.*pressure|carbon dioxide.*pressure|bicarbonate|base excess|lactate|blood gas|o2 saturation)'
        )
        ORDER BY lower(label), itemid
    """)
    con.execute(
        f"COPY abg_item_candidates TO '{OUT / 'abg_item_candidates.csv'}' "
        "(HEADER, DELIMITER ',')"
    )

if "patients" in loaded and "icustays" in loaded:
    con.execute("""
        CREATE OR REPLACE VIEW adult_icustays AS
        SELECT i.*, p.gender, p.anchor_age, p.anchor_year, p.anchor_year_group, p.dod
        FROM icustays i
        JOIN patients p USING (subject_id)
        WHERE p.anchor_age >= 18
    """)

print("Database:", DB)
print("Views:", ", ".join(loaded))
for t in ("vent_item_candidates", "abg_item_candidates"):
    try:
        print(t, con.execute(f"SELECT count(*) FROM {t}").fetchone()[0])
    except Exception:
        pass
con.close()
