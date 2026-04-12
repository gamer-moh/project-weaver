import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { useProject } from '@/hooks/use-project';
import { Toolbar } from '@/components/Toolbar';
import { TaskTable } from '@/components/TaskTable';
import { GanttChart } from '@/components/GanttChart';
import { PdfPreviewModal } from '@/components/PdfPreviewModal';

export const Route = createFileRoute('/')({
  component: App,
  head: () => ({
    meta: [
      { title: 'ProjectFlow - إدارة المشاريع الاحترافية' },
      { name: 'description', content: 'أداة إدارة مشاريع احترافية مع جدولة CPM ومخطط غانت وتتبع العلاقات' },
    ],
  }),
});

function App() {
  const {
    tasks,
    projectName,
    setProjectName,
    updateTask,
    savePredecessors,
    addTask,
    removeTask,
  } = useProject();

  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const criticalCount = tasks.filter(t => t.isCritical).length;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Toolbar
        projectName={projectName}
        onProjectNameChange={setProjectName}
        onAddTask={addTask}
        onExportPdf={() => setShowPdfPreview(true)}
        taskCount={tasks.length}
        criticalCount={criticalCount}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[680px] min-w-[480px] border-l border-border flex flex-col overflow-hidden">
          <TaskTable
            tasks={tasks}
            onUpdateTask={updateTask}
            onSavePredecessors={savePredecessors}
            onAddTask={addTask}
            onRemoveTask={removeTask}
          />
        </div>
        <div className="flex-1 overflow-hidden">
          <GanttChart tasks={tasks} />
        </div>
      </div>

      <div className="flex items-center justify-between px-4 py-1 bg-card border-t border-border text-[10px] text-muted-foreground">
        <span>انقر نقرتين على الخلايا للتعديل • اضغط على الاعتمادات لفتح نافذة الربط</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gantt-bar" /> عادي
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-critical-path" /> مسار حرج
          </span>
          <span className="flex items-center gap-1">
            <span className="w-0.5 h-3 bg-gantt-today" /> اليوم
          </span>
        </div>
      </div>

      {showPdfPreview && (
        <PdfPreviewModal
          tasks={tasks}
          projectName={projectName}
          onClose={() => setShowPdfPreview(false)}
        />
      )}
    </div>
  );
}
