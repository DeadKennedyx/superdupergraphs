function safeClear(ctx) {
  const { canvas } = ctx;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

const HIT_TOLERANCE = 8;
const MIN_SIZE = 8;

function rotatePointAround(point, center, angle) {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  return {
    x: center.x + dx * cosA - dy * sinA,
    y: center.y + dx * sinA + dy * cosA
  };
}

function getDrawingCenter(drawing) {
  switch (drawing.type) {
    case 'pencil': {
      const pts = drawing.points || [];
      if (!pts.length) return { x: 0, y: 0 };
      let minX = pts[0].x;
      let maxX = pts[0].x;
      let minY = pts[0].y;
      let maxY = pts[0].y;
      pts.forEach((p) => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      });
      return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
    }
    case 'line':
    case 'segment':
    case 'arrow':
    case 'projection':
      return {
        x: (drawing.start?.x || 0) / 2 + (drawing.end?.x || 0) / 2,
        y: (drawing.start?.y || 0) / 2 + (drawing.end?.y || 0) / 2
      };
    case 'rectangle':
    case 'ellipse':
      return {
        x: (drawing.start?.x || 0) / 2 + (drawing.end?.x || 0) / 2,
        y: (drawing.start?.y || 0) / 2 + (drawing.end?.y || 0) / 2
      };
    case 'text':
    case 'icon':
      return { x: drawing.x || 0, y: drawing.y || 0 };
    default:
      return { x: 0, y: 0 };
  }
}

function translateDrawing(drawing, dx, dy) {
  switch (drawing.type) {
    case 'pencil':
      return { ...drawing, points: (drawing.points || []).map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    case 'line':
    case 'segment':
    case 'arrow':
    case 'projection':
      return {
        ...drawing,
        start: drawing.start ? { x: drawing.start.x + dx, y: drawing.start.y + dy } : drawing.start,
        end: drawing.end ? { x: drawing.end.x + dx, y: drawing.end.y + dy } : drawing.end
      };
    case 'rectangle':
    case 'ellipse':
      return {
        ...drawing,
        start: drawing.start ? { x: drawing.start.x + dx, y: drawing.start.y + dy } : drawing.start,
        end: drawing.end ? { x: drawing.end.x + dx, y: drawing.end.y + dy } : drawing.end
      };
    case 'text':
    case 'icon':
      return { ...drawing, x: (drawing.x || 0) + dx, y: (drawing.y || 0) + dy };
    default:
      return drawing;
  }
}

function rotateDrawing(drawing, angleDelta) {
  const center = getDrawingCenter(drawing);
  switch (drawing.type) {
    case 'pencil':
      return {
        ...drawing,
        points: (drawing.points || []).map((p) => rotatePointAround(p, center, angleDelta))
      };
    case 'line':
    case 'segment':
    case 'arrow':
    case 'projection':
      return {
        ...drawing,
        start: drawing.start ? rotatePointAround(drawing.start, center, angleDelta) : drawing.start,
        end: drawing.end ? rotatePointAround(drawing.end, center, angleDelta) : drawing.end
      };
    case 'rectangle':
    case 'ellipse':
      return { ...drawing, angle: (drawing.angle || 0) + angleDelta };
    case 'text':
    case 'icon':
      return { ...drawing, angle: (drawing.angle || 0) + angleDelta };
    default:
      return drawing;
  }
}

function rotateCorners(corners, center, angle) {
  return corners.map((p) => rotatePointAround(p, center, angle));
}

function boundingFromPoints(points, angle = 0) {
  if (!points || !points.length) {
    return {
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      width: 0,
      height: 0,
      center: { x: 0, y: 0 },
      angle,
      corners: []
    };
  }
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  points.forEach((p) => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });
  const width = maxX - minX;
  const height = maxY - minY;
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  return {
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    center,
    angle,
    corners: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY }
    ]
  };
}

