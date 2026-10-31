cd /workspace/boomerang-brawl; R=/workspace/out/v4.7/soak2; mkdir -p $R
for s in small large huge; do node tools/soak47.mjs ${SEC:-12} $s > $R/$s.log 2>&1; echo "$s EXIT $?" >> $R/summary; done; echo ALLDONE >> $R/summary
