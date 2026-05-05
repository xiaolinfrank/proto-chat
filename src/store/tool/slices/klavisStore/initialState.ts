import { KlavisServer } from './types';

/**
 * Klavis Store state interface
 *
 * NOTE: API Key is NOT stored in client-side state for security reasons.
 * It's only available on the server-side.
 */
export interface KlavisStoreState {
  /** Set of tool call IDs currently being executed */
  executingToolIds: Set<string>;
  /** Set of server IDs currently loading */
  loadingServerIds: Set<string>;
  /** List of created Klavis Servers */
  servers: KlavisServer[];
}

/**
 * Klavis Store initial state
 */
export const initialKlavisStoreState: KlavisStoreState = {
  executingToolIds: new Set(),
  loadingServerIds: new Set(),
  servers: [],
};
