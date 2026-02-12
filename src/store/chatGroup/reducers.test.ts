import { describe, expect, it } from 'vitest';

import { ChatGroupItem } from '@/database/schemas/chatGroup';

import { chatGroupReducers } from './reducers';
import { ChatGroupState, initialChatGroupState } from './initialState';

describe('chatGroupReducers', () => {
  const mockChatGroup: ChatGroupItem = {
    id: 'group-1',
    title: 'Test Group',
    description: 'A test group',
    config: null,
    clientId: 'client-1',
    userId: 'user-1',
    groupId: null,
    pinned: false,
    accessedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  const mockChatGroup2: ChatGroupItem = {
    id: 'group-2',
    title: 'Second Group',
    description: 'Another test group',
    config: null,
    clientId: 'client-2',
    userId: 'user-1',
    groupId: null,
    pinned: true,
    accessedAt: new Date('2024-01-02'),
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
  };

  describe('addGroup', () => {
    it('should add a new group to empty state', () => {
      const state: ChatGroupState = { ...initialChatGroupState };
      const newState = chatGroupReducers.addGroup(state, { payload: mockChatGroup });

      expect(newState.groups).toHaveLength(1);
      expect(newState.groups[0]).toEqual(mockChatGroup);
      expect(newState.groupMap[mockChatGroup.id]).toEqual(mockChatGroup);
    });

    it('should add a new group to existing groups', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groups: [mockChatGroup],
        groupMap: { [mockChatGroup.id]: mockChatGroup },
      };

      const newState = chatGroupReducers.addGroup(state, { payload: mockChatGroup2 });

      expect(newState.groups).toHaveLength(2);
      expect(newState.groups[1]).toEqual(mockChatGroup2);
      expect(newState.groupMap[mockChatGroup2.id]).toEqual(mockChatGroup2);
    });

    it('should maintain consistency between groups array and groupMap', () => {
      const state: ChatGroupState = { ...initialChatGroupState };
      const newState = chatGroupReducers.addGroup(state, { payload: mockChatGroup });

      expect(newState.groups[0]).toEqual(newState.groupMap[mockChatGroup.id]);
    });

    it('should not mutate the original state', () => {
      const state: ChatGroupState = { ...initialChatGroupState };
      const originalGroups = state.groups;
      const originalGroupMap = state.groupMap;

      chatGroupReducers.addGroup(state, { payload: mockChatGroup });

      expect(state.groups).toBe(originalGroups);
      expect(state.groupMap).toBe(originalGroupMap);
    });
  });

  describe('deleteGroup', () => {
    it('should delete a group by id', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groups: [mockChatGroup],
        groupMap: { [mockChatGroup.id]: mockChatGroup },
      };

      const newState = chatGroupReducers.deleteGroup(state, { payload: mockChatGroup.id });

      expect(newState.groups).toHaveLength(0);
      expect(newState.groupMap[mockChatGroup.id]).toBeUndefined();
    });

    it('should delete the correct group when multiple groups exist', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groups: [mockChatGroup, mockChatGroup2],
        groupMap: {
          [mockChatGroup.id]: mockChatGroup,
          [mockChatGroup2.id]: mockChatGroup2,
        },
      };

      const newState = chatGroupReducers.deleteGroup(state, { payload: mockChatGroup.id });

      expect(newState.groups).toHaveLength(1);
      expect(newState.groups[0]).toEqual(mockChatGroup2);
      expect(newState.groupMap[mockChatGroup.id]).toBeUndefined();
      expect(newState.groupMap[mockChatGroup2.id]).toEqual(mockChatGroup2);
    });

    it('should handle deleting non-existent group gracefully', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groups: [mockChatGroup],
        groupMap: { [mockChatGroup.id]: mockChatGroup },
      };

      const newState = chatGroupReducers.deleteGroup(state, { payload: 'non-existent-id' });

      expect(newState.groups).toHaveLength(1);
      expect(newState.groups[0]).toEqual(mockChatGroup);
    });

    it('should maintain consistency between groups array and groupMap', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groups: [mockChatGroup, mockChatGroup2],
        groupMap: {
          [mockChatGroup.id]: mockChatGroup,
          [mockChatGroup2.id]: mockChatGroup2,
        },
      };

      const newState = chatGroupReducers.deleteGroup(state, { payload: mockChatGroup.id });

      expect(newState.groups.length).toBe(Object.keys(newState.groupMap).length);
      newState.groups.forEach((group) => {
        expect(newState.groupMap[group.id]).toEqual(group);
      });
    });

    it('should not mutate the original state', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groups: [mockChatGroup],
        groupMap: { [mockChatGroup.id]: mockChatGroup },
      };
      const originalGroups = state.groups;
      const originalGroupMap = state.groupMap;

      chatGroupReducers.deleteGroup(state, { payload: mockChatGroup.id });

      expect(state.groups).toBe(originalGroups);
      expect(state.groupMap).toBe(originalGroupMap);
    });
  });

  describe('loadGroups', () => {
    it('should load groups into empty state', () => {
      const state: ChatGroupState = { ...initialChatGroupState };
      const groups = [mockChatGroup, mockChatGroup2];

      const newState = chatGroupReducers.loadGroups(state, { payload: groups });

      expect(newState.groups).toEqual(groups);
      expect(Object.keys(newState.groupMap)).toHaveLength(2);
      expect(newState.groupMap[mockChatGroup.id]).toEqual(mockChatGroup);
      expect(newState.groupMap[mockChatGroup2.id]).toEqual(mockChatGroup2);
      expect(newState.isGroupsLoading).toBe(false);
    });

    it('should replace existing groups', () => {
      const existingGroup: ChatGroupItem = {
        ...mockChatGroup,
        id: 'group-old',
        title: 'Old Group',
      };

      const state: ChatGroupState = {
        ...initialChatGroupState,
        groups: [existingGroup],
        groupMap: { [existingGroup.id]: existingGroup },
      };

      const newGroups = [mockChatGroup, mockChatGroup2];
      const newState = chatGroupReducers.loadGroups(state, { payload: newGroups });

      expect(newState.groups).toEqual(newGroups);
      expect(newState.groupMap[existingGroup.id]).toBeUndefined();
      expect(Object.keys(newState.groupMap)).toHaveLength(2);
    });

    it('should handle empty groups array', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groups: [mockChatGroup],
        groupMap: { [mockChatGroup.id]: mockChatGroup },
      };

      const newState = chatGroupReducers.loadGroups(state, { payload: [] });

      expect(newState.groups).toEqual([]);
      expect(newState.groupMap).toEqual({});
      expect(newState.isGroupsLoading).toBe(false);
    });

    it('should rebuild groupMap to maintain consistency', () => {
      const state: ChatGroupState = { ...initialChatGroupState };
      const groups = [mockChatGroup, mockChatGroup2];

      const newState = chatGroupReducers.loadGroups(state, { payload: groups });

      expect(newState.groups.length).toBe(Object.keys(newState.groupMap).length);
      newState.groups.forEach((group) => {
        expect(newState.groupMap[group.id]).toEqual(group);
      });
    });

    it('should set isGroupsLoading to false', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        isGroupsLoading: true,
      };

      const newState = chatGroupReducers.loadGroups(state, { payload: [mockChatGroup] });

      expect(newState.isGroupsLoading).toBe(false);
    });

    it('should not mutate the original state', () => {
      const state: ChatGroupState = { ...initialChatGroupState };
      const originalGroups = state.groups;
      const originalGroupMap = state.groupMap;

      chatGroupReducers.loadGroups(state, { payload: [mockChatGroup] });

      expect(state.groups).toBe(originalGroups);
      expect(state.groupMap).toBe(originalGroupMap);
    });
  });

  describe('setGroupsLoading', () => {
    it('should set isGroupsLoading to true', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        isGroupsLoading: false,
      };

      const newState = chatGroupReducers.setGroupsLoading(state, { payload: true });

      expect(newState.isGroupsLoading).toBe(true);
    });

    it('should set isGroupsLoading to false', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        isGroupsLoading: true,
      };

      const newState = chatGroupReducers.setGroupsLoading(state, { payload: false });

      expect(newState.isGroupsLoading).toBe(false);
    });

    it('should preserve other state properties', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groups: [mockChatGroup],
        groupMap: { [mockChatGroup.id]: mockChatGroup },
        isGroupsLoading: true,
      };

      const newState = chatGroupReducers.setGroupsLoading(state, { payload: false });

      expect(newState.groups).toEqual(state.groups);
      expect(newState.groupMap).toEqual(state.groupMap);
    });
  });

  describe('updateGroup', () => {
    it('should update a group in both groupMap and groups array', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groups: [mockChatGroup],
        groupMap: { [mockChatGroup.id]: mockChatGroup },
      };

      const updatedValues = { title: 'Updated Title', description: 'Updated description' };
      const newState = chatGroupReducers.updateGroup(state, {
        payload: { id: mockChatGroup.id, value: updatedValues },
      });

      expect(newState.groupMap[mockChatGroup.id]?.title).toBe('Updated Title');
      expect(newState.groupMap[mockChatGroup.id]?.description).toBe('Updated description');
      expect(newState.groups[0].title).toBe('Updated Title');
      expect(newState.groups[0].description).toBe('Updated description');
    });

    it('should update pinned status', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groups: [mockChatGroup],
        groupMap: { [mockChatGroup.id]: mockChatGroup },
      };

      const newState = chatGroupReducers.updateGroup(state, {
        payload: { id: mockChatGroup.id, value: { pinned: true } },
      });

      expect(newState.groupMap[mockChatGroup.id]?.pinned).toBe(true);
      expect(newState.groups[0].pinned).toBe(true);
    });

    it('should partially update group properties', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groups: [mockChatGroup],
        groupMap: { [mockChatGroup.id]: mockChatGroup },
      };

      const newState = chatGroupReducers.updateGroup(state, {
        payload: { id: mockChatGroup.id, value: { title: 'New Title' } },
      });

      expect(newState.groupMap[mockChatGroup.id]?.title).toBe('New Title');
      expect(newState.groupMap[mockChatGroup.id]?.description).toBe(mockChatGroup.description);
      expect(newState.groups[0].title).toBe('New Title');
    });

    it('should update the correct group when multiple groups exist', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groups: [mockChatGroup, mockChatGroup2],
        groupMap: {
          [mockChatGroup.id]: mockChatGroup,
          [mockChatGroup2.id]: mockChatGroup2,
        },
      };

      const newState = chatGroupReducers.updateGroup(state, {
        payload: { id: mockChatGroup2.id, value: { title: 'Updated Second Group' } },
      });

      expect(newState.groupMap[mockChatGroup2.id]?.title).toBe('Updated Second Group');
      expect(newState.groups[1].title).toBe('Updated Second Group');
      expect(newState.groupMap[mockChatGroup.id]?.title).toBe(mockChatGroup.title);
      expect(newState.groups[0].title).toBe(mockChatGroup.title);
    });

    it('should handle updating non-existent group gracefully', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groups: [mockChatGroup],
        groupMap: { [mockChatGroup.id]: mockChatGroup },
      };

      const newState = chatGroupReducers.updateGroup(state, {
        payload: { id: 'non-existent-id', value: { title: 'New Title' } },
      });

      expect(newState.groups[0]).toEqual(mockChatGroup);
      expect(newState.groupMap[mockChatGroup.id]).toEqual(mockChatGroup);
    });

    it('should maintain consistency between groups array and groupMap', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groups: [mockChatGroup, mockChatGroup2],
        groupMap: {
          [mockChatGroup.id]: mockChatGroup,
          [mockChatGroup2.id]: mockChatGroup2,
        },
      };

      const newState = chatGroupReducers.updateGroup(state, {
        payload: { id: mockChatGroup.id, value: { title: 'Consistent Title' } },
      });

      const groupInArray = newState.groups.find((g) => g.id === mockChatGroup.id);
      const groupInMap = newState.groupMap[mockChatGroup.id];

      expect(groupInArray?.title).toBe(groupInMap?.title);
      expect(groupInArray?.description).toBe(groupInMap?.description);
    });

    it('should not mutate the original state', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groups: [mockChatGroup],
        groupMap: { [mockChatGroup.id]: mockChatGroup },
      };
      const originalGroups = state.groups;
      const originalGroupMap = state.groupMap;
      const originalTitle = state.groups[0].title;

      chatGroupReducers.updateGroup(state, {
        payload: { id: mockChatGroup.id, value: { title: 'New Title' } },
      });

      expect(state.groups).toBe(originalGroups);
      expect(state.groupMap).toBe(originalGroupMap);
      expect(state.groups[0].title).toBe(originalTitle);
    });

    it('should update config object', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groups: [mockChatGroup],
        groupMap: { [mockChatGroup.id]: mockChatGroup },
      };

      const newConfig = { temperature: 0.7, maxTokens: 1000 };
      const newState = chatGroupReducers.updateGroup(state, {
        payload: { id: mockChatGroup.id, value: { config: newConfig as any } },
      });

      expect(newState.groupMap[mockChatGroup.id]?.config).toEqual(newConfig);
      expect(newState.groups[0].config).toEqual(newConfig);
    });
  });
});
