import { useEffect, useRef, useState } from 'react';
import DxfParser from 'dxf-parser';

interface DxfViewerProps {
  blob: Blob;
  className?: string;
}

interface BBox {
  minX: number; minY: number; maxX: number; maxY: number;
}

const COLORS: Record<number, string> = {
  1: '#FF0000', 2: '#FFFF00', 3: '#00FF00', 4: '#00FFFF',
  5: '#0000FF', 6: '#FF00FF', 7: '#FFFFFF', 8: '#808080',
  9: '#C0C0C0',
};

function getColor(entity: any): string {
  const c = entity.color ?? entity.colorIndex ?? 7;
  return COLORS[c] || '#CCCCCC';
}

export function DxfViewer({ blob, className }: DxfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const parsedRef = useRef<any>(null);
  const bboxRef = useRef<BBox | null>(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parser = new DxfParser();
        const dxf = parser.parseSync(reader.result as string);
        if (!dxf) { setError('Ne mogu parsirati DXF fajl.'); return; }
        parsedRef.current = dxf;

        // Calculate bounding box
        const bbox: BBox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
        const expandBBox = (x: number, y: number) => {
          if (isFinite(x) && isFinite(y)) {
            bbox.minX = Math.min(bbox.minX, x);
            bbox.minY = Math.min(bbox.minY, y);
            bbox.maxX = Math.max(bbox.maxX, x);
            bbox.maxY = Math.max(bbox.maxY, y);
          }
        };

        for (const _entity of dxf.entities || []) {
          const entity = _entity as any;
          if (entity.type === 'LINE') {
            expandBBox(entity.vertices[0].x, entity.vertices[0].y);
            expandBBox(entity.vertices[1].x, entity.vertices[1].y);
          } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
            for (const v of entity.vertices || []) expandBBox(v.x, v.y);
          } else if (entity.type === 'CIRCLE' || entity.type === 'ARC') {
            expandBBox(entity.center.x - entity.radius, entity.center.y - entity.radius);
            expandBBox(entity.center.x + entity.radius, entity.center.y + entity.radius);
          } else if (entity.type === 'POINT') {
            expandBBox(entity.position.x, entity.position.y);
          } else if (entity.type === 'INSERT') {
            expandBBox(entity.position.x, entity.position.y);
          } else if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
            expandBBox(entity.startPoint?.x ?? entity.position?.x ?? 0, entity.startPoint?.y ?? entity.position?.y ?? 0);
          } else if (entity.type === 'ELLIPSE') {
            expandBBox(entity.center.x - (entity.majorAxisEndPoint?.x ?? 0), entity.center.y - (entity.majorAxisEndPoint?.y ?? 0));
            expandBBox(entity.center.x + (entity.majorAxisEndPoint?.x ?? 0), entity.center.y + (entity.majorAxisEndPoint?.y ?? 0));
          } else if (entity.type === 'SPLINE') {
            for (const p of entity.controlPoints || []) expandBBox(p.x, p.y);
          }
        }

        if (!isFinite(bbox.minX)) {
          bbox.minX = 0; bbox.minY = 0; bbox.maxX = 100; bbox.maxY = 100;
        }
        bboxRef.current = bbox;
        setZoom(1);
        setPan({ x: 0, y: 0 });
      } catch (e: any) {
        setError(e.message || 'Greška pri parsiranju DXF fajla.');
      }
    };
    reader.readAsText(blob);
  }, [blob]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const dxf = parsedRef.current;
    const bbox = bboxRef.current;
    if (!canvas || !dxf || !bbox) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const pad = 40;

    const dxfW = bbox.maxX - bbox.minX || 1;
    const dxfH = bbox.maxY - bbox.minY || 1;
    const scale = Math.min((w - pad * 2) / dxfW, (h - pad * 2) / dxfH) * zoom;

    const cx = w / 2 + pan.x;
    const cy = h / 2 + pan.y;

    const toX = (x: number) => cx + (x - (bbox.minX + dxfW / 2)) * scale;
    const toY = (y: number) => cy - (y - (bbox.minY + dxfH / 2)) * scale; // flip Y

    // Dark background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // Draw grid
    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = 0.5;
    const gridStep = Math.pow(10, Math.floor(Math.log10(dxfW / 5)));
    for (let x = Math.floor(bbox.minX / gridStep) * gridStep; x <= bbox.maxX; x += gridStep) {
      const sx = toX(x);
      if (sx >= 0 && sx <= w) {
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();
      }
    }
    for (let y = Math.floor(bbox.minY / gridStep) * gridStep; y <= bbox.maxY; y += gridStep) {
      const sy = toY(y);
      if (sy >= 0 && sy <= h) {
        ctx.beginPath(); ctx.moveTo(0, sy); ctx.lineTo(w, sy); ctx.stroke();
      }
    }

    // Draw entities
    for (const _entity of dxf.entities || []) {
      const entity = _entity as any;
      ctx.strokeStyle = getColor(entity);
      ctx.fillStyle = getColor(entity);
      ctx.lineWidth = 1;

      if (entity.type === 'LINE') {
        ctx.beginPath();
        ctx.moveTo(toX(entity.vertices[0].x), toY(entity.vertices[0].y));
        ctx.lineTo(toX(entity.vertices[1].x), toY(entity.vertices[1].y));
        ctx.stroke();
      } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
        const verts = entity.vertices || [];
        if (verts.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(toX(verts[0].x), toY(verts[0].y));
        for (let i = 1; i < verts.length; i++) {
          ctx.lineTo(toX(verts[i].x), toY(verts[i].y));
        }
        if (entity.shape) ctx.closePath();
        ctx.stroke();
      } else if (entity.type === 'CIRCLE') {
        ctx.beginPath();
        ctx.arc(toX(entity.center.x), toY(entity.center.y), entity.radius * scale, 0, Math.PI * 2);
        ctx.stroke();
      } else if (entity.type === 'ARC') {
        ctx.beginPath();
        const startAngle = -(entity.endAngle * Math.PI / 180);
        const endAngle = -(entity.startAngle * Math.PI / 180);
        ctx.arc(toX(entity.center.x), toY(entity.center.y), entity.radius * scale, startAngle, endAngle);
        ctx.stroke();
      } else if (entity.type === 'ELLIPSE') {
        const mx = entity.majorAxisEndPoint?.x ?? 1;
        const my = entity.majorAxisEndPoint?.y ?? 0;
        const majorR = Math.sqrt(mx * mx + my * my) * scale;
        const minorR = majorR * (entity.axisRatio ?? 0.5);
        const rot = Math.atan2(my, mx);
        ctx.beginPath();
        ctx.ellipse(toX(entity.center.x), toY(entity.center.y), majorR, minorR, -rot, 0, Math.PI * 2);
        ctx.stroke();
      } else if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
        const px = entity.startPoint?.x ?? entity.position?.x ?? 0;
        const py = entity.startPoint?.y ?? entity.position?.y ?? 0;
        const textH = (entity.height || 2) * scale;
        if (textH > 3 && textH < 200) {
          ctx.font = `${Math.max(8, Math.min(textH, 48))}px monospace`;
          ctx.fillText(entity.text || entity.string || '', toX(px), toY(py));
        }
      } else if (entity.type === 'SPLINE') {
        const pts = entity.controlPoints || [];
        if (pts.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(toX(pts[0].x), toY(pts[0].y));
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(toX(pts[i].x), toY(pts[i].y));
        }
        ctx.stroke();
      } else if (entity.type === 'POINT') {
        ctx.fillRect(toX(entity.position.x) - 2, toY(entity.position.y) - 2, 4, 4);
      }
    }

    // Entity count label
    ctx.fillStyle = '#666';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${dxf.entities?.length || 0} entiteta`, 10, h - 10);
  }, [zoom, pan]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.1, Math.min(z * factor, 20)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setDragging(false);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-lg p-8 ${className}`}>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        width={900}
        height={600}
        className="w-full h-full rounded-lg cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="absolute bottom-3 right-3 flex gap-1">
        <button
          onClick={() => setZoom((z) => Math.min(z * 1.3, 20))}
          className="bg-black/60 text-white w-8 h-8 rounded flex items-center justify-center hover:bg-black/80 text-lg cursor-pointer"
        >+</button>
        <button
          onClick={() => setZoom((z) => Math.max(z * 0.7, 0.1))}
          className="bg-black/60 text-white w-8 h-8 rounded flex items-center justify-center hover:bg-black/80 text-lg cursor-pointer"
        >-</button>
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="bg-black/60 text-white px-3 h-8 rounded flex items-center justify-center hover:bg-black/80 text-xs cursor-pointer"
        >Reset</button>
      </div>
    </div>
  );
}
