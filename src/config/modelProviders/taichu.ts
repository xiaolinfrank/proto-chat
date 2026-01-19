import { ModelProviderCard } from '@/types/llm';

// ref :https://ai-maas.wair.ac.cn/#/doc
const Taichu: ModelProviderCard = {
  chatModels: [],
  checkModel: 'taichu_llm',
  description:
    'A next-generation multimodal large model launched by the Institute of Automation, Chinese Academy of Sciences, and Wuhan AI Research Institute. It supports comprehensive tasks including multi-turn Q&A, text creation, image generation, 3D understanding, signal analysis, and more, with enhanced cognitive, comprehension, and creative capabilities, delivering a new interactive experience.',
  id: 'taichu',
  modelsUrl: 'https://ai-maas.wair.ac.cn/#/doc',
  name: 'Taichu',
  settings: {
    proxyUrl: {
      placeholder: 'https://ai-maas.wair.ac.cn/maas/v1',
    },
    sdkType: 'openai',
  },
  url: 'https://ai-maas.wair.ac.cn',
};

export default Taichu;
