/**
 * Converts an async iterator into a JSON-formatted ReadableStream
 */
export const createModelPullStream = <
  T extends { completed?: number; digest?: string; status: string; total?: number },
>(
  iterable: AsyncIterable<T>,
  model: string,
  {
    onCancel, // callback to invoke on cancel
  }: {
    onCancel?: (reason?: any) => void; // callback signature
  } = {},
): ReadableStream => {
  let iterator: AsyncIterator<T>; // tracked outside so we can call return() on cancel

  return new ReadableStream({
    // implement cancel method
    cancel(reason) {
      // invoke the onCancel callback to perform external cleanup (e.g. client.abort())
      if (onCancel) {
        onCancel(reason);
      }

      // attempt to gracefully terminate the iterator
      // NOTE: this depends on whether the AsyncIterable implementation supports return/throw
      if (iterator && typeof iterator.return === 'function') {
        // no need to await — let cleanup run in the background
        iterator.return().catch();
      }
    },
    async start(controller) {
      iterator = iterable[Symbol.asyncIterator](); // get the iterator

      const encoder = new TextEncoder();

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          // wait for the next chunk or iteration completion
          const { value: progress, done } = await iterator.next();

          // if iteration is complete, break out of the loop
          if (done) {
            break;
          }

          // skip 'pulling manifest' status because it contains no progress
          if (progress.status === 'pulling manifest') continue;

          // format as standard shape and write to stream
          const progressData =
            JSON.stringify({
              completed: progress.completed,
              digest: progress.digest,
              model,
              status: progress.status,
              total: progress.total,
            }) + '\n';

          controller.enqueue(encoder.encode(progressData));
        }

        // completed normally
        controller.close();
      } catch (error) {
        // handle errors

        // if the error was caused by an abort, silently handle or log it, then try to close the stream
        if (error instanceof DOMException && error.name === 'AbortError') {
          // no need to enqueue an error message since the connection may already be closed
          // try to close normally; if already cancelled, the controller may be closed or errored
          try {
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ status: 'cancelled' })));
            controller.close();
          } catch {
            // ignore close errors — the stream may already have been handled by the cancel mechanism
          }
        } else {
          console.error('[createModelPullStream] model download stream error:', error);
          // for other errors, try to send error information to the client
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorData =
            JSON.stringify({
              error: errorMessage,
              model,
              status: 'error',
            }) + '\n';

          try {
            // only enqueue if the stream is still expecting data
            if (controller.desiredSize !== null && controller.desiredSize > 0) {
              controller.enqueue(encoder.encode(errorData));
            }
          } catch (enqueueError) {
            console.error('[createModelPullStream] Error enqueueing error message:', enqueueError);
            // if this also fails, the connection is most likely already closed
          }

          // try to close the stream or mark it as errored
          try {
            controller.close(); // try to close normally
          } catch {
            controller.error(error); // if closing fails, put the stream into an error state
          }
        }
      }
    },
  });
};
