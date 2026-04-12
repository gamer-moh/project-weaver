import { useMemo, useState } from 'react';
import { Task, diffDays, addDays, RelationType } from '@/lib/scheduler';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface GanttChartProps {
  tasks: Task[];
}

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 48;
const BAR_HEIGHT = 18;
const BAR_MARGIN = (ROW_HEIGHT - BAR_HEIGHT) / 2;

export function GanttChart({ tasks }: GanttChartProps) {
  const [dayWidth, setDayWidth] = useState(28);

  const { projectStart, totalDays, dates } = useMemo(() => {
    if (tasks.length === 0) {
      const d = new Date(2026, 3, 13);
      return { projectStart: d, totalDays: 30, dates: [] };
    }

    let minDate = new Date(tasks[0].startDate);
    let maxDate = new Date(tasks[0].endDate);
    for (const t of tasks) {
      if (t.startDate < minDate) minDate = new Date(t.startDate);
      if (t.endDate > maxDate) maxDate = new Date(t.endDate);
    }

    const pStart = addDays(minDate, -2);
    const pEnd = addDays(maxDate, 5);
    const total = diffDays(pEnd, pStart) + 1;

    const dts: Date[] = [];
    for (let i = 0; i < total; i++) dts.push(addDays(pStart, i));

    return { projectStart: pStart, totalDays: total, dates: dts };
  }, [tasks]);

  const chartWidth = totalDays * dayWidth;
  const chartHeight = HEADER_HEIGHT + tasks.length * ROW_HEIGHT;

  const todayDate = new Date(2026, 3, 13);
  const todayDayOff = diffDays(todayDate, projectStart);
  const todayXPos = chartWidth - (todayDayOff + 0.5) * dayWidth;

  // Months RTL
  const months = useMemo(() => {
    const m: Array<{ label: string; x: number; width: number }> = [];
    let currentMonth = '';
    let startIdx = 0;

    dates.forEach((d, i) => {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key !== currentMonth) {
        if (currentMonth) {
          const w = (i - startIdx) * dayWidth;
          m.push({
            label: dates[startIdx].toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' }),
            x: chartWidth - i * dayWidth,
            width: w,
          });
        }
        currentMonth = key;
        startIdx = i;
      }
    });
    if (dates.length > 0) {
      const w = (dates.length - startIdx) * dayWidth;
      m.push({
        label: dates[startIdx].toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' }),
        x: chartWidth - dates.length * dayWidth,
        width: w,
      });
    }
    return m;
  }, [dates, chartWidth, dayWidth]);

  // RTL position helpers
  const getBarEndEdge = (task: Task) => {
    const dayOff = diffDays(task.endDate, projectStart);
    return chartWidth - (dayOff + 1) * dayWidth;
  };
  const getBarStartEdge = (task: Task) => {
    const dayOff = diffDays(task.startDate, projectStart);
    return chartWidth - dayOff * dayWidth;
  };
  const getBarW = (start: Date, end: Date) => (diffDays(end, start) + 1) * dayWidth;

  // Professional dependency arrows
  const arrows = useMemo(() => {
    const taskMap = new Map(tasks.map((t, i) => [t.id, { task: t, index: i }]));
    const result: Array<{ d: string; isCritical: boolean }> = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      for (const pred of task.predecessors) {
        const predInfo = taskMap.get(pred.taskId);
        if (!predInfo) continue;

        const pTask = predInfo.task;
        const pRow = predInfo.index;
        const sRow = i;

        const pY = HEADER_HEIGHT + pRow * ROW_HEIGHT + ROW_HEIGHT / 2;
        const sY = HEADER_HEIGHT + sRow * ROW_HEIGHT + ROW_HEIGHT / 2;

        // RTL edges: start=right, finish=left
        const pStartX = getBarStartEdge(pTask);
        const pEndX = getBarEndEdge(pTask);
        const sStartX = getBarStartEdge(task);
        const sEndX = getBarEndEdge(task);

        let fromX: number, toX: number;
        let fromSide: 'left' | 'right', toSide: 'left' | 'right';

        switch (pred.type) {
          case 'FS':
            fromX = pEndX; fromSide = 'left';
            toX = sStartX; toSide = 'right';
            break;
          case 'SS':
            fromX = pStartX; fromSide = 'right';
            toX = sStartX; toSide = 'right';
            break;
          case 'FF':
            fromX = pEndX; fromSide = 'left';
            toX = sEndX; toSide = 'left';
            break;
          case 'SF':
            fromX = pStartX; fromSide = 'right';
            toX = sEndX; toSide = 'left';
            break;
        }

        const d = buildProfessionalPath(fromX, pY, toX, sY, fromSide, toSide, BAR_HEIGHT / 2);

        result.push({
          d,
          isCritical: pTask.isCritical && task.isCritical,
        });
      }
    }
    return result;
  }, [tasks, projectStart, chartWidth, dayWidth]);

  return (
    <div className="flex flex-col h-full">
      {/* Zoom toolbar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-secondary/40 border-b border-border">
        <ZoomOut className="w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="range"
          min={10}
          max={60}
          value={dayWidth}
          onChange={e => setDayWidth(Number(e.target.value))}
          className="w-32 h-1 accent-primary cursor-pointer"
          dir="ltr"
        />
        <ZoomIn className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">{dayWidth}px/يوم</span>
      </div>

      {/* Chart */}
      <div className="flex-1 overflow-auto bg-card" dir="ltr">
        <svg width={chartWidth} height={Math.max(chartHeight, 300)} className="min-w-full">
          <defs>
            <marker id="arrow-norm" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,0.5 L7,3 L0,5.5" fill="none" stroke="oklch(0.55 0.03 250)" strokeWidth="1.2" strokeLinejoin="round" />
            </marker>
            <marker id="arrow-crit" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M0,0.5 L7,3 L0,5.5" fill="none" stroke="oklch(0.65 0.22 25)" strokeWidth="1.2" strokeLinejoin="round" />
            </marker>
          </defs>

          {/* Month headers */}
          {months.map((m, i) => (
            <g key={i}>
              <rect x={m.x} y={0} width={m.width} height={24} className="fill-secondary/80" />
              <text x={m.x + m.width - 8} y={16} textAnchor="end" className="fill-muted-foreground text-[10px] font-medium" style={{ fontFamily: 'Cairo, sans-serif' }}>
                {m.label}
              </text>
            </g>
          ))}

          {/* Day columns RTL */}
          {dates.map((d, i) => {
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const x = chartWidth - (i + 1) * dayWidth;
            return (
              <g key={i}>
                {isWeekend && <rect x={x} y={24} width={dayWidth} height={chartHeight} className="fill-secondary/30" />}
                <text x={x + dayWidth / 2} y={40} textAnchor="middle" className={`text-[9px] ${isWeekend ? 'fill-muted-foreground/50' : 'fill-muted-foreground'}`}>
                  {d.getDate()}
                </text>
                <line x1={x} y1={24} x2={x} y2={chartHeight} className="stroke-border/30" strokeWidth={0.5} />
              </g>
            );
          })}

          <line x1={0} y1={HEADER_HEIGHT} x2={chartWidth} y2={HEADER_HEIGHT} className="stroke-border" strokeWidth={1} />

          {tasks.map((_, i) => (
            <line key={i} x1={0} y1={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT} x2={chartWidth} y2={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT} className="stroke-border/20" strokeWidth={0.5} />
          ))}

          {/* Today */}
          {todayXPos > 0 && todayXPos < chartWidth && (
            <line x1={todayXPos} y1={0} x2={todayXPos} y2={chartHeight} className="stroke-gantt-today" strokeWidth={1.5} strokeDasharray="4 2" />
          )}

          {/* Arrows */}
          {arrows.map((arrow, i) => (
            <path
              key={`dep-${i}`}
              d={arrow.d}
              fill="none"
              stroke={arrow.isCritical ? 'oklch(0.65 0.22 25)' : 'oklch(0.55 0.03 250)'}
              strokeWidth={1.2}
              strokeLinejoin="round"
              markerEnd={`url(#arrow-${arrow.isCritical ? 'crit' : 'norm'})`}
            />
          ))}

          {/* Task bars */}
          {tasks.map((task, i) => {
            const w = getBarW(task.startDate, task.endDate);
            const barLeft = getBarEndEdge(task);
            const y = HEADER_HEIGHT + i * ROW_HEIGHT + BAR_MARGIN;

            return (
              <g key={task.id}>
                <rect x={barLeft} y={y + 2} width={w} height={BAR_HEIGHT} rx={3} fill="black" opacity={0.12} />
                <rect
                  x={barLeft} y={y} width={w} height={BAR_HEIGHT} rx={3}
                  className={task.isCritical ? 'fill-gantt-bar-critical' : 'fill-gantt-bar'}
                  opacity={0.9}
                />
                {task.progress > 0 && (
                  <rect
                    x={barLeft + w - w * (task.progress / 100)} y={y + 2}
                    width={w * (task.progress / 100)} height={BAR_HEIGHT - 4}
                    rx={2} className={task.isCritical ? 'fill-critical-path' : 'fill-primary'} opacity={0.5}
                  />
                )}
                <text x={barLeft + w + 6} y={y + BAR_HEIGHT / 2 + 4} className="fill-muted-foreground text-[9px] font-medium" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  {task.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/**
 * Professional orthogonal arrow path with clean right-angle routing.
 * Exits perpendicular to the bar edge, routes orthogonally, enters perpendicular.
 */
function buildProfessionalPath(
  fromX: number, fromY: number,
  toX: number, toY: number,
  fromSide: 'left' | 'right',
  toSide: 'left' | 'right',
  barHalfH: number,
): string {
  const stub = 12; // stub length exiting the bar
  const isDown = toY > fromY;

  // Exit point: go outward from bar edge
  const exitX = fromSide === 'left' ? fromX - stub : fromX + stub;
  // Entry approach point
  const entryX = toSide === 'left' ? toX - stub : toX + stub;

  // Determine if we need a simple L or a Z route
  if (fromSide === 'left' && toSide === 'right') {
    // FS in RTL: exit left, enter right — typical forward dependency
    if (exitX <= entryX) {
      // Clean space between — simple Z route
      const midX = (exitX + entryX) / 2;
      return `M${fromX},${fromY} L${exitX},${fromY} L${exitX},${toY} L${toX},${toY}`;
    } else {
      // Bars overlap — need to route around
      const midY = fromY + (ROW_HEIGHT * 0.6) * (isDown ? 1 : -1);
      return `M${fromX},${fromY} L${exitX},${fromY} L${exitX},${midY} L${entryX},${midY} L${entryX},${toY} L${toX},${toY}`;
    }
  }

  if (fromSide === 'right' && toSide === 'right') {
    // SS: both exit/enter from right
    const maxX = Math.max(exitX, entryX);
    return `M${fromX},${fromY} L${maxX},${fromY} L${maxX},${toY} L${toX},${toY}`;
  }

  if (fromSide === 'left' && toSide === 'left') {
    // FF: both exit/enter from left
    const minX = Math.min(exitX, entryX);
    return `M${fromX},${fromY} L${minX},${fromY} L${minX},${toY} L${toX},${toY}`;
  }

  if (fromSide === 'right' && toSide === 'left') {
    // SF: exit right, enter left
    if (exitX >= entryX) {
      return `M${fromX},${fromY} L${exitX},${fromY} L${exitX},${toY} L${toX},${toY}`;
    } else {
      const midY = fromY + (ROW_HEIGHT * 0.6) * (isDown ? 1 : -1);
      return `M${fromX},${fromY} L${exitX},${fromY} L${exitX},${midY} L${entryX},${midY} L${entryX},${toY} L${toX},${toY}`;
    }
  }

  return `M${fromX},${fromY} L${toX},${toY}`;
}
