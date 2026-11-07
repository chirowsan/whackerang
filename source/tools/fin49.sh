# v4.9 full release suite (local relay on :8799 must be running for the net_* relay tests)
R=/workspace/out/v4.9/fin; mkdir -p $R; : > $R/summary; cd /tmp/pp; T=/workspace/boomerang-brawl/tools
for t in bush49 dens49 hop49 traps49calm trapcount49 combat49 vis49 traps43 poison48 abil47 hearts47 cd45 falls44 smoke31 touch31 v33test tut42; do node $T/$t.mjs > $R/$t.log 2>&1; echo "$t EXIT $? $(tail -1 $R/$t.log | cut -c1-120)" >> $R/summary; done
node $T/leak45.mjs file:///workspace/boomerang-brawl/Whackerang.html > $R/leak45.log 2>&1; echo "leak45 EXIT $?" >> $R/summary
for t in net_ui net_life net_poison48 net_mixed49; do node $T/$t.mjs > $R/$t.log 2>&1; echo "$t EXIT $? $(tail -1 $R/$t.log | cut -c1-120)" >> $R/summary; done
for t in net_relay43 net_cd45 relay43 net_match; do node $T/$t.mjs ws://localhost:8799 > $R/$t.log 2>&1; echo "$t EXIT $? $(tail -1 $R/$t.log | cut -c1-120)" >> $R/summary; done
echo ALLDONE >> $R/summary
