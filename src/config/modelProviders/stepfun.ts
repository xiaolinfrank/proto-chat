import { ModelProviderCard } from '@/types/llm';

// ref: https://platform.stepfun.com/docs/llm/text
// According to the documentation, for the Stepfun large model's context length, 'k' means 1000
const Stepfun: ModelProviderCard = {
  chatModels: [],
  checkModel: 'step-2-mini',
  description:
    'The Stepfun large model features industry-leading multimodal and complex reasoning capabilities, supporting ultra-long text understanding and powerful autonomous search engine scheduling.',
  // after test, currently https://api.stepfun.com/v1/chat/completions has the CORS issue
  // So we should close the browser request mode
  disableBrowserRequest: true,
  id: 'stepfun',
  modelList: { showModelFetcher: true },
  modelsUrl: 'https://platform.stepfun.com/docs/llm/text',
  name: 'Stepfun',
  settings: {
    disableBrowserRequest: true,
    proxyUrl: {
      placeholder: 'https://api.stepfun.com/v1',
    },
    responseAnimation: {
      speed: 2,
      text: 'smooth',
    },
    sdkType: 'openai',
    showModelFetcher: true,
  },
  url: 'https://stepfun.com',
};

export default Stepfun;
