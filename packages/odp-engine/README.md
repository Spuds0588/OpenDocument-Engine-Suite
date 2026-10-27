# odp-engine

Read `.odp` presentations in the browser. Zero dependencies, absolute slide layout, print-ready deck HTML for PDF export, and a Markdown transcript for indexing or LLM context.

Keywords: javascript parse odp slides, odp presentation viewer js, libreoffice impress to pdf client side, extract text from odp.

## Use it

One file, no install. Import it from a URL:

```js
import { parseODP } from 'https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@odp-engine-v1.0.0/packages/odp-engine/dist/index.js';
```

Load it in the `<head>` of a page. `type="module"` is required and module scripts are deferred, so the DOM is ready when the code runs:

```html
<head>
  <script type="module">
    import { parseODP } from 'https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@odp-engine-v1.0.0/packages/odp-engine/dist/index.js';

    const input = document.querySelector('input[type=file]');
    input.addEventListener('change', async () => {
      const deck = await parseODP(input.files[0]);
      document.querySelector('#preview').innerHTML = deck.toHTML();
    });
  </script>
</head>
```

Or copy the library into your project with one command:

```bash
curl -sLo odp-engine.js https://cdn.jsdelivr.net/gh/Spuds0588/OpenDocument-Engine-Suite@odp-engine-v1.0.0/packages/odp-engine/dist/index.js
```

```js
import { parseODP } from './odp-engine.js';
```

GitHub Pages serves the same bytes: `https://spuds0588.github.io/OpenDocument-Engine-Suite/packages/odp-engine/dist/index.js`. Swap the release tag for `main` to follow the newest build. The download is the complete library, 18.78 KB minified / 7.69 KB gzipped, with its types in `dist/index.d.ts`.

## Quick start

```js
import { parseODP } from './odp-engine.js';

const deck = await parseODP(file);

render(deck.toHTML());            // absolutely positioned slides
console.log(deck.toMarkdown());   // ## Slide 1 ... transcript
console.log(deck.meta.dimensions); // { width: '28cm', height: '21cm' }
deck.destroy();                   // revoke Blob URLs for slide images
```

`parseODP` accepts an `ArrayBuffer`, `Uint8Array`, `Blob` or `File`.

## API

| Member | Description |
| --- | --- |
| `parseODP(input)` | Async parse. Resolves to an `ODPPresentation`. |
| `deck.meta` | `{ format, slideCount, dimensions }` |
| `deck.slides` | Ordered slide AST array |
| `deck.resources.images` | Map of archive paths to Blob URLs |
| `deck.toAST()` | The complete presentation AST |
| `deck.toHTML()` | Standalone deck document, one slide per printed page |
| `deck.toMarkdown()` | Slide transcript with `## Slide N` sections |
| `deck.destroy()` | Revokes every Blob URL created for images |
| `setLogLevel(level)` | Tagged diagnostics, silent by default |

## AST

```js
{
  meta: { format: 'odp', slideCount: 2, dimensions: { width: '28cm', height: '21cm' } },
  slides: [{
    slideNumber: 1,
    name: 'Intro',
    background: '#fafafa',
    elements: [{
      type: 'text-box',             // text-box | image | shape
      style: 'pr1',
      shape: 'frame',
      geometry: { x: '2cm', y: '1.5cm', width: '24cm', height: '4cm' },
      content: {
        paragraphs: [
          { text: 'Welcome', style: 'Title' },
          { text: 'Agenda', style: 'Body', bullet: true },
        ],
      },
    }],
  }],
  resources: { images: { 'Pictures/logo.png': 'blob:...' } },
}
```

Element order is z-order: later elements paint over earlier ones. Groups are flattened so every visible frame keeps its own geometry. Speaker notes are excluded from the deck AST.

## Layout and fidelity

- Slide size comes from the presentation's page layout, so 4:3 and 16:9 decks keep their real canvas. Decks without a page layout fall back to classic 4:3 (25.4 × 19.05 cm).
- Frames keep `svg:x/y/width/height` in physical units; the renderer converts them to percentages of the slide, which keeps the layout responsive and exact when printed at the slide size.
- Fills, strokes, borders, text styles, bullets, image frames and master page background colors are mapped through the ODF style cascade.
- Text boxes that overflow their frame are clipped, matching Impress behaviour.

## Print to PDF

Each slide is a fixed-size, `page-break-after: always` page inside the generated document, with `@page { size; margin: 0 }` set to the deck dimensions.

```js
import { parseODP, triggerPrintToPDF } from './odp-engine.js';

triggerPrintToPDF((await parseODP(file)).toHTML());
```

## Markdown transcript

```
## Slide 1

### Welcome

- Agenda item one
- Bullet A
- Bullet B

![Slide 1 image](blob:...)

---

## Slide 2

### Wrap up
```

The first text paragraph on a slide becomes its `###` title; the rest become bullets. Slides are separated by `---`.

## Limitations

- Static rendering only: transitions, animations, embedded video and audio are ignored.
- Master-page placeholders are not expanded into empty frames; inherited background colors are applied.
- Notes pages are omitted from the deck AST.
- OLE objects and charts are skipped.
- ZIP64 archives are rejected.
- Node.js requires a `DOMParser` polyfill.

## License

MIT