function getBoundingBox(drawing) {
  if (!drawing) return boundingFromPoints([]);
  const angle = drawing.angle || 0;
  switch (drawing.type) {
    case 'pencil': {
      return boundingFromPoints(drawing.points || []);
    }
    case 'line':
    case 'segment':
    case 'arrow':
    case 'projection': {
      const pts = [];
      if (drawing.start) pts.push(drawing.start);
      if (drawing.end) pts.push(drawing.end);
      return boundingFromPoints(pts);
    }
    case 'rectangle':
    case 'ellipse': {
      const center = {
        x: (drawing.start?.x || 0) / 2 + (drawing.end?.x || 0) / 2,
        y: (drawing.start?.y || 0) / 2 + (drawing.end?.y || 0) / 2
      };
      const width = Math.abs((drawing.start?.x || 0) - (drawing.end?.x || 0));
      const height = Math.abs((drawing.start?.y || 0) - (drawing.end?.y || 0));
      const corners = [
        { x: center.x - width / 2, y: center.y - height / 2 },
        { x: center.x + width / 2, y: center.y - height / 2 },
        { x: center.x + width / 2, y: center.y + height / 2 },
        { x: center.x - width / 2, y: center.y + height / 2 }
      ];
      const rotated = angle ? rotateCorners(corners, center, angle) : corners;
      const bbox = boundingFromPoints(rotated, angle);
      return { ...bbox, width, height, center, angle, corners: rotated };
    }
    case 'text': {
      const width = (drawing.text?.length || 1) * 8;
      const height = 16;
      const center = { x: (drawing.x || 0) + width / 2, y: (drawing.y || 0) + height / 2 };
      const corners = [
        { x: drawing.x || 0, y: drawing.y || 0 },
        { x: (drawing.x || 0) + width, y: drawing.y || 0 },
        { x: (drawing.x || 0) + width, y: (drawing.y || 0) + height },
        { x: drawing.x || 0, y: (drawing.y || 0) + height }
      ];
      const rotated = angle ? rotateCorners(corners, center, angle) : corners;
      return { ...boundingFromPoints(rotated, angle), width, height, center, corners: rotated };
    }
    case 'icon': {
      const size = drawing.size || 16;
      const center = { x: drawing.x || 0, y: drawing.y || 0 };
      const half = size / 2;
      const corners = [
        { x: center.x - half, y: center.y - half },
        { x: center.x + half, y: center.y - half },
        { x: center.x + half, y: center.y + half },
        { x: center.x - half, y: center.y + half }
      ];
      const rotated = angle ? rotateCorners(corners, center, angle) : corners;
      return { ...boundingFromPoints(rotated, angle), width: size, height: size, center, corners: rotated };
    }
    default:
      return boundingFromPoints([]);
  }
}

function parseFontSize(font) {
  const match = typeof font === 'string' ? font.match(/(\d+(?:\\.\\d+)?)px/) : null;
  return match ? Number(match[1]) : null;
}

function scalePoint(point, anchor, angle, scaleX, scaleY) {
  const local = rotatePointAround(point, anchor, -angle);
  const scaled = { x: anchor.x + (local.x - anchor.x) * scaleX, y: anchor.y + (local.y - anchor.y) * scaleY };
  return rotatePointAround(scaled, anchor, angle);
}

