import { DEFAULT_THEME } from './theme.js';
import {
  clamp,
  formatPrice,
  formatTime,
  setupHiDPICanvas,
  deepMerge
} from './utils.js';
import { DrawingManager } from './drawing.js';

const DEFAULT_OPTIONS = {
  padding: { top: 16, right: 64, bottom: 28, left: 56 },
  minCandleWidth: 4,
  maxCandleWidth: 18,
  priceFormatter: formatPrice,
  timeFormatter: formatTime,
  showVolume: true
};

function clearCanvas(ctx) {
  const { canvas } = ctx;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function rotatePoint(point, center, angle) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  return {
    x: center.x + dx * cosA - dy * sinA,
    y: center.y + dx * sinA + dy * cosA
  };
}

export class SuperDuperChart {
  constructor(container, options = {}) {
    if (!container) throw new Error('A container element is required');
    this.container = container;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.theme = deepMerge(DEFAULT_THEME, options.theme || {});
    this.data = options.data || [];
    this.pointerState = null;
    this.cursor = null;
    this.selection = null;
    this.activeTool = null;
    this._setupElements();
    this._bindEvents();
    this.resize();
    this.setData(this.data);
  }

  _setupElements() {
    this.container.style.position = 'relative';
    this.container.style.userSelect = 'none';
    this.container.style.touchAction = 'none';

    this.canvas = document.createElement('canvas');
    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.style.position = 'absolute';
    this.overlayCanvas.style.left = '0';
    this.overlayCanvas.style.top = '0';
    this.overlayCanvas.style.pointerEvents = 'auto';
    this.overlayCanvas.style.cursor = 'crosshair';

    this.container.appendChild(this.canvas);
    this.container.appendChild(this.overlayCanvas);
    this.ctx = this.canvas.getContext('2d');
    this.overlayCtx = this.overlayCanvas.getContext('2d');
    this.drawingManager = new DrawingManager(this.overlayCtx, this.theme);
  }

  _bindEvents() {
    this._onResize = () => this.resize();
    this._onPointerDown = (evt) => this._handlePointerDown(evt);
    this._onPointerMove = (evt) => this._handlePointerMove(evt);
    this._onPointerUp = (evt) => this._handlePointerUp(evt);
    this._onPointerLeave = (evt) => this._handlePointerLeave(evt);
    window.addEventListener('resize', this._onResize);
    this.overlayCanvas.addEventListener('pointerdown', this._onPointerDown);
    this.overlayCanvas.addEventListener('pointermove', this._onPointerMove);
    this.overlayCanvas.addEventListener('pointerup', this._onPointerUp);
    this.overlayCanvas.addEventListener('pointerleave', this._onPointerLeave);
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    this.overlayCanvas.removeEventListener('pointerdown', this._onPointerDown);
    this.overlayCanvas.removeEventListener('pointermove', this._onPointerMove);
    this.overlayCanvas.removeEventListener('pointerup', this._onPointerUp);
    this.overlayCanvas.removeEventListener('pointerleave', this._onPointerLeave);
  }

  setData(data) {
    this.data = Array.isArray(data) ? data : [];
    this._updatePriceRange();
    this.render();
  }

  setTheme(theme) {
    this.theme = deepMerge(DEFAULT_THEME, theme || {});
    this.drawingManager.setTheme(this.theme);
    this.render();
  }

  setActiveTool(toolName, toolOptions = {}) {
    this.activeTool = toolName ? { name: toolName, options: toolOptions } : null;
    if (!toolName) {
      this.pointerState = null;
      this.selection = null;
      this.renderOverlay();
    }
  }

  addDrawing(drawing) {
    this.drawingManager.add(drawing);
    this.renderOverlay();
  }

  undoLastDrawing() {
    const removed = this.drawingManager.undo();
    if (removed) {
      this.selection = null;
      this.renderOverlay();
    }
    return removed;
  }

  eraseDrawingAt(point, tolerance) {
    const removed = this.drawingManager.eraseAt(point, tolerance);
    if (removed) {
      if (this.selection && this.selection.index === removed.index) this.selection = null;
      this.renderOverlay();
    }
    return removed ? removed.drawing : null;
  }

  clearDrawings() {
    this.drawingManager.clear();
    this.selection = null;
    this.renderOverlay();
  }

