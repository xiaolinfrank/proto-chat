import { ModelProviderCard } from '@/types/llm';

const PPIO: ModelProviderCard = {
  chatModels: [],
  checkModel: 'deepseek/deepseek-r1-distill-qwen-32b',
  description:
    'PPIO Cloud provides stable, cost-effective open-source model API services, supporting industry-leading large models such as the full DeepSeek series, Llama, Qwen, and more.',
  disableBrowserRequest: true,
  id: 'ppio',
  modelList: { showModelFetcher: true },
  modelsUrl:
    'https://ppinfra.com/llm-api?utm_source=github_lobe-chat&utm_medium=github_readme&utm_campaign=link',
  name: 'PPIO',
  settings: {
    disableBrowserRequest: true,
    sdkType: 'openai',
    showModelFetcher: true,
  },
  url: 'https://ppinfra.com/user/register?invited_by=RQIMOC&utm_source=github_lobechat',
};

export default PPIO;