function scaleDrawing(drawing, anchor, angle, scaleX, scaleY) {
  switch (drawing.type) {
    case 'pencil':
      return { ...drawing, points: (drawing.points || []).map((p) => scalePoint(p, anchor, angle, scaleX, scaleY)) };
    case 'line':
    case 'segment':
    case 'arrow':
    case 'projection':
      return {
        ...drawing,
        start: drawing.start ? scalePoint(drawing.start, anchor, angle, scaleX, scaleY) : drawing.start,
        end: drawing.end ? scalePoint(drawing.end, anchor, angle, scaleX, scaleY) : drawing.end
      };
    case 'rectangle':
    case 'ellipse':
      return {
        ...drawing,
        start: drawing.start ? scalePoint(drawing.start, anchor, angle, scaleX, scaleY) : drawing.start,
        end: drawing.end ? scalePoint(drawing.end, anchor, angle, scaleX, scaleY) : drawing.end
      };
    case 'text': {
      const avgScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2 || 1;
      const size = parseFontSize(drawing.font);
      const newSize = size ? Math.max(4, size * avgScale) : null;
      const newFont = newSize ? drawing.font.replace(/(\d+(?:\\.\\d+)?)px/, `${newSize}px`) : drawing.font;
      const pos = { x: drawing.x || 0, y: drawing.y || 0 };
      const scaledPos = scalePoint(pos, anchor, angle, scaleX, scaleY);
      return { ...drawing, x: scaledPos.x, y: scaledPos.y, font: newFont };
    }
    case 'icon': {
      const avgScale = (Math.abs(scaleX) + Math.abs(scaleY)) / 2 || 1;
      const size = Math.max(4, (drawing.size || 16) * avgScale);
      const pos = { x: drawing.x || 0, y: drawing.y || 0 };
      const scaledPos = scalePoint(pos, anchor, angle, scaleX, scaleY);
      return { ...drawing, x: scaledPos.x, y: scaledPos.y, size };
    }
    default:
      return drawing;
  }
}

function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) {
    const dist = Math.hypot(point.x - a.x, point.y - a.y);
    return dist;
  }
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

function pointNearLine(point, start, end, tolerance = HIT_TOLERANCE) {
  if (!start || !end) return false;
  return distanceToSegment(point, start, end) <= tolerance;
}

function pointNearPolyline(point, pts, tolerance = HIT_TOLERANCE) {
  if (!pts || pts.length < 2) return false;
  for (let i = 0; i < pts.length - 1; i += 1) {
    if (pointNearLine(point, pts[i], pts[i + 1], tolerance)) return true;
  }
  return false;
}

function pointInRect(point, start, end, tolerance = HIT_TOLERANCE, angle = 0) {
  if (!start || !end) return false;
  const center = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const testPoint = angle ? rotatePointAround(point, center, -angle) : point;
  const x1 = Math.min(start.x, end.x) - tolerance;
  const x2 = Math.max(start.x, end.x) + tolerance;
  const y1 = Math.min(start.y, end.y) - tolerance;
  const y2 = Math.max(start.y, end.y) + tolerance;
  return testPoint.x >= x1 && testPoint.x <= x2 && testPoint.y >= y1 && testPoint.y <= y2;
}

function pointInEllipse(point, start, end, tolerance = HIT_TOLERANCE, angle = 0) {
  if (!start || !end) return false;
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const rx = Math.max(1, Math.abs(start.x - end.x) / 2) + tolerance;
  const ry = Math.max(1, Math.abs(start.y - end.y) / 2) + tolerance;
  const testPoint = angle ? rotatePointAround(point, { x: cx, y: cy }, -angle) : point;
  const normX = (testPoint.x - cx) / rx;
  const normY = (testPoint.y - cy) / ry;
  return normX * normX + normY * normY <= 1;
}

function pointNearText(point, drawing, tolerance = HIT_TOLERANCE) {
  if (drawing.x === undefined || drawing.y === undefined) return false;
  const angle = drawing.angle || 0;
  const center = { x: drawing.x, y: drawing.y };
  const testPoint = angle ? rotatePointAround(point, center, -angle) : point;
  const width = (drawing.text?.length || 1) * 8;
  const height = 16;
  return (
    testPoint.x >= drawing.x - tolerance &&
    testPoint.x <= drawing.x + width + tolerance &&
    testPoint.y >= drawing.y - tolerance &&
    testPoint.y <= drawing.y + height + tolerance
  );
}

function pointNearIcon(point, drawing, tolerance = HIT_TOLERANCE) {
  if (drawing.x === undefined || drawing.y === undefined) return false;
  const angle = drawing.angle || 0;
  const center = { x: drawing.x, y: drawing.y };
  const testPoint = angle ? rotatePointAround(point, center, -angle) : point;
  const size = drawing.size || 16;
  return (
    Math.abs(testPoint.x - drawing.x) <= size / 2 + tolerance &&
    Math.abs(testPoint.y - drawing.y) <= size / 2 + tolerance
  );
}

