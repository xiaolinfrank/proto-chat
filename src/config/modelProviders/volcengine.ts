import { ModelProviderCard } from '@/types/llm';

// ref https://www.volcengine.com/docs/82379/1330310
const Doubao: ModelProviderCard = {
  chatModels: [],
  checkModel: 'doubao-seed-1-6-flash-250828',
  description:
    'A large model service development platform launched by ByteDance, providing feature-rich, secure, and competitively priced model invocation services, along with end-to-end capabilities including model data, fine-tuning, inference, and evaluation, ensuring comprehensive support for your AI application development and deployment.',
  id: 'volcengine',
  modelsUrl: 'https://www.volcengine.com/docs/82379/1330310',
  name: 'Volcengine',
  settings: {
    disableBrowserRequest: true, // CORS error
    proxyUrl: {
      placeholder: 'https://ark.cn-beijing.volces.com/api/v3',
    },
    responseAnimation: {
      speed: 2,
      text: 'smooth',
    },
    sdkType: 'openai',
    showDeployName: true,
    showModelFetcher: false,
  },
  url: 'https://www.volcengine.com/product/ark',
};

export default Doubao;
