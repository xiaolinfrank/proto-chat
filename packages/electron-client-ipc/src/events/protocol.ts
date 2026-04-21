import { McpInstallSchema } from '../types';

/**
 * Broadcast events related to protocol installation (main process -> renderer process)
 */
export interface ProtocolBroadcastEvents {
  /**
   * MCP plugin installation request event
   * Sent from main process to frontend after parsing the protocol URL
   */
  mcpInstallRequest: (data: {
    /** Marketplace source ID */
    marketId?: string;
    /** Plugin ID */
    pluginId: string;
    /** MCP schema object */
    schema: McpInstallSchema;
  }) => void;
}

/**
 * Dispatch events related to protocol handling (renderer process -> main process)
 */
export interface ProtocolDispatchEvents {
  /**
   * Notifies the main process that the protocol URL has been handled
   */
  protocolUrlHandled: (data: { error?: string; success: boolean; url: string }) => Promise<void>;
}
