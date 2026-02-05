import { genUserLLMConfig } from './genUserLLMConfig';

export const DEFAULT_LLM_CONFIG = genUserLLMConfig({
  lmstudio: {
    fetchOnClient: true,
  },
  ollama: {
    enabled: true,
    fetchOnClient: true,
  },
  openai: {
    enabled: false,  // Disable OpenAI
  },
  protochat: {
    enabled: true,  // Enable your ProtoChat
  },
});

// Modify to your actual model and provider
export const DEFAULT_MODEL = 'gemini-2.5-flash';  // ProtoChat will automatically route to gemini-2.5-flash

// Use OpenRouter's Qwen Embedding (via ProtoChat)
// Option 1: Use ProtoChat's internal ID (requires backend mapping configuration)
// export const DEFAULT_EMBEDDING_MODEL = 'qwen-embed-4b';
// export const DEFAULT_EMBEDDING_PROVIDER = 'protochat';

// Use ProtoChat's internal ID (requires backend database configuration)
export const DEFAULT_EMBEDDING_MODEL = 'qwen-embed-4b';  // 32k context, affordable pricing
export const DEFAULT_EMBEDDING_PROVIDER = 'protochat';  // ProtoChat will route to OpenRouter

// Rerank functionality is not currently implemented, configuration serves as placeholder
// To enable, configure Cohere or other providers that support rerank
export const DEFAULT_RERANK_MODEL = 'rerank-english-v3.0';
export const DEFAULT_RERANK_PROVIDER = 'cohere';  // Or change to 'none' / 'disabled'
export const DEFAULT_RERANK_QUERY_MODE = 'full_text';

export const DEFAULT_PROVIDER = 'protochat';  // Modify to your default provider
