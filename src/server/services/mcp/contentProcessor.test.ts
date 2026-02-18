import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external dependencies before imports
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
  nanoid: vi.fn(() => 'test-nanoid'),
}));

vi.mock('debug', () => ({
  default: vi.fn(() => vi.fn()),
}));

import { contentBlocksToString, processContentBlocks } from './contentProcessor';
import type { ToolCallContent } from '@/libs/mcp';

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

    it('should extract text from text block', () => {
      const blocks: ToolCallContent[] = [{ type: 'text', text: 'Hello World' }];
      expect(contentBlocksToString(blocks)).toBe('Hello World');
    });

    it('should join multiple text blocks with double newlines', () => {
      const blocks: ToolCallContent[] = [
        { type: 'text', text: 'First' },
        { type: 'text', text: 'Second' },
      ];
      expect(contentBlocksToString(blocks)).toBe('First\n\nSecond');
    });

    it('should format image block as markdown image with APP_URL prefix', () => {
      const blocks: ToolCallContent[] = [
        { type: 'image', data: '/path/to/image.png', mimeType: 'image/png' },
      ];
      expect(contentBlocksToString(blocks)).toBe('![](https://example.com/path/to/image.png)');
    });

    it('should format audio block as resource element with APP_URL prefix', () => {
      const blocks: ToolCallContent[] = [
        { type: 'audio', data: '/path/to/audio.mp3', mimeType: 'audio/mp3' },
      ];
      expect(contentBlocksToString(blocks)).toBe(
        '<resource type="audio" url="https://example.com/path/to/audio.mp3" />',
      );
    });

    it('should format resource block as resource element with JSON content', () => {
      const blocks: ToolCallContent[] = [
        {
          type: 'resource',
          resource: { uri: 'file:///some/resource', text: 'resource text' },
        },
      ];
      const result = contentBlocksToString(blocks);
      expect(result).toContain('<resource type="resource">');
      expect(result).toContain(JSON.stringify({ uri: 'file:///some/resource', text: 'resource text' }));
    });

    it('should return empty string for unknown block types', () => {
      const blocks = [{ type: 'unknown' }] as any;
      expect(contentBlocksToString(blocks)).toBe('');
    });

    it('should filter out empty strings from unknown types', () => {
      const blocks: ToolCallContent[] = [
        { type: 'text', text: 'Hello' },
        { type: 'resource_link', uri: 'http://example.com', name: 'link' } as any,
        { type: 'text', text: 'World' },
      ];
      // resource_link returns '' so it should be filtered
      expect(contentBlocksToString(blocks)).toBe('Hello\n\nWorld');
    });

    it('should handle mixed content types', () => {
      const blocks: ToolCallContent[] = [
        { type: 'text', text: 'Check this image:' },
        { type: 'image', data: '/img.jpg', mimeType: 'image/jpeg' },
      ];
      const result = contentBlocksToString(blocks);
      expect(result).toBe('Check this image:\n\n![](https://example.com/img.jpg)');
    });
  });

  describe('processContentBlocks', () => {
    let mockFileService: any;

    beforeEach(() => {
      mockFileService = {
        uploadBase64: vi.fn(),
      };
    });

    it('should return empty array for empty input', async () => {
      const result = await processContentBlocks([], mockFileService);
      expect(result).toEqual([]);
    });

    it('should pass through text blocks unchanged', async () => {
      const blocks: ToolCallContent[] = [{ type: 'text', text: 'Hello' }];
      const result = await processContentBlocks(blocks, mockFileService);
      expect(result).toEqual(blocks);
      expect(mockFileService.uploadBase64).not.toHaveBeenCalled();
    });

    it('should pass through resource blocks unchanged', async () => {
      const blocks: ToolCallContent[] = [
        {
          type: 'resource',
          resource: { uri: 'file:///some/resource', text: 'resource text' },
        },
      ];
      const result = await processContentBlocks(blocks, mockFileService);
      expect(result).toEqual(blocks);
      expect(mockFileService.uploadBase64).not.toHaveBeenCalled();
    });

    it('should upload image block and replace data with URL', async () => {
      const proxyUrl = 'https://storage.example.com/files/mcp/images/2026-02-18/test-nanoid.png';
      mockFileService.uploadBase64.mockResolvedValue({ url: proxyUrl });

      const blocks: ToolCallContent[] = [
        { type: 'image', data: 'base64encodedimagedata', mimeType: 'image/png' },
      ];

      const result = await processContentBlocks(blocks, mockFileService);

      expect(mockFileService.uploadBase64).toHaveBeenCalledOnce();
      expect(mockFileService.uploadBase64).toHaveBeenCalledWith(
        'base64encodedimagedata',
        expect.stringContaining('mcp/images'),
      );
      expect(result[0]).toMatchObject({ type: 'image', data: proxyUrl });
    });

    it('should extract correct file extension from image mimeType', async () => {
      mockFileService.uploadBase64.mockResolvedValue({ url: 'https://storage.example.com/img.jpeg' });

      const blocks: ToolCallContent[] = [
        { type: 'image', data: 'base64data', mimeType: 'image/jpeg' },
      ];

      await processContentBlocks(blocks, mockFileService);

      const calledPath = mockFileService.uploadBase64.mock.calls[0][1] as string;
      expect(calledPath).toMatch(/\.jpeg$/);
    });

    it('should use png as default extension when image mimeType has no subtype', async () => {
      mockFileService.uploadBase64.mockResolvedValue({ url: 'https://storage.example.com/img.png' });

      const blocks: ToolCallContent[] = [
        { type: 'image', data: 'base64data', mimeType: 'image' },
      ];

      await processContentBlocks(blocks, mockFileService);

      const calledPath = mockFileService.uploadBase64.mock.calls[0][1] as string;
      expect(calledPath).toMatch(/\.png$/);
    });

    it('should upload audio block and replace data with URL', async () => {
      const proxyUrl = 'https://storage.example.com/files/mcp/audio/2026-02-18/test-nanoid.mp3';
      mockFileService.uploadBase64.mockResolvedValue({ url: proxyUrl });

      const blocks: ToolCallContent[] = [
        { type: 'audio', data: 'base64encodedaudiodata', mimeType: 'audio/mp3' },
      ];

      const result = await processContentBlocks(blocks, mockFileService);

      expect(mockFileService.uploadBase64).toHaveBeenCalledOnce();
      expect(mockFileService.uploadBase64).toHaveBeenCalledWith(
        'base64encodedaudiodata',
        expect.stringContaining('mcp/audio'),
      );
      expect(result[0]).toMatchObject({ type: 'audio', data: proxyUrl });
    });

    it('should extract correct file extension from audio mimeType', async () => {
      mockFileService.uploadBase64.mockResolvedValue({ url: 'https://storage.example.com/audio.wav' });

      const blocks: ToolCallContent[] = [
        { type: 'audio', data: 'base64data', mimeType: 'audio/wav' },
      ];

      await processContentBlocks(blocks, mockFileService);

      const calledPath = mockFileService.uploadBase64.mock.calls[0][1] as string;
      expect(calledPath).toMatch(/\.wav$/);
    });

    it('should use mp3 as default extension when audio mimeType has no subtype', async () => {
      mockFileService.uploadBase64.mockResolvedValue({ url: 'https://storage.example.com/audio.mp3' });

      const blocks: ToolCallContent[] = [
        { type: 'audio', data: 'base64data', mimeType: 'audio' },
      ];

      await processContentBlocks(blocks, mockFileService);

      const calledPath = mockFileService.uploadBase64.mock.calls[0][1] as string;
      expect(calledPath).toMatch(/\.mp3$/);
    });

    it('should preserve other block fields when uploading image', async () => {
      const proxyUrl = 'https://storage.example.com/img.png';
      mockFileService.uploadBase64.mockResolvedValue({ url: proxyUrl });

      const blocks: ToolCallContent[] = [
        { type: 'image', data: 'base64data', mimeType: 'image/png', _meta: { extra: 'info' } },
      ];

      const result = await processContentBlocks(blocks, mockFileService);

      expect(result[0]).toMatchObject({
        type: 'image',
        mimeType: 'image/png',
        _meta: { extra: 'info' },
        data: proxyUrl,
      });
    });

    it('should preserve other block fields when uploading audio', async () => {
      const proxyUrl = 'https://storage.example.com/audio.mp3';
      mockFileService.uploadBase64.mockResolvedValue({ url: proxyUrl });

      const blocks: ToolCallContent[] = [
        { type: 'audio', data: 'base64data', mimeType: 'audio/mp3', _meta: { extra: 'info' } },
      ];

      const result = await processContentBlocks(blocks, mockFileService);

      expect(result[0]).toMatchObject({
        type: 'audio',
        mimeType: 'audio/mp3',
        _meta: { extra: 'info' },
        data: proxyUrl,
      });
    });

    it('should process multiple blocks concurrently', async () => {
      const imageUrl = 'https://storage.example.com/img.png';
      const audioUrl = 'https://storage.example.com/audio.mp3';

      mockFileService.uploadBase64
        .mockResolvedValueOnce({ url: imageUrl })
        .mockResolvedValueOnce({ url: audioUrl });

      const blocks: ToolCallContent[] = [
        { type: 'image', data: 'imgdata', mimeType: 'image/png' },
        { type: 'text', text: 'some text' },
        { type: 'audio', data: 'audiodata', mimeType: 'audio/mp3' },
      ];

      const result = await processContentBlocks(blocks, mockFileService);

      expect(mockFileService.uploadBase64).toHaveBeenCalledTimes(2);
      expect(result[0]).toMatchObject({ type: 'image', data: imageUrl });
      expect(result[1]).toMatchObject({ type: 'text', text: 'some text' });
      expect(result[2]).toMatchObject({ type: 'audio', data: audioUrl });
    });

    it('should include date-based sharding in upload pathname', async () => {
      mockFileService.uploadBase64.mockResolvedValue({ url: 'https://storage.example.com/img.png' });

      const blocks: ToolCallContent[] = [
        { type: 'image', data: 'base64data', mimeType: 'image/png' },
      ];

      await processContentBlocks(blocks, mockFileService);

      const calledPath = mockFileService.uploadBase64.mock.calls[0][1] as string;
      // Should contain date in YYYY-MM-DD format
      expect(calledPath).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it('should include nanoid in upload pathname for uniqueness', async () => {
      mockFileService.uploadBase64.mockResolvedValue({ url: 'https://storage.example.com/img.png' });

      const blocks: ToolCallContent[] = [
        { type: 'image', data: 'base64data', mimeType: 'image/png' },
      ];

      await processContentBlocks(blocks, mockFileService);

      const calledPath = mockFileService.uploadBase64.mock.calls[0][1] as string;
      expect(calledPath).toContain('test-nanoid');
    });

    it('should use S3_FILE_PATH prefix in upload pathname', async () => {
      mockFileService.uploadBase64.mockResolvedValue({ url: 'https://storage.example.com/img.png' });

      const blocks: ToolCallContent[] = [
        { type: 'image', data: 'base64data', mimeType: 'image/png' },
      ];

      await processContentBlocks(blocks, mockFileService);

      const calledPath = mockFileService.uploadBase64.mock.calls[0][1] as string;
      expect(calledPath).toMatch(/^files\//);
    });
  });
});
