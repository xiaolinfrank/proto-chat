import { ThreadType, UIChatMessage } from '@lobechat/types';

export const genMessage = (
  messages: UIChatMessage[],
  startMessageId: string | null | undefined,
  threadMode?: ThreadType,
) => {
  if (!startMessageId) return [];

  // If in standalone topic mode, only show topic start message
  if (threadMode === ThreadType.Standalone) {
    return messages.filter((m) => m.id === startMessageId);
  }

  // If in continuous mode, only show topic start message and topic divider
  const targetIndex = messages.findIndex((item) => item.id === startMessageId);

  if (targetIndex < 0) return [];

  return messages.slice(0, targetIndex + 1);
};
