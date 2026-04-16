import { ClientSecretPayload } from '@lobechat/types';
import { createTRPCClient, httpLink } from '@trpc/client';
import superjson from 'superjson';
import urlJoin from 'url-join';

import { serverDBEnv } from '@/config/db';
import { LOBE_CHAT_AUTH_HEADER } from '@/const/auth';
import { isDesktop } from '@/const/version';
import { appEnv } from '@/envs/app';
import { createAsyncCallerFactory } from '@/libs/trpc/async';
import { createAsyncContextInner } from '@/libs/trpc/async/context';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';

import { asyncRouter } from './index';
import type { AsyncRouter } from './index';

export const createAsyncServerClient = async (userId: string, payload: ClientSecretPayload) => {
  const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${serverDBEnv.KEY_VAULTS_SECRET}`,
    [LOBE_CHAT_AUTH_HEADER]: await gateKeeper.encrypt(JSON.stringify({ payload, userId })),
  };

  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }

  const client = createTRPCClient<AsyncRouter>({
    links: [
      httpLink({
        headers,
        transformer: superjson,
        // Use INTERNAL_APP_URL for server-to-server calls to bypass CDN/proxy
        url: urlJoin(appEnv.INTERNAL_APP_URL!, '/trpc/async'),
      }),
    ],
  });

  return client;
};

/**
 * Helper method for inferring the caller type; does not actually invoke createAsyncCallerFactory,
 * as calling it would throw an error because asyncRouter has not been initialized
 */
const helperFunc = () => {
  const dummyCreateCaller = createAsyncCallerFactory(asyncRouter);
  return {} as unknown as ReturnType<typeof dummyCreateCaller>;
};

export type UnifiedAsyncCaller = ReturnType<typeof helperFunc>;

interface CreateCallerOptions {
  jwtPayload: any;
  userId: string;
}

/**
 * Factory method for creating a caller, compatible with both desktop server and remote server environments
 * Unifies the call style to caller.a.b()
 */
export const createAsyncCaller = async (
  options: CreateCallerOptions,
): Promise<UnifiedAsyncCaller> => {
  const { userId, jwtPayload } = options;

  if (isDesktop) {
    // Desktop environment: use caller to invoke methods directly in the same thread
    const asyncContext = await createAsyncContextInner({
      jwtPayload,
      // See src/libs/trpc/async/asyncAuth.ts
      secret: serverDBEnv.KEY_VAULTS_SECRET,
      userId,
    });

    const createCaller = createAsyncCallerFactory(asyncRouter);
    const caller = createCaller(asyncContext);

    return caller;
  }
  // Non-desktop environment: use HTTP Client
  // The HTTP client call style is client.a.b.mutate(); this is unified to caller.a.b()
  else {
    const httpClient = await createAsyncServerClient(userId, jwtPayload);
    const createRecursiveProxy = (client: any, path: string[]): any => {
      // The target is a dummy function, so that 'apply' can be triggered.
      return new Proxy(() => {}, {
        apply: (target, thisArg, args) => {
          // 'apply' is triggered by the function call `(...)`.
          // The `path` at this point is the full path to the procedure.

          // Traverse the original httpClient to get the actual procedure object.
          const procedure = path.reduce((obj, key) => (obj ? obj[key] : undefined), client);

          if (procedure && typeof procedure.mutate === 'function') {
            // If we found a valid procedure, call its mutate method.
            return procedure.mutate(...args);
          } else {
            // This should not happen if the call path is correct.
            const message = `Procedure not found or not valid at path: ${path.join('.')}`;
            throw new Error(message);
          }
        },
        get: (_, property: string) => {
          // When a property is accessed, we just extend the path and return a new proxy.
          // This handles `caller.file.parseFileToChunks`
          if (property === 'then') return undefined; // Prevent async/await issues
          return createRecursiveProxy(client, [...path, property as string]);
        },
      });
    };

    return createRecursiveProxy(httpClient, []);
  }
};
