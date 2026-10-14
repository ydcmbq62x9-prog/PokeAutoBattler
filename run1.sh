#!/bin/sh
# run one test file; if it fails, run it once more. Passing the second time is reported as FLAKY (so a
# timing flake is visible but doesn't block a release), failing twice is a real FAIL.
f="$1"; mkdir -p _scratch/logs; s=$(date +%s)
if timeout 500 node "$f" > "_scratch/logs/$f.log" 2>&1; then echo "ok $(( $(date +%s) - s ))s $f"; exit 0; fi
if timeout 500 node "$f" > "_scratch/logs/$f.log" 2>&1; then echo "FLAKY $(( $(date +%s) - s ))s $f"; exit 0; fi
echo "FAIL $(( $(date +%s) - s ))s $f"; exit 1
