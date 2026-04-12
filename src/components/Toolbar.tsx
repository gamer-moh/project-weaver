import { FileDown, Plus, BarChart3 } from 'lucide-react';

interface ToolbarProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onAddTask: () => void;
  onExportPdf: () => void;
  taskCount: number;
  criticalCount: number;
}

export function Toolbar({
  projectName,
  onProjectNameChange,
  onAddTask,
  onExportPdf,
  taskCount,
  criticalCount,
}: ToolbarProps) {
  return (
    <header className="flex items-center justify-between px-4 py-2 bg-card border-b border-border">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <input
            value={projectName}
            onChange={e => onProjectNameChange(e.target.value)}
            className="bg-transparent text-foreground font-semibold text-sm outline-none border-b border-transparent hover:border-border focus:border-primary transition-colors px-1 py-0.5 min-w-[200px]"
          />
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground tracking-wider">
          <span>{taskCount} مهمة</span>
          <span className="w-px h-3 bg-border" />
          <span className="text-critical-path">{criticalCount} حرجة</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onAddTask}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-md transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          إضافة مهمة
        </button>
        <button
          onClick={onExportPdf}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors"
        >
          <FileDown className="w-3.5 h-3.5" />
          تحميل PDF
        </button>
      </div>
    </header>
  );
}
