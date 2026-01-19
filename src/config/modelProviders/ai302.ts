import { ModelProviderCard } from '@/types/llm';

// ref: https://302.ai/pricing/
const Ai302: ModelProviderCard = {
  apiKeyUrl: 'https://lobe.li/Oizw5sN',
  chatModels: [],
  checkModel: 'gpt-4o',
  description: '302.AI is a pay-as-you-go AI application platform, providing the most comprehensive AI APIs and online AI applications available on the market',
  id: 'ai302',
  modelList: { showModelFetcher: true },
  modelsUrl: 'https://302.ai/pricing/',
  name: '302.AI',
  settings: {
    proxyUrl: {
      placeholder: 'https://api.302.ai/v1',
    },
    sdkType: 'openai',
    showModelFetcher: true,
  },
  url: 'https://302.ai',
};

export default Ai302;
