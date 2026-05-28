import { useState } from 'react';

import type { ContainerResult } from '../types';
import type { GateOutSearchResult } from '../components/GateOutSearchSection';

interface UseGateOutSearchParams {
  yardId: number;
}

export function useGateOutSearch({ yardId }: UseGateOutSearchParams) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GateOutSearchResult[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<ContainerResult | null>(null);
  const [searching, setSearching] = useState(false);

  const searchContainers = async () => {
    if (!searchQuery) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/gate/out-search?yard_id=${yardId}&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(Array.isArray(data.results) ? data.results : []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const clearGateOutSearch = () => {
    setSelectedContainer(null);
    setSearchResults([]);
    setSearchQuery('');
  };

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    selectedContainer,
    setSelectedContainer,
    searching,
    searchContainers,
    clearGateOutSearch,
  };
}
