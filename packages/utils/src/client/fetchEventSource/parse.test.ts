import { describe, expect, it, vi } from 'vitest';

import { type EventSourceMessage, getBytes, getLines, getMessages } from './parse';

describe('fetchEventSource/parse', () => {
  describe('getBytes', () => {
    it('should read all chunks from a ReadableStream and call onChunk for each', async () => {
      const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5]), new Uint8Array([6])];
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
          controller.close();
        },
      });

      const received: Uint8Array[] = [];
      await getBytes(stream, (arr) => received.push(arr));

      expect(received).toHaveLength(3);
      expect(received[0]).toEqual(new Uint8Array([1, 2, 3]));
      expect(received[1]).toEqual(new Uint8Array([4, 5]));
      expect(received[2]).toEqual(new Uint8Array([6]));
    });

    it('should resolve without calling onChunk for an empty stream', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

      const onChunk = vi.fn();
      await getBytes(stream, onChunk);

      expect(onChunk).not.toHaveBeenCalled();
    });

    it('should call onChunk once for a single-chunk stream', async () => {
      const chunk = new Uint8Array([10, 20, 30]);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(chunk);
          controller.close();
        },
      });

      const onChunk = vi.fn();
      await getBytes(stream, onChunk);

      expect(onChunk).toHaveBeenCalledOnce();
      expect(onChunk).toHaveBeenCalledWith(chunk);
    });
  });

  describe('getLines', () => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    it('should parse a line terminated with \\n', () => {
      const received: Array<[string, number]> = [];
      const onChunk = getLines((line, fieldLength) => {
        received.push([decoder.decode(line), fieldLength]);
      });

      onChunk(encoder.encode('data: hello\n'));

      expect(received).toHaveLength(1);
      expect(received[0][0]).toBe('data: hello');
      expect(received[0][1]).toBe(4); // length of 'data'
    });

    it('should parse a line terminated with \\r', () => {
      const received: Array<[string, number]> = [];
      const onChunk = getLines((line, fieldLength) => {
        received.push([decoder.decode(line), fieldLength]);
      });

      onChunk(encoder.encode('event: message\r'));

      expect(received).toHaveLength(1);
      expect(received[0][0]).toBe('event: message');
      expect(received[0][1]).toBe(5); // length of 'event'
    });

    it('should parse a line terminated with \\r\\n and discard trailing newline', () => {
      const received: Array<[string, number]> = [];
      const onChunk = getLines((line, fieldLength) => {
        received.push([decoder.decode(line), fieldLength]);
      });

      onChunk(encoder.encode('id: 42\r\n'));

      expect(received).toHaveLength(1);
      expect(received[0][0]).toBe('id: 42');
      expect(received[0][1]).toBe(2); // length of 'id'
    });

    it('should parse multiple lines in a single chunk', () => {
      const received: string[] = [];
      const onChunk = getLines((line) => received.push(decoder.decode(line)));

      onChunk(encoder.encode('data: first\ndata: second\n'));

      expect(received).toHaveLength(2);
      expect(received[0]).toBe('data: first');
      expect(received[1]).toBe('data: second');
    });

    it('should buffer a line that spans two chunks', () => {
      const received: string[] = [];
      const onChunk = getLines((line) => received.push(decoder.decode(line)));

      onChunk(encoder.encode('data: hel'));
      expect(received).toHaveLength(0); // no complete line yet

      onChunk(encoder.encode('lo\n'));
      expect(received).toHaveLength(1);
      expect(received[0]).toBe('data: hello');
    });

    it('should handle empty lines (message separator)', () => {
      const received: Array<[number, number]> = [];
      const onChunk = getLines((line, fieldLength) => {
        received.push([line.length, fieldLength]);
      });

      onChunk(encoder.encode('\n'));

      expect(received).toHaveLength(1);
      expect(received[0][0]).toBe(0); // empty line
      expect(received[0][1]).toBe(-1); // no colon
    });

    it('should set fieldLength to -1 for lines without a colon', () => {
      const received: number[] = [];
      const onChunk = getLines((_, fieldLength) => received.push(fieldLength));

      onChunk(encoder.encode('nocolon\n'));

      expect(received).toHaveLength(1);
      expect(received[0]).toBe(-1);
    });

    it('should record fieldLength only for the first colon in the line', () => {
      const received: number[] = [];
      const onChunk = getLines((_, fieldLength) => received.push(fieldLength));

      onChunk(encoder.encode('data: a:b:c\n'));

      expect(received).toHaveLength(1);
      expect(received[0]).toBe(4); // only the first colon counts
    });

    it('should handle mixed line endings in one chunk', () => {
      const received: string[] = [];
      const onChunk = getLines((line) => received.push(decoder.decode(line)));

      onChunk(encoder.encode('data: a\ndata: b\r\ndata: c\r'));

      expect(received).toHaveLength(3);
      expect(received[0]).toBe('data: a');
      expect(received[1]).toBe('data: b');
      expect(received[2]).toBe('data: c');
    });

    it('should handle a line whose \\r\\n boundary spans two chunks', () => {
      const received: string[] = [];
      const onChunk = getLines((line) => received.push(decoder.decode(line)));

      // \r ends first chunk, \n starts second
      onChunk(encoder.encode('data: test\r'));
      onChunk(encoder.encode('\ndata: next\n'));

      expect(received).toHaveLength(2);
      expect(received[0]).toBe('data: test');
      expect(received[1]).toBe('data: next');
    });
  });

  describe('getMessages', () => {
    const encoder = new TextEncoder();

    it('should dispatch a message when an empty line is received', () => {
      const onMessage = vi.fn();
      const onLine = getMessages(vi.fn(), onMessage);

      onLine(encoder.encode('data: hello'), 4);
      onLine(new Uint8Array(0), -1); // empty line

      expect(onMessage).toHaveBeenCalledOnce();
      const msg = onMessage.mock.calls[0][0] as EventSourceMessage;
      expect(msg.data).toBe('hello');
    });

    it('should parse data field with space after colon', () => {
      const onMessage = vi.fn();
      const onLine = getMessages(vi.fn(), onMessage);

      onLine(encoder.encode('data: value'), 4);
      onLine(new Uint8Array(0), -1);

      const msg = onMessage.mock.calls[0][0] as EventSourceMessage;
      expect(msg.data).toBe('value');
    });

    it('should parse data field without space after colon', () => {
      const onMessage = vi.fn();
      const onLine = getMessages(vi.fn(), onMessage);

      onLine(encoder.encode('data:value'), 4);
      onLine(new Uint8Array(0), -1);

      const msg = onMessage.mock.calls[0][0] as EventSourceMessage;
      expect(msg.data).toBe('value');
    });

    it('should append multiple data lines with newline separator', () => {
      const onMessage = vi.fn();
      const onLine = getMessages(vi.fn(), onMessage);

      onLine(encoder.encode('data: line1'), 4);
      onLine(encoder.encode('data: line2'), 4);
      onLine(encoder.encode('data: line3'), 4);
      onLine(new Uint8Array(0), -1);

      const msg = onMessage.mock.calls[0][0] as EventSourceMessage;
      expect(msg.data).toBe('line1\nline2\nline3');
    });

    it('should set the event field', () => {
      const onMessage = vi.fn();
      const onLine = getMessages(vi.fn(), onMessage);

      onLine(encoder.encode('event: myEvent'), 5);
      onLine(new Uint8Array(0), -1);

      const msg = onMessage.mock.calls[0][0] as EventSourceMessage;
      expect(msg.event).toBe('myEvent');
    });

    it('should set the id field and call onId callback', () => {
      const onId = vi.fn();
      const onMessage = vi.fn();
      const onLine = getMessages(onId, onMessage);

      onLine(encoder.encode('id: 123'), 2);
      onLine(new Uint8Array(0), -1);

      expect(onId).toHaveBeenCalledWith('123');
      const msg = onMessage.mock.calls[0][0] as EventSourceMessage;
      expect(msg.id).toBe('123');
    });

    it('should ignore comment lines (fieldLength === 0)', () => {
      const onMessage = vi.fn();
      const onLine = getMessages(vi.fn(), onMessage);

      onLine(encoder.encode(': this is a comment'), 0);
      onLine(new Uint8Array(0), -1);

      const msg = onMessage.mock.calls[0][0] as EventSourceMessage;
      expect(msg.data).toBe('');
      expect(msg.event).toBe('');
      expect(msg.id).toBe('');
    });

    it('should ignore lines with no colon (fieldLength === -1, non-empty)', () => {
      const onMessage = vi.fn();
      const onLine = getMessages(vi.fn(), onMessage);

      onLine(encoder.encode('nocolon'), -1);
      onLine(new Uint8Array(0), -1);

      const msg = onMessage.mock.calls[0][0] as EventSourceMessage;
      expect(msg.data).toBe('');
    });

    it('should reset message state after each dispatch', () => {
      const messages: EventSourceMessage[] = [];
      const onLine = getMessages(vi.fn(), (msg) => messages.push(msg));

      onLine(encoder.encode('data: first'), 4);
      onLine(new Uint8Array(0), -1);

      onLine(encoder.encode('event: update'), 5);
      onLine(encoder.encode('data: second'), 4);
      onLine(new Uint8Array(0), -1);

      expect(messages).toHaveLength(2);
      expect(messages[0].data).toBe('first');
      expect(messages[0].event).toBe('');
      expect(messages[1].data).toBe('second');
      expect(messages[1].event).toBe('update');
    });

    it('should handle a full SSE message with all standard fields', () => {
      const onId = vi.fn();
      const messages: EventSourceMessage[] = [];
      const onLine = getMessages(onId, (msg) => messages.push(msg));

      onLine(encoder.encode('id: 1'), 2);
      onLine(encoder.encode('event: update'), 5);
      onLine(encoder.encode('data: {"key":"value"}'), 4);
      onLine(new Uint8Array(0), -1);

      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('1');
      expect(messages[0].event).toBe('update');
      expect(messages[0].data).toBe('{"key":"value"}');
      expect(onId).toHaveBeenCalledWith('1');
    });

    it('should not throw when onMessage is not provided', () => {
      const onLine = getMessages(vi.fn());

      onLine(encoder.encode('data: test'), 4);
      expect(() => onLine(new Uint8Array(0), -1)).not.toThrow();
    });

    it('should dispatch an empty message for consecutive empty lines', () => {
      const onMessage = vi.fn();
      const onLine = getMessages(vi.fn(), onMessage);

      onLine(new Uint8Array(0), -1);
      onLine(new Uint8Array(0), -1);

      expect(onMessage).toHaveBeenCalledTimes(2);
    });

    it('should handle multiple independent messages in sequence', () => {
      const messages: EventSourceMessage[] = [];
      const onLine = getMessages(vi.fn(), (msg) => messages.push(msg));

      for (let i = 1; i <= 3; i++) {
        onLine(encoder.encode(`data: msg${i}`), 4);
        onLine(new Uint8Array(0), -1);
      }

      expect(messages).toHaveLength(3);
      expect(messages[0].data).toBe('msg1');
      expect(messages[1].data).toBe('msg2');
      expect(messages[2].data).toBe('msg3');
    });
  });

  describe('getLines + getMessages integration', () => {
    it('should correctly parse a complete SSE stream end-to-end', () => {
      const messages: EventSourceMessage[] = [];
      const onId = vi.fn();
      const onLine = getMessages(onId, (msg) => messages.push(msg));
      const onChunk = getLines(onLine);

      const encoder = new TextEncoder();
      const sseStream =
        'id: 1\nevent: update\ndata: hello world\n\nid: 2\ndata: second message\n\n';

      onChunk(encoder.encode(sseStream));

      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe('1');
      expect(messages[0].event).toBe('update');
      expect(messages[0].data).toBe('hello world');
      expect(messages[1].id).toBe('2');
      expect(messages[1].data).toBe('second message');
      expect(onId).toHaveBeenCalledTimes(2);
    });

    it('should handle stream data arriving in small byte-by-byte chunks', () => {
      const messages: EventSourceMessage[] = [];
      const onLine = getMessages(vi.fn(), (msg) => messages.push(msg));
      const onChunk = getLines(onLine);

      const encoder = new TextEncoder();
      const text = 'data: chunked\n\n';
      const bytes = encoder.encode(text);

      for (const byte of bytes) {
        onChunk(new Uint8Array([byte]));
      }

      expect(messages).toHaveLength(1);
      expect(messages[0].data).toBe('chunked');
    });

    it('should handle multi-line data fields across chunks', () => {
      const messages: EventSourceMessage[] = [];
      const onLine = getMessages(vi.fn(), (msg) => messages.push(msg));
      const onChunk = getLines(onLine);

      const encoder = new TextEncoder();
      onChunk(encoder.encode('data: line1\ndata: line2\n\n'));

      expect(messages).toHaveLength(1);
      expect(messages[0].data).toBe('line1\nline2');
    });
  });
});
