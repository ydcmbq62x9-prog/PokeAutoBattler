#!/bin/sh
# The fast check (~30 s): every test that needs no browser and is not marked @slow, i.e. all the game rules, items, shop, economy and
# the changelog/version check. Run this after every edit; run ./runtests.sh (or ./release.sh full) before shipping.
cd "$(dirname "$0")"; chmod +x run1.sh; mkdir -p _scratch/logs
ls *test.js wipefix.js selfix.js dockfix.js downfix.js carryfix.js movenames.js | while read f; do grep -q "playwright\|@slow" "$f" || echo "$f"; done \
  | xargs -P 2 -I{} ./run1.sh {} > _scratch/logs/quick.txt
echo "$(grep -c '^ok' _scratch/logs/quick.txt) ok, $(grep -c '^FLAKY' _scratch/logs/quick.txt) flaky, $(grep -c '^FAIL' _scratch/logs/quick.txt) failed (engine-only suite)"
grep -v '^ok' _scratch/logs/quick.txt; ! grep -q '^FAIL' _scratch/logs/quick.txt
