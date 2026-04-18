import { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { FileDown, LoaderCircle, Settings, X } from 'lucide-react';
import { Task, addDays, diffDays, formatDate, formatPredecessors } from '@/lib/scheduler';
import { buildOrthogonalDependencyPath, getDependencyConnection, getTaskBarLayout } from '@/lib/gantt';
import type { ReportSettings } from '@/hooks/use-project';

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
  altRow: '#eef3fa',
  brand: '#1f2a44',
  brandText: '#f8fafc',
  brandSubtle: '#c9d3e8',
  barFill: '#2563eb',
  criticalFill: '#dc2626',
  weekend: '#f1f5f9',
  today: '#16a34a',
};

interface PdfPreviewModalProps {
  tasks: Task[];
  projectName: string;
  reportSettings: ReportSettings;
  onOpenSettings: () => void;
  onClose: () => void;
}

type PageProps = {
  tasks: Task[];
  projectName: string;
  paperSize: PaperSize;
  reportSettings: ReportSettings;
};

async function waitForCaptureReady() {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    await document.fonts.ready;
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function captureElement(element: HTMLElement, widthPx: number, heightPx: number) {
  const canvas = await html2canvas(element, {
    backgroundColor: PDF_COLORS.page,
    scale: Math.max(2, window.devicePixelRatio * 1.5),
    useCORS: true,
    logging: false,
    foreignObjectRendering: true,
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
    if (index > 0) doc.addPage(paperSize, 'landscape');
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
              <span>الأسهم: احترافية</span>
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
                    <td style={cellStyle('right', 700, true)}>{task.name}</td>
                    <td style={cellStyle('center')} dir="ltr">{task.duration} يوم</td>
                    <td style={cellStyle('center')} dir="ltr">{formatDate(task.startDate)}</td>
                    <td style={cellStyle('center')} dir="ltr">{formatDate(task.endDate)}</td>
                    <td style={cellStyle('center')} dir="ltr">{formatPredecessors(task.predecessors, taskIds) || '—'}</td>
                    <td style={cellStyle('center')}>{task.totalFloat}</td>
                    <td style={{ ...cellStyle('center', 700), color: task.isCritical ? PDF_COLORS.criticalFill : PDF_COLORS.muted }}>
                      {task.isCritical ? '●' : '○'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 'auto', padding: '12px 24px', fontSize: 12, color: PDF_COLORS.muted, textAlign: 'center' }}>
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
    const labelWidth = paperSize === 'a3' ? 300 : 230;
    const chartWidth = spec.widthPx - spec.padding * 2 - 30 - labelWidth;
    const dayWidth = Math.max(12, Math.min(26, chartWidth / Math.max(totalDays, 1)));
    const timelineWidth = totalDays * dayWidth;
    const rowHeight = paperSize === 'a3' ? 46 : 38;
    const barHeight = Math.min(24, rowHeight - 16);
    const headerHeight = 62;
    const timelineHeight = headerHeight + tasks.length * rowHeight + 24;
    const dates = Array.from({ length: totalDays }, (_, index) => addDays(projectStart, index));
    const todayDate = new Date(2026, 3, 13);
    const todayX = (diffDays(todayDate, projectStart) + 0.5) * dayWidth;

    const arrows = useMemo(() => {
      const taskMap = new Map(tasks.map((task, index) => [task.id, { task, index }]));
      return tasks.flatMap((task, successorIndex) => {
        return task.predecessors.flatMap((pred) => {
          const predecessorInfo = taskMap.get(pred.taskId);
          if (!predecessorInfo) return [];

          const predecessorY = headerHeight + predecessorInfo.index * rowHeight + rowHeight / 2;
          const successorY = headerHeight + successorIndex * rowHeight + rowHeight / 2;
          const connection = getDependencyConnection(pred.type, predecessorInfo.task, task, projectStart, dayWidth);

          return [{
            d: buildOrthogonalDependencyPath(
              connection.fromX,
              predecessorY,
              connection.toX,
              successorY,
              connection.fromSide,
              connection.toSide,
              rowHeight,
              Math.abs(successorIndex - predecessorInfo.index) % 3,
            ),
            critical: predecessorInfo.task.isCritical && task.isCritical,
          }];
        });
      });
    }, [tasks, projectStart, dayWidth, rowHeight]);

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
                  <marker id="export-arrow-normal" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
                    <path d="M0,0.5 L7,3 L0,5.5" fill="none" stroke={PDF_COLORS.ink} strokeWidth="1.2" strokeLinejoin="round" />
                  </marker>
                  <marker id="export-arrow-critical" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto" markerUnits="userSpaceOnUse">
                    <path d="M0,0.5 L7,3 L0,5.5" fill="none" stroke={PDF_COLORS.criticalFill} strokeWidth="1.3" strokeLinejoin="round" />
                  </marker>
                </defs>

                {dates.map((date, index) => {
                  const x = index * dayWidth;
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
                {todayX > 0 && todayX < timelineWidth && (
                  <line x1={todayX} y1={0} x2={todayX} y2={timelineHeight} stroke={PDF_COLORS.today} strokeWidth="1.5" strokeDasharray="4 2" />
                )}

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
                    stroke={arrow.critical ? PDF_COLORS.criticalFill : PDF_COLORS.ink}
                    strokeWidth={arrow.critical ? 1.8 : 1.45}
                    strokeLinejoin="round"
                    markerEnd={`url(#${arrow.critical ? 'export-arrow-critical' : 'export-arrow-normal'})`}
                  />
                ))}

                {tasks.map((task, index) => {
                  const bar = getTaskBarLayout(task, projectStart, dayWidth);
                  const y = headerHeight + index * rowHeight + (rowHeight - barHeight) / 2;
                  return (
                    <g key={task.id}>
                      <rect x={bar.startX} y={y + 2} width={bar.width} height={barHeight} rx={4} fill="rgba(15,23,42,0.12)" />
                      <rect x={bar.startX} y={y} width={bar.width} height={barHeight} rx={4} fill={task.isCritical ? PDF_COLORS.criticalFill : PDF_COLORS.barFill} />
                      {task.progress > 0 && (
                        <rect x={bar.startX} y={y + 2} width={bar.width * (task.progress / 100)} height={barHeight - 4} rx={3} fill="rgba(255,255,255,0.35)" />
                      )}
                    </g>
                  );
                })}
              </svg>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: headerHeight + 4 }}>
                {tasks.map((task, index) => (
                  <div
                    key={task.id}
                    style={{
                      minHeight: rowHeight,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      borderBottom: `1px solid ${PDF_COLORS.line}`,
                      background: index % 2 === 0 ? PDF_COLORS.subtle : PDF_COLORS.page,
                      borderRadius: 8,
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 12, color: PDF_COLORS.muted }} dir="ltr">{formatDate(task.startDate)}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: task.isCritical ? PDF_COLORS.criticalFill : PDF_COLORS.ink, flex: 1, textAlign: 'right', whiteSpace: 'normal', lineHeight: 1.4, wordBreak: 'break-word' }}>
                      {task.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ padding: '12px 24px', fontSize: 12, color: PDF_COLORS.muted, textAlign: 'center' }}>
            LTR Gantt Preview — الأسهم والمهام مطابقة للعرض داخل التطبيق
          </div>
        </div>
      </div>
    );
  },
);

