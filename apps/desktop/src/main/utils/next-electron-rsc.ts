// copy from https://github.com/kirill-konshin/next-electron-rsc
import { serialize as serializeCookie } from 'cookie';
import { type Protocol, type Session } from 'electron';
// @ts-ignore
import type { NextConfig } from 'next';
// @ts-ignore
import type NextNodeServer from 'next/dist/server/next-server';
import assert from 'node:assert';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import path from 'node:path';
import { parse } from 'node:url';
import resolve from 'resolve';
import { parse as parseCookie, splitCookiesString } from 'set-cookie-parser';

import { LOCAL_STORAGE_URL_PREFIX } from '@/const/dir';
import { isDev } from '@/const/env';
import { createLogger } from '@/utils/logger';

// Create logger
const logger = createLogger('utils:next-electron-rsc');

// Define custom handler type
export type CustomRequestHandler = (request: Request) => Promise<Response | null | undefined>;

export const createRequest = async ({
  socket,
  request,
  session,
}: {
  request: Request;
  session: Session;
  socket: Socket;
}): Promise<IncomingMessage> => {
  const req = new IncomingMessage(socket);

  const url = new URL(request.url);

  // Normal Next.js URL does not contain schema and host/port, otherwise endless loops due to butchering of schema by normalizeRepeatedSlashes in resolve-routes
  req.url = url.pathname + (url.search || '');
  req.method = request.method;

  request.headers.forEach((value, key) => {
    req.headers[key] = value;
  });

  try {
    // @see https://github.com/electron/electron/issues/39525#issue-1852825052
    const cookies = await session.cookies.get({
      url: request.url,
      // domain: url.hostname,
      // path: url.pathname,
      // `secure: true` Cookies should not be sent via http
      // secure: url.protocol === 'http:' ? false : undefined,
      // theoretically not possible to implement sameSite because we don't know the url
      // of the website that is requesting the resource
    });

    if (cookies.length) {
      const cookiesHeader = [];

      for (const cookie of cookies) {
        const { name, value } = cookie;
        cookiesHeader.push(serializeCookie(name, value));
      }

      req.headers.cookie = cookiesHeader.join('; ');
    }
  } catch (e) {
    throw new Error('Failed to parse cookies', { cause: e });
  }

  if (request.body) {
    req.push(Buffer.from(await request.arrayBuffer()));
  }

  req.push(null);
  req.complete = true;

  return req;
};

export class ReadableServerResponse extends ServerResponse {
  private responsePromise: Promise<Response>;

  constructor(req: IncomingMessage) {
    super(req);

    this.responsePromise = new Promise<Response>((resolve) => {
      const readableStream = new ReadableStream({
        cancel: () => {},
        pull: () => {
          this.emit('drain');
        },
        start: (controller) => {
          let onData;

          this.on(
            'data',
            (onData = (chunk) => {
              controller.enqueue(chunk);
            }),
          );

          this.once('end', (chunk) => {
            controller.enqueue(chunk);
            controller.close();
            this.off('data', onData);
          });
        },
      });

      this.once('writeHead', (statusCode) => {
        resolve(
          new Response(readableStream, {
            headers: this.getHeaders() as any,
            status: statusCode,
            statusText: this.statusMessage,
          }),
        );
      });
    });
  }

  write(chunk: any, ...args): boolean {
    this.emit('data', chunk);
    return super.write(chunk, ...args);
  }

  end(chunk: any, ...args): this {
    this.emit('end', chunk);
    return super.end(chunk, ...args);
  }

  writeHead(statusCode: number, ...args: any): this {
    this.emit('writeHead', statusCode);
    return super.writeHead(statusCode, ...args);
  }

  getResponse() {
    return this.responsePromise;
  }
}

/**
 * https://nextjs.org/docs/pages/building-your-application/configuring/custom-server
 * https://github.com/vercel/next.js/pull/68167/files#diff-d0d8b7158bcb066cdbbeb548a29909fe8dc4e98f682a6d88654b1684e523edac
 * https://github.com/vercel/next.js/blob/canary/examples/custom-server/server.ts
 *
 * @param {string} standaloneDir
 * @param {string} localhostUrl
 * @param {import('electron').Protocol} protocol
 * @param {boolean} debug
 */
