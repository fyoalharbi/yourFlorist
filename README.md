# yourFlorist

Pick flowers, write a note, and send someone a bouquet as a link:
**https://fyoalharbi.github.io/yourFlorist/**

The bouquet is drawn in 3D ASCII in the Herbarium style of
[fyoalharbi/Fayhaa](https://github.com/fyoalharbi/Fayhaa): petals of live 0/1 bits, gold `@8` eyes,
stems and leaves in line glyphs, folded paper with a ribbon. Drag it to turn it.

## How it works

- **No server.** The flowers, the wrap, the arrangement and the note are packed into the link's
  `#` fragment, which browsers never send anywhere. Nothing is stored.
- **Links** (`#g=`): a few bytes for the flowers, wrap, language and centre flower, then the
  words, deflated when that's shorter. Old `#b=` links still open.
- **English and Arabic.** The recipient sees the page in the sender's language, and can switch.
- **The recipient** can save the bouquet and the note as an image.

## Files

- `index.html`, `style.css`: the page and its look
- `app.js`: the composer, the link format, the gift page, saving the image, English/Arabic
- `bouquet3d.js`: the flowers, the wrap, and the 3D ASCII renderer
- `og.png`: the image shown when a link is pasted into a chat

## Run locally

```sh
python -m http.server 4321   # http://localhost:4321
```

Pushing to `main` publishes the site via GitHub Pages.
