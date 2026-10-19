/** dnd-kit ids must be unique across cards and columns, so they carry a prefix. */
export const cardDndId = (id: number) => `card-${id}`;
export const columnDndId = (id: number) => `column-${id}`;

export type ParsedDndId = { type: 'card' | 'column'; id: number } | null;

export function parseDndId(value: string | number): ParsedDndId {
  const match = /^(card|column)-(\d+)$/.exec(String(value));
  if (!match) return null;
  return { type: match[1] as 'card' | 'column', id: Number(match[2]) };
}
