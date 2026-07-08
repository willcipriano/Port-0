import { useState, useEffect, useRef } from 'react';
import type { Topology, Objects } from 'topojson-specification';
import { useApi } from './useApi';

export interface WorldNode {
  ipv6: string;
  osArchetypeId: string;
  isLandmark: boolean;
  latitude: number;
  longitude: number;
}

interface WorldNodesResponse {
  nodes: WorldNode[];
}

/**
 * Loads and memoizes the Natural Earth country TopoJSON (served from /public)
 * and fetches all machine nodes from the API.
 *
 * The TopoJSON is only fetched once per page load; nodes re-fetch when the
 * caller increments `refreshKey`.
 */
export function useWorldMap(accountId: string, refreshKey = 0) {
  const { get } = useApi(accountId);
  const [topology, setTopology] = useState<Topology<Objects> | null>(null);
  const [nodes, setNodes] = useState<WorldNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const topoRef = useRef<Topology<Objects> | null>(null);

  // Load TopoJSON once (countries-110m Natural Earth data)
  useEffect(() => {
    if (topoRef.current) {
      setTopology(topoRef.current);
      return;
    }
    fetch('/countries-110m.json')
      .then(r => {
        if (!r.ok) throw new Error(`Failed to load map data: ${r.status}`);
        return r.json() as Promise<Topology<Objects>>;
      })
      .then(topo => {
        topoRef.current = topo;
        setTopology(topo);
      })
      .catch(err => {
        setError(String(err));
      });
  }, []);

  // Fetch nodes (re-fetches when refreshKey changes)
  useEffect(() => {
    setLoading(true);
    get<WorldNodesResponse>('/world/nodes')
      .then(d => {
        setNodes(d.nodes);
        setError(null);
      })
      .catch(err => {
        setError(String(err));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [get, refreshKey]);

  return { topology, nodes, loading, error };
}
