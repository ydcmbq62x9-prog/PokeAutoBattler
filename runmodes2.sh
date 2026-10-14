#!/bin/sh
# 4.0.0: run rules for Gen 2 and mixed runs. Rich/No PC/One Life are only checked (shared knobs); Mono is tuned per gens.
for G in '[2]' '[1,2]'; do
  GENS=$G node modtune.js richFoes 52 400 0 > mt2-rich-$G.log 2>&1 &
  GENS=$G node modtune.js nopcFoes 54 400 0 > mt2-nopc-$G.log 2>&1 &
  wait
  GENS=$G node modtune.js onelifeFoes 20.5 600 0 > mt2-one-$G.log 2>&1 &
  wait
done
for G in '[2]' '[1,2]'; do
  set -- Normal Fire Water Electric Grass Ice Fighting Ground Flying Poison Psychic Bug Rock Dark
  while [ $# -gt 0 ]; do
    GENS=$G node modtune.js mono:$1 52 400 3 > mt2-m$1-$G.log 2>&1 &
    [ $# -gt 1 ] && GENS=$G node modtune.js mono:$2 52 400 3 > mt2-m$2-$G.log 2>&1 &
    wait; shift; [ $# -gt 0 ] && shift
  done
done
echo done > modes2.done
