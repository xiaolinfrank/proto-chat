import { ModelProviderCard } from '@/types/llm';

// ref: https://api.cometapi.com/pricing
const CometAPI: ModelProviderCard = {
  chatModels: [],
  checkModel: 'gpt-5-mini',
  description:
    'CometAPI is a service platform providing various cutting-edge large model interfaces, supporting OpenAI, Anthropic, Google, and more, suitable for diverse development and application needs. Users can flexibly choose optimal models and pricing based on their requirements, enhancing the AI experience.',
  enabled: true,
  id: 'cometapi',
  modelList: { showModelFetcher: true },
  modelsUrl: 'https://api.cometapi.com/v1/models',
  name: 'CometAPI',
  settings: {
    proxyUrl: {
      placeholder: 'https://api.cometapi.com/v1',
    },
    sdkType: 'openai',
    showModelFetcher: true,
  },
  url: 'https://cometapi.com',
};

export default CometAPI;
