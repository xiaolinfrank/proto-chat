import { ModelProviderCard } from '@/types/llm';

// ref: https://platform.lingyiwanwu.com/docs#models-and-pricing
const ZeroOne: ModelProviderCard = {
  chatModels: [],
  checkModel: 'yi-lightning',
  description:
    '01.AI is committed to advancing the human-centric AI 2.0 technological revolution, aiming to create significant economic and social value through large language models and pioneer new AI ecosystems and business models.',
  id: 'zeroone',
  modelList: { showModelFetcher: true },
  modelsUrl: 'https://platform.lingyiwanwu.com/docs#models-and-pricing',
  name: '01.AI',
  settings: {
    proxyUrl: {
      placeholder: 'https://api.lingyiwanwu.com/v1',
    },
    sdkType: 'openai',
    showModelFetcher: true,
  },
  url: 'https://www.lingyiwanwu.com/',
};

export default ZeroOne;
