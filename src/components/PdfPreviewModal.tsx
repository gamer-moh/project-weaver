import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { FileDown, LoaderCircle, X } from 'lucide-react';
import { Task, RelationType, addDays, diffDays, formatDate, formatPredecessors } from '@/lib/scheduler';

type PaperSize = 'a4' | 'a3';

type PaperSpec = {
  label: string;
  widthPx: number;
  heightPx: number;
  padding: number;
};

const PAPER_SPECS: Record<PaperSize, PaperSpec> = {
  a4: { label: 'A4', widthPx: 1123, heightPx: 794, padding: 30 },
  a3: { label: 'A3', widthPx: 1587, heightPx: 1123, padding: 40 },
};

const PDF_COLORS = {
  page: '#ffffff',
  ink: '#1f2a44',
  muted: '#6b7280',
  line: '#dbe1ea',
  subtle: '#f5f7fb',
  altRow: '#f7f9fc',
  brand: '#1f2a44',
  brandText: '#f8fafc',
  brandSubtle: '#c9d3e8',
  bar: '#2563eb',
  critical: '#dc2626',
  barFill: '#3b82f6',
  criticalFill: '#ef4444',
  weekend: '#f1f5f9',
  today: '#16a34a',
};

interface PdfPreviewModalProps {
  tasks: Task[];
  projectName: string;
  onClose: () => void;
}

async function waitForCaptureReady() {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    await document.fonts.ready;
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function captureElement(element: HTMLElement, widthPx: number, heightPx: number) {
  const scale = Math.min(2.2, Math.max(1.6, window.devicePixelRatio * 1.6));
  const canvas = await html2canvas(element, {
    backgroundColor: PDF_COLORS.page,
    scale,
    useCORS: true,
    logging: false,
    width: widthPx,
    height: heightPx,
    windowWidth: widthPx,
    windowHeight: heightPx,
    scrollX: 0,
    scrollY: 0,
  });

  return canvas.toDataURL('image/png');
}

function buildPdfFromImages(images: string[], paperSize: PaperSize, fileName: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: paperSize });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  images.forEach((image, index) => {
    if (index > 0) {
      doc.addPage(paperSize, 'landscape');
    }
    doc.addImage(image, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
  });

  doc.save(`${fileName}.pdf`);
}

function getProjectRange(tasks: Task[]) {
  if (tasks.length === 0) {
    const base = new Date(2026, 3, 13);
    return { projectStart: base, projectEnd: addDays(base, 30) };
  }

  let minDate = new Date(tasks[0].startDate);
  let maxDate = new Date(tasks[0].endDate);

  for (const task of tasks) {
    if (task.startDate < minDate) minDate = new Date(task.startDate);
    if (task.endDate > maxDate) maxDate = new Date(task.endDate);
  }

  return {
    projectStart: addDays(minDate, -2),
    projectEnd: addDays(maxDate, 4),
  };
}

function buildProfessionalPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  fromSide: 'left' | 'right',
  toSide: 'left' | 'right',
  rowHeight: number,
) {
  const stub = 12;
  const direction = toY >= fromY ? 1 : -1;
  const exitX = fromSide === 'left' ? fromX - stub : fromX + stub;
  const entryX = toSide === 'left' ? toX - stub : toX + stub;

  if (fromSide === 'left' && toSide === 'right') {
    if (exitX <= entryX) {
      return `M${fromX},${fromY} L${exitX},${fromY} L${exitX},${toY} L${toX},${toY}`;
    }

    const midY = fromY + rowHeight * 0.55 * direction;
    return `M${fromX},${fromY} L${exitX},${fromY} L${exitX},${midY} L${entryX},${midY} L${entryX},${toY} L${toX},${toY}`;
  }

  if (fromSide === 'right' && toSide === 'right') {
    const maxX = Math.max(exitX, entryX);
    return `M${fromX},${fromY} L${maxX},${fromY} L${maxX},${toY} L${toX},${toY}`;
  }

  if (fromSide === 'left' && toSide === 'left') {
    const minX = Math.min(exitX, entryX);
    return `M${fromX},${fromY} L${minX},${fromY} L${minX},${toY} L${toX},${toY}`;
  }

  if (fromSide === 'right' && toSide === 'left') {
    if (exitX >= entryX) {
      return `M${fromX},${fromY} L${exitX},${fromY} L${exitX},${toY} L${toX},${toY}`;
    }

    const midY = fromY + rowHeight * 0.55 * direction;
    return `M${fromX},${fromY} L${exitX},${fromY} L${exitX},${midY} L${entryX},${midY} L${entryX},${toY} L${toX},${toY}`;
  }

  return `M${fromX},${fromY} L${toX},${toY}`;
}

