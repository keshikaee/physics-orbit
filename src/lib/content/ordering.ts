export interface Orderable {
  id: string;
  order_index: number;
}

/**
 * Moving one item up/down within a sibling list. Returns the rows whose
 * order_index must change (normalised to 1..n), or [] if the move is a no-op.
 */
export function planMove<T extends Orderable>(
  items: T[],
  id: string,
  direction: "up" | "down"
): { id: string; order_index: number }[] {
  const sorted = [...items].sort((a, b) => a.order_index - b.order_index);
  const from = sorted.findIndex((i) => i.id === id);
  if (from === -1) return [];
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= sorted.length) return [];

  [sorted[from], sorted[to]] = [sorted[to]!, sorted[from]!];

  return sorted
    .map((item, index) => ({ id: item.id, order_index: index + 1, before: item.order_index }))
    .filter((row) => row.order_index !== row.before)
    .map(({ id, order_index }) => ({ id, order_index }));
}

/** order_index for a new item appended at the end. */
export function nextOrderIndex(items: Orderable[]): number {
  return items.reduce((max, i) => Math.max(max, i.order_index), 0) + 1;
}
