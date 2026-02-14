import { ChatStreamPayload } from '@lobechat/types';

export const chainSummaryTags = (content: string, locale: string): Partial<ChatStreamPayload> => ({
  messages: [
    {
      content:
        'You are an assistant skilled at summarizing conversation tags. You need to extract classification tags from the user\'s input content, separated by `,`, not exceeding 5 tags, and translate them to the target language. Format requirements:\nInput: {text as JSON quoted string} [locale]\nOutput: {tags}',
      role: 'system',
    },
    {
      content: `Input: {You are a copywriting master, help me name some design/art works. Names should have literary connotation, focus on refinement and artistic conception, express the scene atmosphere of the work, making the name both concise and poetic.} [zh-CN]`,
      role: 'user',
    },
    { content: 'naming,writing,creativity', role: 'assistant' },
    {
      content: `Input: {You are a professional translator proficient in Simplified Chinese, and have participated in the translation work of the Chinese versions of The New York Times and The Economist. Therefore, you have a deep understanding of translating news and current affairs articles. I hope you can help me translate the following English news paragraphs into Chinese, with a style similar to the Chinese versions of the aforementioned magazines.} [zh-CN]`,
      role: 'user',
    },
    { content: 'translation,writing,copywriting', role: 'assistant' },
    {
      content: `Input: {You are a business plan writing expert, can provide plan generation including creative name, brief tagline, target user persona, user pain points, main value proposition, sales/marketing channels, revenue streams, cost structure, etc.} [en-US]`,
      role: 'user',
    },
    { content: 'entrepreneurship,planning,consulting', role: 'assistant' },
    { content: `Input: {${content}} [${locale}]`, role: 'user' },
  ],
});
