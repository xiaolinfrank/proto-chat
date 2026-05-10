import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CreateNewEvalDatasets, EvalDatasetRecord, RAGEvalDataSetItem } from '@lobechat/types';

import { useKnowledgeBaseStore } from '../../../store';

vi.mock('zustand/traditional');

vi.mock('@/components/AntdStaticMethods', () => ({
  notification: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock('jsonl-parse-stringify', () => ({
  default: {
    parse: vi.fn(),
    stringify: vi.fn(),
  },
}));

vi.mock('@/services/ragEval', () => ({
  ragEvalService: {
    checkEvaluationStatus: vi.fn(),
    createDataset: vi.fn(),
    createEvaluation: vi.fn(),
    getDatasetRecords: vi.fn(),
    getDatasets: vi.fn(),
    getEvaluationList: vi.fn(),
    importDatasetRecords: vi.fn(),
    removeDataset: vi.fn(),
    removeDatasetRecord: vi.fn(),
    removeEvaluation: vi.fn(),
    startEvaluationTask: vi.fn(),
    updateDataset: vi.fn(),
  },
}));

// Prevent @/store/file from loading its upload slice which imports @lobechat/utils
vi.mock('@/store/file', () => ({
  useFileStore: vi.fn(),
}));

// Prevent @/services/knowledgeBase from loading @/libs/trpc/client which imports @lobechat/fetch-sse
vi.mock('@/services/knowledgeBase', () => ({
  knowledgeBaseService: {
    addFilesToKnowledgeBase: vi.fn(),
    createKnowledgeBase: vi.fn(),
    deleteKnowledgeBase: vi.fn(),
    getKnowledgeBaseById: vi.fn(),
    getKnowledgeBaseList: vi.fn(),
    removeFilesFromKnowledgeBase: vi.fn(),
    updateKnowledgeBaseList: vi.fn(),
  },
}));

import { notification } from '@/components/AntdStaticMethods';
import { ragEvalService } from '@/services/ragEval';

beforeEach(() => {
  vi.clearAllMocks();
  useKnowledgeBaseStore.setState({ initDatasetList: false });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RAGEvalDatasetAction', () => {
  describe('createNewDataset', () => {
    it('should create dataset and refresh list', async () => {
      const params: CreateNewEvalDatasets = { knowledgeBaseId: 'kb-1', name: 'Test Dataset' };

      vi.mocked(ragEvalService.createDataset).mockResolvedValue(1);

      const { result } = renderHook(() => useKnowledgeBaseStore());
      const refreshSpy = vi.spyOn(result.current, 'refreshDatasetList').mockResolvedValue();

      await act(async () => {
        await result.current.createNewDataset(params);
      });

      expect(ragEvalService.createDataset).toHaveBeenCalledWith(params);
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should propagate errors from createDataset', async () => {
      const params: CreateNewEvalDatasets = { knowledgeBaseId: 'kb-1', name: 'Test Dataset' };
      vi.mocked(ragEvalService.createDataset).mockRejectedValue(new Error('Create failed'));

      const { result } = renderHook(() => useKnowledgeBaseStore());

      await expect(
        act(async () => {
          await result.current.createNewDataset(params);
        }),
      ).rejects.toThrow('Create failed');
    });
  });

  describe('importDataset', () => {
    it('should return early when datasetId is falsy', async () => {
      const file = new File(['{}'], 'test.jsonl', { type: 'application/jsonl' });

      const { result } = renderHook(() => useKnowledgeBaseStore());
      const refreshSpy = vi.spyOn(result.current, 'refreshDatasetList').mockResolvedValue();

      await act(async () => {
        await result.current.importDataset(file, 0);
      });

      expect(ragEvalService.importDatasetRecords).not.toHaveBeenCalled();
      expect(refreshSpy).not.toHaveBeenCalled();
    });

    it('should skip JSONL processing for non-jsonl files and still refresh', async () => {
      const file = new File(['test content'], 'test.csv', { type: 'text/csv' });

      const { result } = renderHook(() => useKnowledgeBaseStore());
      const refreshSpy = vi.spyOn(result.current, 'refreshDatasetList').mockResolvedValue();

      await act(async () => {
        await result.current.importDataset(file, 1);
      });

      expect(ragEvalService.importDatasetRecords).not.toHaveBeenCalled();
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should parse, validate, and import a valid JSONL file', async () => {
      const validRecord = { question: 'What is AI?' };
      const jsonlContent = JSON.stringify(validRecord);
      const file = new File([jsonlContent], 'data.jsonl', { type: 'application/jsonl' });

      const JSONL = (await import('jsonl-parse-stringify')).default as any;
      JSONL.parse.mockReturnValue([validRecord]);
      vi.mocked(ragEvalService.importDatasetRecords).mockResolvedValue();

      const { result } = renderHook(() => useKnowledgeBaseStore());
      const refreshSpy = vi.spyOn(result.current, 'refreshDatasetList').mockResolvedValue();

      await act(async () => {
        await result.current.importDataset(file, 1);
      });

      expect(JSONL.parse).toHaveBeenCalledWith(jsonlContent);
      expect(ragEvalService.importDatasetRecords).toHaveBeenCalledWith(1, file);
      expect(refreshSpy).toHaveBeenCalled();
      expect(notification.error).not.toHaveBeenCalled();
    });

    it('should show error notification when JSONL parsing fails', async () => {
      const file = new File(['invalid jsonl'], 'data.jsonl', { type: 'application/jsonl' });

      const JSONL = (await import('jsonl-parse-stringify')).default as any;
      JSONL.parse.mockImplementation(() => {
        throw new Error('Invalid JSONL format');
      });

      const { result } = renderHook(() => useKnowledgeBaseStore());
      const refreshSpy = vi.spyOn(result.current, 'refreshDatasetList').mockResolvedValue();

      await act(async () => {
        await result.current.importDataset(file, 1);
      });

      expect(notification.error).toHaveBeenCalledWith({
        description: 'Invalid JSONL format',
        message: '文件格式错误',
      });
      expect(ragEvalService.importDatasetRecords).not.toHaveBeenCalled();
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should show error notification when schema validation fails', async () => {
      const invalidRecord = { invalidField: 'no question field' };
      const file = new File([JSON.stringify(invalidRecord)], 'data.jsonl', {
        type: 'application/jsonl',
      });

      const JSONL = (await import('jsonl-parse-stringify')).default as any;
      JSONL.parse.mockReturnValue([invalidRecord]);

      const { result } = renderHook(() => useKnowledgeBaseStore());
      const refreshSpy = vi.spyOn(result.current, 'refreshDatasetList').mockResolvedValue();

      await act(async () => {
        await result.current.importDataset(file, 1);
      });

      expect(notification.error).toHaveBeenCalled();
      expect(ragEvalService.importDatasetRecords).not.toHaveBeenCalled();
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should always refresh dataset list after import, even on parse error', async () => {
      const file = new File(['bad'], 'data.jsonl', { type: 'application/jsonl' });

      const JSONL = (await import('jsonl-parse-stringify')).default as any;
      JSONL.parse.mockImplementation(() => {
        throw new Error('Parse error');
      });

      const { result } = renderHook(() => useKnowledgeBaseStore());
      const refreshSpy = vi.spyOn(result.current, 'refreshDatasetList').mockResolvedValue();

      await act(async () => {
        await result.current.importDataset(file, 42);
      });

      expect(refreshSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('refreshDatasetList', () => {
    it('should execute without errors', async () => {
      const { result } = renderHook(() => useKnowledgeBaseStore());

      await expect(
        act(async () => {
          await result.current.refreshDatasetList();
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('removeDataset', () => {
    it('should remove dataset and refresh list', async () => {
      vi.mocked(ragEvalService.removeDataset).mockResolvedValue();

      const { result } = renderHook(() => useKnowledgeBaseStore());
      const refreshSpy = vi.spyOn(result.current, 'refreshDatasetList').mockResolvedValue();

      await act(async () => {
        await result.current.removeDataset(5);
      });

      expect(ragEvalService.removeDataset).toHaveBeenCalledWith(5);
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should propagate errors from removeDataset', async () => {
      vi.mocked(ragEvalService.removeDataset).mockRejectedValue(new Error('Remove failed'));

      const { result } = renderHook(() => useKnowledgeBaseStore());

      await expect(
        act(async () => {
          await result.current.removeDataset(5);
        }),
      ).rejects.toThrow('Remove failed');
    });
  });

  describe('useFetchDatasets', () => {
    it('should fetch datasets for a knowledge base', async () => {
      const mockDatasets: RAGEvalDataSetItem[] = [
        { createdAt: new Date(), id: 1, name: 'DS 1', updatedAt: new Date() },
        { createdAt: new Date(), id: 2, name: 'DS 2', updatedAt: new Date() },
      ];

      vi.mocked(ragEvalService.getDatasets).mockResolvedValue(mockDatasets);

      const { result } = renderHook(() =>
        useKnowledgeBaseStore.getState().useFetchDatasets('kb-1'),
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockDatasets);
      });

      expect(ragEvalService.getDatasets).toHaveBeenCalledWith('kb-1');
    });

    it('should initialize dataset list flag on first successful fetch', async () => {
      vi.mocked(ragEvalService.getDatasets).mockResolvedValue([]);

      act(() => {
        useKnowledgeBaseStore.setState({ initDatasetList: false });
      });

      const { result } = renderHook(() =>
        useKnowledgeBaseStore.getState().useFetchDatasets('kb-1'),
      );

      await waitFor(() => {
        expect(result.current.data).toEqual([]);
      });

      expect(useKnowledgeBaseStore.getState().initDatasetList).toBe(true);
    });

    it('should not re-initialize if already initialized', async () => {
      vi.mocked(ragEvalService.getDatasets).mockResolvedValue([]);

      act(() => {
        useKnowledgeBaseStore.setState({ initDatasetList: true });
      });

      const { result } = renderHook(() =>
        useKnowledgeBaseStore.getState().useFetchDatasets('kb-2'),
      );

      await waitFor(() => {
        expect(result.current.data).toEqual([]);
      });

      expect(useKnowledgeBaseStore.getState().initDatasetList).toBe(true);
    });

    it('should return fallback empty array before data loads', async () => {
      vi.mocked(ragEvalService.getDatasets).mockResolvedValue([]);

      const { result } = renderHook(() =>
        useKnowledgeBaseStore.getState().useFetchDatasets('kb-1'),
      );

      expect(result.current.data).toEqual([]);
    });
  });

  describe('useFetchDatasetRecords', () => {
    it('should fetch dataset records when datasetId is provided', async () => {
      const mockRecords: EvalDatasetRecord[] = [
        { createdAt: new Date(), id: 1, metadata: {}, question: 'Q1' },
        { createdAt: new Date(), id: 2, metadata: {}, question: 'Q2' },
      ];

      vi.mocked(ragEvalService.getDatasetRecords).mockResolvedValue(mockRecords);

      const { result } = renderHook(() =>
        useKnowledgeBaseStore.getState().useFetchDatasetRecords(10),
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockRecords);
      });

      expect(ragEvalService.getDatasetRecords).toHaveBeenCalledWith(10);
    });

    it('should not fetch when datasetId is null', async () => {
      vi.mocked(ragEvalService.getDatasetRecords).mockResolvedValue([]);

      renderHook(() => useKnowledgeBaseStore.getState().useFetchDatasetRecords(null));

      await new Promise((r) => setTimeout(r, 50));

      expect(ragEvalService.getDatasetRecords).not.toHaveBeenCalled();
    });
  });
});
