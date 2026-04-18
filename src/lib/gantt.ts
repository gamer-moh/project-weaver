import { Task, diffDays, RelationType } from '@/lib/scheduler';

export type ConnectionSide = 'left' | 'right';

export function getTaskBarLayout(task: Task, projectStart: Date, dayWidth: number) {
  const startOffset = diffDays(task.startDate, projectStart);
  const width = (diffDays(task.endDate, task.startDate) + 1) * dayWidth;
  const startX = startOffset * dayWidth;

  return {
    startX,
    endX: startX + width,
    width,
  };
}

export function getDependencyConnection(
  type: RelationType,
  predecessor: Task,
  successor: Task,
  projectStart: Date,
  dayWidth: number,
) {
  const predecessorBar = getTaskBarLayout(predecessor, projectStart, dayWidth);
  const successorBar = getTaskBarLayout(successor, projectStart, dayWidth);

  switch (type) {
    case 'FS':
      return {
        fromX: predecessorBar.endX,
        toX: successorBar.startX,
        fromSide: 'right' as const,
        toSide: 'left' as const,
      };
    case 'SS':
      return {
        fromX: predecessorBar.startX,
        toX: successorBar.startX,
        fromSide: 'left' as const,
        toSide: 'left' as const,
      };
    case 'FF':
      return {
        fromX: predecessorBar.endX,
        toX: successorBar.endX,
        fromSide: 'right' as const,
        toSide: 'right' as const,
      };
    case 'SF':
      return {
        fromX: predecessorBar.startX,
        toX: successorBar.endX,
        fromSide: 'left' as const,
        toSide: 'right' as const,
      };
  }
}

export function buildOrthogonalDependencyPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  fromSide: ConnectionSide,
  toSide: ConnectionSide,
  rowHeight: number,
  laneIndex = 0,
) {
  const stub = Math.max(12, Math.round(rowHeight * 0.28));
  const laneGap = 14 + laneIndex * 8;
  const sameRow = Math.abs(toY - fromY) < 1;
  const exitX = fromSide === 'left' ? fromX - stub : fromX + stub;
  const entryX = toSide === 'left' ? toX - stub : toX + stub;
  const clearDirectLane =
    (fromSide === 'right' && toSide === 'left' && exitX <= entryX) ||
    (fromSide === 'left' && toSide === 'right' && exitX >= entryX);

  if (clearDirectLane && !sameRow) {
    const midX = (exitX + entryX) / 2;
    return [
      `M${fromX},${fromY}`,
      `L${exitX},${fromY}`,
      `L${midX},${fromY}`,
      `L${midX},${toY}`,
      `L${entryX},${toY}`,
      `L${toX},${toY}`,
    ].join(' ');
  }

  const laneY = sameRow
    ? fromY - rowHeight / 2 - laneGap
    : fromY + (toY > fromY ? -1 : 1) * (rowHeight / 2 + laneGap);
  const sweepX = fromSide === 'right'
    ? Math.max(exitX, entryX) + laneGap
    : Math.min(exitX, entryX) - laneGap;

  return [
    `M${fromX},${fromY}`,
    `L${exitX},${fromY}`,
    `L${exitX},${laneY}`,
    `L${sweepX},${laneY}`,
    `L${sweepX},${toY}`,
    `L${entryX},${toY}`,
    `L${toX},${toY}`,
  ].join(' ');
}

export function wrapTaskName(name: string, maxCharsPerLine: number, maxLines: number) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = '';
    }

    if (word.length <= maxCharsPerLine) {
      currentLine = word;
    } else {
      const chunks = word.match(new RegExp(`.{1,${maxCharsPerLine}}`, 'g')) ?? [word];
      lines.push(...chunks.slice(0, Math.max(1, maxLines - lines.length - 1)));
      currentLine = chunks[chunks.length - 1] ?? '';
    }

    if (lines.length >= maxLines) {
      return lines.slice(0, maxLines);
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  return lines.slice(0, maxLines);
}