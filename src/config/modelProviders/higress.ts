import { ModelProviderCard } from '@/types/llm';

const Higress: ModelProviderCard = {
  chatModels: [],
  checkModel: 'qwen-max',
  description:
    'Higress is a cloud-native API gateway, created within Alibaba to address issues with Tengine reload damaging long-connection services and insufficient gRPC/Dubbo load balancing capabilities.',
  id: 'higress',
  modelList: { showModelFetcher: true },
  modelsUrl: 'https://higress.cn/',
  name: 'Higress',
  proxyUrl: {
    desc: 'Enter the Higress AI Gateway access address',
    placeholder: 'https://127.0.0.1:8080/v1',
    title: 'AI Gateway Address',
  },
  settings: {
    proxyUrl: {
      desc: 'Enter the Higress AI Gateway access address',
      placeholder: 'https://127.0.0.1:8080/v1',
      title: 'AI Gateway Address',
    },
    sdkType: 'openai',
    showModelFetcher: true,
  },
  url: 'https://apig.console.aliyun.com/',
};

export default Higress;
