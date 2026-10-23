cd /workspace/boomerang-brawl; R=/workspace/out/v4.5.1-results; mkdir -p $R
for t in cd45 falls44 smoke31 touch31 v33test traps43 tut42; do node tools/$t.mjs > $R/$t.log 2>&1; echo "$t EXIT $?" >> $R/summary; done
node tools/leak45.mjs file:///tmp/v451_final.html > $R/leak45_final.log 2>&1; echo "leak45 EXIT $?" >> $R/summary
node tools/layout42.mjs shots/v43/layout451 > $R/layout42.log 2>&1; echo "layout42 EXIT $?" >> $R/summary
for t in net_ui net_life; do node tools/$t.mjs > $R/$t.log 2>&1; echo "$t EXIT $?" >> $R/summary; done
node tools/net_relay43.mjs ws://localhost:8799 > $R/net_relay43_local.log 2>&1; echo "net_relay43 EXIT $?" >> $R/summary
node tools/net_cd45.mjs ws://localhost:8799 > $R/net_cd45.log 2>&1; echo "net_cd45 EXIT $?" >> $R/summary
node tools/relay43.mjs ws://localhost:8799 > $R/relay43_local.log 2>&1; echo "relay43_local EXIT $?" >> $R/summary
echo DONE >> $R/summary
