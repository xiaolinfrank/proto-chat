import { ModelProviderCard } from '@/types/llm';

const BaiduWenxin: ModelProviderCard = {
  chatModels: [],
  checkModel: 'ernie-4.5-turbo-latest',
  description:
    'Enterprise-level one-stop platform for large-scale models and AI-native application development and services, providing the most comprehensive and user-friendly full-process toolchain for generative AI model development and application development',
  id: 'wenxin',
  modelsUrl: 'https://console.bce.baidu.com/qianfan/modelcenter/model/buildIn/list',
  name: 'Wenxin',
  settings: {
    proxyUrl: {
      placeholder: 'https://qianfan.baidubce.com/v2',
    },
    responseAnimation: {
      speed: 2,
      text: 'smooth',
    },
    sdkType: 'openai',
  },
  url: 'https://cloud.baidu.com/wenxin.html',
};

export default BaiduWenxin;
