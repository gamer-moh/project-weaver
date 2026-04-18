import { useState } from 'react';
import { Task, Predecessor, formatDate, formatPredecessors } from '@/lib/scheduler';
import { PredecessorModal } from './PredecessorModal';
import { Trash2, Plus, Link2 } from 'lucide-react';

interface TaskTableProps {
  tasks: Task[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onSavePredecessors: (taskId: string, preds: Predecessor[]) => void;
  onAddTask: () => void;
  onRemoveTask: (taskId: string) => void;
}

export function TaskTable({
  tasks,
  onUpdateTask,
  onSavePredecessors,
  onAddTask,
  onRemoveTask,
}: TaskTableProps) {
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [predModalTask, setPredModalTask] = useState<Task | null>(null);
  const taskIds = tasks.map(t => t.id);

  const startEdit = (cellId: string, value: string) => {
    setEditingCell(cellId);
    setEditValue(value);
  };

  const commitEdit = (taskId: string, field: string) => {
    setEditingCell(null);
    if (field === 'name') {
      onUpdateTask(taskId, { name: editValue });
    } else if (field === 'duration') {
      const dur = parseInt(editValue);
      if (!isNaN(dur) && dur > 0) onUpdateTask(taskId, { duration: dur });
    } else if (field === 'startDate') {
      const d = new Date(editValue);
      if (!isNaN(d.getTime())) onUpdateTask(taskId, { startDate: d });
    } else if (field === 'progress') {
      const p = parseInt(editValue);
      if (!isNaN(p) && p >= 0 && p <= 100) onUpdateTask(taskId, { progress: p });
    }
  };

  const renderCell = (taskId: string, field: string, value: string) => {
    const cellId = `${taskId}-${field}`;
    const isEditing = editingCell === cellId;

    if (isEditing) {
      return (
        <input
          autoFocus
          type={field === 'startDate' ? 'date' : 'text'}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={() => commitEdit(taskId, field)}
          onKeyDown={e => {
            if (e.key === 'Enter') commitEdit(taskId, field);
            if (e.key === 'Escape') setEditingCell(null);
          }}
          className="w-full bg-input text-foreground px-2 py-1 rounded-sm border border-ring outline-none text-xs"
          dir={field === 'startDate' ? 'ltr' : 'rtl'}
        />
      );
    }

    return (
      <div
        onDoubleClick={() => startEdit(cellId, value)}
        className="cursor-text px-2 py-1.5 text-xs hover:bg-secondary/50 rounded-sm transition-colors whitespace-normal break-words leading-5"
        title={value}
      >
        {value || '\u00A0'}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="grid grid-cols-[36px_40px_minmax(0,2fr)_70px_95px_95px_110px_50px_50px_32px] gap-px bg-secondary/80 border-b border-border text-[10px] font-semibold text-muted-foreground tracking-wider">
        <div className="px-2 py-2">#</div>
        <div className="px-2 py-2">WBS</div>
        <div className="px-2 py-2">اسم المهمة</div>
        <div className="px-2 py-2">المدة</div>
        <div className="px-2 py-2">البداية</div>
        <div className="px-2 py-2">النهاية</div>
        <div className="px-2 py-2">الاعتمادات</div>
        <div className="px-2 py-2">فائض</div>
        <div className="px-2 py-2">%</div>
        <div className="px-2 py-2"></div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {tasks.map((task, idx) => (
          <div
            key={task.id}
            className={`grid grid-cols-[36px_40px_minmax(0,2fr)_70px_95px_95px_110px_50px_50px_32px] gap-px border-b border-border/50 items-center transition-colors ${
              task.isCritical ? 'bg-critical-path/5' : 'hover:bg-secondary/30'
            }`}
          >
            <div className="px-2 py-1 text-xs text-muted-foreground">{idx + 1}</div>
            <div className="px-2 py-1 text-xs text-muted-foreground">{task.wbs}</div>
            <div className="flex items-start gap-1 py-1">
              {task.isCritical && (
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-critical-path flex-shrink-0" />
              )}
              {renderCell(task.id, 'name', task.name)}
            </div>
            {renderCell(task.id, 'duration', `${task.duration}`)}
            <div className="px-2 py-1.5 text-xs text-muted-foreground" dir="ltr">{formatDate(task.startDate)}</div>
            <div className="px-2 py-1.5 text-xs text-muted-foreground" dir="ltr">{formatDate(task.endDate)}</div>
            {/* Predecessors - click to open modal */}
            <button
              onClick={() => setPredModalTask(task)}
              className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-sm transition-colors text-start"
            >
              <Link2 className="w-3 h-3 flex-shrink-0" />
              <span className="truncate" dir="ltr">{formatPredecessors(task.predecessors, taskIds) || '—'}</span>
            </button>
            <div className={`px-2 py-1.5 text-xs ${task.totalFloat === 0 ? 'text-critical-path font-semibold' : 'text-muted-foreground'}`}>
              {task.totalFloat}
            </div>
            {renderCell(task.id, 'progress', `${task.progress}`)}
            <button
              onClick={() => onRemoveTask(task.id)}
              className="p-1 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add button */}
      <button
        onClick={onAddTask}
        className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 border-t border-border transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        إضافة مهمة
      </button>

      {/* Predecessor Modal */}
      {predModalTask && (
        <PredecessorModal
          task={predModalTask}
          allTasks={tasks}
          onSave={onSavePredecessors}
          onClose={() => setPredModalTask(null)}
        />
      )}
    </div>
  );
}
