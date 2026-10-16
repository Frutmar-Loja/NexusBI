import React, { useState } from 'react';
import { formatCompactNumber, formatCurrency, formatNumber } from '../../utils/dataEngine';
import { ColumnType, GrowthTrend } from '../../types/dashboard';
import { ArrowUpRight, ArrowDownRight, Minus, AlertTriangle } from 'lucide-react';

interface TrendPoint {
  label: string;
  date: Date;
  value: number;
  count: number;
  isOutlier?: boolean;
}

interface TrendChartProps {
  data: TrendPoint[];
  metricLabel: string;
  metricType: ColumnType;
  title: string;
  subtitle?: string;
  growthTrend?: GrowthTrend | null;
  onSelectPeriod?: (periodLabel: string) => void;
  selectedPeriod?: string | null;
}

// Generates smooth bezier curves from points
function createSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  let d = `M ${points[0].x},${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return d;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  metricLabel,
  metricType,
  title,
  subtitle,
  growthTrend,
  onSelectPeriod,
  selectedPeriod
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-neutral-500 text-xs">
        <p>Sem dados temporais disponíveis nesta seleção.</p>
      </div>
    );
  }

  const width = 640;
  const height = 230;
  const padding = { top: 20, right: 20, bottom: 32, left: 52 };

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const minValue = 0;

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const getX = (idx: number) => {
    if (data.length === 1) return padding.left + chartWidth / 2;
    return padding.left + (idx / (data.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const ratio = (val - minValue) / (maxValue - minValue);
    return padding.top + chartHeight - ratio * chartHeight;
  };

  const pts = data.map((d, i) => ({ x: getX(i), y: getY(d.value) }));
  const smoothLine = createSmoothPath(pts);
  const areaPath = pts.length > 1
    ? `${smoothLine} L ${pts[pts.length - 1].x},${padding.top + chartHeight} L ${pts[0].x},${padding.top + chartHeight} Z`
    : '';

  const yTicks = [0, maxValue * 0.5, maxValue];

  const formatVal = (v: number) => {
    if (metricType === 'currency') return formatCurrency(v);
    return formatNumber(v);
  };

  const hoveredPoint = hoveredIdx !== null ? data[hoveredIdx] : null;
  const prevPoint = hoveredIdx !== null && hoveredIdx > 0 ? data[hoveredIdx - 1] : null;
  const hoverDiffPct = (hoveredPoint && prevPoint && prevPoint.value > 0)
    ? ((hoveredPoint.value - prevPoint.value) / prevPoint.value) * 100
    : null;

  return (
    <div className="flex flex-col w-full h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-neutral-200 tracking-tight">{title}</h3>
            {growthTrend && (
              <span
                className={`inline-flex items-center gap-0.5 text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-md ${
                  growthTrend.direction === 'up'
                    ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                    : growthTrend.direction === 'down'
                    ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                    : 'text-neutral-400 bg-white/[0.05]'
                }`}
                title="Crescimento entre períodos"
              >
                {growthTrend.direction === 'up' ? (
                  <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                ) : growthTrend.direction === 'down' ? (
                  <ArrowDownRight className="w-3 h-3 text-rose-400" />
                ) : (
                  <Minus className="w-3 h-3 text-neutral-400" />
                )}
                {growthTrend.formatted} MoM
              </span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-neutral-500">{subtitle}</p>}
        </div>

        {/* Live Hover Tooltip Badge */}
        {hoveredPoint ? (
          <div className="flex items-center gap-2 text-xs bg-white/[0.06] border border-white/[0.1] px-2.5 py-1 rounded-md text-white font-mono tabular-nums">
            <span className="text-neutral-400">{hoveredPoint.label}:</span>
            <span className="font-semibold text-emerald-300">{formatVal(hoveredPoint.value)}</span>
            {hoverDiffPct !== null && (
              <span className={`text-[10px] ${hoverDiffPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ({hoverDiffPct >= 0 ? '+' : ''}{hoverDiffPct.toFixed(1)}%)
              </span>
            )}
            {hoveredPoint.isOutlier && (
              <span className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/20 px-1 py-0.2 rounded font-sans">
                <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                Anomalia
              </span>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-neutral-500 font-mono">
            {data.length} períodos
          </span>
        )}
      </div>

      {/* Interactive Chart Canvas */}
      <div className="relative w-full flex-1 min-h-[200px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="cleanAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((tick, i) => {
            const y = getY(tick);
            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] fill-neutral-500 font-mono tabular-nums"
                >
                  {formatCompactNumber(tick)}
                </text>
              </g>
            );
          })}

          {/* Gradient area */}
          {areaPath && <path d={areaPath} fill="url(#cleanAreaGradient)" />}

          {/* Line stroke */}
          {smoothLine && (
            <path
              d={smoothLine}
              fill="none"
              stroke="#10B981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Vertical cursor guide when hovered */}
          {hoveredIdx !== null && (
            <line
              x1={getX(hoveredIdx)}
              y1={padding.top}
              x2={getX(hoveredIdx)}
              y2={padding.top + chartHeight}
              stroke="rgba(255, 255, 255, 0.2)"
              strokeDasharray="2 2"
              strokeWidth="1"
            />
          )}

          {/* Points & Hit Areas */}
          {data.map((d, i) => {
            const cx = getX(i);
            const cy = getY(d.value);
            const isHovered = hoveredIdx === i;
            const isSelected = selectedPeriod === d.label;
            const isOutlier = d.isOutlier;

            return (
              <g key={i}>
                {/* Outlier indicator */}
                {isOutlier && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r="6"
                    fill="transparent"
                    stroke="#F59E0B"
                    strokeWidth="1.5"
                    className="pointer-events-none"
                  />
                )}

                {/* Invisible hit anchor */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="14"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => onSelectPeriod && onSelectPeriod(d.label)}
                />

                {/* Dot */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered || isSelected ? 4.5 : isOutlier ? 3.5 : 2.5}
                  fill={isOutlier ? '#F59E0B' : isSelected ? '#FFFFFF' : '#10B981'}
                  stroke="#111215"
                  strokeWidth="1.5"
                  className="pointer-events-none transition-all"
                />

                {/* X-axis ticks */}
                {(data.length <= 7 || i % Math.ceil(data.length / 7) === 0 || i === data.length - 1) && (
                  <text
                    x={cx}
                    y={height - padding.bottom + 16}
                    textAnchor="middle"
                    className={`text-[10px] font-mono ${isOutlier ? 'fill-amber-400 font-semibold' : 'fill-neutral-500'}`}
                  >
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-2 border-t border-white/[0.05] mt-1">
        <span>Monitoramento temporal contínuo</span>
        <span className="font-mono tabular-nums">
          {growthTrend ? `Trajetória ${growthTrend.direction === 'up' ? 'ascendente' : growthTrend.direction === 'down' ? 'descendente' : 'estável'}` : 'Série contínua'}
        </span>
      </div>
    </div>
  );
};
