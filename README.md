# yourFlorist

Pick flowers, write a note, and send someone a bouquet as a link.

The bouquet is drawn in 3D ASCII (drag to turn it), and it and the note are packed into the link's `#` fragment, so there is no
server and nothing is stored. The art follows the Herbarium style of
[fyoalharbi/Fayhaa](https://github.com/fyoalharbi/Fayhaa): ASCII flower heads with
live 0/1 petals, gold `@8` eyes and `'.` rims.

## Run locally

```sh
python -m http.server 4321   # http://localhost:4321
```

It is four static files (`index.html`, `style.css`, `app.js`, `bouquet3d.js`), so any static host works.
