#!/bin/sh
node modtune.js richFoes 52 800 5 > mt-rich.log 2>&1 &
node modtune.js nopcFoes 54 800 5 > mt-nopc.log 2>&1 &
wait
node modtune.js onelifeFoes 20.5 1200 5 > mt-one.log 2>&1 &
node modtune.js mono:Normal 52 800 5 > mt-mNormal.log 2>&1 &
wait
for pair in "Fire Water" "Electric Grass" "Bug Fighting" "Flying Poison" "Ground Ground2"; do set -- $pair
  node modtune.js mono:$1 52 800 5 > mt-m$1.log 2>&1 &
  [ "$2" != "Ground2" ] && node modtune.js mono:$2 52 800 5 > mt-m$2.log 2>&1 &
  wait
done
echo done > modes.done
