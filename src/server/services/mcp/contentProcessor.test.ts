import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock external dependencies
vi.mock('debug', () => ({
  default: () => () => {},
}));

vi.mock('@/envs/app', () => ({
  appEnv: {
    APP_URL: 'https://example.com',
  },
}));

vi.mock('@/envs/file', () => ({
  fileEnv: {
    NEXT_PUBLIC_S3_FILE_PATH: 'files',
  },
}));

vi.mock('@/utils/uuid', () => ({
  nanoid: vi.fn(() => 'test-unique-id'),
}));

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

    it('should convert a text block to string', () => {
      const blocks = [{ type: 'text' as const, text: 'Hello World' }];
      expect(contentBlocksToString(blocks)).toBe('Hello World');
    });

    it('should convert an image block to markdown image syntax', () => {
      const blocks = [{ type: 'image' as const, data: '/image-url', mimeType: 'image/png' }];
      expect(contentBlocksToString(blocks)).toBe('![](https://example.com/image-url)');
    });

    it('should convert an audio block to resource tag', () => {
      const blocks = [{ type: 'audio' as const, data: '/audio-url', mimeType: 'audio/mp3' }];
      expect(contentBlocksToString(blocks)).toBe(
        '<resource type="audio" url="https://example.com/audio-url" />',
      );
    });

    it('should convert a resource block to resource tag with JSON content', () => {
      const blocks = [
        {
          type: 'resource' as const,
          resource: { uri: 'file://test.txt', text: 'content', mimeType: 'text/plain' },
        },
      ];
      const result = contentBlocksToString(blocks);
      expect(result).toContain('<resource type="resource">');
      expect(result).toContain('file://test.txt');
    });

    it('should return empty string for unknown block type', () => {
      const blocks = [{ type: 'unknown', data: 'some-data' }] as any;
      expect(contentBlocksToString(blocks)).toBe('');
    });

    it('should join multiple blocks with double newlines', () => {
      const blocks = [
        { type: 'text' as const, text: 'First' },
        { type: 'text' as const, text: 'Second' },
      ];
      expect(contentBlocksToString(blocks)).toBe('First\n\nSecond');
    });

    it('should filter out empty strings from unknown types', () => {
      const blocks = [
        { type: 'text' as const, text: 'Valid' },
        { type: 'unknown', data: 'ignored' },
        { type: 'text' as const, text: 'Also valid' },
      ] as any;
      expect(contentBlocksToString(blocks)).toBe('Valid\n\nAlso valid');
    });

    it('should handle mixed content types', () => {
      const blocks = [
        { type: 'text' as const, text: 'Description' },
        { type: 'image' as const, data: '/img.png', mimeType: 'image/png' },
        { type: 'audio' as const, data: '/audio.mp3', mimeType: 'audio/mp3' },
      ];
      const result = contentBlocksToString(blocks);
      expect(result).toContain('Description');
      expect(result).toContain('![](https://example.com/img.png)');
      expect(result).toContain('<resource type="audio" url="https://example.com/audio.mp3" />');
    });

    it('should handle resource_link block type (returns empty string)', () => {
      const blocks = [
        {
          type: 'resource_link' as const,
          uri: 'https://example.com',
          name: 'link',
        },
      ];
      // resource_link falls into default case, returns empty string, filtered out
      expect(contentBlocksToString(blocks)).toBe('');
    });
  });

  describe('processContentBlocks', () => {
    let mockFileService: { uploadBase64: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      vi.clearAllMocks();
      mockFileService = {
        uploadBase64: vi.fn(),
      };
    });

    it('should return empty array for empty blocks', async () => {
      const result = await processContentBlocks([], mockFileService as any);
      expect(result).toEqual([]);
      expect(mockFileService.uploadBase64).not.toHaveBeenCalled();
    });

    it('should pass through text blocks unchanged', async () => {
      const blocks = [{ type: 'text' as const, text: 'Hello' }];
      const result = await processContentBlocks(blocks, mockFileService as any);
      expect(result).toEqual(blocks);
      expect(mockFileService.uploadBase64).not.toHaveBeenCalled();
    });

    it('should upload image block and replace data with URL', async () => {
      const proxyUrl = 'https://storage.example.com/files/mcp/images/2025-11-08/test-unique-id.png';
      mockFileService.uploadBase64.mockResolvedValue({ url: proxyUrl });

      const blocks = [
        { type: 'image' as const, data: 'base64imagedata==', mimeType: 'image/png' },
      ];

      const result = await processContentBlocks(blocks, mockFileService as any);

      expect(result).toHaveLength(1);
      expect((result[0] as any).data).toBe(proxyUrl);
      expect(result[0].type).toBe('image');
      expect(mockFileService.uploadBase64).toHaveBeenCalledOnce();
      expect(mockFileService.uploadBase64).toHaveBeenCalledWith(
        'base64imagedata==',
        expect.stringContaining('mcp/images'),
      );
    });

    it('should upload audio block and replace data with URL', async () => {
      const proxyUrl = 'https://storage.example.com/files/mcp/audio/2025-11-08/test-unique-id.mp3';
      mockFileService.uploadBase64.mockResolvedValue({ url: proxyUrl });

      const blocks = [
        { type: 'audio' as const, data: 'base64audiodata==', mimeType: 'audio/mp3' },
      ];

      const result = await processContentBlocks(blocks, mockFileService as any);

      expect(result).toHaveLength(1);
      expect((result[0] as any).data).toBe(proxyUrl);
      expect(result[0].type).toBe('audio');
      expect(mockFileService.uploadBase64).toHaveBeenCalledOnce();
      expect(mockFileService.uploadBase64).toHaveBeenCalledWith(
        'base64audiodata==',
        expect.stringContaining('mcp/audio'),
      );
    });

    it('should use correct file extension from mimeType for images', async () => {
      mockFileService.uploadBase64.mockResolvedValue({ url: 'https://example.com/file.jpeg' });

      const blocks = [
        { type: 'image' as const, data: 'base64data==', mimeType: 'image/jpeg' },
      ];

      await processContentBlocks(blocks, mockFileService as any);

      const callArg = mockFileService.uploadBase64.mock.calls[0][1] as string;
      expect(callArg).toMatch(/\.jpeg$/);
    });

    it('should use correct file extension from mimeType for audio', async () => {
      mockFileService.uploadBase64.mockResolvedValue({ url: 'https://example.com/file.wav' });

      const blocks = [
        { type: 'audio' as const, data: 'base64data==', mimeType: 'audio/wav' },
      ];

      await processContentBlocks(blocks, mockFileService as any);

      const callArg = mockFileService.uploadBase64.mock.calls[0][1] as string;
      expect(callArg).toMatch(/\.wav$/);
    });

    it('should use png as fallback extension for image with no subtype', async () => {
      mockFileService.uploadBase64.mockResolvedValue({ url: 'https://example.com/file.png' });

      const blocks = [
        { type: 'image' as const, data: 'base64data==', mimeType: 'image' },
      ];

      await processContentBlocks(blocks, mockFileService as any);

      const callArg = mockFileService.uploadBase64.mock.calls[0][1] as string;
      expect(callArg).toMatch(/\.png$/);
    });

    it('should use mp3 as fallback extension for audio with no subtype', async () => {
      mockFileService.uploadBase64.mockResolvedValue({ url: 'https://example.com/file.mp3' });

      const blocks = [
        { type: 'audio' as const, data: 'base64data==', mimeType: 'audio' },
      ];

      await processContentBlocks(blocks, mockFileService as any);

      const callArg = mockFileService.uploadBase64.mock.calls[0][1] as string;
      expect(callArg).toMatch(/\.mp3$/);
    });

    it('should include date-based sharding in the upload path', async () => {
      mockFileService.uploadBase64.mockResolvedValue({ url: 'https://example.com/img.png' });

      const blocks = [
        { type: 'image' as const, data: 'data==', mimeType: 'image/png' },
      ];

      await processContentBlocks(blocks, mockFileService as any);

      const callArg = mockFileService.uploadBase64.mock.calls[0][1] as string;
      // Path should contain date-based sharding in YYYY-MM-DD format
      expect(callArg).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should process multiple blocks in parallel', async () => {
      const imageUrl = 'https://example.com/image.png';
      const audioUrl = 'https://example.com/audio.mp3';
      mockFileService.uploadBase64
        .mockResolvedValueOnce({ url: imageUrl })
        .mockResolvedValueOnce({ url: audioUrl });

      const blocks = [
        { type: 'image' as const, data: 'imagedata==', mimeType: 'image/png' },
        { type: 'audio' as const, data: 'audiodata==', mimeType: 'audio/mp3' },
      ];

      const result = await processContentBlocks(blocks, mockFileService as any);

      expect(result).toHaveLength(2);
      expect((result[0] as any).data).toBe(imageUrl);
      expect((result[1] as any).data).toBe(audioUrl);
      expect(mockFileService.uploadBase64).toHaveBeenCalledTimes(2);
    });

    it('should pass through resource blocks unchanged', async () => {
      const blocks = [
        {
          type: 'resource' as const,
          resource: { uri: 'file://test.txt', text: 'content', mimeType: 'text/plain' },
        },
      ];

      const result = await processContentBlocks(blocks, mockFileService as any);

      expect(result).toEqual(blocks);
      expect(mockFileService.uploadBase64).not.toHaveBeenCalled();
    });

    it('should preserve other block properties when uploading image', async () => {
      const proxyUrl = 'https://storage.example.com/img.png';
      mockFileService.uploadBase64.mockResolvedValue({ url: proxyUrl });

      const blocks = [
        {
          type: 'image' as const,
          data: 'base64data==',
          mimeType: 'image/png',
          _meta: { custom: 'metadata' },
        },
      ];

      const result = await processContentBlocks(blocks, mockFileService as any);

      expect(result[0]).toMatchObject({
        type: 'image',
        mimeType: 'image/png',
        _meta: { custom: 'metadata' },
        data: proxyUrl,
      });
    });

    it('should use S3 file path prefix in upload pathname', async () => {
      mockFileService.uploadBase64.mockResolvedValue({ url: 'https://example.com/img.png' });

      const blocks = [
        { type: 'image' as const, data: 'data==', mimeType: 'image/png' },
      ];

      await processContentBlocks(blocks, mockFileService as any);

      const callArg = mockFileService.uploadBase64.mock.calls[0][1] as string;
      expect(callArg).toMatch(/^files\//);
    });
  });
});
