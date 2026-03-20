import { isContextCachingModel, isThinkingWithToolClaudeModel } from '@lobechat/model-runtime';

import { DEFAULT_AGENT_CHAT_CONFIG, DEFAULT_AGENT_SEARCH_FC_MODEL } from '@/const/settings';
import { AgentStoreState } from '@/store/agent/initialState';
import { LobeAgentChatConfig } from '@/types/agent';

import { currentAgentConfig } from './agent';

export const currentAgentChatConfig = (s: AgentStoreState): LobeAgentChatConfig =>
  currentAgentConfig(s).chatConfig || {};

const agentSearchMode = (s: AgentStoreState) => currentAgentChatConfig(s).searchMode || 'off';
const isAgentEnableSearch = (s: AgentStoreState) => agentSearchMode(s) !== 'off';

const useModelBuiltinSearch = (s: AgentStoreState) =>
  currentAgentChatConfig(s).useModelBuiltinSearch;

const searchFCModel = (s: AgentStoreState) =>
  currentAgentChatConfig(s).searchFCModel || DEFAULT_AGENT_SEARCH_FC_MODEL;

const enableHistoryCount = (s: AgentStoreState) => {
  const config = currentAgentConfig(s);
  const chatConfig = currentAgentChatConfig(s);

  // If context caching is enabled and the current model type matches, do not enable history
  const enableContextCaching = !chatConfig.disableContextCaching;

  if (enableContextCaching && isContextCachingModel(config.model)) return false;

  // When search is enabled, do not enable history for claude 3.7 sonnet model
  const enableSearch = isAgentEnableSearch(s);

  if (enableSearch && isThinkingWithToolClaudeModel(config.model)) return false;

  return chatConfig.enableHistoryCount;
};

const historyCount = (s: AgentStoreState): number => {
  const chatConfig = currentAgentChatConfig(s);

  return chatConfig.historyCount ?? (DEFAULT_AGENT_CHAT_CONFIG.historyCount as number); // historyCount of 0 means no history messages are included
};

const displayMode = (s: AgentStoreState) => {
  const chatConfig = currentAgentChatConfig(s);

  return chatConfig.displayMode || 'chat';
};

const enableHistoryDivider =
  (historyLength: number, currentIndex: number) => (s: AgentStoreState) => {
    const config = currentAgentChatConfig(s);

    return (
      enableHistoryCount(s) &&
      historyLength > (config.historyCount ?? 0) &&
      config.historyCount === historyLength - currentIndex
    );
  };

export const agentChatConfigSelectors = {
  agentSearchMode,
  currentChatConfig: currentAgentChatConfig,
  displayMode,
  enableHistoryCount,
  enableHistoryDivider,
  historyCount,
  isAgentEnableSearch,
  searchFCModel,
  useModelBuiltinSearch,
};
