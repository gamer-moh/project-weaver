import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Task, formatDate, formatPredecessors, diffDays, addDays } from './scheduler';
import { CAIRO_FONT_BASE64 } from './cairo-font';

function setupArabicFont(doc: jsPDF) {
  doc.addFileToVFS('Cairo-Regular.ttf', CAIRO_FONT_BASE64);
  doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');
  doc.setFont('Cairo');
}

export function exportSchedulePdf(tasks: Task[], projectName: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const pageWidth = doc.internal.pageSize.getWidth();

  setupArabicFont(doc);

  // Title - right aligned for RTL
  doc.setFontSize(18);
  doc.text(projectName, pageWidth - 14, 15, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(120);
  const dateStr = `تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')} | عدد المهام: ${tasks.length}`;
  doc.text(dateStr, pageWidth - 14, 22, { align: 'right' });

  const taskIds = tasks.map(t => t.id);

  // Table with RTL
  autoTable(doc, {
    startY: 28,
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
    styles: {
      fontSize: 8,
      cellPadding: 2,
      font: 'Cairo',
      halign: 'right',
    },
    headStyles: {
      fillColor: [40, 50, 80],
      textColor: [220, 225, 240],
      font: 'Cairo',
      halign: 'center',
    },
    bodyStyles: { textColor: [60, 60, 60] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { halign: 'center', textColor: [200, 60, 60], cellWidth: 10 },
      1: { halign: 'center', cellWidth: 12 },
      8: { halign: 'center', cellWidth: 8 },
    },
  });

  // Gantt page
  doc.addPage('a3', 'landscape');
  setupArabicFont(doc);
  doc.setFontSize(14);
  doc.setTextColor(30);
  doc.text('مخطط غانت', pageWidth - 14, 15, { align: 'right' });

  if (tasks.length === 0) return doc.save(`${projectName}.pdf`);

  let minDate = new Date(tasks[0].startDate);
  let maxDate = new Date(tasks[0].endDate);
  for (const t of tasks) {
    if (t.startDate < minDate) minDate = new Date(t.startDate);
    if (t.endDate > maxDate) maxDate = new Date(t.endDate);
  }
  const pStart = addDays(minDate, -1);
  const totalDays = diffDays(maxDate, pStart) + 3;

  const chartX = 14;
  const labelX = pageWidth - 14;
  const chartY = 22;
  const rowH = 6;
  const dayW = Math.min((pageWidth - 80) / totalDays, 4);
  const barH = 4;

  // Task labels (RTL - right side)
  doc.setFontSize(6);
  tasks.forEach((t, i) => {
    const y = chartY + i * rowH + rowH / 2 + 1.5;
    doc.setTextColor(t.isCritical ? 180 : 80, t.isCritical ? 50 : 80, t.isCritical ? 50 : 80);
    doc.text(t.name.substring(0, 30), labelX, y, { align: 'right' });
  });

  // Bars
  tasks.forEach((t, i) => {
    const x = chartX + diffDays(t.startDate, pStart) * dayW;
    const w = (diffDays(t.endDate, t.startDate) + 1) * dayW;
    const y = chartY + i * rowH + (rowH - barH) / 2;

    if (t.isCritical) {
      doc.setFillColor(200, 70, 70);
    } else {
      doc.setFillColor(70, 100, 200);
    }
    doc.roundedRect(x, y, w, barH, 0.8, 0.8, 'F');

    // Draw dependency arrows
    for (const pred of t.predecessors) {
      const predIdx = tasks.findIndex(pt => pt.id === pred.taskId);
      if (predIdx === -1) continue;
      const predTask = tasks[predIdx];
      const predEndX = chartX + diffDays(predTask.endDate, pStart) * dayW + (diffDays(predTask.endDate, predTask.startDate) + 1) * dayW;
      const predY = chartY + predIdx * rowH + rowH / 2;
      const succStartX = x;
      const succY = chartY + i * rowH + rowH / 2;

      doc.setDrawColor(150);
      doc.setLineWidth(0.2);
      doc.line(Math.min(predEndX, succStartX), predY, Math.min(predEndX, succStartX), succY);
      doc.line(Math.min(predEndX, succStartX), succY, succStartX, succY);
    }
  });

  doc.save(`${projectName}.pdf`);
}
