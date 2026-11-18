import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { assignmentsFromRows, setAssignment, type TagCount } from './filter';
import {
  assignTag,
  assignTagToTracks,
  createTag,
  listTagAssignments,
  listTagsWithCounts,
  unassignTag,
  unassignTagFromTracks,
  type Tag,
} from './repo';

export type TagContextValue = {
  tags: TagCount[];
  assignments: ReadonlyMap<string, readonly string[]>;
  loaded: boolean;
  refresh: () => Promise<void>;
  createAndAssign: (trackId: string, name: string) => Promise<Tag | null>;
  assign: (trackId: string, tagId: string) => Promise<void>;
  unassign: (trackId: string, tagId: string) => Promise<void>;
  assignMany: (trackIds: readonly string[], tagId: string) => Promise<void>;
  unassignMany: (trackIds: readonly string[], tagId: string) => Promise<void>;
  createAndAssignMany: (trackIds: readonly string[], name: string) => Promise<Tag | null>;
  tagsFor: (trackId: string) => Tag[];
};

type TagState = {
  tags: TagCount[];
  assignments: Map<string, string[]>;
};

const EMPTY_ASSIGNMENTS: ReadonlyMap<string, readonly string[]> = new Map();

const TagContext = createContext<TagContextValue | null>(null);

const byName = (a: Tag, b: Tag) => {
  const left = a.name.toLowerCase();
  const right = b.name.toLowerCase();
  return left < right ? -1 : left > right ? 1 : 0;
};

export function TagProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<TagState>(() => ({
    tags: [],
    assignments: new Map(),
  }));
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [tags, rows] = await Promise.all([listTagsWithCounts(), listTagAssignments()]);
      if (!mounted.current) return;
      setState({ tags, assignments: assignmentsFromRows(rows) });
    } finally {
      if (mounted.current) setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh().catch(() => {});
  }, [refresh]);

  const applyOptimistic = useCallback(
    (trackId: string, tagId: string, assigned: boolean) => {
      setState((previous) => ({
        ...previous,
        assignments: setAssignment(previous.assignments, trackId, tagId, assigned),
      }));
    },
    [],
  );

  const mutateMany = useCallback(
    async (
      trackIds: readonly string[],
      tagId: string,
      assigned: boolean,
      write: () => Promise<void>,
    ) => {
      setState((previous) => {
        let assignments = previous.assignments;
        for (const trackId of trackIds) {
          assignments = setAssignment(assignments, trackId, tagId, assigned);
        }
        return { ...previous, assignments };
      });
      try {
        await write();
      } catch (error) {
        await refresh().catch(() => {});
        throw error;
      }
      await refresh();
    },
    [refresh],
  );

  const mutate = useCallback(
    async (trackId: string, tagId: string, assigned: boolean, write: () => Promise<void>) => {
      applyOptimistic(trackId, tagId, assigned);
      try {
        await write();
      } catch (error) {
        await refresh().catch(() => {});
        throw error;
      }
      await refresh();
    },
    [applyOptimistic, refresh],
  );

  const assign = useCallback(
    (trackId: string, tagId: string) =>
      mutate(trackId, tagId, true, () => assignTag(trackId, tagId)),
    [mutate],
  );

  const unassign = useCallback(
    (trackId: string, tagId: string) =>
      mutate(trackId, tagId, false, () => unassignTag(trackId, tagId)),
    [mutate],
  );

  const assignMany = useCallback(
    (trackIds: readonly string[], tagId: string) =>
      mutateMany(trackIds, tagId, true, () => assignTagToTracks(trackIds, tagId)),
    [mutateMany],
  );

  const unassignMany = useCallback(
    (trackIds: readonly string[], tagId: string) =>
      mutateMany(trackIds, tagId, false, () => unassignTagFromTracks(trackIds, tagId)),
    [mutateMany],
  );

  const createAndAssignMany = useCallback(
    async (trackIds: readonly string[], name: string) => {
      const tag = await createTag(name);
      if (!tag) return null;
      await mutateMany(trackIds, tag.id, true, () => assignTagToTracks(trackIds, tag.id));
      return tag;
    },
    [mutateMany],
  );

  const createAndAssign = useCallback(
    async (trackId: string, name: string) => {
      const tag = await createTag(name);
      if (!tag) return null;
      await mutate(trackId, tag.id, true, () => assignTag(trackId, tag.id));
      return tag;
    },
    [mutate],
  );

  const tagsById = useMemo(
    () => new Map(state.tags.map((tag) => [tag.id, tag])),
    [state.tags],
  );

  const tagsFor = useCallback(
    (trackId: string) => {
      const ids = state.assignments.get(trackId);
      if (!ids) return [];
      const result: Tag[] = [];
      for (const id of ids) {
        const tag = tagsById.get(id);
        if (tag) result.push({ id: tag.id, name: tag.name });
      }
      return result.sort(byName);
    },
    [state.assignments, tagsById],
  );

  const value = useMemo<TagContextValue>(
    () => ({
      tags: loaded ? state.tags : [],
      assignments: loaded ? state.assignments : EMPTY_ASSIGNMENTS,
      loaded,
      refresh,
      createAndAssign,
      assign,
      unassign,
      assignMany,
      unassignMany,
      createAndAssignMany,
      tagsFor,
    }),
    [
      assign,
      assignMany,
      createAndAssign,
      createAndAssignMany,
      loaded,
      refresh,
      state.assignments,
      state.tags,
      tagsFor,
      unassign,
      unassignMany,
    ],
  );

  return <TagContext.Provider value={value}>{children}</TagContext.Provider>;
}

export function useTags(): TagContextValue {
  const value = useContext(TagContext);
  if (!value) throw new Error('useTags must be used inside TagProvider');
  return value;
}
