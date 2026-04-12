import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Task, formatDate, formatPredecessors, diffDays, addDays } from './scheduler';

export function exportSchedulePdf(tasks: Task[], projectName: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(projectName, 14, 15);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleDateString()} | ${tasks.length} tasks`, 14, 22);

  const taskIds = tasks.map(t => t.id);

  // Table
  autoTable(doc, {
    startY: 28,
    head: [['#', 'WBS', 'Task Name', 'Duration', 'Start', 'Finish', 'Predecessors', 'Float', 'Critical']],
    body: tasks.map((t, i) => [
      String(i + 1),
      t.wbs,
      t.name,
      `${t.duration}d`,
      formatDate(t.startDate),
      formatDate(t.endDate),
      formatPredecessors(t.predecessors, taskIds),
      `${t.totalFloat}d`,
      t.isCritical ? '●' : '',
    ]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [40, 50, 80], textColor: [220, 225, 240] },
    bodyStyles: { textColor: [60, 60, 60] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 12 },
      2: { cellWidth: 55 },
      8: { halign: 'center', textColor: [200, 60, 60] },
    },
  });

  // Gantt on next page
  doc.addPage('a3', 'landscape');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30);
  doc.text('Gantt Chart', 14, 15);

  if (tasks.length === 0) return doc.save(`${projectName}.pdf`);

  // Calculate date range
  let minDate = new Date(tasks[0].startDate);
  let maxDate = new Date(tasks[0].endDate);
  for (const t of tasks) {
    if (t.startDate < minDate) minDate = new Date(t.startDate);
    if (t.endDate > maxDate) maxDate = new Date(t.endDate);
  }
  const pStart = addDays(minDate, -1);
  const totalDays = diffDays(maxDate, pStart) + 3;

  const chartX = 65;
  const chartY = 22;
  const rowH = 6;
  const dayW = Math.min((pageWidth - chartX - 10) / totalDays, 4);
  const barH = 4;

  // Task labels
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  tasks.forEach((t, i) => {
    const y = chartY + i * rowH + rowH / 2 + 1.5;
    doc.setTextColor(t.isCritical ? 180 : 80, t.isCritical ? 50 : 80, t.isCritical ? 50 : 80);
    doc.text(t.name.substring(0, 25), 14, y);
  });

  // Draw bars
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
  });

  doc.save(`${projectName}.pdf`);
}
