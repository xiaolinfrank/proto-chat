import { ChatStreamPayload } from '@lobechat/types';

export const chainLangDetect = (content: string): Partial<ChatStreamPayload> => ({
  messages: [
    {
      content:
        'You are a language expert proficient in all languages worldwide. You need to identify the content input by the user and output it in the international standard locale format',
      role: 'system',
    },
    {
      content: '{Hello}',
      role: 'user',
    },
    {
      content: 'en-US',
      role: 'assistant',
    },
    {
      content: '{Bonjour}',
      role: 'user',
    },
    {
      content: 'fr-FR',
      role: 'assistant',
    },
    {
      content: `{${content}}`,
      role: 'user',
    },
  ],
});
