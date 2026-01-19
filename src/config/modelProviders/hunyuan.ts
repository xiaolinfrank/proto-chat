import { ModelProviderCard } from '@/types/llm';

// ref https://cloud.tencent.com/document/product/1729/104753
const Hunyuan: ModelProviderCard = {
  chatModels: [],
  checkModel: 'hunyuan-lite',
  description:
    'A large language model developed by Tencent, featuring powerful Chinese content creation capabilities, logical reasoning abilities in complex contexts, and reliable task execution capabilities',
  disableBrowserRequest: true,
  id: 'hunyuan',
  modelList: { showModelFetcher: true },
  modelsUrl: 'https://cloud.tencent.com/document/product/1729/104753',
  name: 'Hunyuan',
  settings: {
    disableBrowserRequest: true,
    proxyUrl: {
      placeholder: 'https://api.hunyuan.cloud.tencent.com/v1',
    },
    sdkType: 'openai',
    showModelFetcher: true,
  },
  url: 'https://hunyuan.tencent.com',
};

export default Hunyuan;
