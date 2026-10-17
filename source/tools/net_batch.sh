#!/bin/bash
# sequential multiplayer matrix; results in /tmp/netres/*.json
cd /workspace/boomerang-brawl
run() { name=$1; shift; env "$@" PORT=$((9200 + RANDOM % 500)) node tools/net_mp.mjs > /tmp/netres/$name.json 2>&1; echo "done $name" >> /tmp/netres/_log; }
run p2_classic_clean N=2 MODE=classic SECS=62
run p4_ctf_clean N=4 MODE=ctf SECS=62 SHOT=/workspace/boomerang-brawl/shots/v40/p4ctf
run p2_coins_lat150_loss5 N=2 MODE=coins SECS=62 DELAY=150 JITTER=30 LOSS=0.05
run p4_koth_lat200_loss10 N=4 MODE=koth SECS=62 DELAY=200 JITTER=40 LOSS=0.10
run p3_ball_lat100_loss5 N=3 MODE=ball SECS=62 DELAY=100 JITTER=20 LOSS=0.05
for m in team bomb crumble; do run p3_${m} N=3 MODE=$m SECS=35; done
run p2_classic_lat200_loss10 N=2 MODE=classic SECS=62 DELAY=200 JITTER=50 LOSS=0.10
echo ALLDONE >> /tmp/netres/_log
