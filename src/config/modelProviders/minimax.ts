import { ModelProviderCard } from '@/types/llm';

// ref: https://platform.minimaxi.com/document/Models
const Minimax: ModelProviderCard = {
  chatModels: [],
  checkModel: 'MiniMax-M2',
  description:
    'MiniMax is a general artificial intelligence technology company founded in 2021, dedicated to co-creating intelligence with users. MiniMax has independently developed general large models of different modalities, including trillion-parameter MoE text models, voice models, and image models. It has also launched applications such as Conch AI.',
  id: 'minimax',
  modelsUrl: 'https://platform.minimaxi.com/document/Models',
  name: 'Minimax',
  settings: {
    disableBrowserRequest: true, // CORS error
    proxyUrl: {
      placeholder: 'https://api.minimaxi.com/v1',
    },
    responseAnimation: {
      speed: 2,
      text: 'smooth',
    },
    sdkType: 'openai',
  },
  url: 'https://www.minimaxi.com',
};

export default Minimax;
