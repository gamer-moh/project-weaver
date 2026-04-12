import { useMemo } from 'react';
import { Task, diffDays, addDays, RelationType } from '@/lib/scheduler';

interface GanttChartProps {
  tasks: Task[];
}

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 48;
const DAY_WIDTH = 28;
const BAR_HEIGHT = 18;
const BAR_MARGIN = (ROW_HEIGHT - BAR_HEIGHT) / 2;
const ARROW_GAP = 10;

interface ArrowPath {
  d: string;
  isCritical: boolean;
  type: RelationType;
}

function buildArrowPath(
  fromX: number, fromY: number,
  toX: number, toY: number,
  type: RelationType,
  predBarStartX: number, predBarEndX: number,
  succBarStartX: number, succBarEndX: number,
): string {
  // Professional orthogonal routing
  const dropDown = 12;
  const vertGap = 6;

  if (type === 'FS') {
    // From pred end → down → horizontal → down to succ start
    const exitX = fromX;
    const entryX = toX;
    if (fromY < toY) {
      const midY = fromY + dropDown;
      if (exitX > entryX + ARROW_GAP) {
        // Pred ends after succ starts - need to route around
        return `M${exitX},${fromY} L${exitX + ARROW_GAP},${fromY} L${exitX + ARROW_GAP},${midY} L${entryX},${midY} L${entryX},${toY}`;
      }
      return `M${exitX},${fromY} L${exitX + ARROW_GAP},${fromY} L${exitX + ARROW_GAP},${midY} L${entryX},${midY} L${entryX},${toY}`;
    } else {
      const midY = toY - dropDown;
      return `M${exitX},${fromY} L${exitX + ARROW_GAP},${fromY} L${exitX + ARROW_GAP},${midY} L${entryX},${midY} L${entryX},${toY}`;
    }
  }

  if (type === 'SS') {
    // From pred start → left → down → to succ start
    const exitX = fromX;
    const entryX = toX;
    const leftX = Math.min(exitX, entryX) - ARROW_GAP;
    return `M${exitX},${fromY} L${leftX},${fromY} L${leftX},${toY} L${entryX},${toY}`;
  }

  if (type === 'FF') {
    // From pred end → right → down → to succ end
    const exitX = fromX;
    const entryX = toX;
    const rightX = Math.max(exitX, entryX) + ARROW_GAP;
    return `M${exitX},${fromY} L${rightX},${fromY} L${rightX},${toY} L${entryX},${toY}`;
  }

  if (type === 'SF') {
    // From pred start → left → down → to succ end
    const exitX = fromX;
    const entryX = toX;
    if (exitX > entryX) {
      const midY = (fromY + toY) / 2;
      return `M${exitX},${fromY} L${exitX - ARROW_GAP},${fromY} L${exitX - ARROW_GAP},${midY} L${entryX + ARROW_GAP},${midY} L${entryX + ARROW_GAP},${toY} L${entryX},${toY}`;
    }
    return `M${exitX},${fromY} L${exitX - ARROW_GAP},${fromY} L${exitX - ARROW_GAP},${toY} L${entryX},${toY}`;
  }

  return `M${fromX},${fromY} L${toX},${toY}`;
}

