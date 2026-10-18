cd /workspace/boomerang-brawl; R=/workspace/out/v4.3-results; rm -rf $R; mkdir -p $R
for t in smoke31 touch31 v33test traps43 tut42; do node tools/$t.mjs > $R/$t.log 2>&1; echo "$t EXIT $?" >> $R/summary; done
node tools/layout42.mjs shots/v43/layout-final > $R/layout42.log 2>&1; echo "layout42 EXIT $?" >> $R/summary
node tools/perf30.mjs sharp 4 file:///tmp/v43_final.html > $R/perf43.log 2>&1; echo "perf EXIT $?" >> $R/summary
for t in net_ui net_life; do node tools/$t.mjs > $R/$t.log 2>&1; echo "$t EXIT $?" >> $R/summary; done
node tools/net_relay43.mjs ws://localhost:8799 > $R/net_relay43_local.log 2>&1; echo "net_relay43 EXIT $?" >> $R/summary
node tools/relay43.mjs ws://localhost:8799 > $R/relay43_local.log 2>&1; echo "relay43_local EXIT $?" >> $R/summary
node tools/relay43.mjs wss://whackerang-relay.chirowsan-backyard.workers.dev > $R/relay43_live.log 2>&1; echo "relay43_live EXIT $?" >> $R/summary
mkdir -p /workspace/out/v4.3-shots; node tools/shots43.mjs > $R/shots43.log 2>&1; echo "shots43 EXIT $?" >> $R/summary
echo DONE >> $R/summary
