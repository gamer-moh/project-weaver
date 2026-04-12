import { useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Task, formatDate, formatPredecessors, diffDays, addDays } from '@/lib/scheduler';
import { CAIRO_FONT_BASE64 } from '@/lib/cairo-font';
import { X, FileDown } from 'lucide-react';

type PaperSize = 'a4' | 'a3';

interface PdfPreviewModalProps {
  tasks: Task[];
  projectName: string;
  onClose: () => void;
}

function generatePdf(tasks: Task[], projectName: string, paperSize: PaperSize): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: paperSize });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Setup Arabic font
  doc.addFileToVFS('Cairo-Regular.ttf', CAIRO_FONT_BASE64);
  doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');
  doc.setFont('Cairo');

  // Header bar
  doc.setFillColor(30, 40, 65);
  doc.rect(0, 0, pageWidth, 20, 'F');
  doc.setFontSize(14);
  doc.setTextColor(220, 225, 240);
  doc.text(projectName, pageWidth - 10, 13, { align: 'right' });

  doc.setFontSize(8);
  doc.setTextColor(160, 170, 200);
  const dateStr = `تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')} | عدد المهام: ${tasks.length}`;
  doc.text(dateStr, 10, 13);

  const taskIds = tasks.map(t => t.id);

  // Table
  autoTable(doc, {
    startY: 24,
    head: [['حرج', 'فائض', 'الاعتمادات', 'النهاية', 'البداية', 'المدة', 'اسم المهمة', 'WBS', '#']],
    body: tasks.map((t, i) => [
      t.isCritical ? '●' : '',
      `${t.totalFloat}`,
      formatPredecessors(t.predecessors, taskIds),
      formatDate(t.endDate),
      formatDate(t.startDate),
      `${t.duration} يوم`,
      t.name,
      t.wbs,
      String(i + 1),
    ]),
    styles: { fontSize: 7, cellPadding: 1.5, font: 'Cairo', halign: 'right' },
    headStyles: { fillColor: [40, 50, 80], textColor: [220, 225, 240], font: 'Cairo', halign: 'center', fontSize: 7 },
    bodyStyles: { textColor: [50, 50, 50] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { halign: 'center', textColor: [200, 60, 60], cellWidth: 8 },
      1: { halign: 'center', cellWidth: 10 },
      8: { halign: 'center', cellWidth: 8 },
    },
  });

  // Footer on page 1
  doc.setFontSize(6);
  doc.setTextColor(150);
  doc.text('ProjectFlow - إدارة المشاريع الاحترافية', pageWidth / 2, pageHeight - 5, { align: 'center' });

  // Gantt page
  doc.addPage(paperSize, 'landscape');
  doc.setFont('Cairo');

  // Header bar again
  doc.setFillColor(30, 40, 65);
  doc.rect(0, 0, pageWidth, 20, 'F');
  doc.setFontSize(14);
  doc.setTextColor(220, 225, 240);
  doc.text('مخطط غانت', pageWidth - 10, 13, { align: 'right' });

  if (tasks.length === 0) return doc;

  let minDate = new Date(tasks[0].startDate);
  let maxDate = new Date(tasks[0].endDate);
  for (const t of tasks) {
    if (t.startDate < minDate) minDate = new Date(t.startDate);
    if (t.endDate > maxDate) maxDate = new Date(t.endDate);
  }
  const pStart = addDays(minDate, -1);
  const totalDays = diffDays(maxDate, pStart) + 3;

  const labelWidth = 55;
  const chartLeft = 10;
  const chartRight = pageWidth - labelWidth - 10;
  const chartAvailW = chartRight - chartLeft;
  const chartY = 24;
  const rowH = Math.min(7, (pageHeight - chartY - 15) / tasks.length);
  const dayW = Math.min(chartAvailW / totalDays, 5);
  const barH = rowH * 0.6;

  // Grid lines
  doc.setDrawColor(220);
  doc.setLineWidth(0.1);
  tasks.forEach((_, i) => {
    const y = chartY + (i + 1) * rowH;
    doc.line(chartLeft, y, chartRight, y);
  });

  // Task labels & bars
  tasks.forEach((t, i) => {
    const y = chartY + i * rowH;
    const barY = y + (rowH - barH) / 2;

    // Label
    doc.setFontSize(6);
    doc.setTextColor(t.isCritical ? 180 : 70, t.isCritical ? 50 : 70, t.isCritical ? 50 : 70);
    doc.text(t.name.substring(0, 25), pageWidth - 10, y + rowH / 2 + 1.5, { align: 'right' });

    // Bar (RTL: earlier dates on right)
    const barStartOffset = diffDays(t.startDate, pStart);
    const barDuration = diffDays(t.endDate, t.startDate) + 1;
    const barX = chartRight - (barStartOffset + barDuration) * dayW;
    const barW = barDuration * dayW;

    if (t.isCritical) {
      doc.setFillColor(200, 70, 70);
    } else {
      doc.setFillColor(60, 90, 190);
    }
    doc.roundedRect(barX, barY, barW, barH, 0.6, 0.6, 'F');

    // Dependency lines
    doc.setDrawColor(t.isCritical ? 200 : 140, t.isCritical ? 70 : 140, t.isCritical ? 70 : 140);
    doc.setLineWidth(0.15);
    for (const pred of t.predecessors) {
      const predIdx = tasks.findIndex(pt => pt.id === pred.taskId);
      if (predIdx === -1) continue;
      const pT = tasks[predIdx];

      const pBarStart = diffDays(pT.startDate, pStart);
      const pBarDur = diffDays(pT.endDate, pT.startDate) + 1;
      const pBarX = chartRight - (pBarStart + pBarDur) * dayW;
      const pBarRight = pBarX + pBarDur * dayW;
      const pMidY = chartY + predIdx * rowH + rowH / 2;
      const sMidY = chartY + i * rowH + rowH / 2;

      let exitPx: number, entryPx: number;

      switch (pred.type) {
        case 'FS':
          exitPx = pBarX; // finish = left in RTL
          entryPx = barX + barW; // start = right in RTL
          break;
        case 'SS':
          exitPx = pBarRight;
          entryPx = barX + barW;
          break;
        case 'FF':
          exitPx = pBarX;
          entryPx = barX;
          break;
        case 'SF':
          exitPx = pBarRight;
          entryPx = barX;
          break;
      }

      const stubLen = 2;
      const exitDir = (pred.type === 'SS' || pred.type === 'SF') ? 1 : -1;
      const entryDir = (pred.type === 'SS' || pred.type === 'FS') ? 1 : -1;

      const ex = exitPx + exitDir * stubLen;
      const enx = entryPx + entryDir * stubLen;

      // Orthogonal path
      doc.line(exitPx, pMidY, ex, pMidY);
      doc.line(ex, pMidY, ex, sMidY);
      doc.line(ex, sMidY, entryPx, sMidY);

      // Arrow head
      const arrowSize = 1;
      doc.setFillColor(t.isCritical ? 200 : 140, t.isCritical ? 70 : 140, t.isCritical ? 70 : 140);
      if (entryDir > 0) {
        doc.triangle(entryPx, sMidY, entryPx + arrowSize, sMidY - arrowSize / 2, entryPx + arrowSize, sMidY + arrowSize / 2, 'F');
      } else {
        doc.triangle(entryPx, sMidY, entryPx - arrowSize, sMidY - arrowSize / 2, entryPx - arrowSize, sMidY + arrowSize / 2, 'F');
      }
    }
  });

  // Footer
  doc.setFontSize(6);
  doc.setTextColor(150);
  doc.text('ProjectFlow - إدارة المشاريع الاحترافية', pageWidth / 2, pageHeight - 5, { align: 'center' });

  return doc;
}

