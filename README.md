# PokéArena (5.8.1)

A Pokémon auto battler for me and my friends. This folder is the home-screen
app version: the game (`index.html`) plus what a phone needs to install it
(`manifest.webmanifest`, `icons/`) and play offline (`sw.js`).

## Put it on your phone

- **iPhone (Safari):** open the link, tap **Share**, then **Add to Home Screen**.
- **Android (Chrome):** open the link, tap **⋮**, then **Install app** (or START → Install app in the game).

It opens full screen from the home screen and works offline once it has
loaded. Your run is saved on the phone.

## Updating

Upload the new `index.html` and `sw.js` over the old ones (keep the rest).
Phones pick up the new version the next time they open the app with a
connection.
