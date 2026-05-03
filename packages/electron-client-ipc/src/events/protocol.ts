import { McpInstallSchema } from '../types';

/**
 * Broadcast events related to protocol installation (main process -> renderer process)
 */
export interface ProtocolBroadcastEvents {
  /**
   * MCP plugin installation request event
   * Sent to the frontend after the main process parses the protocol URL
   */
  mcpInstallRequest: (data: {
    /** Market source ID */
    marketId?: string;
    /** Plugin ID */
    pluginId: string;
    /** MCP Schema object */
    schema: McpInstallSchema;
  }) => void;
}

/**
 * Dispatch events related to protocol handling (renderer process -> main process)
 */
export interface ProtocolDispatchEvents {
  /**
   * Notify the main process that the protocol URL has been handled
   */
  protocolUrlHandled: (data: { error?: string; success: boolean; url: string }) => Promise<void>;
}
