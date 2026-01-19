import { ModelProviderCard } from '@/types/llm';

// ref: https://help.aliyun.com/zh/model-studio/getting-started/models
const Qwen: ModelProviderCard = {
  chatModels: [],
  checkModel: 'qwen-flash',
  description:
    'Tongyi Qianwen is a large-scale language model independently developed by Alibaba Cloud, with powerful natural language understanding and generation capabilities. It can answer various questions, create written content, express viewpoints, write code, and more, playing roles across multiple domains.',
  disableBrowserRequest: true,
  id: 'qwen',
  modelList: { showModelFetcher: true },
  modelsUrl: 'https://help.aliyun.com/zh/dashscope/developer-reference/api-details',
  name: 'Aliyun Bailian',
  settings: {
    disableBrowserRequest: true,
    proxyUrl: {
      placeholder: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    },
    responseAnimation: {
      speed: 2,
      text: 'smooth',
    },
    sdkType: 'openai',
    showDeployName: true,
    showModelFetcher: true,
  },
  url: 'https://www.aliyun.com/product/bailian',
};

export default Qwen;