const ExportTablePage = forwardRef<HTMLDivElement, { tasks: Task[]; projectName: string; paperSize: PaperSize }>(
  function ExportTablePage({ tasks, projectName, paperSize }, ref) {
    const spec = PAPER_SPECS[paperSize];
    const reportDate = new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const taskIds = tasks.map((task) => task.id);

    return (
      <div
        ref={ref}
        dir="rtl"
        style={{
          width: spec.widthPx,
          height: spec.heightPx,
          background: PDF_COLORS.page,
          padding: spec.padding,
          fontFamily: 'Cairo, sans-serif',
          color: PDF_COLORS.ink,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            height: '100%',
            border: `1px solid ${PDF_COLORS.line}`,
            borderRadius: 22,
            overflow: 'hidden',
            background: PDF_COLORS.page,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              background: PDF_COLORS.brand,
              color: PDF_COLORS.brandText,
              padding: '20px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: 14, color: PDF_COLORS.brandSubtle }}>8:00 | {reportDate}</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{projectName}</div>
          </div>

          <div style={{ padding: '18px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, color: PDF_COLORS.muted }}>إجمالي المهام: {tasks.length}</div>
            <div style={{ display: 'flex', gap: 18, fontSize: 13, color: PDF_COLORS.muted }}>
              <span>المهام الحرجة: {tasks.filter((task) => task.isCritical).length}</span>
              <span>المسار الزمني: احترافي</span>
            </div>
          </div>

          <div style={{ padding: '18px 24px 0', flex: 1, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#2d3b61', color: PDF_COLORS.brandText }}>
                  {['#', 'WBS', 'اسم المهمة', 'المدة', 'البداية', 'النهاية', 'الاعتمادات', 'فائض', 'حرج'].map((header) => (
                    <th
                      key={header}
                      style={{
                        padding: '10px 8px',
                        fontWeight: 700,
                        borderBottom: `1px solid ${PDF_COLORS.line}`,
                        textAlign: 'center',
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, index) => (
                  <tr key={task.id} style={{ background: index % 2 === 0 ? PDF_COLORS.subtle : PDF_COLORS.altRow }}>
                    <td style={cellStyle('center')}>{index + 1}</td>
                    <td style={cellStyle('center')}>{task.wbs}</td>
                    <td style={cellStyle('right', 700)}>{task.name}</td>
                    <td style={cellStyle('center')} dir="ltr">{task.duration} يوم</td>
                    <td style={cellStyle('center')} dir="ltr">{formatDate(task.startDate)}</td>
                    <td style={cellStyle('center')} dir="ltr">{formatDate(task.endDate)}</td>
                    <td style={cellStyle('center')} dir="ltr">{formatPredecessors(task.predecessors, taskIds) || '—'}</td>
                    <td style={cellStyle('center')}>{task.totalFloat}</td>
                    <td style={{ ...cellStyle('center', 700), color: task.isCritical ? PDF_COLORS.critical : PDF_COLORS.muted }}>
                      {task.isCritical ? '●' : '○'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              marginTop: 'auto',
              padding: '12px 24px',
              fontSize: 12,
              color: PDF_COLORS.muted,
              textAlign: 'center',
            }}
          >
            ProjectFlow — التقرير التنفيذي للمشروع
          </div>
        </div>
      </div>
    );
  },
);

const ExportGanttPage = forwardRef<HTMLDivElement, { tasks: Task[]; projectName: string; paperSize: PaperSize }>(
  function ExportGanttPage({ tasks, projectName, paperSize }, ref) {
    const spec = PAPER_SPECS[paperSize];

    const { projectStart, projectEnd } = useMemo(() => getProjectRange(tasks), [tasks]);
    const totalDays = diffDays(projectEnd, projectStart) + 1;
    const labelWidth = paperSize === 'a3' ? 230 : 180;
    const chartWidth = spec.widthPx - spec.padding * 2 - 30 - labelWidth;
    const dayWidth = Math.max(10, Math.min(26, chartWidth / Math.max(totalDays, 1)));
    const timelineWidth = totalDays * dayWidth;
    const rowHeight = paperSize === 'a3' ? 44 : 36;
    const headerHeight = 62;
    const timelineHeight = headerHeight + tasks.length * rowHeight + 24;
    const dates = Array.from({ length: totalDays }, (_, index) => addDays(projectStart, index));

    const rtlStartEdge = (task: Task) => {
      const startOffset = diffDays(task.startDate, projectStart);
      return timelineWidth - startOffset * dayWidth;
    };

    const rtlEndEdge = (task: Task) => {
      const endOffset = diffDays(task.endDate, projectStart);
      return timelineWidth - (endOffset + 1) * dayWidth;
    };

    const arrows = useMemo(() => {
      const taskMap = new Map(tasks.map((task, index) => [task.id, { task, index }]));
      return tasks.flatMap((task, successorIndex) => {
        return task.predecessors.flatMap((pred) => {
          const predecessorInfo = taskMap.get(pred.taskId);
          if (!predecessorInfo) return [];

          const predecessorTask = predecessorInfo.task;
          const predecessorY = headerHeight + predecessorInfo.index * rowHeight + rowHeight / 2;
          const successorY = headerHeight + successorIndex * rowHeight + rowHeight / 2;

          const predecessorStart = rtlStartEdge(predecessorTask);
          const predecessorFinish = rtlEndEdge(predecessorTask);
          const successorStart = rtlStartEdge(task);
          const successorFinish = rtlEndEdge(task);

          let fromX = predecessorFinish;
          let toX = successorStart;
          let fromSide: 'left' | 'right' = 'left';
          let toSide: 'left' | 'right' = 'right';

          switch (pred.type) {
            case 'FS':
              fromX = predecessorFinish;
              toX = successorStart;
              fromSide = 'left';
              toSide = 'right';
              break;
            case 'SS':
              fromX = predecessorStart;
              toX = successorStart;
              fromSide = 'right';
              toSide = 'right';
              break;
            case 'FF':
              fromX = predecessorFinish;
              toX = successorFinish;
              fromSide = 'left';
              toSide = 'left';
              break;
            case 'SF':
              fromX = predecessorStart;
              toX = successorFinish;
              fromSide = 'right';
              toSide = 'left';
              break;
          }

          return [{
            d: buildProfessionalPath(fromX, predecessorY, toX, successorY, fromSide, toSide, rowHeight),
            critical: predecessorTask.isCritical && task.isCritical,
          }];
        });
      });
    }, [tasks, projectStart, rowHeight, headerHeight, timelineWidth, dayWidth]);

    return (
      <div
        ref={ref}
        dir="rtl"
        style={{
          width: spec.widthPx,
          height: spec.heightPx,
          background: PDF_COLORS.page,
          padding: spec.padding,
          fontFamily: 'Cairo, sans-serif',
          color: PDF_COLORS.ink,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            height: '100%',
            border: `1px solid ${PDF_COLORS.line}`,
            borderRadius: 22,
            overflow: 'hidden',
            background: PDF_COLORS.page,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              background: PDF_COLORS.brand,
              color: PDF_COLORS.brandText,
              padding: '20px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ fontSize: 14, color: PDF_COLORS.brandSubtle }}>مخطط غانت التنفيذي</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{projectName}</div>
          </div>

          <div style={{ padding: '22px 24px 18px', flex: 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: `1fr ${labelWidth}px`, gap: 18, height: '100%' }}>
              <svg width={timelineWidth} height={timelineHeight} style={{ alignSelf: 'start' }}>
                <defs>
                  <marker id="export-arrow-normal" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                    <path d="M0,0.5 L7,3 L0,5.5" fill="none" stroke={PDF_COLORS.ink} strokeWidth="1.2" strokeLinejoin="round" />
                  </marker>
                  <marker id="export-arrow-critical" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                    <path d="M0,0.5 L7,3 L0,5.5" fill="none" stroke={PDF_COLORS.critical} strokeWidth="1.3" strokeLinejoin="round" />
                  </marker>
                </defs>

                {dates.map((date, index) => {
                  const x = timelineWidth - (index + 1) * dayWidth;
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  return (
                    <g key={index}>
                      {isWeekend && <rect x={x} y={headerHeight - 20} width={dayWidth} height={timelineHeight - (headerHeight - 20)} fill={PDF_COLORS.weekend} />}
                      <text x={x + dayWidth / 2} y={18} fontSize={11} fill={PDF_COLORS.muted} textAnchor="middle">
                        {date.toLocaleDateString('ar-SA', { month: 'short' })}
                      </text>
                      <text x={x + dayWidth / 2} y={38} fontSize={10} fill={PDF_COLORS.muted} textAnchor="middle">
                        {date.getDate()}
                      </text>
                      <line x1={x} y1={headerHeight - 12} x2={x} y2={timelineHeight} stroke={PDF_COLORS.line} strokeWidth="1" />
                    </g>
                  );
                })}

                <line x1={0} y1={headerHeight} x2={timelineWidth} y2={headerHeight} stroke={PDF_COLORS.line} strokeWidth="1.3" />

                {tasks.map((_, index) => (
                  <line
                    key={index}
                    x1={0}
                    y1={headerHeight + (index + 1) * rowHeight}
                    x2={timelineWidth}
                    y2={headerHeight + (index + 1) * rowHeight}
                    stroke={PDF_COLORS.line}
                    strokeWidth="1"
                  />
                ))}

                {arrows.map((arrow, index) => (
                  <path
                    key={index}
                    d={arrow.d}
                    fill="none"
                    stroke={arrow.critical ? PDF_COLORS.critical : PDF_COLORS.ink}
                    strokeWidth={arrow.critical ? 1.7 : 1.4}
                    strokeLinejoin="round"
                    markerEnd={`url(#${arrow.critical ? 'export-arrow-critical' : 'export-arrow-normal'})`}
                  />
                ))}

                {tasks.map((task, index) => {
                  const barWidth = (diffDays(task.endDate, task.startDate) + 1) * dayWidth;
                  const barX = rtlEndEdge(task);
                  const y = headerHeight + index * rowHeight + (rowHeight - 20) / 2;
                  return (
                    <g key={task.id}>
                      <rect x={barX} y={y + 2} width={barWidth} height={20} rx={4} fill="rgba(15,23,42,0.12)" />
                      <rect x={barX} y={y} width={barWidth} height={20} rx={4} fill={task.isCritical ? PDF_COLORS.criticalFill : PDF_COLORS.barFill} />
                    </g>
                  );
                })}
              </svg>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: headerHeight + 4 }}>
                {tasks.map((task, index) => (
                  <div
                    key={task.id}
                    style={{
                      height: rowHeight,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 10px',
                      borderBottom: `1px solid ${PDF_COLORS.line}`,
                      background: index % 2 === 0 ? PDF_COLORS.subtle : PDF_COLORS.page,
                      borderRadius: 8,
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 12, color: PDF_COLORS.muted }} dir="ltr">{formatDate(task.startDate)}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: task.isCritical ? PDF_COLORS.critical : PDF_COLORS.ink, flex: 1, textAlign: 'right' }}>
                      {task.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '12px 24px',
              fontSize: 12,
              color: PDF_COLORS.muted,
              textAlign: 'center',
            }}
          >
            RTL Gantt Preview — الأسهم والمهام مصممة للطباعة الاحترافية
          </div>
        </div>
      </div>
    );
  },
);

export function PdfPreviewModal({ tasks, projectName, onClose }: PdfPreviewModalProps) {
  const [paperSize, setPaperSize] = useState<PaperSize>('a3');
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [isRendering, setIsRendering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const tablePageRef = useRef<HTMLDivElement>(null);
  const ganttPageRef = useRef<HTMLDivElement>(null);
  const spec = PAPER_SPECS[paperSize];

  const generatePreview = useCallback(async () => {
    const generationId = ++generationRef.current;
    setIsRendering(true);
    setError(null);

    try {
      await waitForCaptureReady();

      const pages = [tablePageRef.current, ganttPageRef.current].filter(Boolean) as HTMLDivElement[];
      const images = await Promise.all(
        pages.map((page) => captureElement(page, spec.widthPx, spec.heightPx)),
      );

      if (generationRef.current !== generationId) return [];
      setPageImages(images);
      return images;
    } catch (err) {
      if (generationRef.current === generationId) {
        setError('تعذر إنشاء المعاينة. أعد المحاولة.');
        setPageImages([]);
      }
      return [];
    } finally {
      if (generationRef.current === generationId) {
        setIsRendering(false);
      }
    }
  }, [spec.heightPx, spec.widthPx]);

  useEffect(() => {
    void generatePreview();
  }, [generatePreview, tasks, projectName, paperSize]);

  const handleDownload = useCallback(async () => {
    const images = pageImages.length > 0 ? pageImages : await generatePreview();
    if (images.length === 0) return;
    buildPdfFromImages(images, paperSize, projectName);
    onClose();
  }, [generatePreview, onClose, pageImages, paperSize, projectName]);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
        <div className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-border bg-secondary/30 px-5 py-3">
            <div className="flex items-center gap-2">
              <FileDown className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">معاينة التقرير قبل التنزيل</h2>
            </div>
            <button onClick={onClose} className="p-1 text-muted-foreground transition-colors hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center justify-between border-b border-border/50 bg-secondary/10 px-5 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">حجم الورقة:</span>
              {(['a4', 'a3'] as PaperSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => setPaperSize(size)}
                  className={`rounded-md px-3 py-1 text-xs transition-colors ${paperSize === size ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
                >
                  {PAPER_SPECS[size].label}
                </button>
              ))}
            </div>

            <button
              onClick={handleDownload}
              disabled={isRendering}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60"
            >
              <FileDown className="h-3.5 w-3.5" />
              تنزيل PDF
            </button>
          </div>

          <div className="flex-1 overflow-auto bg-muted/30 p-5">
            {isRendering ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm">جاري إنشاء معاينة عربية حقيقية للصفحات...</span>
              </div>
            ) : error ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <p className="text-sm text-destructive">{error}</p>
                <button onClick={() => void generatePreview()} className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
                  إعادة المحاولة
                </button>
              </div>
            ) : (
              <div className="mx-auto flex max-w-5xl flex-col gap-8">
                {pageImages.map((image, index) => (
                  <div key={index} className="overflow-hidden rounded-xl border border-border bg-background shadow-xl">
                    <img src={image} alt={`معاينة الصفحة ${index + 1}`} className="block h-auto w-full" loading="lazy" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: -20000,
          width: spec.widthPx,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        <ExportTablePage ref={tablePageRef} tasks={tasks} projectName={projectName} paperSize={paperSize} />
        <div style={{ height: 40 }} />
        <ExportGanttPage ref={ganttPageRef} tasks={tasks} projectName={projectName} paperSize={paperSize} />
      </div>
    </>
  );
}

export function exportSchedulePdf() {
  return undefined;
}

function cellStyle(textAlign: 'right' | 'center', fontWeight = 500) {
  return {
    padding: '10px 8px',
    borderBottom: `1px solid ${PDF_COLORS.line}`,
    textAlign,
    fontWeight,
    color: PDF_COLORS.ink,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as const;
}
