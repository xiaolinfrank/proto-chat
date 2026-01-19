import { ModelProviderCard } from '@/types/llm';

// ref: https://platform.baichuan-ai.com/price
const Baichuan: ModelProviderCard = {
  chatModels: [],
  checkModel: 'Baichuan3-Turbo',
  description:
    'Baichuan Intelligence is a company focused on developing large-scale AI models. Its models excel in Chinese tasks such as knowledge encyclopedias, long-text processing, and content generation, surpassing mainstream foreign models. Baichuan Intelligence also possesses industry-leading multimodal capabilities and performs exceptionally well in multiple authoritative evaluations. Its models include Baichuan 4, Baichuan 3 Turbo, and Baichuan 3 Turbo 128k, each optimized for different application scenarios, providing cost-effective solutions.',
  id: 'baichuan',
  modelList: { showModelFetcher: true },
  modelsUrl: 'https://platform.baichuan-ai.com/price',
  name: 'Baichuan',
  settings: {
    proxyUrl: {
      placeholder: 'https://api.baichuan-ai.com/v1',
    },
    responseAnimation: {
      speed: 2,
      text: 'smooth',
    },
    sdkType: 'openai',
    showModelFetcher: true,
  },
  url: 'https://platform.baichuan-ai.com',
};

export default Baichuan;
