import { useEffect, useState } from 'react';
import { getCoverColor } from './palette';

export function useCoverColor(uri: string | undefined): string | null {
  const [state, setState] = useState<{ uri?: string; color: string | null }>({
    color: null,
  });

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    void getCoverColor(uri).then((color) => {
      if (!cancelled) setState({ uri, color });
    });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return state.uri === uri ? state.color : null;
}
