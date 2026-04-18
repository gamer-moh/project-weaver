import { useMemo, useState } from 'react';
import { Task, diffDays, addDays } from '@/lib/scheduler';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { buildOrthogonalDependencyPath, getDependencyConnection, getTaskBarLayout } from '@/lib/gantt';

interface GanttChartProps {
  tasks: Task[];
}

const HEADER_HEIGHT = 48;
const LABEL_GUTTER_MIN = 220;
const LABEL_GUTTER_MAX = 320;
const LABEL_GAP = 14;

export function GanttChart({ tasks }: GanttChartProps) {
  const [dayWidth, setDayWidth] = useState(28);
  const [rowHeight, setRowHeight] = useState(48);
  const barHeight = Math.min(24, Math.max(16, rowHeight - 16));
  const barMargin = (rowHeight - barHeight) / 2;

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
  const chartHeight = HEADER_HEIGHT + tasks.length * rowHeight;
  const labelGutterWidth = Math.max(LABEL_GUTTER_MIN, Math.min(LABEL_GUTTER_MAX, dayWidth * 9));
  const scrollWidth = chartWidth + labelGutterWidth;

  const todayDate = new Date(2026, 3, 13);
  const todayDayOff = diffDays(todayDate, projectStart);
  const todayXPos = (todayDayOff + 0.5) * dayWidth;

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
            x: startIdx * dayWidth,
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
        x: startIdx * dayWidth,
        width: w,
      });
    }

    return m;
  }, [dates, dayWidth]);

  const arrows = useMemo(() => {
    const taskMap = new Map(tasks.map((t, i) => [t.id, { task: t, index: i }]));
    const successorCounts = new Map<string, number>();
    const result: Array<{ d: string; isCritical: boolean }> = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      for (const pred of task.predecessors) {
        const predInfo = taskMap.get(pred.taskId);
        if (!predInfo) continue;

        const pTask = predInfo.task;
        const pRow = predInfo.index;
        const sRow = i;
        const successorIndex = successorCounts.get(pred.taskId) ?? 0;
        successorCounts.set(pred.taskId, successorIndex + 1);

        const pY = HEADER_HEIGHT + pRow * rowHeight + rowHeight / 2;
        const sY = HEADER_HEIGHT + sRow * rowHeight + rowHeight / 2;
        const connection = getDependencyConnection(pred.type, pTask, task, projectStart, dayWidth);
        const d = buildOrthogonalDependencyPath(
          connection.fromX,
          pY,
          connection.toX,
          sY,
          connection.fromSide,
          connection.toSide,
          rowHeight,
          successorIndex,
        );

        result.push({
          d,
          isCritical: pTask.isCritical && task.isCritical,
        });
      }
    }

    return result;
  }, [tasks, projectStart, dayWidth, rowHeight]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-4 border-b border-border bg-secondary/40 px-3 py-2">
        <ZoomOut className="h-3.5 w-3.5 text-muted-foreground" />
        <Slider value={[dayWidth]} min={10} max={60} step={1} onValueChange={([value]) => setDayWidth(value)} className="w-32" dir="ltr" />
        <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">{dayWidth}px/يوم</span>
        <span className="h-4 w-px bg-border" />
        <span className="text-[10px] text-muted-foreground">ارتفاع الصف</span>
        <Slider value={[rowHeight]} min={30} max={64} step={2} onValueChange={([value]) => setRowHeight(value)} className="w-28" dir="ltr" />
        <span className="text-[10px] text-muted-foreground">{rowHeight}px</span>
      </div>

      <div className="flex-1 overflow-auto bg-card [transform-origin:left_top]" dir="ltr">
        <div className="relative" style={{ width: scrollWidth, height: Math.max(chartHeight, 300) }}>
          <svg width={chartWidth} height={Math.max(chartHeight, 300)} className="block origin-top-left" style={{ overflow: 'hidden' }}>
            <defs>
              <marker id="arrow-norm" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M0,0.5 L7,3 L0,5.5" fill="none" stroke="oklch(0.55 0.03 250)" strokeWidth="1.2" strokeLinejoin="round" />
              </marker>
              <marker id="arrow-crit" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M0,0.5 L7,3 L0,5.5" fill="none" stroke="oklch(0.65 0.22 25)" strokeWidth="1.2" strokeLinejoin="round" />
              </marker>
            </defs>

            {months.map((m, i) => (
              <g key={i}>
                <rect x={m.x} y={0} width={m.width} height={24} className="fill-secondary/80" />
                <text x={m.x + m.width - 8} y={16} textAnchor="end" className="fill-muted-foreground text-[10px] font-medium" style={{ fontFamily: 'Cairo, sans-serif' }}>
                  {m.label}
                </text>
              </g>
            ))}

            {dates.map((d, i) => {
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const x = i * dayWidth;
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
              <line key={i} x1={0} y1={HEADER_HEIGHT + (i + 1) * rowHeight} x2={chartWidth} y2={HEADER_HEIGHT + (i + 1) * rowHeight} className="stroke-border/20" strokeWidth={0.5} />
            ))}

            {todayXPos > 0 && todayXPos < chartWidth && (
              <line x1={todayXPos} y1={0} x2={todayXPos} y2={chartHeight} className="stroke-gantt-today" strokeWidth={1.5} strokeDasharray="4 2" />
            )}

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

            {tasks.map((task, i) => {
              const bar = getTaskBarLayout(task, projectStart, dayWidth);
              const y = HEADER_HEIGHT + i * rowHeight + barMargin;

              return (
                <g key={task.id}>
                  <rect x={bar.startX} y={y + 2} width={bar.width} height={barHeight} rx={3} fill="black" opacity={0.12} />
                  <rect
                    x={bar.startX}
                    y={y}
                    width={bar.width}
                    height={barHeight}
                    rx={3}
                    className={task.isCritical ? 'fill-gantt-bar-critical' : 'fill-gantt-bar'}
                    opacity={0.9}
                  />
                  {task.progress > 0 && (
                    <rect
                      x={bar.startX}
                      y={y + 2}
                      width={bar.width * (task.progress / 100)}
                      height={barHeight - 4}
                      rx={2}
                      className={task.isCritical ? 'fill-critical-path' : 'fill-primary'}
                      opacity={0.5}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          <div className="pointer-events-none absolute inset-y-0" style={{ left: chartWidth, width: labelGutterWidth }}>
            {tasks.map((task, i) => (
              <div
                key={`label-${task.id}`}
                dir="rtl"
                className="absolute z-10 flex items-center justify-end text-[10px] font-medium text-muted-foreground"
                style={{
                  left: LABEL_GAP,
                  top: HEADER_HEIGHT + i * rowHeight,
                  width: labelGutterWidth - LABEL_GAP - 10,
                  height: rowHeight,
                  paddingInlineStart: '10px',
                  paddingInlineEnd: '6px',
                  boxSizing: 'border-box',
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontFamily: 'Cairo, sans-serif',
                  letterSpacing: 'normal',
                  wordSpacing: 'normal',
                  unicodeBidi: 'plaintext',
                }}
              >
                {task.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
