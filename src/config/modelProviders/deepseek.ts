import { ModelProviderCard } from '@/types/llm';

const DeepSeek: ModelProviderCard = {
  chatModels: [],
  checkModel: 'deepseek-chat',
  description:
    'DeepSeek is a company focused on artificial intelligence technology research and applications. Its latest model, DeepSeek-V3, surpasses open-source models such as Qwen2.5-72B and Llama-3.1-405B in multiple evaluations, with performance aligning with leading closed-source models GPT-4o and Claude-3.5-Sonnet.',
  id: 'deepseek',
  modelList: { showModelFetcher: true },
  modelsUrl: 'https://platform.deepseek.com/api-docs/zh-cn/quick_start/pricing',
  name: 'DeepSeek',
  settings: {
    proxyUrl: {
      placeholder: 'https://api.deepseek.com',
    },
    sdkType: 'openai',
    showModelFetcher: true,
  },
  url: 'https://deepseek.com',
};

export default DeepSeek;