export function PdfPreviewModal({ tasks, projectName, onClose }: PdfPreviewModalProps) {
  const [paperSize, setPaperSize] = useState<PaperSize>('a3');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captureTableRef = useRef<HTMLDivElement>(null);
  const captureGanttRef = useRef<HTMLDivElement>(null);
  const spec = PAPER_SPECS[paperSize];
  const previewScale = paperSize === 'a3' ? 0.58 : 0.74;

  const handleDownload = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      await waitForCaptureReady();
      const pages = [captureTableRef.current, captureGanttRef.current].filter(Boolean) as HTMLDivElement[];
      const images = await Promise.all(pages.map((page) => captureElement(page, spec.widthPx, spec.heightPx)));
      if (images.length === 0) {
        throw new Error('empty-preview');
      }
      buildPdfFromImages(images, paperSize, projectName);
    } catch {
      setError('تعذر إنشاء ملف PDF. جرّب مرة أخرى بعد ثوانٍ.');
    } finally {
      setIsExporting(false);
    }
  }, [paperSize, projectName, spec.heightPx, spec.widthPx]);

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
              disabled={isExporting}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60"
            >
              {isExporting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              تنزيل PDF
            </button>
          </div>

          <div className="flex-1 overflow-auto bg-muted/30 p-5">
            {error && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="mx-auto flex max-w-5xl flex-col gap-8">
              {[0, 1].map((pageIndex) => (
                <div
                  key={pageIndex}
                  className="overflow-hidden rounded-xl border border-border bg-background shadow-xl"
                  style={{ width: spec.widthPx * previewScale, height: spec.heightPx * previewScale }}
                >
                  <div style={{ width: spec.widthPx, height: spec.heightPx, transform: `scale(${previewScale})`, transformOrigin: 'top right' }}>
                    {pageIndex === 0 ? (
                      <ExportTablePage tasks={tasks} projectName={projectName} paperSize={paperSize} />
                    ) : (
                      <ExportGanttPage tasks={tasks} projectName={projectName} paperSize={paperSize} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 'calc(100vw + 32px)',
          width: spec.widthPx,
          pointerEvents: 'none',
        }}
      >
        <ExportTablePage ref={captureTableRef} tasks={tasks} projectName={projectName} paperSize={paperSize} />
        <div style={{ height: 40 }} />
        <ExportGanttPage ref={captureGanttRef} tasks={tasks} projectName={projectName} paperSize={paperSize} />
      </div>
    </>
  );
}

export function exportSchedulePdf() {
  return undefined;
}

function cellStyle(textAlign: 'right' | 'center', fontWeight = 500, wrap = false) {
  return {
    padding: '10px 8px',
    borderBottom: `1px solid ${PDF_COLORS.line}`,
    textAlign,
    fontWeight,
    color: PDF_COLORS.ink,
    overflow: 'hidden',
    textOverflow: wrap ? 'clip' : 'ellipsis',
    whiteSpace: wrap ? 'normal' : 'nowrap',
    wordBreak: wrap ? 'break-word' : 'normal',
    lineHeight: wrap ? 1.45 : 1.2,
  } as const;
}
