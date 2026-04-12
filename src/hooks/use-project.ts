import { useState, useCallback } from 'react';
import {
  Task,
  Predecessor,
  calculateSchedule,
  createTask,
  generateSampleProject,
  addDays,
} from '@/lib/scheduler';

export function useProject() {
  const [tasks, setTasks] = useState<Task[]>(() => generateSampleProject());
  const [projectName, setProjectName] = useState('مشروع تطوير برمجيات المؤسسة');

  const updateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    setTasks(prev => {
      const updated = prev.map(t => {
        if (t.id !== taskId) return t;
        const merged = { ...t, ...updates };
        if (updates.duration !== undefined || updates.startDate !== undefined) {
          const start = updates.startDate || t.startDate;
          const dur = updates.duration || t.duration;
          merged.endDate = addDays(start, dur - 1);
        }
        return merged;
      });
      return calculateSchedule(updated);
    });
  }, []);

  const savePredecessors = useCallback((taskId: string, preds: Predecessor[]) => {
    setTasks(prev => {
      const updated = prev.map(t =>
        t.id === taskId ? { ...t, predecessors: preds } : t
      );
      return calculateSchedule(updated);
    });
  }, []);

  const addTask = useCallback(() => {
    setTasks(prev => {
      const lastTask = prev[prev.length - 1];
      const startDate = lastTask ? addDays(lastTask.endDate, 1) : new Date(2026, 3, 13);
      const newTask = createTask({
        name: `مهمة جديدة ${prev.length + 1}`,
        startDate,
        duration: 5,
        wbs: `${prev.length + 1}`,
      });
      return calculateSchedule([...prev, newTask]);
    });
  }, []);

  const removeTask = useCallback((taskId: string) => {
    setTasks(prev => {
      const filtered = prev
        .filter(t => t.id !== taskId)
        .map(t => ({
          ...t,
          predecessors: t.predecessors.filter(p => p.taskId !== taskId),
        }));
      return calculateSchedule(filtered);
    });
  }, []);

  return {
    tasks,
    projectName,
    setProjectName,
    updateTask,
    savePredecessors,
    addTask,
    removeTask,
  };
}
