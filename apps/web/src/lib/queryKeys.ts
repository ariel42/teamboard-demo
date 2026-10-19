export const queryKeys = {
  config: ['config'] as const,
  boards: ['boards'] as const,
  board: (id: number) => ['board', id] as const,
  comments: (cardId: number) => ['comments', cardId] as const,
};
