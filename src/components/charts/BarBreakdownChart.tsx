import React from 'react';
import { ColumnType } from '../../types/dashboard';
import { formatCompactNumber, formatCurrency, formatNumber } from '../../utils/dataEngine';
import { MousePointerClick } from 'lucide-react';

interface CategoryItem {
  label: string;
  value: number;
  count: number;
  percentage: number;
}

interface BarBreakdownChartProps {
  data: CategoryItem[];
  categoryKey: string;
  categoryLabel: string;
  metricLabel: string;
  metricType: ColumnType;
  title: string;
  subtitle?: string;
  activeCrossFilterValue?: string | null;
  onSelectCategory: (value: string) => void;
}

export const BarBreakdownChart: React.FC<BarBreakdownChartProps> = ({
  data,
  categoryKey,
  categoryLabel,
  metricLabel,
  metricType,
  title,
  subtitle,
  activeCrossFilterValue,
  onSelectCategory
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-neutral-500 text-xs">
        <p>Sem dados para a dimensão {categoryLabel}.</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);

  const formatVal = (v: number) => {
    if (metricType === 'currency') return formatCurrency(v);
    return formatNumber(v);
  };

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex items-center justify-between mb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold text-neutral-200 tracking-tight">{title}</h3>
            {activeCrossFilterValue && (
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md font-mono">
                {activeCrossFilterValue}
              </span>
            )}
          </div>
          <p className="text-[11px] text-neutral-500">
            {subtitle || `Distribuição de ${metricLabel}`}
          </p>
        </div>
        <span className="text-[10px] text-neutral-500 flex items-center gap-1 font-mono">
          <MousePointerClick className="w-3 h-3 text-neutral-400" />
          Clique p/ filtrar
        </span>
      </div>

      <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
        {data.map((item) => {
          const isSelected = activeCrossFilterValue === item.label;
          const isDimmed = activeCrossFilterValue && !isSelected;
          const widthPercent = Math.max((item.value / maxValue) * 100, 2);

          return (
            <div
              key={item.label}
              onClick={() => onSelectCategory(item.label)}
              className={`group cursor-pointer p-2 rounded-lg transition-all border ${
                isSelected
                  ? 'bg-white/[0.08] border-white/[0.2]'
                  : isDimmed
                  ? 'opacity-40 hover:opacity-80 border-transparent bg-transparent'
                  : 'hover:bg-white/[0.04] border-transparent'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={`font-medium truncate max-w-[170px] ${
                  isSelected ? 'text-white' : 'text-neutral-300 group-hover:text-white'
                }`}>
                  {item.label}
                </span>
                <div className="flex items-center gap-2 font-mono tabular-nums text-xs">
                  <span className={isSelected ? 'text-white font-semibold' : 'text-neutral-200'}>
                    {formatVal(item.value)}
                  </span>
                  <span className="text-neutral-500 text-[11px] w-11 text-right">
                    {item.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Minimal bar track */}
              <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isSelected
                      ? 'bg-emerald-400'
                      : isDimmed
                      ? 'bg-neutral-600'
                      : 'bg-emerald-500/80 group-hover:bg-emerald-400'
                  }`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-2 border-t border-white/[0.05] mt-1.5">
        <span>{data.length} segmentos</span>
        <span className="font-mono tabular-nums">100% total</span>
      </div>
    </div>
  );
};
