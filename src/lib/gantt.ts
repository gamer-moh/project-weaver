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
  _rowHeight: number,
  successorIndex = 0,
) {
  if (fromSide === 'right' && toSide === 'left') {
    const outX = fromX + 85 + successorIndex * 10;

    if (outX < toX - 15) {
      return `M ${fromX} ${fromY} L ${outX} ${fromY} L ${outX} ${toY} L ${toX} ${toY}`;
    }

    const safeDropY = fromY + 22 + successorIndex * 4;
    const safeLeftX = toX - 15 - successorIndex * 4;

    return `M ${fromX} ${fromY} L ${outX} ${fromY} L ${outX} ${safeDropY} L ${safeLeftX} ${safeDropY} L ${safeLeftX} ${toY} L ${toX} ${toY}`;
  }

  const outX = fromSide === 'left' ? fromX - 85 - successorIndex * 10 : fromX + 85 + successorIndex * 10;
  const entryX = toSide === 'left' ? toX - 15 - successorIndex * 4 : toX + 15 + successorIndex * 4;
  const safeDropY = fromY + 22 + successorIndex * 4;

  return `M ${fromX} ${fromY} L ${outX} ${fromY} L ${outX} ${safeDropY} L ${entryX} ${safeDropY} L ${entryX} ${toY} L ${toX} ${toY}`;
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