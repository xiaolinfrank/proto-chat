import { ThreadType, UIChatMessage } from '@lobechat/types';

export const genMessage = (
  messages: UIChatMessage[],
  startMessageId: string | null | undefined,
  threadMode?: ThreadType,
) => {
  if (!startMessageId) return [];

  // In standalone thread mode, only show the thread start message
  if (threadMode === ThreadType.Standalone) {
    return messages.filter((m) => m.id === startMessageId);
  }

  // In continuous mode, only show the thread start message and the thread divider
  const targetIndex = messages.findIndex((item) => item.id === startMessageId);

  if (targetIndex < 0) return [];

  return messages.slice(0, targetIndex + 1);
};
