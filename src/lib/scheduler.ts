// Scheduling engine with FS/SS/FF/SF logic and critical path analysis

export type RelationType = 'FS' | 'SS' | 'FF' | 'SF';

export interface Predecessor {
  taskId: string;
  type: RelationType;
  lag: number; // days
}

export interface Task {
  id: string;
  name: string;
  startDate: Date;
  duration: number; // working days
  endDate: Date;
  predecessors: Predecessor[];
  isCritical: boolean;
  earlyStart: Date;
  earlyFinish: Date;
  lateStart: Date;
  lateFinish: Date;
  totalFloat: number;
  wbs: string;
  progress: number; // 0-100
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function parseDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Calculate successor dates based on relationship type
 */
function calcSuccessorDates(
  predStart: Date,
  predFinish: Date,
  type: RelationType,
  lag: number,
  successorDuration: number
): { start: Date; finish: Date } {
  let start: Date;
  let finish: Date;

  switch (type) {
    case 'FS': // Successor Start = Predecessor Finish + lag
      start = addDays(predFinish, lag + 1);
      finish = addDays(start, successorDuration - 1);
      break;
    case 'SS': // Successor Start = Predecessor Start + lag
      start = addDays(predStart, lag);
      finish = addDays(start, successorDuration - 1);
      break;
    case 'FF': // Successor Finish = Predecessor Finish + lag
      finish = addDays(predFinish, lag);
      start = addDays(finish, -(successorDuration - 1));
      break;
    case 'SF': // Successor Finish = Predecessor Start + lag
      finish = addDays(predStart, lag);
      start = addDays(finish, -(successorDuration - 1));
      break;
  }

  return { start, finish };
}

/**
 * Topological sort for dependency ordering
 */
function topoSort(tasks: Task[]): Task[] {
  const taskMap = new Map<string, Task>();
  tasks.forEach(t => taskMap.set(t.id, t));

  const visited = new Set<string>();
  const sorted: Task[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const task = taskMap.get(id);
    if (!task) return;
    for (const pred of task.predecessors) {
      visit(pred.taskId);
    }
    sorted.push(task);
  }

  tasks.forEach(t => visit(t.id));
  return sorted;
}

/**
 * Forward pass: calculate early start/finish
 */
export function forwardPass(tasks: Task[]): Task[] {
  const taskMap = new Map<string, Task>();
  tasks.forEach(t => taskMap.set(t.id, { ...t }));
  const sorted = topoSort([...taskMap.values()]);

  for (const task of sorted) {
    if (task.predecessors.length === 0) {
      task.earlyStart = new Date(task.startDate);
      task.earlyFinish = addDays(task.earlyStart, task.duration - 1);
    } else {
      let latestStart = new Date(0);

      for (const pred of task.predecessors) {
        const predTask = taskMap.get(pred.taskId);
        if (!predTask) continue;

        const { start } = calcSuccessorDates(
          predTask.earlyStart,
          predTask.earlyFinish,
          pred.type,
          pred.lag,
          task.duration
        );

        if (start > latestStart) {
          latestStart = start;
        }
      }

      task.earlyStart = latestStart;
      task.earlyFinish = addDays(task.earlyStart, task.duration - 1);
    }

    task.startDate = new Date(task.earlyStart);
    task.endDate = new Date(task.earlyFinish);
    taskMap.set(task.id, task);
  }

  return [...taskMap.values()];
}

/**
 * Backward pass: calculate late start/finish and float
 */
export function backwardPass(tasks: Task[]): Task[] {
  const taskMap = new Map<string, Task>();
  tasks.forEach(t => taskMap.set(t.id, { ...t }));

  // Find project end date
  let projectEnd = new Date(0);
  for (const task of tasks) {
    if (task.earlyFinish > projectEnd) {
      projectEnd = new Date(task.earlyFinish);
    }
  }

  // Initialize late dates
  for (const task of taskMap.values()) {
    task.lateFinish = new Date(projectEnd);
    task.lateStart = addDays(task.lateFinish, -(task.duration - 1));
  }

  // Build successor map
  const successorMap = new Map<string, Array<{ task: Task; pred: Predecessor }>>();
  for (const task of taskMap.values()) {
    for (const pred of task.predecessors) {
      if (!successorMap.has(pred.taskId)) {
        successorMap.set(pred.taskId, []);
      }
      successorMap.get(pred.taskId)!.push({ task, pred });
    }
  }

  // Reverse topological order
  const sorted = topoSort([...taskMap.values()]).reverse();

  for (const task of sorted) {
    const succs = successorMap.get(task.id);
    if (succs && succs.length > 0) {
      let earliestConstraint = new Date(8640000000000000); // max date

      for (const { task: succ, pred } of succs) {
        const succTask = taskMap.get(succ.id)!;
        let constraint: Date;

        switch (pred.type) {
          case 'FS':
            constraint = addDays(succTask.lateStart, -(pred.lag + 1));
            break;
          case 'SS':
            constraint = addDays(succTask.lateStart, -pred.lag);
            constraint = addDays(constraint, task.duration - 1);
            break;
          case 'FF':
            constraint = addDays(succTask.lateFinish, -pred.lag);
            break;
          case 'SF':
            constraint = addDays(succTask.lateFinish, -pred.lag);
            constraint = addDays(constraint, task.duration - 1);
            break;
        }

        if (constraint < earliestConstraint) {
          earliestConstraint = constraint;
        }
      }

      task.lateFinish = earliestConstraint;
      task.lateStart = addDays(task.lateFinish, -(task.duration - 1));
    }

    task.totalFloat = diffDays(task.lateStart, task.earlyStart);
    task.isCritical = task.totalFloat === 0;
    taskMap.set(task.id, task);
  }

  return [...taskMap.values()];
}

/**
 * Full scheduling calculation
 */
export function calculateSchedule(tasks: Task[]): Task[] {
  if (tasks.length === 0) return [];
  let result = forwardPass(tasks);
  result = backwardPass(result);
  return result;
}

/**
 * Create a new task with defaults
 */
export function createTask(partial: Partial<Task> & { name: string }): Task {
  const startDate = partial.startDate || new Date();
  const duration = partial.duration || 5;
  return {
    id: partial.id || crypto.randomUUID(),
    name: partial.name,
    startDate,
    duration,
    endDate: addDays(startDate, duration - 1),
    predecessors: partial.predecessors || [],
    isCritical: false,
    earlyStart: startDate,
    earlyFinish: addDays(startDate, duration - 1),
    lateStart: startDate,
    lateFinish: addDays(startDate, duration - 1),
    totalFloat: 0,
    wbs: partial.wbs || '1',
    progress: partial.progress || 0,
  };
}

/**
 * Parse predecessor string like "1FS+2, 3SS"
 */
export function parsePredecessors(str: string, taskIds: string[]): Predecessor[] {
  if (!str.trim()) return [];
  const preds: Predecessor[] = [];
  const parts = str.split(',').map(s => s.trim());

  for (const part of parts) {
    const match = part.match(/^(\d+)\s*(FS|SS|FF|SF)?\s*([+-]\d+)?$/i);
    if (match) {
      const rowNum = parseInt(match[1]) - 1; // 1-indexed
      const type = (match[2]?.toUpperCase() as RelationType) || 'FS';
      const lag = match[3] ? parseInt(match[3]) : 0;

      if (rowNum >= 0 && rowNum < taskIds.length) {
        preds.push({ taskId: taskIds[rowNum], type, lag });
      }
    }
  }

  return preds;
}

/**
 * Format predecessors for display
 */
export function formatPredecessors(preds: Predecessor[], taskIds: string[]): string {
  return preds
    .map(p => {
      const rowNum = taskIds.indexOf(p.taskId) + 1;
      if (rowNum === 0) return '';
      let str = `${rowNum}${p.type}`;
      if (p.lag > 0) str += `+${p.lag}`;
      if (p.lag < 0) str += `${p.lag}`;
      return str;
    })
    .filter(Boolean)
    .join(', ');
}

/**
 * Generate sample project data
 */
export function generateSampleProject(): Task[] {
  const baseDate = new Date(2026, 3, 13); // Fixed date to avoid hydration mismatch

  const ids = [
    'task-001', 'task-002', 'task-003', 'task-004',
    'task-005', 'task-006', 'task-007', 'task-008',
  ];

  const tasks: Task[] = [
    createTask({ id: ids[0], name: 'Project Initiation', startDate: baseDate, duration: 3, wbs: '1.1', predecessors: [] }),
    createTask({ id: ids[1], name: 'Requirements Gathering', startDate: baseDate, duration: 5, wbs: '1.2', predecessors: [{ taskId: ids[0], type: 'FS', lag: 0 }] }),
    createTask({ id: ids[2], name: 'System Design', startDate: baseDate, duration: 8, wbs: '2.1', predecessors: [{ taskId: ids[1], type: 'FS', lag: 0 }] }),
    createTask({ id: ids[3], name: 'Database Development', startDate: baseDate, duration: 10, wbs: '2.2', predecessors: [{ taskId: ids[2], type: 'FS', lag: 0 }] }),
    createTask({ id: ids[4], name: 'Frontend Development', startDate: baseDate, duration: 12, wbs: '2.3', predecessors: [{ taskId: ids[2], type: 'FS', lag: 0 }, { taskId: ids[3], type: 'SS', lag: 2 }] }),
    createTask({ id: ids[5], name: 'Integration Testing', startDate: baseDate, duration: 5, wbs: '3.1', predecessors: [{ taskId: ids[3], type: 'FF', lag: 0 }, { taskId: ids[4], type: 'FS', lag: 0 }] }),
    createTask({ id: ids[6], name: 'User Acceptance Testing', startDate: baseDate, duration: 4, wbs: '3.2', predecessors: [{ taskId: ids[5], type: 'FS', lag: 0 }] }),
    createTask({ id: ids[7], name: 'Deployment & Go-Live', startDate: baseDate, duration: 2, wbs: '4.1', predecessors: [{ taskId: ids[6], type: 'FS', lag: 0 }] }),
  ];

  return calculateSchedule(tasks);
}
