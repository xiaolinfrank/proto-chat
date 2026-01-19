import { ModelProviderCard } from '@/types/llm';

const TencentCloud: ModelProviderCard = {
  chatModels: [],
  checkModel: 'deepseek-v3',
  description:
    'LLM Knowledge Engine Atomic Power is a full-chain knowledge Q&A capability developed based on the knowledge engine, designed for enterprises and developers to provide flexible assembly and development of model applications. You can assemble your exclusive model services through multiple atomic capabilities, calling services such as document parsing, splitting, embedding, multi-turn rewriting, and more to customize enterprise-specific AI business.',
  id: 'tencentcloud',
  modelsUrl: 'https://cloud.tencent.com/document/api/1772/115963',
  name: 'TencentCloud',
  settings: {
    disableBrowserRequest: true,
    proxyUrl: {
      placeholder: 'https://api.lkeap.cloud.tencent.com/v1',
    },
    sdkType: 'openai',
    showModelFetcher: true,
  },
  url: 'https://cloud.tencent.com/document/api/1772/115365',
};

export default TencentCloud;
