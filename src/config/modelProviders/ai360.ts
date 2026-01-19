import { ModelProviderCard } from '@/types/llm';

// ref: https://ai.360.cn/platform/docs/overview
const Ai360: ModelProviderCard = {
  chatModels: [],
  checkModel: '360gpt-turbo',
  description:
    '360 AI is an AI model and service platform launched by 360 Company, providing various advanced natural language processing models, including 360GPT2 Pro, 360GPT Pro, 360GPT Turbo, and 360GPT Turbo Responsibility 8K. These models combine large-scale parameters and multimodal capabilities, widely applied in text generation, semantic understanding, dialogue systems, and code generation. Through flexible pricing strategies, 360 AI meets diverse user needs, supports developer integration, and drives innovation and development of intelligent applications.',
  disableBrowserRequest: true,
  id: 'ai360',
  modelList: { showModelFetcher: true },
  modelsUrl: 'https://ai.360.cn/platform/docs/overview',
  name: '360 AI',
  settings: {
    disableBrowserRequest: true,
    sdkType: 'openai',
    showModelFetcher: true,
  },
  url: 'https://ai.360.com',
};

export default Ai360;
