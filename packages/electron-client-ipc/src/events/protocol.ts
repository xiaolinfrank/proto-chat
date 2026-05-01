import { McpInstallSchema } from '../types';

/**
 * Protocol installation related Broadcast events (main process -> renderer process)
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
 * Protocol handling related Dispatch events (renderer process -> main process)
 */
export interface ProtocolDispatchEvents {
  /**
   * Notify the main process that the protocol URL has been handled
   */
  protocolUrlHandled: (data: { error?: string; success: boolean; url: string }) => Promise<void>;
}
