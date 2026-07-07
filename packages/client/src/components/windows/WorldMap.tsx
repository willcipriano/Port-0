import { useState, useEffect, useRef, useCallback } from 'react';
import {
  geoNaturalEarth1,
  geoPath,
  geoGraticule,
  geoContains,
  type GeoProjection,
  type GeoSphere,
  type GeoPermissibleObjects,
} from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection } from 'topojson-specification';
import { useApi } from '../../hooks/useApi';
import { useWorldMap, type WorldNode } from '../../hooks/useWorldMap';

// ── terminal-palette constants (match CSS variables) ──────────────────────
const C_OCEAN       = '#070b0e';
const C_LAND        = '#0e1a22';
const C_BORDER      = '#1a3040';
const C_GRATICULE   = '#0c1820';
const C_NODE        = '#00ff9f33';
const C_NODE_BORDER = '#00ff9f99';
const C_LANDMARK    = '#00e5ff';
const C_LANDMARK_BG = '#00e5ff22';
const C_HOVER_FILL  = '#00e5ff18';
const C_HOVER_LABEL = '#00e5ff';
const C_SELECTED    = '#00e5ff';
const C_DIM         = '#1a3040';
const C_SCAN_TEXT   = '#00ff9f';

const GEO_SPHERE: GeoSphere = { type: 'Sphere' };

interface SubnetInfo {
  zoneId: string;
  zoneName: string;
  subnetId: string;
  prefix: string;
  machineCount: number;
  landmarkCount: number;
  theme: string;
}

const HEAT_LABELS = ['COLD', 'WARM', 'HOT', 'CRITICAL'];
const HEAT_COLORS = ['#00ff9f', '#e0c040', '#ff8800', '#ff2244'];

// ── Drawing helpers ────────────────────────────────────────────────────────

function drawBaseMap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  projection: GeoProjection,
  countries: GeoJSON.FeatureCollection,
  graticule: GeoPermissibleObjects,
  outline: GeoSphere,
): void {
  ctx.clearRect(0, 0, width, height);
  const path = geoPath(projection, ctx);

  // Ocean (sphere background)
  ctx.beginPath();
  path(outline);
  ctx.fillStyle = C_OCEAN;
  ctx.fill();

  // Graticule
  ctx.beginPath();
  path(graticule);
  ctx.strokeStyle = C_GRATICULE;
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Land polygons
  ctx.beginPath();
  path(countries);
  ctx.fillStyle = C_LAND;
  ctx.fill();

  // Country borders
  ctx.beginPath();
  path(countries);
  ctx.strokeStyle = C_BORDER;
  ctx.lineWidth = 0.4;
  ctx.stroke();
}