function isPointOnDrawing(point, drawing, tolerance = HIT_TOLERANCE) {
  switch (drawing.type) {
    case 'pencil':
      return pointNearPolyline(point, drawing.points, tolerance);
    case 'line':
    case 'segment':
      return pointNearLine(point, drawing.start, drawing.end, tolerance);
    case 'arrow':
      return pointNearLine(point, drawing.start, drawing.end, tolerance);
    case 'rectangle':
      return pointInRect(point, drawing.start, drawing.end, tolerance, drawing.angle || 0);
    case 'ellipse':
      return pointInEllipse(point, drawing.start, drawing.end, tolerance, drawing.angle || 0);
    case 'text':
      return pointNearText(point, drawing, tolerance);
    case 'icon':
      return pointNearIcon(point, drawing, tolerance);
    case 'projection':
      return pointNearLine(point, drawing.start, drawing.end, tolerance);
    default:
      return false;
  }
}

function strokeAndFill(ctx, drawing, theme) {
  ctx.globalAlpha = drawing.opacity ?? 1;
  ctx.strokeStyle = drawing.color || theme.tools.stroke;
  ctx.lineWidth = drawing.width || 2;
  if (drawing.dash) ctx.setLineDash(drawing.dash);
  if (drawing.fill) {
    ctx.fillStyle = drawing.fill;
  }
}

function drawPencil(ctx, drawing, theme) {
  const pts = drawing.points || [];
  if (pts.length < 2) return;
  ctx.save();
  strokeAndFill(ctx, drawing, theme);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawLine(ctx, drawing, theme) {
  const { start, end } = drawing;
  if (!start || !end) return;
  ctx.save();
  strokeAndFill(ctx, drawing, theme);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.restore();
}

function drawArrow(ctx, drawing, theme) {
  const { start, end } = drawing;
  if (!start || !end) return;
  ctx.save();
  strokeAndFill(ctx, drawing, theme);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const headLength = drawing.headLength || 10;
  const headWidth = drawing.headWidth || 4;
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - headLength * Math.cos(angle - Math.PI / 8),
    end.y - headLength * Math.sin(angle - Math.PI / 8)
  );
  ctx.lineTo(
    end.x - headWidth * Math.cos(angle),
    end.y - headWidth * Math.sin(angle)
  );
  ctx.lineTo(
    end.x - headLength * Math.cos(angle + Math.PI / 8),
    end.y - headLength * Math.sin(angle + Math.PI / 8)
  );
  ctx.closePath();
  if (drawing.fill) {
    ctx.fill();
  }
  ctx.stroke();
  ctx.restore();
}

