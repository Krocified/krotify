import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { listFavoriteIds, toggleFavorite } from '../db/repo';

export type FavoritesContextValue = {
  ids: Set<string>;
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => Promise<boolean>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: PropsWithChildren) {
  const [ids, setIds] = useState<Set<string>>(() => new Set());
  const [loaded, setLoaded] = useState(false);
  const mutated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    listFavoriteIds()
      .then((favorites) => {
        if (!cancelled && !mutated.current) setIds(favorites);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isFavorite = useCallback((id: string) => ids.has(id), [ids]);

  const toggle = useCallback(async (id: string) => {
    mutated.current = true;
    const favorite = await toggleFavorite(id);
    setIds((previous) => {
      const next = new Set(previous);
      if (favorite) next.add(id);
      else next.delete(id);
      return next;
    });
    return favorite;
  }, []);

  const value = useMemo<FavoritesContextValue>(
    () => ({ ids: loaded ? ids : new Set(), isFavorite, toggle }),
    [ids, isFavorite, loaded, toggle],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error('useFavorites must be used inside FavoritesProvider');
  return value;
}
