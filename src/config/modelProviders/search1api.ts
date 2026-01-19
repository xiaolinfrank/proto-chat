import { ModelProviderCard } from '@/types/llm';

const Search1API: ModelProviderCard = {
  chatModels: [],
  checkModel: 'deepseek-r1-70b-fast-online',
  description:
    'Search1API provides access to DeepSeek series models with on-demand internet connectivity, including standard and fast versions, supporting model selection across various parameter scales.',
  id: 'search1api',
  modelList: { showModelFetcher: true },
  name: 'Search1API',
  settings: {
    proxyUrl: {
      placeholder: 'https://api.search1api.com/v1',
    },
    responseAnimation: {
      speed: 2,
      text: 'smooth',
    },
    sdkType: 'openai',
    showModelFetcher: true,
  },
  url: 'https://www.search1api.com',
};

export default Search1API;
