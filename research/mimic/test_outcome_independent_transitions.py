#!/usr/bin/env python3
import duckdb
from build_outcome_independent_transitions import build
c=duckdb.connect();c.execute('CREATE TABLE settings(subject_id int,hadm_id int,stay_id int,itemid int,charttime timestamp,storetime timestamp,valuenum double,valueuom varchar)')
# Fraction/percent equivalence; exact duplicates; contradictory same-time block;
# invalid block cannot be silently bridged; delayed recording remains flagged.
for h,v,store in [(0,.4,0),(1,40,1),(2,50,2),(2,50,2),(3,60,3),(3,70,3),(4,80,4),(5,90,7),(6,100,6)]:
 c.execute("INSERT INTO settings VALUES (1,1,1,223835, timestamp '2020-01-01' + ? * interval '1 hour',timestamp '2020-01-01' + ? * interval '1 hour',?,NULL)",[h,store,v])
build(c);r=c.execute('SELECT setting,prior_available_before_change FROM transitions ORDER BY charttime').fetchall();assert r==[(50.0,True),(90.0,True),(100.0,False)],r
print('PASS normalization, duplicate collapse, conflicting-block exclusion, no conflict bridging, delayed-prior availability flag')

# Invalid and missing-storetime blocks are not bridged; unit mismatch rejected.
c2=duckdb.connect()
c2.execute('CREATE TABLE settings(subject_id int,hadm_id int,stay_id int,itemid int,charttime timestamp,storetime timestamp,valuenum double,valueuom varchar)')
for h,v,u in [(0,5,'cmH2O'),(1,99,'cmH2O'),(2,10,'cmH2O'),(3,12,'wrong'),(4,14,'cmH2O'),(5,16,'cmH2O')]:
 c2.execute("INSERT INTO settings VALUES(2,2,2,220339,timestamp '2020-01-01'+?*interval '1 hour',timestamp '2020-01-01'+?*interval '1 hour',?,?)",[h,h,v,u])
build(c2);assert c2.execute('SELECT setting FROM transitions').fetchall()==[(16.0,)]
print('PASS invalid value and wrong unit block adjacent comparisons, no silent bridging')