  exportImage({ includeOverlay = true, mimeType = 'image/png', quality } = {}) {
    if (!includeOverlay) return this.canvas.toDataURL(mimeType, quality);
    const merged = document.createElement('canvas');
    merged.width = this.canvas.width;
    merged.height = this.canvas.height;
    const ctx = merged.getContext('2d');
    ctx.drawImage(this.canvas, 0, 0);
    ctx.drawImage(this.overlayCanvas, 0, 0);
    return merged.toDataURL(mimeType, quality);
  }

  downloadImage(filename = 'chart.png', options) {
    const dataUrl = this.exportImage(options);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
    return dataUrl;
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width) || 320);
    const height = Math.max(220, Math.floor(rect.height) || 220);
    this.ctx = setupHiDPICanvas(this.canvas, width, height);
    this.overlayCtx = setupHiDPICanvas(this.overlayCanvas, width, height);
    this.drawingManager.ctx = this.overlayCtx;
    this._size = { width, height };
    this.render();
  }

  render() {
    if (!this.ctx) return;
    this._updatePriceRange();
    this._drawBackground();
    this._drawGrid();
    this._drawCandles();
    this._drawAxes();
    this.renderOverlay();
  }

  renderOverlay() {
    const draft = this._pointerStateToDrawing();
    this.drawingManager.render(draft);
    this._drawSelectionHandles();
    this._drawCrosshair();
  }

  _drawBackground() {
    const { width, height } = this._size || { width: 0, height: 0 };
    clearCanvas(this.ctx);
    this.ctx.fillStyle = this.theme.background;
    this.ctx.fillRect(0, 0, width, height);
  }

  _drawGrid() {
    const { width, height } = this._size;
    const { padding } = this.options;
    const usableHeight = height - padding.top - padding.bottom;
    const usableWidth = width - padding.left - padding.right;
    const horizontalSteps = 4;
    const verticalSteps = 5;
    this.ctx.strokeStyle = this.theme.grid;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for (let i = 0; i <= horizontalSteps; i += 1) {
      const y = padding.top + (usableHeight / horizontalSteps) * i;
      this.ctx.moveTo(padding.left, y);
      this.ctx.lineTo(width - padding.right, y);
    }
    for (let i = 0; i <= verticalSteps; i += 1) {
      const x = padding.left + (usableWidth / verticalSteps) * i;
      this.ctx.moveTo(x, padding.top);
      this.ctx.lineTo(x, height - padding.bottom);
    }
    this.ctx.stroke();
  }

  _drawCandles() {
    if (!this.data.length) return;
    const { padding, minCandleWidth, maxCandleWidth } = this.options;
    const { width, height } = this._size;
    const usableWidth = width - padding.left - padding.right;
    const usableHeight = height - padding.top - padding.bottom;
    const spacing = Math.max(6, usableWidth / Math.max(this.data.length, 1));
    const bodyWidth = clamp(spacing * 0.6, minCandleWidth, maxCandleWidth);
    this.ctx.lineWidth = 1;

    this.data.forEach((point, index) => {
      const x = padding.left + spacing * index + spacing / 2;
      const openY = this._yForPrice(point.open, usableHeight, padding);
      const closeY = this._yForPrice(point.close, usableHeight, padding);
      const highY = this._yForPrice(point.high, usableHeight, padding);
      const lowY = this._yForPrice(point.low, usableHeight, padding);
      const isUp = point.close >= point.open;
      const bodyColor = isUp ? this.theme.upCandle : this.theme.downCandle;

      // Wick
      this.ctx.strokeStyle = this.theme.wick;
      this.ctx.beginPath();
      this.ctx.moveTo(x, highY);
      this.ctx.lineTo(x, lowY);
      this.ctx.stroke();

      // Body
      const bodyTop = isUp ? closeY : openY;
      const bodyBottom = isUp ? openY : closeY;
      const heightBody = Math.max(1, bodyBottom - bodyTop);
      this.ctx.fillStyle = bodyColor;
      this.ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, heightBody);
    });

    if (this.options.showVolume) {
      this._drawVolume(spacing, bodyWidth);
    }
  }

  _drawVolume(spacing, bodyWidth) {
    const { padding } = this.options;
    const { width, height } = this._size;
    const usableWidth = width - padding.left - padding.right;
    const volumeHeight = padding.bottom * 0.9;
    const volumes = this.data.map((d) => d.volume || 0);
    const maxVolume = Math.max(...volumes, 1);
    this.data.forEach((point, index) => {
      const x = padding.left + spacing * index + spacing / 2;
      const vHeight = (point.volume || 0) / maxVolume;
      const barHeight = vHeight * volumeHeight;
      const y = height - padding.bottom + (volumeHeight - barHeight);
      const isUp = point.close >= point.open;
      this.ctx.fillStyle = isUp ? this.theme.volumeUp : this.theme.volumeDown;
      this.ctx.fillRect(x - bodyWidth / 2, y, bodyWidth, barHeight);
    });
  }

  _drawAxes() {
    const { padding, priceFormatter, timeFormatter } = this.options;
    const { width, height } = this._size;
    const usableHeight = height - padding.top - padding.bottom;
    const steps = 4;
    this.ctx.fillStyle = this.theme.text;
    this.ctx.font = '11px sans-serif';
    this.ctx.textBaseline = 'middle';
    this.ctx.textAlign = 'left';
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const price = this._minPrice + (this._maxPrice - this._minPrice) * (1 - t);
      const y = padding.top + usableHeight * t;
      const label = priceFormatter(price);
      this.ctx.fillText(label, width - padding.right + 8, y);
    }

    if (this.data.length) {
      const ticks = 4;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'top';
      const spacing = Math.max(6, (width - padding.left - padding.right) / Math.max(this.data.length, 1));
      for (let i = 0; i <= ticks; i += 1) {
        const index = Math.floor((this.data.length - 1) * (i / ticks));
        const point = this.data[index];
        if (!point) continue;
        const x = padding.left + spacing * index + spacing / 2;
        const label = timeFormatter(point.time);
        this.ctx.fillText(label, x, height - padding.bottom + 6);
      }
    }
  }

  _updatePriceRange() {
    if (!this.data.length) {
      this._minPrice = 0;
      this._maxPrice = 1;
      return;
    }
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    this.data.forEach((point) => {
      min = Math.min(min, point.low);
      max = Math.max(max, point.high);
    });
    const padding = (max - min) * 0.08 || 1;
    this._minPrice = min - padding;
    this._maxPrice = max + padding;
  }

  _yForPrice(price, usableHeight, padding) {
    const range = this._maxPrice - this._minPrice || 1;
    const rel = (this._maxPrice - price) / range;
    return padding.top + rel * usableHeight;
  }

  _getPointerPosition(evt) {
    const rect = this.overlayCanvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
  }

  _updateCursor(pos) {
    const { padding, priceFormatter, timeFormatter } = this.options;
    const { width, height } = this._size || {};
    if (!width || !height) {
      this.cursor = null;
      return;
    }
    const usableHeight = height - padding.top - padding.bottom;
    const range = this._maxPrice - this._minPrice || 1;
    const price = this._maxPrice - clamp((pos.y - padding.top) / usableHeight, 0, 1) * range;
    let candleInfo = null;
    if (this.data.length) {
      const spacing = Math.max(6, (width - padding.left - padding.right) / Math.max(this.data.length, 1));
      const rawIndex = Math.round((pos.x - padding.left) / spacing);
      const index = clamp(rawIndex, 0, this.data.length - 1);
      const candle = this.data[index];
      const cx = padding.left + spacing * index + spacing / 2;
      candleInfo = {
        index,
        candle,
        x: cx,
        label: candle ? timeFormatter(candle.time) : ''
      };
    }
    this.cursor = {
      x: pos.x,
      y: pos.y,
      price,
      priceLabel: priceFormatter(price),
      candle: candleInfo
    };
  }

  _hitHandle(box, pos, tolerance = 10) {
    if (!box || !box.corners || box.corners.length < 4) return null;
    const corners = box.corners;
    const handles = [
      { name: 'tl', point: corners[0], anchor: corners[2] },
      { name: 'tr', point: corners[1], anchor: corners[3] },
      { name: 'br', point: corners[2], anchor: corners[0] },
      { name: 'bl', point: corners[3], anchor: corners[1] }
    ];
    for (const h of handles) {
      const dist = Math.hypot(pos.x - h.point.x, pos.y - h.point.y);
      if (dist <= tolerance) return h;
    }
    return null;
  }

  _drawSelectionHandles() {
    if (!this.overlayCtx) return;
    if (!this.activeTool || this.activeTool.name !== 'grab') return;
    const idx = this.selection?.index;
    if (idx === null || idx === undefined) return;
    const drawing = this.drawingManager.drawings[idx];
    if (!drawing) return;
    const box = this.drawingManager.getBoundingBox(drawing);
    if (!box.corners || box.corners.length < 4) return;
    const ctx = this.overlayCtx;
    ctx.save();
    ctx.strokeStyle = this.theme.crosshair;
    ctx.fillStyle = this.theme.crosshair;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(box.corners[0].x, box.corners[0].y);
    ctx.lineTo(box.corners[1].x, box.corners[1].y);
    ctx.lineTo(box.corners[2].x, box.corners[2].y);
    ctx.lineTo(box.corners[3].x, box.corners[3].y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);
    const size = 8;
    box.corners.forEach((p) => {
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    });
    ctx.restore();
  }

  _drawCrosshair() {
    if (!this.cursor || !this.overlayCtx) return;
    const { width, height } = this._size;
    const ctx = this.overlayCtx;
    const { x, y, priceLabel, candle } = this.cursor;
    ctx.save();
    ctx.strokeStyle = this.theme.crosshair;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Price pill on the right
    const font = '11px sans-serif';
    const padX = 6;
    const padY = 4;
    ctx.font = font;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const textW = ctx.measureText(priceLabel).width;
    const labelW = textW + padX * 2;
    const labelH = 18;
    const rectX = width - labelW - 4;
    const rectY = clamp(y - labelH / 2, 2, height - labelH - 2);
    ctx.fillStyle = this.theme.background;
    ctx.fillRect(rectX, rectY, labelW, labelH);
    ctx.strokeStyle = this.theme.crosshair;
    ctx.strokeRect(rectX, rectY, labelW, labelH);
    ctx.fillStyle = this.theme.text;
    ctx.fillText(priceLabel, rectX + padX, rectY + labelH / 2);

    // Time pill at the bottom
    if (candle && candle.label) {
      const tText = candle.label;
      const tTextW = ctx.measureText(tText).width;
      const tLabelW = tTextW + padX * 2;
      const tLabelH = 18;
      const baseX = candle.x ?? x;
      const tRectX = clamp(baseX - tLabelW / 2, 2, width - tLabelW - 2);
      const tRectY = height - tLabelH - 2;
      ctx.fillStyle = this.theme.background;
      ctx.fillRect(tRectX, tRectY, tLabelW, tLabelH);
      ctx.strokeStyle = this.theme.crosshair;
      ctx.strokeRect(tRectX, tRectY, tLabelW, tLabelH);
      ctx.fillStyle = this.theme.text;
      ctx.textAlign = 'center';
      ctx.fillText(tText, tRectX + tLabelW / 2, tRectY + tLabelH / 2);
    }

    ctx.restore();
  }

  _handlePointerDown(evt) {
    if (!this.activeTool) return;
    evt.preventDefault();
    const pos = this._getPointerPosition(evt);
    const { name, options } = this.activeTool;
    const base = {
      color: options.color || this.theme.tools.stroke,
      width: options.width || 2,
      fill: options.fill || this.theme.tools.fill
    };
    if (name === 'erase') {
      this.eraseDrawingAt(pos, options.tolerance);
      return;
    }
    if (name === 'grab') {
      const tolerance = options.tolerance ?? 10;
      const tryResize = (index, drawing) => {
        if (index === null || index === undefined || !drawing) return false;
        const box = this.drawingManager.getBoundingBox(drawing);
        const handle = this._hitHandle(box, pos, tolerance);
        if (!handle) return false;
        const localHandle = rotatePoint(handle.point, handle.anchor, -(box.angle || 0));
        const startVec = { x: localHandle.x - handle.anchor.x, y: localHandle.y - handle.anchor.y };
        this.pointerState = {
          tool: 'grab',
          mode: 'resize',
          targetIndex: index,
          handle: handle.name,
          anchor: handle.anchor,
          angle: box.angle || 0,
          startWidth: Math.max(1, Math.abs(startVec.x)),
          startHeight: Math.max(1, Math.abs(startVec.y)),
          baseDrawing: JSON.parse(JSON.stringify(drawing))
        };
        return true;
      };

      const selectedIdx = this.selection?.index;
      if (selectedIdx !== null && selectedIdx !== undefined) {
        const current = this.drawingManager.drawings[selectedIdx];
        if (tryResize(selectedIdx, current)) return;
      }

      const hit = this.drawingManager.hitTest(pos, tolerance);
      if (hit) {
        this.selection = { index: hit.index };
        const drawing = this.drawingManager.drawings[hit.index];
        if (tryResize(hit.index, drawing)) return;
        this.pointerState = {
          tool: 'grab',
          targetIndex: hit.index,
          lastPos: pos,
          mode: evt.shiftKey ? 'rotate' : 'move'
        };
      } else {
        this.selection = null;
      }
      this.renderOverlay();
      return;
    }
    if (name === 'text') {
      const text = options.text || 'Text';
      this.drawingManager.add({
        type: 'text',
        x: pos.x,
        y: pos.y,
        text,
        color: base.color,
        font: options.font
      });
      this.renderOverlay();
      return;
    }
    if (name === 'icon' || name === 'emoji') {
      const icon = options.icon || options.emoji || '😀';
      this.drawingManager.add({
        type: 'icon',
        x: pos.x,
        y: pos.y,
        icon,
        color: base.color,
        size: options.size || 16
      });
      this.renderOverlay();
      return;
    }
    const pointerState = {
      tool: name,
      start: pos,
      current: pos,
      points: [pos],
      options: { ...base, ...options }
    };
    this.pointerState = pointerState;
  }

  _handlePointerMove(evt) {
    const pos = this._getPointerPosition(evt);
    this._updateCursor(pos);
    if (!this.pointerState) {
      this.renderOverlay();
      return;
    }
    if (this.pointerState.tool === 'grab') {
      const { targetIndex, mode, lastPos } = this.pointerState;
      const drawing = this.drawingManager.drawings[targetIndex];
      if (!drawing) {
        this.pointerState = null;
        return;
      }
      if (mode === 'resize') {
        const angle = this.pointerState.angle || 0;
        const anchor = this.pointerState.anchor;
        const localPos = rotatePoint(pos, anchor, -angle);
        const vec = { x: localPos.x - anchor.x, y: localPos.y - anchor.y };
        const width = Math.max(8, Math.abs(vec.x));
        const height = Math.max(8, Math.abs(vec.y));
        const scaleX = width / (this.pointerState.startWidth || 1);
        const scaleY = height / (this.pointerState.startHeight || 1);
        this.drawingManager.resizeTo(
          targetIndex,
          this.pointerState.baseDrawing,
          anchor,
          angle,
          scaleX,
          scaleY
        );
      } else if (mode === 'move') {
        const dx = pos.x - lastPos.x;
        const dy = pos.y - lastPos.y;
        this.drawingManager.translate(targetIndex, dx, dy);
      } else {
        const center = this.drawingManager.getCenter(drawing);
        const prevAngle = Math.atan2(lastPos.y - center.y, lastPos.x - center.x);
        const nextAngle = Math.atan2(pos.y - center.y, pos.x - center.x);
        const delta = nextAngle - prevAngle;
        if (Number.isFinite(delta)) {
          this.drawingManager.rotate(targetIndex, delta);
        }
      }
      this.pointerState.lastPos = pos;
      this.renderOverlay();
      return;
    }
    if (this.pointerState.tool === 'pencil') {
      this.pointerState.points.push(pos);
    } else {
      this.pointerState.current = pos;
    }
    this.renderOverlay();
  }

  _handlePointerUp() {
    if (!this.pointerState) return;
    if (this.pointerState.tool === 'grab') {
      this.pointerState = null;
      return;
    }
    const draft = this._pointerStateToDrawing();
    if (draft) this.drawingManager.add(draft);
    this.pointerState = null;
    this.renderOverlay();
  }

  _handlePointerLeave() {
    this.pointerState = null;
    this.cursor = null;
    this.renderOverlay();
  }

  _pointerStateToDrawing() {
    if (!this.pointerState) return null;
    const state = this.pointerState;
    const opts = state.options || {};
    const start = state.start;
    const end = state.current || start;
    switch (state.tool) {
      case 'pencil':
        return { type: 'pencil', points: state.points.slice(), color: opts.color, width: opts.width };
      case 'line':
      case 'segment':
        return { type: 'line', start, end, color: opts.color, width: opts.width, dash: opts.dash };
      case 'arrow':
        return {
          type: 'arrow',
          start,
          end,
          color: opts.color,
          width: opts.width,
          headLength: opts.headLength || 10,
          headWidth: opts.headWidth || 4,
          fill: opts.fill
        };
      case 'rectangle':
        return { type: 'rectangle', start, end, color: opts.color, width: opts.width, fill: opts.fill };
      case 'ellipse':
        return { type: 'ellipse', start, end, color: opts.color, width: opts.width, fill: opts.fill };
      case 'projection':
        return {
          type: 'projection',
          start,
          end,
          color: opts.color || this.theme.projection,
          width: opts.width || 2,
          label: opts.label || 'Projection',
          dash: opts.dash
        };
      default:
        return null;
    }
  }
}

export { DEFAULT_THEME } from './theme.js';
export { DrawingManager } from './drawing.js';
