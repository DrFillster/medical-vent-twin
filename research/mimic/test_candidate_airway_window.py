#!/usr/bin/env python3
import duckdb
c=duckdb.connect();c.execute('CREATE TABLE windows(subject_id int,stay_id int,cutoff timestamp)');c.execute("INSERT INTO windows VALUES(1,1,timestamp '2020-01-01 12:00:00')");c.execute('CREATE TABLE devices(id int,subject_id int,stay_id int,charttime timestamp,storetime timestamp)')
for i,subject,stay,t,st in [(1,1,1,'09:00','09:05'),(2,1,1,'12:00','12:00'),(3,1,1,'11:00','12:00'),(4,1,1,'07:59','08:00'),(5,2,1,'09:00','09:05'),(6,1,2,'09:00','09:05'),(7,1,1,'08:00','08:01')]:
 c.execute('INSERT INTO devices VALUES(?,?,?,CAST(? AS TIMESTAMP),CAST(? AS TIMESTAMP))',[i,subject,stay,'2020-01-01 '+t,'2020-01-01 '+st])
r=c.execute("SELECT id FROM devices d WHERE EXISTS(SELECT 1 FROM windows w WHERE w.subject_id=d.subject_id AND w.stay_id=d.stay_id AND d.charttime>=w.cutoff-INTERVAL '4 hours' AND d.charttime<w.cutoff AND d.storetime<w.cutoff) ORDER BY id").fetchall();assert r==[(1,),(7,)],r
print('PASS available pre-change device window, late/same-time exclusion, lower boundary and subject/stay isolation')
