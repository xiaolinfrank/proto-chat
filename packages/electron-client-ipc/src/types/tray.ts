/**
 * Parameters for showing a tray notification
 */
export interface ShowTrayNotificationParams {
  /**
   * Notification content
   */
  content: string;

  /**
   * Icon type
   */
  iconType?: 'info' | 'warning' | 'error' | 'none';

  /**
   * Notification title
   */
  title: string;
}

/**
 * Parameters for updating the tray icon
 */
export interface UpdateTrayIconParams {
  /**
   * Icon path (relative to resources directory)
   */
  iconPath: string;
}

/**
 * Parameters for updating the tray tooltip
 */
export interface UpdateTrayTooltipParams {
  /**
   * Tooltip text
   */
  tooltip: string;
}
