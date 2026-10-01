#!/bin/sh
ls *test.js wipefix.js selfix.js dockfix.js downfix.js carryfix.js movenames.js | xargs -P 2 -I{} sh -c 'timeout 500 node {} > out-{}.log 2>&1; echo "{} $?"' | grep -v " 0$" > tests.out
echo done > tests.done
