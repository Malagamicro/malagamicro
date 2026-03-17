import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Pen, Highlighter, Eraser, Undo2, Redo2, Trash2, Maximize2, Minimize2,
  Download, Circle, Square, Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface DrawingCanvasProps {
  pageTitle: string;
  pageId?: string;
  initialContent: string;
  onSave: (dataUrl: string) => void;
}

type Tool = 'pen' | 'highlighter' | 'eraser' | 'line' | 'rect' | 'circle';

interface StrokePoint {
  x: number;
  y: number;
}

interface BroadcastStroke {
  tool: Tool;
  color: string;
  size: number;
  points: StrokePoint[];
  canvasW: number;
  canvasH: number;
}

const COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
];

const HIGHLIGHTER_COLORS = [
  'rgba(250,204,21,0.4)', 'rgba(74,222,128,0.4)', 'rgba(96,165,250,0.4)',
  'rgba(248,113,113,0.4)', 'rgba(251,146,60,0.4)', 'rgba(167,139,250,0.4)',
];

interface HistoryEntry {
  data: ImageData;
}

export function DrawingCanvas({ pageTitle, pageId, initialContent, onSave }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const historyRef = useRef<HistoryEntry[]>([]);
  const historyIndexRef = useRef(-1);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const snapshotRef = useRef<ImageData | null>(null);
  const initializedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Track current stroke points for broadcasting
  const currentStrokeRef = useRef<StrokePoint[]>([]);

  // Logical canvas dimensions (fixed, independent of display size)
  const LOGICAL_W = 1920;
  const LOGICAL_H = 1080;

  const getCtx = useCallback(() => canvasRef.current?.getContext('2d'), []);

  const saveHistory = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push({ data });
    historyIndexRef.current = historyRef.current.length - 1;
  }, [getCtx]);

  const debouncedSave = useCallback(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (canvasRef.current) {
        onSaveRef.current(canvasRef.current.toDataURL('image/png'));
      }
    }, 1500);
  }, []);

  // Init canvas with fixed logical size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = LOGICAL_W;
    canvas.height = LOGICAL_H;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (initialContent && initialContent.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, LOGICAL_W, LOGICAL_H);
        saveHistory();
        initializedRef.current = true;
      };
      img.src = initialContent;
    } else {
      saveHistory();
      initializedRef.current = true;
    }

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime broadcast for collaborative drawing
  useEffect(() => {
    if (!pageId) return;

    const channelName = `canvas-${pageId}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: 'stroke' }, ({ payload }: { payload: BroadcastStroke }) => {
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas || !payload || payload.points.length < 2) return;

        // Scale from sender's logical coords to ours (should be same LOGICAL_W/H)
        const scaleX = canvas.width / payload.canvasW;
        const scaleY = canvas.height / payload.canvasH;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (payload.tool === 'highlighter') {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = payload.color.startsWith('rgba') ? payload.color : `${payload.color}66`;
          ctx.lineWidth = payload.size * 6;
        } else if (payload.tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
          ctx.lineWidth = payload.size * 4;
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = payload.color;
          ctx.lineWidth = payload.size;
        }

        if (['line', 'rect', 'circle'].includes(payload.tool) && payload.points.length >= 2) {
          const s = payload.points[0];
          const e = payload.points[payload.points.length - 1];
          ctx.beginPath();
          if (payload.tool === 'line') {
            ctx.moveTo(s.x * scaleX, s.y * scaleY);
            ctx.lineTo(e.x * scaleX, e.y * scaleY);
          } else if (payload.tool === 'rect') {
            ctx.rect(s.x * scaleX, s.y * scaleY, (e.x - s.x) * scaleX, (e.y - s.y) * scaleY);
          } else if (payload.tool === 'circle') {
            const rx = Math.abs(e.x - s.x) / 2 * scaleX;
            const ry = Math.abs(e.y - s.y) / 2 * scaleY;
            const cx = (s.x + (e.x - s.x) / 2) * scaleX;
            const cy = (s.y + (e.y - s.y) / 2) * scaleY;
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          }
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(payload.points[0].x * scaleX, payload.points[0].y * scaleY);
          for (let i = 1; i < payload.points.length; i++) {
            ctx.lineTo(payload.points[i].x * scaleX, payload.points[i].y * scaleY);
          }
          ctx.stroke();
        }

        ctx.restore();
        saveHistory();
        debouncedSave();
      })
      .on('broadcast', { event: 'clear' }, () => {
        const ctx = getCtx();
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        saveHistory();
        debouncedSave();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pageId, getCtx, saveHistory, debouncedSave]);

  const broadcastStroke = useCallback((points: StrokePoint[]) => {
    if (!pageId || points.length < 2) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    supabase.channel(`canvas-${pageId}`).send({
      type: 'broadcast',
      event: 'stroke',
      payload: {
        tool,
        color,
        size,
        points,
        canvasW: canvas.width,
        canvasH: canvas.height,
      } as BroadcastStroke,
    });
  }, [pageId, tool, color, size]);

  const broadcastClear = useCallback(() => {
    if (!pageId) return;
    supabase.channel(`canvas-${pageId}`).send({
      type: 'broadcast',
      event: 'clear',
      payload: {},
    });
  }, [pageId]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const configureCtx = (ctx: CanvasRenderingContext2D) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color.startsWith('rgba') ? color : `${color}66`;
      ctx.lineWidth = size * 6;
    } else if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = size * 4;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    setIsDrawing(true);
    const pos = getPos(e);
    startPosRef.current = pos;
    currentStrokeRef.current = [pos];

    if (['line', 'rect', 'circle'].includes(tool)) {
      snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } else {
      configureCtx(ctx);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const pos = getPos(e);
    currentStrokeRef.current.push(pos);

    if (['line', 'rect', 'circle'].includes(tool) && snapshotRef.current && startPosRef.current) {
      ctx.putImageData(snapshotRef.current, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.beginPath();
      const s = startPosRef.current;
      if (tool === 'line') {
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(pos.x, pos.y);
      } else if (tool === 'rect') {
        ctx.rect(s.x, s.y, pos.x - s.x, pos.y - s.y);
      } else if (tool === 'circle') {
        const rx = Math.abs(pos.x - s.x) / 2;
        const ry = Math.abs(pos.y - s.y) / 2;
        const cx = s.x + (pos.x - s.x) / 2;
        const cy = s.y + (pos.y - s.y) / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      }
      ctx.stroke();
    } else {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const ctx = getCtx();
    if (ctx) ctx.globalCompositeOperation = 'source-over';
    snapshotRef.current = null;

    // Broadcast the completed stroke
    broadcastStroke(currentStrokeRef.current);
    currentStrokeRef.current = [];

    saveHistory();
    debouncedSave();
  };

  const undo = () => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    const ctx = getCtx();
    if (ctx) ctx.putImageData(historyRef.current[historyIndexRef.current].data, 0, 0);
    debouncedSave();
  };

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    const ctx = getCtx();
    if (ctx) ctx.putImageData(historyRef.current[historyIndexRef.current].data, 0, 0);
    debouncedSave();
  };

  const clearCanvas = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveHistory();
    debouncedSave();
    broadcastClear();
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = `${pageTitle || 'pizarra'}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  const tools: { id: Tool; icon: any; label: string }[] = [
    { id: 'pen', icon: Pen, label: 'Pincel' },
    { id: 'highlighter', icon: Highlighter, label: 'Subrayador' },
    { id: 'eraser', icon: Eraser, label: 'Borrador' },
    { id: 'line', icon: Minus, label: 'Línea' },
    { id: 'rect', icon: Square, label: 'Rectángulo' },
    { id: 'circle', icon: Circle, label: 'Círculo' },
  ];

  const activeColors = tool === 'highlighter' ? HIGHLIGHTER_COLORS : COLORS;

  const toolbar = (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-border/50 bg-card flex-wrap">
      <div className="flex items-center gap-0.5 border-r border-border/30 pr-2 mr-1">
        {tools.map(t => {
          const Icon = t.icon;
          return (
            <Button
              key={t.id}
              variant={tool === t.id ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setTool(t.id);
                if (t.id === 'highlighter') setColor(HIGHLIGHTER_COLORS[0]);
                else if (t.id !== 'eraser' && color.startsWith('rgba')) setColor('#000000');
              }}
              title={t.label}
            >
              <Icon className="h-4 w-4" />
            </Button>
          );
        })}
      </div>
      <div className="flex items-center gap-0.5 border-r border-border/30 pr-2 mr-1">
        {activeColors.map(c => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={cn(
              'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
              color === c ? 'border-primary scale-110' : 'border-border/50'
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 border-r border-border/30 pr-2 mr-1 min-w-[120px]">
        <span className="text-[10px] text-muted-foreground">Grosor</span>
        <Slider value={[size]} onValueChange={v => setSize(v[0])} min={1} max={20} step={1} className="w-20" />
        <span className="text-[10px] text-muted-foreground w-4 text-center">{size}</span>
      </div>
      <div className="flex items-center gap-0.5 ml-auto">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} title="Deshacer"><Undo2 className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} title="Rehacer"><Redo2 className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearCanvas} title="Limpiar"><Trash2 className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={downloadCanvas} title="Descargar"><Download className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMaximized(!maximized)} title={maximized ? 'Minimizar' : 'Maximizar'}>
          {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  // Canvas uses object-fit contain so it always shows correctly regardless of container size
  const canvasEl = (
    <div ref={containerRef} className="flex-1 min-h-0 relative cursor-crosshair bg-white flex items-center justify-center" style={{ isolation: 'isolate' }}>
      <canvas
        ref={canvasRef}
        className="max-w-full max-h-full"
        style={{ objectFit: 'contain' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );

  if (maximized) {
    return (
      <Dialog open={maximized} onOpenChange={setMaximized}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] p-0 overflow-hidden">
          <div className="flex flex-col h-full">
            {toolbar}
            {canvasEl}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {toolbar}
      {canvasEl}
    </div>
  );
}