export function PdfPreviewModal({ tasks, projectName, onClose }: PdfPreviewModalProps) {
  const [paperSize, setPaperSize] = useState<PaperSize>('a3');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const generatePreview = (size: PaperSize) => {
    setPaperSize(size);
    const doc = generatePdf(tasks, projectName, size);
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(url);
  };

  const handleDownload = () => {
    const doc = generatePdf(tasks, projectName, paperSize);
    doc.save(`${projectName}.pdf`);
    onClose();
  };

  // Generate on first render
  if (!previewUrl) {
    setTimeout(() => generatePreview(paperSize), 50);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-5xl h-[85vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2">
            <FileDown className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">معاينة التقرير</h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-2 border-b border-border/50 bg-secondary/10">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">حجم الورقة:</span>
            <button
              onClick={() => generatePreview('a4')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${paperSize === 'a4' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
            >
              A4
            </button>
            <button
              onClick={() => generatePreview('a3')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${paperSize === 'a3' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
            >
              A3
            </button>
          </div>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" />
            تحميل PDF
          </button>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto bg-muted/30 p-4">
          {previewUrl ? (
            <iframe
              src={previewUrl}
              className="w-full h-full rounded-lg border border-border bg-background"
              title="PDF Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              جاري إنشاء المعاينة...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function exportSchedulePdf(tasks: Task[], projectName: string) {
  const doc = generatePdf(tasks, projectName, 'a3');
  doc.save(`${projectName}.pdf`);
}
