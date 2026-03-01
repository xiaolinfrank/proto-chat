import { McpInstallSchema } from '../types';

/**
 * Protocol installation-related broadcast events (main process -> renderer process)
 */
export interface ProtocolBroadcastEvents {
  /**
   * MCP plugin installation request event
   * Sent to the frontend after the main process parses the protocol URL
   */
  mcpInstallRequest: (data: {
    /** Marketplace source ID */
    marketId?: string;
    /** Plugin ID */
    pluginId: string;
    /** MCP Schema object */
    schema: McpInstallSchema;
  }) => void;
}

/**
 * Protocol handling-related dispatch events (renderer process -> main process)
 */
export interface ProtocolDispatchEvents {
  /**
   * Notify the main process that the protocol URL has been handled
   */
  protocolUrlHandled: (data: { error?: string; success: boolean; url: string }) => Promise<void>;
}
