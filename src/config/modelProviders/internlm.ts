import { ModelProviderCard } from '@/types/llm';

const InternLM: ModelProviderCard = {
  chatModels: [],
  checkModel: 'internlm2.5-latest',
  description:
    'An open-source organization dedicated to large model research and development toolchains. Provides an efficient and user-friendly open platform for all AI developers, making cutting-edge large model and algorithm technologies accessible',
  disableBrowserRequest: true,
  id: 'internlm',
  modelList: { showModelFetcher: true },
  modelsUrl:
    'https://internlm.intern-ai.org.cn/doc/docs/Models#get-model-list',
  name: 'InternLM',
  settings: {
    disableBrowserRequest: true,
    proxyUrl: {
      placeholder: 'https://internlm-chat.intern-ai.org.cn/puyu/api/v1',
    },
    sdkType: 'openai',
    showModelFetcher: true,
  },
  url: 'https://internlm.intern-ai.org.cn',
};

export default InternLM;
