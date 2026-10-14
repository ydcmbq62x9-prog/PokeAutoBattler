#!/bin/sh
# Puts together the Cloudflare copy of Duels (game files + relay) in $PKB_OUT/duels-site.
# Run python3 build.py first. That folder is what goes on the duels-preview branch.
set -e; cd "$(dirname "$0")"; OUT="${PKB_OUT:-/mnt/user-data/outputs}"; APP="$OUT/gen2/pokebattler-app"; SITE="$OUT/duels-site"
[ -f "$APP/index.html" ] || { echo "no build in $APP: run python3 build.py first"; exit 1; }
rm -rf "$SITE"; mkdir -p "$SITE/public"; cp -r "$APP/." "$SITE/public/"; cp worker.js wrangler.jsonc "$SITE/"
printf '# PokeArena Duels preview\n\nBuilt by relay/site.sh from the multiplayer branch. `public/` is the game; `worker.js` is the Duels relay.\nCloudflare deploys this branch by itself (Workers Builds).\n' > "$SITE/README.md"
echo "site written: $SITE"
