import useSWR, { SWRHook } from 'swr';

import { isDesktop } from '@/const/version';

/**
 * This type of request method is relatively flexible data, which will be triggered on the first time
 *
 * Refresh rules have two types:
 *
 * - when the user refocuses, it will be refreshed outside the 5mins interval.
 * - can be combined with refreshXXX methods to refresh data
 *
 * Suitable for messages, topics, sessions, and other data that users will interact with on the client.
 */
// @ts-ignore
export const useClientDataSWR: SWRHook = (key, fetch, config) =>
  useSWR(key, fetch, {
    // default is 2000ms ,it makes the user's quick switch don't work correctly.
    // Cause issue like this: https://github.com/lobehub/lobe-chat/issues/532
    // we need to set it to 0.
    dedupingInterval: 0,
    focusThrottleInterval:
      // FIXME: desktop cloud sync mode also goes through edge requests and should also increase the delay
      // desktop 1.5s
      isDesktop
        ? 1500
        : // web 300s
          5 * 60 * 1000,
    // Custom error retry logic: don't retry on 401 errors
    onErrorRetry: (error: any, key: any, config: any, revalidate: any, { retryCount }: any) => {
      // Check if error is marked as non-retryable (e.g., 401 authentication errors)
      if (error?.meta?.shouldRetry === false) {
        return;
      }
      // For other errors, use default SWR retry behavior
      // Default: exponential backoff, max 5 retries
      if (retryCount >= 5) return;
      const exponentialDelay = 1000 * Math.pow(2, Math.min(retryCount, 10));
      const timeout = Math.min(exponentialDelay, 30_000);
      setTimeout(() => revalidate({ retryCount }), timeout);
    },
    refreshWhenOffline: false,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    ...config,
  });

/**
 * This type of request method is relatively “dead” request mode, which will only be triggered on the first request.
 * it suitable for first time request like `initUserState`
 */
// @ts-ignore
export const useOnlyFetchOnceSWR: SWRHook = (key, fetch, config) =>
  useSWR(key, fetch, {
    refreshWhenOffline: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    ...config,
  });

/**
 * This type of request method is used for triggering actions and must use mutate to trigger the request operation.
 * The advantage is built-in loading / error states, making it easy to handle loading / error state interactions.
 * Requests with the same SWR key automatically share the loading state (e.g., the new assistant button and the + button in the top right corner).
 * Very suitable for create operations and similar actions.
 */
// @ts-ignore
export const useActionSWR: SWRHook = (key, fetch, config) =>
  useSWR(key, fetch, {
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    revalidateOnFocus: false,
    revalidateOnMount: false,
    revalidateOnReconnect: false,
    ...config,
  });

export interface SWRRefreshParams<T, A = (...args: any[]) => any> {
  action: A;
  optimisticData?: (data: T | undefined) => T;
}

export type SWRefreshMethod<T> = <A extends (...args: any[]) => Promise<any>>(
  params?: SWRRefreshParams<T, A>,
) => ReturnType<A>;