function drawRectangle(ctx, drawing, theme) {
  const { start, end } = drawing;
  if (!start || !end) return;
  const w = Math.abs(start.x - end.x);
  const h = Math.abs(start.y - end.y);
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  ctx.save();
  strokeAndFill(ctx, drawing, theme);
  ctx.translate(cx, cy);
  if (drawing.angle) ctx.rotate(drawing.angle);
  if (drawing.fill) ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawEllipse(ctx, drawing, theme) {
  const { start, end } = drawing;
  if (!start || !end) return;
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const rx = Math.abs(start.x - end.x) / 2;
  const ry = Math.abs(start.y - end.y) / 2;
  ctx.save();
  strokeAndFill(ctx, drawing, theme);
  ctx.translate(cx, cy);
  if (drawing.angle) ctx.rotate(drawing.angle);
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  if (drawing.fill) ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawText(ctx, drawing, theme) {
  const { x, y, text } = drawing;
  if (x === undefined || y === undefined) return;
  ctx.save();
  ctx.translate(x, y);
  if (drawing.angle) ctx.rotate(drawing.angle);
  ctx.fillStyle = drawing.color || theme.tools.text;
  ctx.font = drawing.font || '12px/1 sans-serif';
  ctx.textBaseline = drawing.textBaseline || 'top';
  ctx.fillText(text || 'Note', 0, 0);
  ctx.restore();
}

function drawIcon(ctx, drawing, theme) {
  const { x, y, icon } = drawing;
  if (x === undefined || y === undefined) return;
  ctx.save();
  ctx.translate(x, y);
  if (drawing.angle) ctx.rotate(drawing.angle);
  ctx.fillStyle = drawing.color || theme.tools.text;
  const size = drawing.size || 16;
  ctx.font = `${size}px/1 sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(icon || '😀', 0, 0);
  ctx.restore();
}

function drawProjection(ctx, drawing, theme) {
  const { start, end } = drawing;
  if (!start || !end) return;
  ctx.save();
  ctx.globalAlpha = drawing.opacity ?? 1;
  ctx.strokeStyle = drawing.color || theme.projection || theme.tools.stroke;
  ctx.lineWidth = drawing.width || 2;
  ctx.setLineDash(drawing.dash || [8, 6]);
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.setLineDash([]);
  if (drawing.label) {
    ctx.fillStyle = drawing.color || theme.projection || theme.tools.text;
    ctx.font = drawing.font || '11px/1 sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.fillText(drawing.label, end.x + 6, end.y - 6);
  }
  ctx.restore();
}

export class DrawingManager {
  constructor(ctx, theme) {
    this.ctx = ctx;
    this.theme = theme;
    this.drawings = [];
  }

  setTheme(theme) {
    this.theme = theme;
  }

  add(drawing) {
    this.drawings.push({ ...drawing });
  }

  clear() {
    this.drawings = [];
  }

  hitTest(point, tolerance = HIT_TOLERANCE) {
    for (let i = this.drawings.length - 1; i >= 0; i -= 1) {
      if (isPointOnDrawing(point, this.drawings[i], tolerance)) {
        return { index: i, drawing: this.drawings[i] };
      }
    }
    return null;
  }

  translate(index, dx, dy) {
    const original = this.drawings[index];
    if (!original) return null;
    const moved = translateDrawing(original, dx, dy);
    this.drawings[index] = moved;
    return moved;
  }

  rotate(index, angleDelta) {
    const original = this.drawings[index];
    if (!original) return null;
    const rotated = rotateDrawing(original, angleDelta);
    this.drawings[index] = rotated;
    return rotated;
  }

  getBoundingBox(drawing) {
    return getBoundingBox(drawing);
  }

  resizeTo(index, baseDrawing, anchor, angle, scaleX, scaleY) {
    const source = baseDrawing || this.drawings[index];
    if (!source) return null;
    const next = scaleDrawing(source, anchor, angle, scaleX, scaleY);
    this.drawings[index] = next;
    return next;
  }

  getCenter(drawing) {
    return getDrawingCenter(drawing);
  }

  undo() {
    if (!this.drawings.length) return null;
    return this.drawings.pop();
  }

  eraseAt(point, tolerance = HIT_TOLERANCE) {
    for (let i = this.drawings.length - 1; i >= 0; i -= 1) {
      if (isPointOnDrawing(point, this.drawings[i], tolerance)) {
        const [removed] = this.drawings.splice(i, 1);
        return { drawing: removed, index: i };
      }
    }
    return null;
  }

  render(draft) {
    safeClear(this.ctx);
    const items = draft ? [...this.drawings, draft] : this.drawings;
    const theme = this.theme;
    items.forEach((d) => {
      switch (d.type) {
        case 'pencil':
          drawPencil(this.ctx, d, theme);
          break;
        case 'line':
        case 'segment':
          drawLine(this.ctx, d, theme);
          break;
        case 'arrow':
          drawArrow(this.ctx, d, theme);
          break;
        case 'rectangle':
          drawRectangle(this.ctx, d, theme);
          break;
        case 'ellipse':
          drawEllipse(this.ctx, d, theme);
          break;
        case 'text':
          drawText(this.ctx, d, theme);
          break;
        case 'icon':
          drawIcon(this.ctx, d, theme);
          break;
        case 'projection':
          drawProjection(this.ctx, d, theme);
          break;
        default:
          break;
      }
    });
  }
}
