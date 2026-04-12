import { useMemo, useRef } from 'react';
import { Task, diffDays, addDays } from '@/lib/scheduler';

interface GanttChartProps {
  tasks: Task[];
}

const ROW_HEIGHT = 32;
const HEADER_HEIGHT = 48;
const DAY_WIDTH = 28;
const BAR_HEIGHT = 16;
const BAR_MARGIN = (ROW_HEIGHT - BAR_HEIGHT) / 2;

export function GanttChart({ tasks }: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { projectStart, projectEnd, totalDays, dates } = useMemo(() => {
    if (tasks.length === 0) {
      const today = new Date();
      return { projectStart: today, projectEnd: today, totalDays: 30, dates: [] };
    }

    let minDate = new Date(tasks[0].startDate);
    let maxDate = new Date(tasks[0].endDate);
    for (const t of tasks) {
      if (t.startDate < minDate) minDate = new Date(t.startDate);
      if (t.endDate > maxDate) maxDate = new Date(t.endDate);
    }

    // Add padding
    const pStart = addDays(minDate, -2);
    const pEnd = addDays(maxDate, 5);
    const total = diffDays(pEnd, pStart) + 1;

    const dts: Date[] = [];
    for (let i = 0; i < total; i++) {
      dts.push(addDays(pStart, i));
    }

    return { projectStart: pStart, projectEnd: pEnd, totalDays: total, dates: dts };
  }, [tasks]);

  const chartWidth = totalDays * DAY_WIDTH;
  const chartHeight = HEADER_HEIGHT + tasks.length * ROW_HEIGHT;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayX = diffDays(today, projectStart) * DAY_WIDTH;

  // Group dates by month
  const months = useMemo(() => {
    const m: Array<{ label: string; startX: number; width: number }> = [];
    let currentMonth = '';
    let startIdx = 0;

    dates.forEach((d, i) => {
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key !== currentMonth) {
        if (currentMonth) {
          m.push({
            label: dates[startIdx].toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
            startX: startIdx * DAY_WIDTH,
            width: (i - startIdx) * DAY_WIDTH,
          });
        }
        currentMonth = key;
        startIdx = i;
      }
    });
    if (dates.length > 0) {
      m.push({
        label: dates[startIdx].toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        startX: startIdx * DAY_WIDTH,
        width: (dates.length - startIdx) * DAY_WIDTH,
      });
    }
    return m;
  }, [dates]);

  const getBarX = (date: Date) => diffDays(date, projectStart) * DAY_WIDTH;
  const getBarWidth = (start: Date, end: Date) => (diffDays(end, start) + 1) * DAY_WIDTH;

  // Calculate dependency arrows
  const arrows = useMemo(() => {
    const taskMap = new Map(tasks.map((t, i) => [t.id, { task: t, index: i }]));
    const lines: Array<{
      points: string;
      isCritical: boolean;
    }> = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      for (const pred of task.predecessors) {
        const predInfo = taskMap.get(pred.taskId);
        if (!predInfo) continue;

        const predY = HEADER_HEIGHT + predInfo.index * ROW_HEIGHT + ROW_HEIGHT / 2;
        const succY = HEADER_HEIGHT + i * ROW_HEIGHT + ROW_HEIGHT / 2;
        const predStartX = getBarX(predInfo.task.startDate);
        const predEndX = predStartX + getBarWidth(predInfo.task.startDate, predInfo.task.endDate);
        const succStartX = getBarX(task.startDate);
        const succEndX = succStartX + getBarWidth(task.startDate, task.endDate);

        let fromX: number, toX: number;
        const midGap = 8;

        switch (pred.type) {
          case 'FS':
            fromX = predEndX;
            toX = succStartX;
            break;
          case 'SS':
            fromX = predStartX;
            toX = succStartX;
            break;
          case 'FF':
            fromX = predEndX;
            toX = succEndX;
            break;
          case 'SF':
            fromX = predStartX;
            toX = succEndX;
            break;
        }

        // Simple L-shaped path
        const midY = (predY + succY) / 2;
        const path = `${fromX},${predY} ${fromX + midGap},${predY} ${fromX + midGap},${midY} ${toX - midGap},${midY} ${toX - midGap},${succY} ${toX},${succY}`;

        lines.push({
          points: path,
          isCritical: predInfo.task.isCritical && task.isCritical,
        });
      }
    }

    return lines;
  }, [tasks, projectStart]);

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-card">
      <svg width={chartWidth} height={chartHeight} className="min-w-full">
        {/* Month headers */}
        {months.map((m, i) => (
          <g key={i}>
            <rect x={m.startX} y={0} width={m.width} height={24} className="fill-secondary/80" />
            <text x={m.startX + 6} y={16} className="fill-muted-foreground text-[10px] font-medium">
              {m.label}
            </text>
          </g>
        ))}

        {/* Day headers */}
        {dates.map((d, i) => {
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <g key={i}>
              {isWeekend && (
                <rect
                  x={i * DAY_WIDTH}
                  y={24}
                  width={DAY_WIDTH}
                  height={chartHeight}
                  className="fill-secondary/30"
                />
              )}
              <text
                x={i * DAY_WIDTH + DAY_WIDTH / 2}
                y={40}
                textAnchor="middle"
                className={`text-[9px] ${isWeekend ? 'fill-muted-foreground/50' : 'fill-muted-foreground'}`}
              >
                {d.getDate()}
              </text>
              <line
                x1={i * DAY_WIDTH}
                y1={24}
                x2={i * DAY_WIDTH}
                y2={chartHeight}
                className="stroke-border/30"
                strokeWidth={0.5}
              />
            </g>
          );
        })}

        {/* Header separator */}
        <line x1={0} y1={HEADER_HEIGHT} x2={chartWidth} y2={HEADER_HEIGHT} className="stroke-border" strokeWidth={1} />

        {/* Row lines */}
        {tasks.map((_, i) => (
          <line
            key={i}
            x1={0}
            y1={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT}
            x2={chartWidth}
            y2={HEADER_HEIGHT + (i + 1) * ROW_HEIGHT}
            className="stroke-border/20"
            strokeWidth={0.5}
          />
        ))}

        {/* Today line */}
        {todayX > 0 && todayX < chartWidth && (
          <line
            x1={todayX}
            y1={0}
            x2={todayX}
            y2={chartHeight}
            className="stroke-gantt-today"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
        )}

        {/* Dependency arrows */}
        {arrows.map((arrow, i) => (
          <g key={`arrow-${i}`}>
            <polyline
              points={arrow.points}
              fill="none"
              className={arrow.isCritical ? 'stroke-critical-path' : 'stroke-muted-foreground/40'}
              strokeWidth={1.5}
              markerEnd={`url(#arrowhead${arrow.isCritical ? '-critical' : ''})`}
            />
          </g>
        ))}

        {/* Arrow markers */}
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" className="fill-muted-foreground/40" />
          </marker>
          <marker id="arrowhead-critical" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" className="fill-critical-path" />
          </marker>
        </defs>

        {/* Task bars */}
        {tasks.map((task, i) => {
          const x = getBarX(task.startDate);
          const w = getBarWidth(task.startDate, task.endDate);
          const y = HEADER_HEIGHT + i * ROW_HEIGHT + BAR_MARGIN;

          return (
            <g key={task.id}>
              {/* Bar background */}
              <rect
                x={x}
                y={y}
                width={w}
                height={BAR_HEIGHT}
                rx={3}
                className={task.isCritical ? 'fill-gantt-bar-critical' : 'fill-gantt-bar'}
                opacity={0.85}
              />
              {/* Progress fill */}
              {task.progress > 0 && (
                <rect
                  x={x}
                  y={y}
                  width={w * (task.progress / 100)}
                  height={BAR_HEIGHT}
                  rx={3}
                  className={task.isCritical ? 'fill-critical-path' : 'fill-primary'}
                  opacity={0.6}
                />
              )}
              {/* Task name on bar */}
              {w > 60 && (
                <text
                  x={x + 6}
                  y={y + BAR_HEIGHT / 2 + 3.5}
                  className="fill-foreground text-[9px] font-medium"
                >
                  {task.name.length > w / 7 ? task.name.slice(0, Math.floor(w / 7)) + '…' : task.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
