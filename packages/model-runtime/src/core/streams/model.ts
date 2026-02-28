/**
 * Convert an async iterator to a JSON-formatted ReadableStream
 */
export const createModelPullStream = <
  T extends { completed?: number; digest?: string; status: string; total?: number },
>(
  iterable: AsyncIterable<T>,
  model: string,
  {
    onCancel, // New: callback function to invoke on cancellation
  }: {
    onCancel?: (reason?: any) => void; // Callback function signature
  } = {},
): ReadableStream => {
  let iterator: AsyncIterator<T>; // Track the iterator externally so that return can be called on cancellation

  return new ReadableStream({
    // Implement the cancel method
    cancel(reason) {
      // Call the provided onCancel callback to execute external cleanup logic (e.g. client.abort())
      if (onCancel) {
        onCancel(reason);
      }

      // Try to gracefully terminate the iterator
      // Note: this depends on whether the AsyncIterable implementation supports return/throw
      if (iterator && typeof iterator.return === 'function') {
        // No need to await, let it perform cleanup in the background
        iterator.return().catch();
      }
    },
    async start(controller) {
      iterator = iterable[Symbol.asyncIterator](); // Get the iterator

      const encoder = new TextEncoder();

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          // Wait for the next data chunk or iteration completion
          const { value: progress, done } = await iterator.next();

          // If iteration is complete, break out of the loop
          if (done) {
            break;
          }

          // Ignore 'pulling manifest' status as it does not contain progress
          if (progress.status === 'pulling manifest') continue;

          // Format to standard format and write to stream
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

        // Normal completion
        controller.close();
      } catch (error) {
        // Handle errors

        // If the error is caused by an abort operation, silently handle or log it, then try to close the stream
        if (error instanceof DOMException && error.name === 'AbortError') {
          // No need to enqueue error message, as the connection may already be disconnected
          // Try to close normally; if already cancelled, the controller may already be closed or in error
          try {
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ status: 'cancelled' })));
            controller.close();
          } catch {
            // Ignore close errors; the stream may already have been handled by the cancellation mechanism
          }
        } else {
          console.error('[createModelPullStream] model download stream error:', error);
          // For other errors, try to send the error message to the client
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorData =
            JSON.stringify({
              error: errorMessage,
              model,
              status: 'error',
            }) + '\n';

          try {
            // Only try to enqueue when the stream is still expecting data
            if (controller.desiredSize !== null && controller.desiredSize > 0) {
              controller.enqueue(encoder.encode(errorData));
            }
          } catch (enqueueError) {
            console.error('[createModelPullStream] Error enqueueing error message:', enqueueError);
            // If this also fails, the connection is most likely disconnected
          }

          // Try to close the stream or mark it as an error state
          try {
            controller.close(); // Try to close normally
          } catch {
            controller.error(error); // If close fails, put the stream into an error state
          }
        }
      }
    },
  });
};
