import { ChatStreamPayload } from '@lobechat/types';

export const chainSummaryDescription = (
  content: string,
  locale: string,
): Partial<ChatStreamPayload> => ({
  messages: [
    {
      content: `You are an assistant skilled at summarizing skills. You need to summarize the user's input into a role skill profile, not exceeding 20 characters. The content should ensure clear information, clear logic, and effectively convey the role's skills and experience, and translate it to the target language: ${locale}. Format requirements:\nInput: {text as JSON quoted string} [locale]\nOutput: {profile}`,
      role: 'system',
    },
    {
      content: `Input: {You are a copywriting master, help me name some design/art works. Names should have literary connotation, focus on refinement and artistic conception, express the scene atmosphere of the work, making the name both concise and poetic.} [zh-CN]`,
      role: 'user',
    },
    { content: 'Skilled at naming creative artworks', role: 'assistant' },
    {
      content: `Input: {You are a business plan writing expert, can provide plan generation including creative name, brief tagline, target user persona, user pain points, main value proposition, sales/marketing channels, revenue streams, cost structure, etc.} [en-US]`,
      role: 'user',
    },
    { content: 'Good at business plan writing and consulting', role: 'assistant' },
    {
      content: `Input: {You are a frontend expert. Please convert the code below to TS without modifying the implementation. If there are global variables not defined in the original JS, you need to add type declarations using declare.} [zh-CN]`,
      role: 'user',
    },
    { content: 'Skilled at TS conversion and type declaration', role: 'assistant' },
    {
      content: `Input: {
Users write API documentation for developers normally. You need to provide documentation content that is easy to use and read from the user's perspective.\n\nA standard API documentation example is as follows:\n\n\`\`\`markdown
---
title: useWatchPluginMessage
description: Listen for plugin messages from LobeChat
nav: API
---\n\n\`useWatchPluginMessage\` is a React Hook encapsulated by Chat Plugin SDK, used to listen for plugin messages from LobeChat.
} [ru-RU]`,
      role: 'user',
    },
    {
      content:
        'Специализируется на создании хорошо структурированной и профессиональной документации README для GitHub с точными техническими терминами',
      role: 'assistant',
    },
    {
      content: `Input: {You are a business plan writing expert, can provide plan generation including creative name, brief tagline, target user persona, user pain points, main value proposition, sales/marketing channels, revenue streams, cost structure, etc.} [zh-CN]`,
      role: 'user',
    },
    { content: 'Skilled at business plan writing and consulting', role: 'assistant' },
    { content: `Input: {${content}} [${locale}]`, role: 'user' },
  ],
  temperature: 0,
});
