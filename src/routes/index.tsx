import { createFileRoute } from '@tanstack/react-router';
import { useProject } from '@/hooks/use-project';
import { Toolbar } from '@/components/Toolbar';
import { TaskTable } from '@/components/TaskTable';
import { GanttChart } from '@/components/GanttChart';
import { exportSchedulePdf } from '@/lib/pdf-export';

export const Route = createFileRoute('/')({
  component: App,
  head: () => ({
    meta: [
      { title: 'ProjectFlow - Advanced Project Scheduling' },
      { name: 'description', content: 'Enterprise-grade project management with CPM scheduling, Gantt charts, and dependency tracking.' },
    ],
  }),
});

function App() {
  const {
    tasks,
    projectName,
    setProjectName,
    updateTask,
    updatePredecessors,
    addTask,
    removeTask,
  } = useProject();

  const criticalCount = tasks.filter(t => t.isCritical).length;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
      <Toolbar
        projectName={projectName}
        onProjectNameChange={setProjectName}
        onAddTask={addTask}
        onExportPdf={() => exportSchedulePdf(tasks, projectName)}
        taskCount={tasks.length}
        criticalCount={criticalCount}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Task Table */}
        <div className="w-[680px] min-w-[480px] border-r border-border flex flex-col overflow-hidden">
          <TaskTable
            tasks={tasks}
            onUpdateTask={updateTask}
            onUpdatePredecessors={updatePredecessors}
            onAddTask={addTask}
            onRemoveTask={removeTask}
          />
        </div>

        {/* Gantt Chart */}
        <div className="flex-1 overflow-hidden">
          <GanttChart tasks={tasks} />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1 bg-card border-t border-border text-[10px] text-muted-foreground">
        <span>Double-click cells to edit • Predecessors format: 1FS, 2SS+3</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gantt-bar" /> Normal
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-critical-path" /> Critical Path
          </span>
          <span className="flex items-center gap-1">
            <span className="w-0.5 h-3 bg-gantt-today" /> Today
          </span>
        </div>
      </div>
    </div>
  );
}
