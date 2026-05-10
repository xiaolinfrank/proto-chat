import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  CreateNewEvalEvaluation,
  EvalEvaluationStatus,
  RAGEvalEvaluationItem,
} from '@lobechat/types';

import { useKnowledgeBaseStore } from '../../../store';

vi.mock('zustand/traditional');

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

import { ragEvalService } from '@/services/ragEval';

const mockEvaluationItem = (id: number): RAGEvalEvaluationItem => ({
  createdAt: new Date(),
  dataset: { id: 1, name: 'Test Dataset' },
  id,
  name: `Evaluation ${id}`,
  recordsStats: { success: 0, total: 0 },
  status: 'Pending' as EvalEvaluationStatus,
  updatedAt: new Date(),
});

beforeEach(() => {
  vi.clearAllMocks();
  useKnowledgeBaseStore.setState({ initDatasetList: false });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RAGEvalEvaluationAction', () => {
  describe('checkEvaluationStatus', () => {
    it('should call service with the evaluation id', async () => {
      vi.mocked(ragEvalService.checkEvaluationStatus).mockResolvedValue({ success: true });

      const { result } = renderHook(() => useKnowledgeBaseStore());

      await act(async () => {
        await result.current.checkEvaluationStatus(7);
      });

      expect(ragEvalService.checkEvaluationStatus).toHaveBeenCalledWith(7);
    });

    it('should propagate errors from checkEvaluationStatus', async () => {
      vi.mocked(ragEvalService.checkEvaluationStatus).mockRejectedValue(
        new Error('Status check failed'),
      );

      const { result } = renderHook(() => useKnowledgeBaseStore());

      await expect(
        act(async () => {
          await result.current.checkEvaluationStatus(7);
        }),
      ).rejects.toThrow('Status check failed');
    });
  });

  describe('createNewEvaluation', () => {
    it('should create evaluation and refresh list', async () => {
      const params: CreateNewEvalEvaluation = {
        datasetId: 1,
        knowledgeBaseId: 'kb-1',
        name: 'Eval 1',
      };

      vi.mocked(ragEvalService.createEvaluation).mockResolvedValue(10);

      const { result } = renderHook(() => useKnowledgeBaseStore());
      const refreshSpy = vi.spyOn(result.current, 'refreshEvaluationList').mockResolvedValue();

      await act(async () => {
        await result.current.createNewEvaluation(params);
      });

      expect(ragEvalService.createEvaluation).toHaveBeenCalledWith(params);
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should propagate errors from createEvaluation', async () => {
      const params: CreateNewEvalEvaluation = {
        datasetId: 1,
        knowledgeBaseId: 'kb-1',
        name: 'Eval 1',
      };

      vi.mocked(ragEvalService.createEvaluation).mockRejectedValue(new Error('Create failed'));

      const { result } = renderHook(() => useKnowledgeBaseStore());

      await expect(
        act(async () => {
          await result.current.createNewEvaluation(params);
        }),
      ).rejects.toThrow('Create failed');
    });
  });

  describe('refreshEvaluationList', () => {
    it('should execute without errors', async () => {
      const { result } = renderHook(() => useKnowledgeBaseStore());

      await expect(
        act(async () => {
          await result.current.refreshEvaluationList();
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('removeEvaluation', () => {
    it('should call service to remove evaluation by id', async () => {
      vi.mocked(ragEvalService.removeEvaluation).mockResolvedValue();

      const { result } = renderHook(() => useKnowledgeBaseStore());

      await act(async () => {
        await result.current.removeEvaluation(3);
      });

      expect(ragEvalService.removeEvaluation).toHaveBeenCalledWith(3);
      expect(ragEvalService.removeEvaluation).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from removeEvaluation', async () => {
      vi.mocked(ragEvalService.removeEvaluation).mockRejectedValue(new Error('Remove failed'));

      const { result } = renderHook(() => useKnowledgeBaseStore());

      await expect(
        act(async () => {
          await result.current.removeEvaluation(3);
        }),
      ).rejects.toThrow('Remove failed');
    });
  });

  describe('runEvaluation', () => {
    it('should call service to start evaluation task', async () => {
      vi.mocked(ragEvalService.startEvaluationTask).mockResolvedValue(undefined as any);

      const { result } = renderHook(() => useKnowledgeBaseStore());

      await act(async () => {
        await result.current.runEvaluation(4);
      });

      expect(ragEvalService.startEvaluationTask).toHaveBeenCalledWith(4);
      expect(ragEvalService.startEvaluationTask).toHaveBeenCalledTimes(1);
    });

    it('should propagate errors from startEvaluationTask', async () => {
      vi.mocked(ragEvalService.startEvaluationTask).mockRejectedValue(
        new Error('Task failed to start'),
      );

      const { result } = renderHook(() => useKnowledgeBaseStore());

      await expect(
        act(async () => {
          await result.current.runEvaluation(4);
        }),
      ).rejects.toThrow('Task failed to start');
    });
  });

  describe('useFetchEvaluationList', () => {
    it('should fetch evaluation list for a knowledge base', async () => {
      const mockList: RAGEvalEvaluationItem[] = [mockEvaluationItem(1), mockEvaluationItem(2)];

      vi.mocked(ragEvalService.getEvaluationList).mockResolvedValue(mockList);

      const { result } = renderHook(() =>
        useKnowledgeBaseStore.getState().useFetchEvaluationList('kb-1'),
      );

      await waitFor(() => {
        expect(result.current.data).toEqual(mockList);
      });

      expect(ragEvalService.getEvaluationList).toHaveBeenCalledWith('kb-1');
    });

    it('should initialize dataset list flag on first successful fetch', async () => {
      vi.mocked(ragEvalService.getEvaluationList).mockResolvedValue([]);

      act(() => {
        useKnowledgeBaseStore.setState({ initDatasetList: false });
      });

      const { result } = renderHook(() =>
        useKnowledgeBaseStore.getState().useFetchEvaluationList('kb-1'),
      );

      await waitFor(() => {
        expect(result.current.data).toEqual([]);
      });

      expect(useKnowledgeBaseStore.getState().initDatasetList).toBe(true);
    });

    it('should not re-initialize if flag already set', async () => {
      vi.mocked(ragEvalService.getEvaluationList).mockResolvedValue([]);

      act(() => {
        useKnowledgeBaseStore.setState({ initDatasetList: true });
      });

      const { result } = renderHook(() =>
        useKnowledgeBaseStore.getState().useFetchEvaluationList('kb-2'),
      );

      await waitFor(() => {
        expect(result.current.data).toEqual([]);
      });

      expect(useKnowledgeBaseStore.getState().initDatasetList).toBe(true);
    });

    it('should return fallback empty array before data loads', async () => {
      vi.mocked(ragEvalService.getEvaluationList).mockResolvedValue([mockEvaluationItem(1)]);

      const { result } = renderHook(() =>
        useKnowledgeBaseStore.getState().useFetchEvaluationList('kb-1'),
      );

      expect(result.current.data).toEqual([]);
    });
  });
});