export function createHandler({
  standaloneDir,
  localhostUrl,
  protocol,
  debug = false,
}: {
  debug?: boolean;
  localhostUrl: string;
  protocol: Protocol;
  standaloneDir: string;
}) {
  assert(standaloneDir, 'standaloneDir is required');
  assert(protocol, 'protocol is required');

  // Array to store custom request handlers
  const customHandlers: CustomRequestHandler[] = [];

  // Method to register custom request handlers - available in both development and production environments
  function registerCustomHandler(handler: CustomRequestHandler) {
    logger.debug('Registering custom request handler');
    customHandlers.push(handler);
    return () => {
      const index = customHandlers.indexOf(handler);
      if (index !== -1) {
        logger.debug('Unregistering custom request handler');
        customHandlers.splice(index, 1);
      }
    };
  }

  let registerProtocolHandle = false;
  let interceptorCount = 0; // Track the number of active interceptors

  protocol.registerSchemesAsPrivileged([
    {
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
      },
      scheme: 'http',
    },
  ]);
  logger.debug('Registered HTTP scheme as privileged');

  // Initialize the Next.js app (only used in production)
  let app: NextNodeServer | null = null;
  let handler: any = null;
  let preparePromise: Promise<void> | null = null;

  if (!isDev) {
    logger.info('Initializing Next.js app for production');

    // https://github.com/lobehub/lobe-chat/pull/9851
    // @ts-ignore
    // noinspection JSConstantReassignment
    process.env.NODE_ENV = 'production';
    const next = require(resolve.sync('next', { basedir: standaloneDir }));

    // @see https://github.com/vercel/next.js/issues/64031#issuecomment-2078708340
    const config = require(path.join(standaloneDir, '.next', 'required-server-files.json'))
      .config as NextConfig;
    process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config);

    app = next({ dir: standaloneDir }) as NextNodeServer;

    handler = app.getRequestHandler();
    preparePromise = app.prepare();
  } else {
    logger.debug('Starting in development mode');
  }

  // Common request handling function - shared by both development and production environments
  const handleRequest = async (
    request: Request,
    session: Session,
    socket: Socket,
  ): Promise<Response> => {
    try {
      // Check if this is a local file service request; if so, skip processing
      const url = new URL(request.url);
      if (url.pathname.startsWith(LOCAL_STORAGE_URL_PREFIX + '/')) {
        if (debug) logger.debug(`Skipping local file service request: ${request.url}`);
        // Directly forward the request to the local file service using fetch
        return fetch(request);
      }

      // First try to handle the request using custom handlers
      for (const customHandler of customHandlers) {
        try {
          const response = await customHandler(request);
          if (response) {
            if (debug) logger.debug(`Custom handler processed: ${request.url}`);
            return response;
          }
        } catch (error) {
          if (debug) logger.error(`Custom handler error: ${error}`);
          // Continue to the next handler
        }
      }

      // Create a Node.js request object
      const req = await createRequest({ request, session, socket });
      // Create a Response object that can read the response
      const res = new ReadableServerResponse(req);

      if (isDev) {
        // Development environment: forward request to the dev server
        if (debug) logger.debug(`Forwarding request to dev server: ${request.url}`);

        // Modify URL to point to the dev server
        const devUrl = new URL(req.url, localhostUrl);

        // Send request to the dev server using the node:http module
        const http = require('node:http');
        const devReq = http.request(
          {
            headers: req.headers,
            hostname: devUrl.hostname,
            method: req.method,
            path: devUrl.pathname + (devUrl.search || ''),
            port: devUrl.port,
          },
          (devRes) => {
            // Set response status code and headers
            res.statusCode = devRes.statusCode;
            res.statusMessage = devRes.statusMessage;

            // Copy response headers
            Object.keys(devRes.headers).forEach((key) => {
              res.setHeader(key, devRes.headers[key]);
            });

            // Stream response content
            devRes.pipe(res);
          },
        );

        // Handle errors
        devReq.on('error', (err) => {
          if (debug) logger.error(`Error forwarding request: ${err}`);
        });

        // Transfer request body
        req.pipe(devReq);
      } else {
        // Production environment: use Next.js to handle the request
        if (debug) logger.debug(`Processing with Next.js handler: ${request.url}`);

        // Ensure Next.js is ready
        if (preparePromise) await preparePromise;

        const url = parse(req.url, true);
        handler(req, res, url);
      }

      // Get the Response object
      const response = await res.getResponse();

      // Handle cookies (common processing for both environments)
      try {
        const cookies = parseCookie(
          response.headers.getSetCookie().reduce((r, c) => {
            return [...r, ...splitCookiesString(c)];
          }, []),
        );

        for (const cookie of cookies) {
          let expirationDate: number | undefined;

          if (cookie.expires) {
            // expires is a Date object; convert to a second-level timestamp
            expirationDate = Math.floor(cookie.expires.getTime() / 1000);
          } else if (cookie.maxAge) {
            // maxAge is in seconds; calculate the expiration timestamp
            expirationDate = Math.floor(Date.now() / 1000) + cookie.maxAge;
          }

          // If neither is present, it is a session cookie; do not set expirationDate

          // Check if already expired
          if (expirationDate && expirationDate < Math.floor(Date.now() / 1000)) {
            await session.cookies.remove(request.url, cookie.name);
            continue;
          }

          await session.cookies.set({
            domain: cookie.domain,
            expirationDate,
            httpOnly: cookie.httpOnly,
            name: cookie.name,
            path: cookie.path,
            secure: cookie.secure,
            url: request.url,
            value: cookie.value,
          } as any);
        }
      } catch (e) {
        logger.error('Failed to set cookies', e);
      }

      if (debug) logger.debug(`Request processed: ${request.url}, status: ${response.status}`);
      return response;
    } catch (e) {
      if (debug) logger.error(`Error handling request: ${e}`);
      return new Response(e.message, { status: 500 });
    }
  };

  // Create the interceptor function
  const createInterceptor = ({ session }: { session: Session }) => {
    assert(session, 'Session is required');
    logger.debug(
      `Creating interceptor with session in ${isDev ? 'development' : 'production'} mode`,
    );

    const socket = new Socket();
    interceptorCount++; // Increment interceptor count

    const closeSocket = () => socket.end();

    process.on('SIGTERM', () => closeSocket);
    process.on('SIGINT', () => closeSocket);

    if (!registerProtocolHandle) {
      logger.debug(
        `Registering HTTP protocol handler in ${isDev ? 'development' : 'production'} mode`,
      );
      protocol.handle('http', async (request) => {
        if (!isDev) {
          // Check if this is a local file service request; if so, allow it through
          const isLocalhost = request.url.startsWith(localhostUrl);

          const url = new URL(request.url);
          const isLocalIP =
            request.url.startsWith('http://127.0.0.1:') ||
            request.url.startsWith('http://localhost:');
          const isLocalFileService = url.pathname.startsWith(LOCAL_STORAGE_URL_PREFIX + '/');

          const valid = isLocalhost || (isLocalIP && isLocalFileService);
          if (!valid) {
            throw new Error('External HTTP not supported, use HTTPS');
          }
        }

        return handleRequest(request, session, socket);
      });
      registerProtocolHandle = true;
    }

    logger.debug(`Active interceptors count: ${interceptorCount}`);

    return function stopIntercept() {
      interceptorCount--; // Decrement interceptor count
      logger.debug(`Stopping interceptor, remaining count: ${interceptorCount}`);

      // Only unregister the protocol handler when there are no active interceptors
      if (registerProtocolHandle && interceptorCount === 0) {
        logger.debug('Unregistering HTTP protocol handler (no active interceptors)');
        protocol.unhandle('http');
        registerProtocolHandle = false;
      }

      process.off('SIGTERM', () => closeSocket);
      process.off('SIGINT', () => closeSocket);
      closeSocket();
    };
  };

  return { createInterceptor, registerCustomHandler };
}
