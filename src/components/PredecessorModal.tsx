import { useState } from 'react';
import { Task, Predecessor, RelationType, RELATION_LABELS } from '@/lib/scheduler';
import { X, Plus, Trash2, Link2 } from 'lucide-react';

interface PredecessorModalProps {
  task: Task;
  allTasks: Task[];
  onSave: (taskId: string, predecessors: Predecessor[]) => void;
  onClose: () => void;
}

export function PredecessorModal({ task, allTasks, onSave, onClose }: PredecessorModalProps) {
  const [preds, setPreds] = useState<Predecessor[]>([...task.predecessors]);

  const availableTasks = allTasks.filter(t => t.id !== task.id);
  const taskIndex = (id: string) => allTasks.findIndex(t => t.id === id) + 1;

  const addPredecessor = () => {
    const firstAvailable = availableTasks.find(t => !preds.some(p => p.taskId === t.id));
    if (firstAvailable) {
      setPreds([...preds, { taskId: firstAvailable.id, type: 'FS', lag: 0 }]);
    }
  };

  const updatePred = (index: number, updates: Partial<Predecessor>) => {
    setPreds(prev => prev.map((p, i) => i === index ? { ...p, ...updates } : p));
  };

  const removePred = (index: number) => {
    setPreds(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(task.id, preds);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              اعتمادات: {task.name}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3 max-h-[400px] overflow-y-auto">
          {preds.length === 0 && (
            <p className="text-center text-muted-foreground text-xs py-6">
              لا توجد اعتمادات. اضغط "إضافة اعتماد" للبدء.
            </p>
          )}

          {preds.map((pred, idx) => {
            const predTask = allTasks.find(t => t.id === pred.taskId);
            return (
              <div key={idx} className="flex items-center gap-2 p-3 bg-secondary/40 rounded-lg border border-border/50">
                {/* Task selector */}
                <div className="flex-1 min-w-0">
                  <label className="block text-[10px] text-muted-foreground mb-1 font-medium">المهمة السابقة</label>
                  <select
                    value={pred.taskId}
                    onChange={e => updatePred(idx, { taskId: e.target.value })}
                    className="w-full bg-input text-foreground text-xs rounded-md border border-border px-2 py-1.5 outline-none focus:ring-1 focus:ring-ring"
                  >
                    {availableTasks.map(t => (
                      <option key={t.id} value={t.id}>
                        {taskIndex(t.id)} - {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Relation type */}
                <div className="w-[160px] flex-shrink-0">
                  <label className="block text-[10px] text-muted-foreground mb-1 font-medium">نوع العلاقة</label>
                  <select
                    value={pred.type}
                    onChange={e => updatePred(idx, { type: e.target.value as RelationType })}
                    className="w-full bg-input text-foreground text-xs rounded-md border border-border px-2 py-1.5 outline-none focus:ring-1 focus:ring-ring"
                  >
                    {(Object.keys(RELATION_LABELS) as RelationType[]).map(rt => (
                      <option key={rt} value={rt}>{RELATION_LABELS[rt]}</option>
                    ))}
                  </select>
                </div>

                {/* Lag */}
                <div className="w-[70px] flex-shrink-0">
                  <label className="block text-[10px] text-muted-foreground mb-1 font-medium">سماح (أيام)</label>
                  <input
                    type="number"
                    value={pred.lag}
                    onChange={e => updatePred(idx, { lag: parseInt(e.target.value) || 0 })}
                    className="w-full bg-input text-foreground text-xs rounded-md border border-border px-2 py-1.5 outline-none focus:ring-1 focus:ring-ring text-center"
                  />
                </div>

                {/* Remove */}
                <button
                  onClick={() => removePred(idx)}
                  className="self-end p-1.5 text-muted-foreground hover:text-destructive transition-colors mb-0.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-secondary/20">
          <button
            onClick={addPredecessor}
            disabled={preds.length >= availableTasks.length}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <Plus className="w-3.5 h-3.5" />
            إضافة اعتماد
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              حفظ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
