import json,sys
t=open(sys.argv[1]).read()
try:
    d=json.loads(t[t.index('{'):])
    for k in ['N','MODE','DELAY','JITTER','LOSS','joined','cmp','aliveMismatchSamples','stateMismatch','phaseBad','posErr','hostSimSeconds','persistentMismatch','snapCheck','clients','errors']:
        if k in d: print(k, json.dumps(d.get(k)))
except Exception as e: print('ERR',e); print(t[-1500:])
