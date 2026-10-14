#!/bin/sh
# One command from "edits done" to "ready to publish": build, quick checks, and the two files to hand over.
#   ./release.sh          build + quick suite (~1 min) + phone layout check
#   ./release.sh full     the same, then the whole suite (~9 min)
set -e
cd "$(dirname "$0")"
python3 build.py | cut -c1-70
./quick.sh
node phonepass.js | tail -1
[ "$1" = "full" ] && ./runtests.sh
echo
OUT="${PKB_OUT:-/mnt/user-data/outputs}"; echo "Ready: $OUT/pokebattler.html and $OUT/gen2/pokebattler-app.zip"
