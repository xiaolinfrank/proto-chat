import { ModelProviderCard } from '@/types/llm';

// ref: https://www.xfyun.cn/doc/spark/HTTP%E8%B0%83%E7%94%A8%E6%96%87%E6%A1%A3.html#_3-request-specification
// ref: https://www.xfyun.cn/doc/spark/Web.html#_1-interface-specification
const Spark: ModelProviderCard = {
  chatModels: [],
  checkModel: 'lite',
  description:
    'iFlytek Spark large model provides powerful AI capabilities across multiple domains and languages, utilizing advanced natural language processing technology to build innovative applications suitable for various vertical scenarios such as smart hardware, smart healthcare, and smart finance.',
  id: 'spark',
  modelsUrl: 'https://xinghuo.xfyun.cn/spark',
  name: 'Spark',
  settings: {
    disableBrowserRequest: true,
    responseAnimation: {
      speed: 2,
      text: 'smooth',
    },
    sdkType: 'openai',
    showModelFetcher: false,
  },
  url: 'https://www.xfyun.cn',
};

export default Spark;
