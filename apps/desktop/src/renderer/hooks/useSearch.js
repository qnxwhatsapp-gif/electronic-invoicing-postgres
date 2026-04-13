import { useState, useCallback, useRef } from 'react';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);

  const search = useCallback((value) => {
    setQuery(value);
    if (value.length < 2) { setResults(null); setOpen(false); return; }
    setLoading(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await window.electron.invoke('search:global', { query: value });
      setResults(res);
      setOpen(true);
      setLoading(false);
    }, 300);
  }, []);

  function clear() { setQuery(''); setResults(null); setOpen(false); }

  return { query, results, loading, open, setOpen, search, clear };
}