function drawNodes(
  ctx: CanvasRenderingContext2D,
  projection: GeoProjection,
  nodes: WorldNode[],
  discoveredSet: Set<string>,
  selected: string | null,
  hovered: string | null,
): void {
  for (const node of nodes) {
    const pt = projection([node.longitude, node.latitude]);
    if (!pt) continue;
    const [x, y] = pt;
    const isDiscovered = discoveredSet.has(node.ipv6);
    const isSelected = node.ipv6 === selected;
    const isHovered = node.ipv6 === hovered;
    const r = node.isLandmark ? 5 : 3;

    if (node.isLandmark) {
      // Landmark: cyan diamond / glow
      ctx.beginPath();
      ctx.arc(x, y, r + 3, 0, Math.PI * 2);
      ctx.fillStyle = C_LANDMARK_BG;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = C_LANDMARK_BG;
      ctx.fill();
      ctx.strokeStyle = isSelected || isHovered ? C_SELECTED : C_LANDMARK;
      ctx.lineWidth = isSelected ? 2 : 1.5;
      ctx.stroke();
      // Inner dot
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = C_LANDMARK;
      ctx.fill();
    } else {
      const alpha = isDiscovered ? 1 : 0.35;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = isSelected || isHovered ? C_HOVER_FILL : C_NODE;
      ctx.fill();
      ctx.strokeStyle = isSelected || isHovered ? C_SELECTED : C_NODE_BORDER;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

// ── Nearest-node hit detection ─────────────────────────────────────────────
function findNearestNode(
  projection: GeoProjection,
  nodes: WorldNode[],
  mx: number,
  my: number,
  threshold = 12,
): WorldNode | null {
  let best: WorldNode | null = null;
  let bestDist = threshold * threshold;
  for (const node of nodes) {
    const pt = projection([node.longitude, node.latitude]);
    if (!pt) continue;
    const dx = pt[0] - mx;
    const dy = pt[1] - my;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestDist) { bestDist = d2; best = node; }
  }
  return best;
}

// ── Component ──────────────────────────────────────────────────────────────
export function WorldMap() {
  const { get } = useApi();
  const [subnet, setSubnet] = useState<SubnetInfo | null>(null);
  const [heat, setHeat] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState('');
  const [scanRefreshKey, setScanRefreshKey] = useState(0);
  const [discovered, setDiscovered] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  // Canvas / layout refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenRef = useRef<HTMLCanvasElement | null>(null);
  const projRef = useRef<GeoProjection | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });

  // Map data
  const { topology, nodes, loading: nodesLoading } = useWorldMap(scanRefreshKey);

  // Pre-compute GeoJSON from topology
  const [countries, setCountries] = useState<GeoJSON.FeatureCollection | null>(null);
  const graticule = useRef<GeoPermissibleObjects>(geoGraticule()());

  useEffect(() => {
    if (!topology) return;
    const topo = topology as unknown as import('topojson-specification').Topology<{ countries: GeometryCollection }>;
    const fc = feature(topo, topo.objects.countries) as GeoJSON.FeatureCollection;
    setCountries(fc);
  }, [topology]);

  // Fetch subnet info for header
  useEffect(() => {
    get<{ subnet: SubnetInfo; heatLevel: number }>('/world/subnet')
      .then(d => { setSubnet(d.subnet); setHeat(d.heatLevel); })
      .catch(() => {});
  }, [get]);

  // ResizeObserver → rebuild projection + offscreen canvas + redraw
  const rebuildMap = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !countries) return;

    const { clientWidth: w, clientHeight: h } = container;
    if (w === 0 || h === 0) return;

    canvas.width = w;
    canvas.height = h;
    sizeRef.current = { w, h };

    // Build projection fitted to canvas (with 4px padding)
    const proj = geoNaturalEarth1().fitSize([w - 8, h - 8], GEO_SPHERE);
    // Centre it
    const t = proj.translate();
    proj.translate([t[0] + 4, t[1] + 4]);
    projRef.current = proj;

    // Draw base map to offscreen canvas
    if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas');
    const off = offscreenRef.current;
    off.width = w;
    off.height = h;
    const offCtx = off.getContext('2d');
    if (!offCtx) return;
    drawBaseMap(offCtx, w, h, proj, countries, graticule.current, GEO_SPHERE);

    // Blit + draw nodes
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(off, 0, 0);
    drawNodes(ctx, proj, nodes, discovered, selected, hovered);
  }, [countries, nodes, discovered, selected, hovered]);

  useEffect(() => {
    rebuildMap();
  }, [rebuildMap]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => rebuildMap());
    observer.observe(container);
    return () => observer.disconnect();
  }, [rebuildMap]);

  // Redraw node layer only (fast path)
  const redrawNodes = useCallback(() => {
    const canvas = canvasRef.current;
    const off = offscreenRef.current;
    const proj = projRef.current;
    if (!canvas || !off || !proj) return;
    const { w, h } = sizeRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(off, 0, 0);
    drawNodes(ctx, proj, nodes, discovered, selected, hovered);
  }, [nodes, discovered, selected, hovered]);

  useEffect(() => {
    redrawNodes();
  }, [redrawNodes]);

  // Mouse interactions
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const proj = projRef.current;
    if (!proj) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Nearest node hit
    const near = findNearestNode(proj, nodes, mx, my);
    setHovered(near?.ipv6 ?? null);

    // Country hover via geoContains
    if (countries) {
      const geo = proj.invert?.([mx, my]);
      if (geo) {
        const hit = countries.features.find(f => geoContains(f as GeoJSON.Feature, geo));
        const name = (hit?.properties as { name?: string } | null)?.name ?? null;
        setHoveredCountry(name);
      }
    }
  }, [nodes, countries]);

  const handleMouseLeave = useCallback(() => {
    setHovered(null);
    setHoveredCountry(null);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const proj = projRef.current;
    if (!proj) return;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const near = findNearestNode(proj, nodes, e.clientX - rect.left, e.clientY - rect.top, 16);
    setSelected(near?.ipv6 ?? null);
  }, [nodes]);

  // Scan action
  const startScan = async () => {
    if (!subnet) return;
    setScanning(true);
    setScanStatus('SCAN INITIATED...');
    try {
      await get<{ id: string }>('/scans');
      setScanStatus('PROBING SUBNET...');
      await new Promise(r => setTimeout(r, 800));
      // Reveal all nodes as discovered after scan
      setDiscovered(new Set(nodes.map(n => n.ipv6)));
      setScanStatus(`SCAN COMPLETE — ${nodes.length} HOSTS DISCOVERED`);
      setScanRefreshKey(k => k + 1);
      setTimeout(() => setScanStatus(''), 4000);
    } catch {
      setScanStatus('SCAN FAILED');
      setTimeout(() => setScanStatus(''), 2000);
    } finally {
      setScanning(false);
    }
  };

  const heatColor = HEAT_COLORS[Math.min(heat, 3)];
  const selectedNode = nodes.find(n => n.ipv6 === selected);
  const hoveredNode = hovered ? nodes.find(n => n.ipv6 === hovered) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px', gap: '6px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 700, letterSpacing: '0.15em' }}>
            {subnet?.zoneName ?? '...'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em', marginTop: '1px' }}>
            {subnet?.prefix ?? '—'}  ·  {nodes.length} NODES
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hoveredCountry && (
            <div style={{ fontSize: '9px', color: C_HOVER_LABEL, letterSpacing: '0.1em', opacity: 0.8 }}>
              {hoveredCountry.toUpperCase()}
            </div>
          )}
          <div style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em',
            color: heatColor, textShadow: `0 0 6px ${heatColor}`,
          }}>
            HEAT: {HEAT_LABELS[Math.min(heat, 3)]}
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={startScan}
            disabled={scanning || nodesLoading}
          >
            {scanning ? 'SCAN...' : 'SCAN'}
          </button>
        </div>
      </div>

      {/* Status line */}
      {scanStatus && (
        <div style={{
          fontSize: '10px', color: C_SCAN_TEXT, letterSpacing: '0.08em',
          animation: 'fade-in 0.2s ease', flexShrink: 0,
          textShadow: `0 0 6px ${C_SCAN_TEXT}`,
        }}>
          ▸ {scanStatus}
        </div>
      )}

      {/* Map canvas */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          background: C_OCEAN,
          border: '1px solid var(--border)',
          borderRadius: '2px',
          overflow: 'hidden',
          position: 'relative',
          cursor: hovered ? 'pointer' : 'crosshair',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ display: 'block', width: '100%', height: '100%' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        />
        {nodesLoading && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '10px', color: 'var(--text-dim)',
            letterSpacing: '0.12em', background: 'rgba(7,11,14,0.7)',
          }}>
            LOADING MAP DATA<span style={{ animation: 'blink 0.8s step-start infinite' }}>_</span>
          </div>
        )}
        {/* Hover tooltip for node */}
        {hoveredNode && (
          <div style={{
            position: 'absolute', bottom: '8px', left: '8px',
            background: 'var(--bg-panel-2)', border: '1px solid var(--border)',
            borderLeft: `2px solid ${hoveredNode.isLandmark ? C_LANDMARK : C_NODE_BORDER}`,
            padding: '4px 8px', fontSize: '9px', letterSpacing: '0.08em',
            pointerEvents: 'none', animation: 'fade-in 0.1s ease',
          }}>
            <span style={{ color: 'var(--text-muted)' }}>
              {hoveredNode.isLandmark ? '★ ' : ''}
            </span>
            <span style={{ color: hoveredNode.isLandmark ? C_LANDMARK : C_NODE_BORDER, fontFamily: 'var(--font-mono)' }}>
              {hoveredNode.ipv6}
            </span>
            <span style={{ color: 'var(--text-dim)', marginLeft: '8px' }}>
              {hoveredNode.osArchetypeId.replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Legend + selected info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: '12px', fontSize: '9px', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>
          <span style={{ color: C_NODE_BORDER }}>◆ NODE</span>
          <span style={{ color: C_LANDMARK }}>◆ LANDMARK</span>
          <span style={{ color: 'var(--text-dim)', opacity: 0.5 }}>◆ UNDISCOVERED</span>
        </div>
        {selectedNode && (
          <div style={{
            fontSize: '9px', background: 'var(--bg-panel-2)',
            border: '1px solid var(--border)', borderLeft: `2px solid ${C_SELECTED}`,
            padding: '2px 8px', letterSpacing: '0.08em',
            animation: 'fade-in 0.2s ease',
          }}>
            <span style={{ color: 'var(--text-muted)' }}>TARGET // </span>
            <span style={{ color: C_SELECTED, fontFamily: 'var(--font-mono)' }}>{selectedNode.ipv6}</span>
          </div>
        )}
      </div>
    </div>
  );
}
