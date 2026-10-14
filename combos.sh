for g in '[1]' '[2]' '[1,2]'; do
 for m in '{}' '{"onelife":true}' '{"nopc":true}' '{"rich":true}' '{"mono":"Water"}' '{"mono":"Ground"}' '{"mono":"Psychic"}' '{"mono":"Fire"}'; do
  node combos.js "$g" "$m" 400
 done
done
echo DONE
