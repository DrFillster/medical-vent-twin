#!/usr/bin/env python3
from build_documented_airway_cohort import classify,assess
assert classify(223837,'7.5mm')=='positive';assert classify(224415,'Not applicable')=='negative';assert classify(224831,'')=='unknown';assert classify(223836,'Oral')=='unknown'
def row(i,t,v,st=None):return {'itemid':i,'charttime':t,'storetime':t if st is None else st,'value':v}
a=[row(223837,1,'7.5mm'),row(223838,2,'Oral-R')]
assert assess(a,5,10)['documentedAirwaySpan']
assert not assess(a[:1],5,10)['documentedAirwaySpan']
assert not assess(a+[row(224832,7,'Not applicable')],5,10)['documentedAirwaySpan']
assert not assess([row(223837,5,'7.5mm'),row(223838,5,'Oral-R')],5,10)['documentedAirwaySpan']
assert not assess(a+[row(223837,1,'Not applicable')],5,10)['documentedAirwaySpan']
assert not assess([row(223837,1,'7.5mm',12),a[1]],5,10)['documentedAirwaySpan']
assert assess(a+[row(224829,7,'Not applicable')],5,10)['documentedAirwaySpan']
assert assess([row(224829,1,'Perc Trach '),row(224831,2,'8.0mm')],5,10)['documentedAirwaySpan']
print('PASS two-field evidence, before-sample ordering, conflicts/unknowns, late availability, family isolation, trach and unit vocabulary')
