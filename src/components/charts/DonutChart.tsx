import React, { useState } from 'react';
import { ColumnType } from '../../types/dashboard';
import { formatCompactNumber } from '../../utils/dataEngine';
import { MousePointerClick } from 'lucide-react';

interface DonutItem {
  label: string;
  value: number;
  count: number;
  percentage: number;
}

interface DonutChartProps {
  data: DonutItem[];
  metricLabel: string;
  metricType: ColumnType;
  title: string;
  subtitle?: string;
  activeCrossFilterValue?: string | null;
  onSelectCategory: (value: string) => void;
}

// Sophisticated Refero palette
const PALETTE = [
  '#10B981', // Emerald
  '#3B82F6', // Cobalt blue
  '#8B5CF6', // Iris purple
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#64748B'  // Slate
];

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  metricLabel,
  metricType,
  title,
  subtitle,
  activeCrossFilterValue,
  onSelectCategory
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-neutral-500 text-xs">
        <p>Sem dados de proporção disponíveis.</p>
      </div>
    );
  }

  const totalValue = data.reduce((acc, curr) => acc + curr.value, 0);

  // SVG Donut geometry
  const size = 160;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  const slices = data.map((item, idx) => {
    const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -currentOffset;
    currentOffset += (item.percentage / 100) * circumference;
    const color = PALETTE[idx % PALETTE.length];

    return {
      ...item,
      color,
      strokeDasharray,
      strokeDashoffset,
      idx
    };
  });

  const activeItem = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-xs font-semibold text-neutral-200 tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-neutral-500">{subtitle}</p>}
        </div>
        <span className="text-[10px] text-neutral-500 flex items-center gap-1 font-mono">
          <MousePointerClick className="w-3 h-3 text-neutral-400" />
          Filtro
        </span>
      </div>

      <div className="flex items-center justify-center gap-5 flex-1 py-1">
        {/* SVG Circle */}
        <div className="relative shrink-0 w-[150px] h-[150px] flex items-center justify-center">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
            {slices.map((slice) => {
              const isSelected = activeCrossFilterValue === slice.label;
              const isHovered = hoveredIdx === slice.idx;

              return (
                <circle
                  key={slice.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke={slice.color}
                  strokeWidth={isHovered || isSelected ? strokeWidth + 3 : strokeWidth}
                  strokeDasharray={slice.strokeDasharray}
                  strokeDashoffset={slice.strokeDashoffset}
                  strokeLinecap="round"
                  className="cursor-pointer transition-all duration-200"
                  opacity={activeCrossFilterValue && !isSelected ? 0.3 : 1}
                  onMouseEnter={() => setHoveredIdx(slice.idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onClick={() => onSelectCategory(slice.label)}
                />
              );
            })}
          </svg>

          {/* Center Info Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-3">
            <span className="text-[10px] text-neutral-400 font-medium truncate max-w-[90px]">
              {activeItem ? activeItem.label : 'Total'}
            </span>
            <span className="text-sm font-semibold text-white font-mono tabular-nums">
              {activeItem
                ? `${activeItem.percentage.toFixed(1)}%`
                : formatCompactNumber(totalValue)}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1 overflow-y-auto max-h-[160px] pr-1">
          {slices.map((slice) => {
            const isSelected = activeCrossFilterValue === slice.label;
            const isDimmed = activeCrossFilterValue && !isSelected;

            return (
              <div
                key={slice.label}
                onClick={() => onSelectCategory(slice.label)}
                onMouseEnter={() => setHoveredIdx(slice.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`flex items-center justify-between text-xs px-2 py-1 rounded-md cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-white/[0.08] text-white font-medium'
                    : isDimmed
                    ? 'opacity-40 hover:opacity-80 text-neutral-400'
                    : 'text-neutral-300 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate pr-2">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="truncate text-[11px]">{slice.label}</span>
                </div>
                <span className="font-mono tabular-nums text-neutral-400 text-[10px]">
                  {slice.percentage.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-2 border-t border-white/[0.05] mt-1">
        <span>Partição percentual</span>
        <span className="font-mono tabular-nums">100% da base</span>
      </div>
    </div>
  );
};
