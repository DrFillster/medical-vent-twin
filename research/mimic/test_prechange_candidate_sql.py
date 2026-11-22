#!/usr/bin/env python3
"""Test exact specimen-screen SQL from script without reading patient files."""
import ast
from pathlib import Path
import duckdb
src=ast.parse(Path(__file__).with_name('screen_prechange_candidate_inputs.py').read_text());sql=next(n.args[0].value for n in ast.walk(src)if isinstance(n,ast.Call)and n.args and isinstance(n.args[0],ast.Constant)and isinstance(n.args[0].value,str)and n.args[0].value.startswith('CREATE TABLE lab_blocks'))
c=duckdb.connect();c.execute("CREATE TABLE chart_eligible(event_key int,subject_id int,hadm_id int,charttime timestamp)");c.execute("INSERT INTO chart_eligible VALUES(1,1,1,timestamp '2020-01-01 12:00:00')");c.execute('CREATE TABLE fixture(subject_id int,hadm_id int,specimen_id int,itemid int,charttime timestamp,storetime timestamp,value varchar,valuenum double,valueuom varchar)')
for sp,unit,late,typ in [(1,'mm Hg',False,'ART.'),(2,'mmHg',False,'ART.'),(3,None,False,'ART.'),(4,'mm Hg',True,'ART.'),(5,'mm Hg',False,'VEN.')]:
 for item,text,num in [(52033,typ,None),(50820,'7.4',7.4),(50818,'40',40),(50821,'90',90)]:
  c.execute("INSERT INTO fixture VALUES(1,1,?,?,timestamp '2020-01-01 11:00:00',CAST(? AS TIMESTAMP),?,?,?)",[sp,item,'2020-01-01 13:00:00'if late else '2020-01-01 11:05:00',text,num,unit if item in(50818,50821)else None])
sql=sql.replace('read_parquet(?)','fixture');c.execute(sql);assert c.execute('SELECT specimen_id FROM lab_blocks WHERE arterial AND no_conflicting_type AND ph AND co2 AND o2 ORDER BY specimen_id').fetchall()==[(1,),(2,)]
print('PASS exact specimen SQL accepts mm Hg/mmHg, rejects missing units, unavailable results and venous specimens')