export function GanttChart({ tasks }: GanttChartProps) {
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
    for (let i = 0; i < total; i++) {
      dts.push(addDays(pStart, i));
    }

    return { projectStart: pStart, totalDays: total, dates: dts };
  }, [tasks]);

  const chartWidth = totalDays * DAY_WIDTH;
  const chartHeight = HEADER_HEIGHT + tasks.length * ROW_HEIGHT;

  // RTL: flip X axis. Day 0 is on the RIGHT side.
  const rtlX = (dayOffset: number) => chartWidth - (dayOffset + 1) * DAY_WIDTH;
  const getBarX = (date: Date) => {
    const dayOff = diffDays(date, projectStart);
    // Bar starts at rtlX of (dayOff + duration - 1) and ends at rtlX of dayOff
    return chartWidth - (dayOff + 1) * DAY_WIDTH;
  };
  const getBarXEnd = (date: Date) => {
    const dayOff = diffDays(date, projectStart);
    return chartWidth - dayOff * DAY_WIDTH;
  };
  const getBarStartEdge = (task: Task) => {
    // In RTL, "start" edge is on the RIGHT
    return getBarXEnd(task.startDate);
  };
  const getBarEndEdge = (task: Task) => {
    // In RTL, "end/finish" edge is on the LEFT
    return getBarX(task.endDate);
  };
  const getBarW = (start: Date, end: Date) => (diffDays(end, start) + 1) * DAY_WIDTH;

  // Today line
  const todayDate = new Date(2026, 3, 13); // Fixed to prevent hydration mismatch
  const todayDayOff = diffDays(todayDate, projectStart);
  const todayXPos = chartWidth - (todayDayOff + 0.5) * DAY_WIDTH;

  // Months (RTL)
  const months = useMemo(() => {
    const m: Array<{ label: string; x: number; width: number }> = [];
    let currentMonth = '';
    let startIdx = 0;

    dates.forEach((d, i) => {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key !== currentMonth) {
        if (currentMonth) {
          const w = (i - startIdx) * DAY_WIDTH;
          m.push({
            label: dates[startIdx].toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' }),
            x: chartWidth - i * DAY_WIDTH,
            width: w,
          });
        }
        currentMonth = key;
        startIdx = i;
      }
    });
    if (dates.length > 0) {
      const w = (dates.length - startIdx) * DAY_WIDTH;
      m.push({
        label: dates[startIdx].toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' }),
        x: chartWidth - dates.length * DAY_WIDTH,
        width: w,
      });
    }
    return m;
  }, [dates, chartWidth]);

  // Dependency arrows
  const arrows = useMemo((): ArrowPath[] => {
    const taskMap = new Map(tasks.map((t, i) => [t.id, { task: t, index: i }]));
    const result: ArrowPath[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      for (const pred of task.predecessors) {
        const predInfo = taskMap.get(pred.taskId);
        if (!predInfo) continue;

        const predTask = predInfo.task;
        const predRow = predInfo.index;
        const succRow = i;

        const predY = HEADER_HEIGHT + predRow * ROW_HEIGHT + ROW_HEIGHT / 2;
        const succY = HEADER_HEIGHT + succRow * ROW_HEIGHT + ROW_HEIGHT / 2;

        // In RTL: start edge = right, end/finish edge = left
        const predStartEdge = getBarStartEdge(predTask); // right edge
        const predEndEdge = getBarEndEdge(predTask);     // left edge
        const succStartEdge = getBarStartEdge(task);
        const succEndEdge = getBarEndEdge(task);

        const predBarSX = getBarEndEdge(predTask);
        const predBarEX = getBarStartEdge(predTask);
        const succBarSX = getBarEndEdge(task);
        const succBarEX = getBarStartEdge(task);

        let fromX: number, toX: number;

        switch (pred.type) {
          case 'FS': // from pred finish (left) to succ start (right)
            fromX = predEndEdge;
            toX = succStartEdge;
            break;
          case 'SS': // from pred start (right) to succ start (right)
            fromX = predStartEdge;
            toX = succStartEdge;
            break;
          case 'FF': // from pred finish (left) to succ finish (left)
            fromX = predEndEdge;
            toX = succEndEdge;
            break;
          case 'SF': // from pred start (right) to succ finish (left)
            fromX = predStartEdge;
            toX = succEndEdge;
            break;
        }

        const d = buildArrowPathRTL(
          fromX, predY, toX, succY,
          pred.type,
          predBarSX, predBarEX,
          succBarSX, succBarEX,
        );

        result.push({
          d,
          isCritical: predTask.isCritical && task.isCritical,
          type: pred.type,
        });
      }
    }

    return result;
  }, [tasks, projectStart, chartWidth]);

  return (
    <div className="h-full overflow-auto bg-card" dir="ltr">
      <svg width={chartWidth} height={Math.max(chartHeight, 300)} className="min-w-full">
        <defs>
          <marker id="arrow-normal" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
            <path d="M0,0 L6,2.5 L0,5 L1.5,2.5 Z" fill="oklch(0.6 0.02 250 / 0.6)" />
          </marker>
          <marker id="arrow-critical" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto">
            <path d="M0,0 L6,2.5 L0,5 L1.5,2.5 Z" fill="oklch(0.65 0.22 25)" />
          </marker>
        </defs>

        {/* Month headers */}
        {months.map((m, i) => (
          <g key={i}>
            <rect x={m.x} y={0} width={m.width} height={24} className="fill-secondary/80" />
            <text
              x={m.x + m.width - 8}
              y={16}
              textAnchor="end"
              className="fill-muted-foreground text-[10px] font-medium"
              style={{ fontFamily: 'Cairo, sans-serif' }}
            >
              {m.label}
            </text>
          </g>
        ))}

        {/* Day columns (RTL) */}
        {dates.map((d, i) => {
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          const x = chartWidth - (i + 1) * DAY_WIDTH;
          return (
            <g key={i}>
              {isWeekend && (
                <rect x={x} y={24} width={DAY_WIDTH} height={chartHeight} className="fill-secondary/30" />
              )}
              <text
                x={x + DAY_WIDTH / 2}
                y={40}
                textAnchor="middle"
                className={`text-[9px] ${isWeekend ? 'fill-muted-foreground/50' : 'fill-muted-foreground'}`}
              >
                {d.getDate()}
              </text>
              <line x1={x} y1={24} x2={x} y2={chartHeight} className="stroke-border/30" strokeWidth={0.5} />
            </g>
          );
        })}

        {/* Header separator */}
        <line x1={0} y1={HEADER_HEIGHT} x2={chartWidth} y2={HEADER_HEIGHT} className="stroke-border" strokeWidth={1} />

        {/* Row lines */}
        {tasks.map((_, i) => (
          <line key={i} x1={0} y1={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT} x2={chartWidth} y2={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT} className="stroke-border/20" strokeWidth={0.5} />
        ))}

        {/* Today line */}
        {todayXPos > 0 && todayXPos < chartWidth && (
          <line x1={todayXPos} y1={0} x2={todayXPos} y2={chartHeight} className="stroke-gantt-today" strokeWidth={1.5} strokeDasharray="4 2" />
        )}

        {/* Dependency arrows - drawn BEHIND bars */}
        {arrows.map((arrow, i) => (
          <path
            key={`dep-${i}`}
            d={arrow.d}
            fill="none"
            stroke={arrow.isCritical ? 'oklch(0.65 0.22 25)' : 'oklch(0.6 0.02 250 / 0.5)'}
            strokeWidth={1.5}
            strokeLinejoin="round"
            markerEnd={`url(#arrow-${arrow.isCritical ? 'critical' : 'normal'})`}
          />
        ))}

        {/* Task bars */}
        {tasks.map((task, i) => {
          const w = getBarW(task.startDate, task.endDate);
          const barLeft = getBarEndEdge(task); // left edge in RTL
          const y = HEADER_HEIGHT + i * ROW_HEIGHT + BAR_MARGIN;

          return (
            <g key={task.id}>
              {/* Shadow */}
              <rect
                x={barLeft}
                y={y + 2}
                width={w}
                height={BAR_HEIGHT}
                rx={4}
                fill="black"
                opacity={0.15}
              />
              {/* Bar */}
              <rect
                x={barLeft}
                y={y}
                width={w}
                height={BAR_HEIGHT}
                rx={4}
                className={task.isCritical ? 'fill-gantt-bar-critical' : 'fill-gantt-bar'}
                opacity={0.9}
              />
              {/* Progress */}
              {task.progress > 0 && (
                <rect
                  x={barLeft + w - w * (task.progress / 100)}
                  y={y + 2}
                  width={w * (task.progress / 100)}
                  height={BAR_HEIGHT - 4}
                  rx={2}
                  className={task.isCritical ? 'fill-critical-path' : 'fill-primary'}
                  opacity={0.5}
                />
              )}
              {/* Task name - positioned to the right of bar in RTL */}
              <text
                x={barLeft + w + 6}
                y={y + BAR_HEIGHT / 2 + 4}
                className="fill-muted-foreground text-[9px] font-medium"
                style={{ fontFamily: 'Cairo, sans-serif' }}
              >
                {task.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Build professional orthogonal arrow path for RTL Gantt
 * In RTL: start = right edge, finish = left edge
 */
function buildArrowPathRTL(
  fromX: number, fromY: number,
  toX: number, toY: number,
  type: RelationType,
  _predBarLeft: number, _predBarRight: number,
  _succBarLeft: number, _succBarRight: number,
): string {
  const gap = ARROW_GAP;
  const isDownward = toY > fromY;
  const vertDir = isDownward ? 1 : -1;

  switch (type) {
    case 'FS': {
      // From finish (left) → go left → down → right to start (right)
      const exitX = fromX - gap;
      if (toX <= fromX) {
        // Succ starts after pred finishes (normal case in RTL)
        const midY = fromY + (ROW_HEIGHT / 2 + 2) * vertDir;
        return `M${fromX},${fromY} L${exitX},${fromY} L${exitX},${midY} L${toX + gap},${midY} L${toX + gap},${toY} L${toX},${toY}`;
      } else {
        // Overlap case
        const midY = fromY + (ROW_HEIGHT / 2 + 2) * vertDir;
        return `M${fromX},${fromY} L${exitX},${fromY} L${exitX},${midY} L${toX + gap},${midY} L${toX + gap},${toY} L${toX},${toY}`;
      }
    }
    case 'SS': {
      // Both from right edge
      const rightX = Math.max(fromX, toX) + gap;
      return `M${fromX},${fromY} L${rightX},${fromY} L${rightX},${toY} L${toX},${toY}`;
    }
    case 'FF': {
      // Both from left edge
      const leftX = Math.min(fromX, toX) - gap;
      return `M${fromX},${fromY} L${leftX},${fromY} L${leftX},${toY} L${toX},${toY}`;
    }
    case 'SF': {
      // From start (right) to finish (left)
      const exitX = fromX + gap;
      const midY = fromY + (ROW_HEIGHT / 2 + 2) * vertDir;
      return `M${fromX},${fromY} L${exitX},${fromY} L${exitX},${midY} L${toX - gap},${midY} L${toX - gap},${toY} L${toX},${toY}`;
    }
  }
}
