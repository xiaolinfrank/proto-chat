import { ModelProviderCard } from '@/types/llm';

// ref: https://platform.moonshot.cn/docs/intro#model-list
const Moonshot: ModelProviderCard = {
  chatModels: [],
  checkModel: 'kimi-latest',
  description:
    'Moonshot is an open-source platform launched by Beijing Dark Side of the Moon Technology Co., Ltd., providing various natural language processing models with wide-ranging applications including but not limited to content creation, academic research, intelligent recommendations, medical diagnosis, and more. It supports long-text processing and complex generation tasks.',
  id: 'moonshot',
  modelList: { showModelFetcher: true },
  modelsUrl: 'https://platform.moonshot.cn/docs/intro',
  name: 'Moonshot',
  settings: {
    disableBrowserRequest: true, // CORS error
    proxyUrl: {
      placeholder: 'https://api.moonshot.cn/v1',
    },
    responseAnimation: {
      speed: 2,
      text: 'smooth',
    },
    sdkType: 'openai',
    showModelFetcher: true,
  },
  url: 'https://www.moonshot.cn',
};

export default Moonshot;
