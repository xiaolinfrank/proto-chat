import { ModelProviderCard } from '@/types/llm';

// ref: https://novita.ai/model-api/product/llm-api
const Novita: ModelProviderCard = {
  chatModels: [],
  checkModel: 'meta-llama/llama-3.1-8b-instruct',
  description:
    'Novita AI is a platform providing API services for various large language models and AI image generation, offering flexibility, reliability, and cost-effectiveness. It supports the latest open-source models such as Llama3 and Mistral, providing comprehensive, user-friendly, and auto-scaling API solutions for generative AI application development, ideal for the rapid growth of AI startups.',
  disableBrowserRequest: true,
  id: 'novita',
  modelList: { showModelFetcher: true },
  modelsUrl: 'https://novita.ai/model-api/product/llm-api',
  name: 'Novita',
  settings: {
    disableBrowserRequest: true,
    proxyUrl: {
      placeholder: 'https://api.novita.ai/v3/openai',
    },
    sdkType: 'openai',
    showModelFetcher: true,
  },
  url: 'https://novita.ai',
};

export default Novita;
