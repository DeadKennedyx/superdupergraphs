# SuperDuperGraphs


https://github.com/user-attachments/assets/c20818c7-64f5-4abc-af65-c6d905f4e752


Lightweight, dependency-free JavaScript library for interactive stock charts with TradingView-style drawings (text, emoji, pencil, arrows, shapes, projections, and more). Built on the HTML canvas so you can embed it anywhere without heavy bundles.

## Features
- Candlestick rendering with auto-fit spacing and optional volume bars
- High-DPI aware canvas for crisp lines on retina displays
- Drawing tools: pencil, line, arrow, rectangle, ellipse, text labels, emoji, and projection/forecast strokes
- Undo last drawing or erase specific drawings with hit-tested removal
- Grab/rotate drawings directly on the canvas (drag; Shift+drag to rotate)
- Cursor crosshair with live price/time readout and right-side price scale
- Export the chart (base + drawings) as a PNG data URL or downloadable file
- Selection handles for resizing drawings in grab mode
- Themeable colors and fonts with sane defaults
- Zero runtime dependencies; works with plain `<script type="module">`

## Install / Use

For now, consume straight from the repo or your bundler:

```html
<div id="chart"></div>
<script type="module">
  import { SuperDuperChart } from './src/index.js';

  const candles = [
    { time: Date.now(), open: 100, high: 105, low: 98, close: 102, volume: 12000 },
    { time: Date.now() + 86_400_000, open: 102, high: 108, low: 101, close: 106, volume: 15000 }
  ];

  const chart = new SuperDuperChart(document.getElementById('chart'), { data: candles, showVolume: true });
  chart.setActiveTool('arrow', { color: '#38bdf8' });
  chart.addDrawing({ type: 'text', x: 120, y: 80, text: 'Breakout', color: '#f59e0b' });
</script>
```

Data shape:

```js
{
  time: number | string, // epoch millis or date-like string
  open: number,
  high: number,
  low: number,
  close: number,
  volume?: number
}
```

## Drawing tools

Call `chart.setActiveTool(name, options)` to arm the overlay. Pointer interactions are handled for you on the overlay canvas.

- `pencil` — freehand path (`width`, `color`)
- `line` — straight segment (`width`, `color`, optional `dash`)
- `arrow` — line with head (`width`, `color`, `headLength`, `headWidth`)
- `rectangle` — drag to size (`width`, `color`, optional `fill`)
- `ellipse` — drag to size (`width`, `color`, optional `fill`)
- `text` — click to place text (`text`, `color`, `font`)
- `emoji` — click to place an emoji/character (`emoji`, `color`, `size`)
- `projection` — dashed forecast stroke (`color`, `label`, `dash`, `width`)
- `erase` — click any drawing to remove the topmost item under the cursor
- `grab` — click a drawing to move it; drag corner handles to resize; hold `Shift` while dragging to rotate rectangles, ellipses, text, emoji, and rotated paths

You can also add drawings programmatically:

```js
chart.addDrawing({ type: 'text', x: 30, y: 40, text: 'Earnings', color: '#f59e0b' });
```

## API
- `new SuperDuperChart(container, options)` — create a chart in a DOM element
- `setData(candles)` — replace price series
- `setTheme(partialTheme)` — override theme colors/fonts
- `setActiveTool(name, options)` — arm a drawing tool; pass `null` to disable
- `addDrawing(drawing)` — push a drawing object to the overlay
- `undoLastDrawing()` — remove the most recently added drawing (if any)
- `eraseDrawingAt(point, tolerance?)` — remove the topmost drawing at the supplied coordinates
- `exportImage({ includeOverlay = true, mimeType = 'image/png', quality }?)` — return a data URL of the chart; overlays included by default
- `downloadImage(filename?, options?)` — trigger a download using `exportImage`
- `clearDrawings()` — remove all drawings

Options:

```js
{
  data?: Candle[],
  showVolume?: boolean,
  padding?: { top: number, right: number, bottom: number, left: number },
  priceFormatter?: (value: number) => string,
  timeFormatter?: (value: any) => string,
  theme?: PartialTheme
}
```

## Demo

Run the included demo with any static server (Python shown). Serve from the repo root so `/dist` is reachable:

```bash
npm run build
python -m http.server 4173
```

Then open `http://localhost:4173/demo/` to try the drawing tools.

## License

MIT
