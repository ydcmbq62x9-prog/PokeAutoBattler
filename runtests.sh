#!/bin/sh
# Whole suite (~9 min on 2 cores). Prints only what needs attention, then a one-line summary.
# Logs: _scratch/logs/<test>.log.  A test that fails once but passes on retry is listed as FLAKY.
cd "$(dirname "$0")"; chmod +x run1.sh; rm -f tests.done tests.out
ls *test.js wipefix.js selfix.js dockfix.js downfix.js carryfix.js movenames.js | xargs -P 2 -I{} ./run1.sh {} > _scratch/logs/summary.txt
grep -v '^ok' _scratch/logs/summary.txt > tests.out
echo "$(grep -c '^ok' _scratch/logs/summary.txt) ok, $(grep -c '^FLAKY' _scratch/logs/summary.txt) flaky, $(grep -c '^FAIL' _scratch/logs/summary.txt) failed"; cat tests.out
echo done > tests.done
