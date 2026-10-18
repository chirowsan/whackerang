cd /workspace/boomerang-brawl; R=/workspace/out/v4.3-results
for t in net_ui net_life; do node tools/$t.mjs > $R/$t.log 2>&1; echo "$t EXIT $?" >> $R/summary2; done
node tools/net_relay43.mjs ws://localhost:8799 > $R/net_relay43_local.log 2>&1; echo "net_relay43 EXIT $?" >> $R/summary2
echo DONE >> $R/summary2
