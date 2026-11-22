#!/usr/bin/env python3
import ast,duckdb
from pathlib import Path
s=ast.parse(Path(__file__).with_name('screen_candidate_exposure_alignment.py').read_text());sql=next(n.args[0].value for n in ast.walk(s)if isinstance(n,ast.Call)and n.args and isinstance(n.args[0],ast.Constant)and isinstance(n.args[0].value,str)and n.args[0].value.startswith('CREATE TABLE checks'))
c=duckdb.connect();c.execute('CREATE TABLE measurements(event_key int,measurement varchar,sample_time int)');c.execute('CREATE TABLE cutoff(event_key int,itemid int,val varchar,valid boolean)');c.execute('CREATE TABLE blocks(event_key int,itemid int,charttime int,valid boolean,val varchar)')
for eid in range(1,6):c.execute("INSERT INTO measurements VALUES(?,'gas',10)",[eid]);c.execute("INSERT INTO cutoff VALUES(?,1,'40',true)",[eid])
for row in [(1,1,5,True,'40'),(2,1,10,True,'40'),(3,1,5,True,'40'),(3,1,12,True,'50'),(4,1,5,True,'40'),(4,1,12,False,'40'),(5,1,5,True,'30')]:c.execute('INSERT INTO blocks VALUES(?,?,?,?,?)',row)
c.execute(sql);r=c.execute('SELECT event_key,matches,later_conflict FROM checks ORDER BY event_key').fetchall();assert r==[(1,True,False),(2,False,False),(3,True,True),(4,True,True),(5,False,False)],r
print('PASS strict earlier support, same-time ambiguity, later setting change, invalid conflict and mismatch')
