import { useState, useMemo, useRef } from "react";

type Waypoint = [number, number];

export function WaypointGraph({
  waypoints,
  title,
  carWidth = 2.0,
  sampleRateHz = 5, // Used to estimate timestamp t = index / sampleRateHz
}: {
  waypoints: Waypoint[];
  title: string;
  carWidth?: number;
  sampleRateHz?: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Canvas ViewBox scale dimensions
  const svgWidth = 500;
  const svgHeight = 280;
  const padding = { left: 45, right: 25, top: 25, bottom: 40 };
  const graphW = svgWidth - padding.left - padding.right;
  const graphH = svgHeight - padding.top - padding.bottom;

  // Extents computation
  const bounds = useMemo(() => {
    if (!waypoints.length) return null;
    const xs = [0, ...waypoints.map(([x]) => x)];
    const ys = [0, ...waypoints.map(([, y]) => y)];

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs, 25);
    const minY = Math.min(...ys, -3);
    const maxY = Math.max(...ys, 3);

    const xSpan = Math.max(maxX - minX, 1) * 1.15;
    const ySpan = Math.max(maxY - minY, 1) * 1.3;

    return { minX, maxX, minY, maxY, xSpan, ySpan };
  }, [waypoints]);

  if (!waypoints.length || !bounds) return null;

  const { minX, minY, xSpan, ySpan } = bounds;

  // Transform Cartesian meters -> SVG pixels
  const toSvg = (x: number, y: number) => ({
    x: padding.left + ((x - minX) / xSpan) * graphW,
    y: padding.top + graphH - ((y - minY) / ySpan) * graphH,
  });

  const fullWaypoints: Waypoint[] = [[0, 0], ...waypoints];
  const mainPoints = fullWaypoints.map(([x, y]) => toSvg(x, y));

  // Generate dynamic drivable lane corridor ribbon
  const leftBoundary: { x: number; y: number }[] = [];
  const rightBoundary: { x: number; y: number }[] = [];

  for (let i = 0; i < fullWaypoints.length; i++) {
    const [cx, cy] = fullWaypoints[i];
    let dx = 1;
    let dy = 0;

    if (i < fullWaypoints.length - 1) {
      dx = fullWaypoints[i + 1][0] - cx;
      dy = fullWaypoints[i + 1][1] - cy;
    } else if (i > 0) {
      dx = cx - fullWaypoints[i - 1][0];
      dy = cy - fullWaypoints[i - 1][1];
    }

    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const halfWidth = carWidth / 2;

    leftBoundary.push(toSvg(cx + nx * halfWidth, cy + ny * halfWidth));
    rightBoundary.push(toSvg(cx - nx * halfWidth, cy - ny * halfWidth));
  }

  const corridorPathD =
    `M ${leftBoundary.map((p) => `${p.x},${p.y}`).join(" L ")} ` +
    `L ${rightBoundary.slice().reverse().map((p) => `${p.x},${p.y}`).join(" L ")} Z`;

  const pathD = `M ${mainPoints.map((p) => `${p.x},${p.y}`).join(" L ")}`;

  // Find nearest waypoint on pointer hover
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * svgWidth;
    const mouseY = ((e.clientY - rect.top) / rect.height) * svgHeight;

    let closestIndex = 0;
    let minDistance = Infinity;

    mainPoints.forEach((pt, index) => {
      const dist = Math.hypot(pt.x - mouseX, pt.y - mouseY);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = index;
      }
    });

    setHoveredIdx(closestIndex);
  };

  const activeIdx = hoveredIdx ?? (mainPoints.length - 1);
  const activePt = mainPoints[activeIdx];
  const activeData = fullWaypoints[activeIdx];
  const activeTime = (activeIdx / sampleRateHz).toFixed(1);

  const xTicks = Array.from({ length: 6 }, (_, i) => minX + (xSpan / 5) * i);
  const yTicks = Array.from({ length: 5 }, (_, i) => minY + (ySpan / 4) * i);
  const egoOrigin = toSvg(0, 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm select-none">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {title}
        </span>
        <span className="text-xs text-slate-400 font-mono">
          Hover/drag to inspect
        </span>
      </div>

      <div className="relative w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50/50">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto cursor-crosshair touch-none"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoveredIdx(null)}
          role="img"
          aria-label={title}
        >
          {/* Grid Lines */}
          {xTicks.map((xVal, i) => {
            const p1 = toSvg(xVal, minY);
            const p2 = toSvg(xVal, minY + ySpan);
            return (
              <g key={`x-grid-${i}`}>
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
                <text x={p1.x} y={svgHeight - 16} fontSize="9" fill="#94a3b8" textAnchor="middle">
                  {Math.round(xVal)}m
                </text>
              </g>
            );
          })}

          {yTicks.map((yVal, i) => {
            const p1 = toSvg(minX, yVal);
            const p2 = toSvg(minX + xSpan, yVal);
            return (
              <g key={`y-grid-${i}`}>
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
                <text x={padding.left - 8} y={p1.y + 3} fontSize="9" fill="#94a3b8" textAnchor="end">
                  {yVal.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Drivable Path Ribbon */}
          <path d={corridorPathD} fill="#cbd5e1" fillOpacity="0.4" />

          {/* Trajectory Dashed Path */}
          <path d={pathD} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" />

          {/* Interactive Target Dots */}
          {mainPoints.map((p, idx) => (
            <circle
              key={`point-${idx}`}
              cx={p.x}
              cy={p.y}
              r={idx === activeIdx ? 5 : 2.5}
              fill={idx === activeIdx ? "#2563eb" : "#60a5fa"}
              className="transition-all duration-75"
            />
          ))}

          {/* Hover Crosshairs & Guide Lines */}
          {hoveredIdx !== null && activePt && (
            <g className="pointer-events-none">
              <line
                x1={activePt.x}
                y1={padding.top}
                x2={activePt.x}
                y2={padding.top + graphH}
                stroke="#2563eb"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.5"
              />
              <line
                x1={padding.left}
                y1={activePt.y}
                x2={padding.left + graphW}
                y2={activePt.y}
                stroke="#2563eb"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.5"
              />
              <circle cx={activePt.x} cy={activePt.y} r={8} fill="#2563eb" fillOpacity="0.2" />
            </g>
          )}

          {/* Ego Vehicle Box at (0,0) */}
          <g transform={`translate(${egoOrigin.x - 7}, ${egoOrigin.y - 12})`}>
            <rect width="14" height="24" rx="3" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1.5" />
            <text x="18" y="15" fontSize="10" fontWeight="600" fill="#334155">
              Ego vehicle
            </text>
          </g>

          {/* Axis Titles */}
          <text x={svgWidth / 2} y={svgHeight - 2} fontSize="9" fill="#64748b" textAnchor="middle" fontWeight="500">
            x: forward distance (m)
          </text>
          <text
            x={12}
            y={graphH / 2 + padding.top}
            fontSize="9"
            fill="#64748b"
            textAnchor="middle"
            fontWeight="500"
            transform={`rotate(-90 12 ${graphH / 2 + padding.top})`}
          >
            y: lateral distance (m), left +
          </text>
        </svg>

        {/* Dynamic Waypoint Readout Bar */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-white/80 px-3 py-1.5 text-xs text-slate-600 font-mono">
          <span>
            Waypoint {activeIdx} of {fullWaypoints.length - 1} — t = {activeTime}s
          </span>
          <span>
            x = {activeData[0].toFixed(1)}m, y = {activeData[1].toFixed(1)}m {activeData[1] >= 0 ? "left" : "right"}
          </span>
        </div>
      </div>
    </div>
  );
}