#!/bin/sh
GENS='[2]' node modtune.js nopcFoes 54 400 2 > mt5-nopc2.log 2>&1 &
GENS='[2]' node modtune.js onelifeFoes 20.5 600 2 > mt5-one2.log 2>&1 &
wait
set -- Normal Fire Water Electric Ice Fighting Bug Dark
while [ $# -gt 0 ]; do
  GENS='[2]' node modtune.js mono:$1 52 400 3 > mt5-m$1.log 2>&1 &
  GENS='[2]' node modtune.js mono:$2 52 400 3 > mt5-m$2.log 2>&1 &
  wait; shift 2
done
echo done > modes3.done
