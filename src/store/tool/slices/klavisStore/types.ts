/**
 * Klavis Server connection status
 */
export enum KlavisServerStatus {
  /** Connected, available for use */
  CONNECTED = 'connected',
  /** Connection failed */
  ERROR = 'error',
  /** Unauthenticated, OAuth flow required */
  PENDING_AUTH = 'pending_auth',
}

/**
 * Klavis tool definition (MCP format)
 */
export interface KlavisTool {
  /** Tool description */
  description?: string;
  /** JSON Schema for tool input */
  inputSchema: {
    properties?: Record<string, any>;
    required?: string[];
    type: string;
  };
  /** Tool name */
  name: string;
}

/**
 * Klavis Server instance
 */
export interface KlavisServer {
  /** Creation timestamp */
  createdAt: number;
  /** Error message (if any) */
  errorMessage?: string;
  /** Server icon URL */
  icon?: string;
  /**
   * Identifier used for storing to database (e.g., 'google-calendar')
   * Format: lowercase, spaces replaced with hyphens
   */
  identifier: string;
  /** Klavis instance ID */
  instanceId: string;
  /** Whether authenticated */
  isAuthenticated: boolean;
  /** OAuth authentication URL */
  oauthUrl?: string;
  /**
   * Server name for calling Klavis API (e.g., 'Google Calendar')
   */
  serverName: string;
  /** Server URL (for connecting and calling tools) */
  serverUrl: string;
  /** Connection status */
  status: KlavisServerStatus;
  /** List of tools provided by the server */
  tools?: KlavisTool[];
}

/**
 * Parameters for creating a Klavis Server
 */
export interface CreateKlavisServerParams {
  /**
   * Identifier used for storing to database (e.g., 'google-calendar')
   */
  identifier: string;
  /**
   * Server name for calling Klavis API (e.g., 'Google Calendar')
   */
  serverName: string;
  /** User ID */
  userId: string;
}

/**
 * Parameters for calling a Klavis tool
 */
export interface CallKlavisToolParams {
  /** Strata Server URL */
  serverUrl: string;
  /** Tool arguments */
  toolArgs?: Record<string, unknown>;
  /** Tool name */
  toolName: string;
}

/**
 * Result of calling a Klavis tool
 */
export interface CallKlavisToolResult {
  /** Return data */
  data?: any;
  /** Error message */
  error?: string;
  /** Whether successful */
  success: boolean;
}
