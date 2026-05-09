import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/envs/app', () => ({
  appEnv: { APP_URL: 'https://app.example.com' },
}));

vi.mock('@/envs/file', () => ({
  fileEnv: { NEXT_PUBLIC_S3_FILE_PATH: 'files' },
}));

vi.mock('@/utils/uuid', () => ({
  nanoid: vi.fn(() => 'mock-nanoid'),
}));

vi.mock('debug', () => ({
  default: vi.fn(() => vi.fn()),
}));

import { AudioContent, ImageContent, ToolCallContent } from '@/libs/mcp';

import { contentBlocksToString, processContentBlocks } from './contentProcessor';

describe('contentProcessor', () => {
  describe('contentBlocksToString', () => {
    it('should return empty string for null input', () => {
      expect(contentBlocksToString(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(contentBlocksToString(undefined)).toBe('');
    });

    it('should return empty string for empty array', () => {
      expect(contentBlocksToString([])).toBe('');
    });

    it('should extract text from text blocks', () => {
      const blocks = [{ type: 'text' as const, text: 'Hello World' }];

      expect(contentBlocksToString(blocks)).toBe('Hello World');
    });

    it('should join multiple text blocks with double newlines', () => {
      const blocks = [
        { type: 'text' as const, text: 'First' },
        { type: 'text' as const, text: 'Second' },
      ];

      expect(contentBlocksToString(blocks)).toBe('First\n\nSecond');
    });

    it('should format image blocks as markdown images using APP_URL', () => {
      const blocks = [
        {
          type: 'image' as const,
          mimeType: 'image/png',
          data: '/path/to/image.png',
        },
      ];

      const result = contentBlocksToString(blocks);

      expect(result).toBe('![](https://app.example.com/path/to/image.png)');
    });

    it('should format audio blocks as resource elements', () => {
      const blocks = [
        {
          type: 'audio' as const,
          mimeType: 'audio/mp3',
          data: '/audio/file.mp3',
        },
      ];

      const result = contentBlocksToString(blocks);

      expect(result).toBe(
        '<resource type="audio" url="https://app.example.com/audio/file.mp3" />',
      );
    });

    it('should format resource blocks with JSON content', () => {
      const resourceData = { uri: 'file:///example.txt', mimeType: 'text/plain', text: 'content' };
      const blocks = [
        {
          type: 'resource' as const,
          resource: resourceData,
        },
      ];

      const result = contentBlocksToString(blocks);

      expect(result).toBe(
        `<resource type="resource">${JSON.stringify(resourceData)}</resource>}`,
      );
    });

    it('should return empty string for unknown block types', () => {
      const blocks = [{ type: 'unknown', data: 'something' } as unknown as ToolCallContent];

      expect(contentBlocksToString(blocks)).toBe('');
    });

    it('should filter out empty values and join with double newlines', () => {
      const blocks = [
        { type: 'text' as const, text: 'First' },
        { type: 'unknown' } as unknown as ToolCallContent,
        { type: 'text' as const, text: 'Third' },
      ] as ToolCallContent[];

      expect(contentBlocksToString(blocks)).toBe('First\n\nThird');
    });

    it('should handle mixed block types', () => {
      const blocks = [
        { type: 'text' as const, text: 'Description' },
        { type: 'image' as const, mimeType: 'image/jpeg', data: '/img/photo.jpg' },
      ];

      const result = contentBlocksToString(blocks);

      expect(result).toBe(
        'Description\n\n![](https://app.example.com/img/photo.jpg)',
      );
    });
  });

  describe('processContentBlocks', () => {
    let mockFileService: any;

    beforeEach(() => {
      mockFileService = {
        uploadBase64: vi.fn(),
      };
    });

    it('should return unchanged non-image/audio blocks', async () => {
      const blocks = [{ type: 'text' as const, text: 'Hello' }];

      const result = await processContentBlocks(blocks, mockFileService);

      expect(result).toEqual(blocks);
      expect(mockFileService.uploadBase64).not.toHaveBeenCalled();
    });

    it('should upload image blocks and replace data with URL', async () => {
      const imageBlock = {
        type: 'image' as const,
        mimeType: 'image/png',
        data: 'base64encodedimagedata',
      };
      mockFileService.uploadBase64.mockResolvedValue({
        url: 'https://storage.example.com/mcp/images/2026-05-09/mock-nanoid.png',
      });

      const result = await processContentBlocks([imageBlock], mockFileService);

      expect(mockFileService.uploadBase64).toHaveBeenCalledWith(
        'base64encodedimagedata',
        expect.stringContaining('mcp/images'),
      );
      expect((result[0] as ImageContent).data).toBe(
        'https://storage.example.com/mcp/images/2026-05-09/mock-nanoid.png',
      );
      expect(result[0].type).toBe('image');
    });

    it('should upload audio blocks and replace data with URL', async () => {
      const audioBlock = {
        type: 'audio' as const,
        mimeType: 'audio/mp3',
        data: 'base64encodedaudiodata',
      };
      mockFileService.uploadBase64.mockResolvedValue({
        url: 'https://storage.example.com/mcp/audio/2026-05-09/mock-nanoid.mp3',
      });

      const result = await processContentBlocks([audioBlock], mockFileService);

      expect(mockFileService.uploadBase64).toHaveBeenCalledWith(
        'base64encodedaudiodata',
        expect.stringContaining('mcp/audio'),
      );
      expect((result[0] as AudioContent).data).toBe(
        'https://storage.example.com/mcp/audio/2026-05-09/mock-nanoid.mp3',
      );
      expect(result[0].type).toBe('audio');
    });

    it('should extract file extension from image mimeType', async () => {
      const imageBlock = {
        type: 'image' as const,
        mimeType: 'image/webp',
        data: 'base64data',
      };
      mockFileService.uploadBase64.mockResolvedValue({ url: 'https://example.com/img.webp' });

      await processContentBlocks([imageBlock], mockFileService);

      expect(mockFileService.uploadBase64).toHaveBeenCalledWith(
        'base64data',
        expect.stringMatching(/\.webp$/),
      );
    });

    it('should use "png" as default extension when image mimeType has no subtype', async () => {
      const imageBlock = {
        type: 'image' as const,
        mimeType: 'image/',
        data: 'base64data',
      };
      mockFileService.uploadBase64.mockResolvedValue({ url: 'https://example.com/img.png' });

      await processContentBlocks([imageBlock], mockFileService);

      expect(mockFileService.uploadBase64).toHaveBeenCalledWith(
        'base64data',
        expect.stringMatching(/\.png$/),
      );
    });

    it('should use "mp3" as default extension when audio mimeType has no subtype', async () => {
      const audioBlock = {
        type: 'audio' as const,
        mimeType: 'audio/',
        data: 'base64data',
      };
      mockFileService.uploadBase64.mockResolvedValue({ url: 'https://example.com/audio.mp3' });

      await processContentBlocks([audioBlock], mockFileService);

      expect(mockFileService.uploadBase64).toHaveBeenCalledWith(
        'base64data',
        expect.stringMatching(/\.mp3$/),
      );
    });

    it('should handle empty blocks array', async () => {
      const result = await processContentBlocks([], mockFileService);

      expect(result).toEqual([]);
      expect(mockFileService.uploadBase64).not.toHaveBeenCalled();
    });

    it('should process multiple blocks in parallel', async () => {
      const blocks = [
        { type: 'image' as const, mimeType: 'image/png', data: 'img1data' },
        { type: 'audio' as const, mimeType: 'audio/wav', data: 'audio1data' },
        { type: 'text' as const, text: 'plain text' },
      ];
      mockFileService.uploadBase64
        .mockResolvedValueOnce({ url: 'https://storage.example.com/img1.png' })
        .mockResolvedValueOnce({ url: 'https://storage.example.com/audio1.wav' });

      const result = await processContentBlocks(blocks, mockFileService);

      expect(mockFileService.uploadBase64).toHaveBeenCalledTimes(2);
      expect((result[0] as ImageContent).data).toBe('https://storage.example.com/img1.png');
      expect((result[1] as AudioContent).data).toBe('https://storage.example.com/audio1.wav');
      expect(result[2]).toEqual({ type: 'text', text: 'plain text' });
    });
  });
});
