import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Layers,
  DollarSign,
  BarChart2,
  Calculator,
  AlertTriangle,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Percent,
  FileCheck
} from 'lucide-react';
import { AutoAnalysis } from '../types/dashboard';

interface KPIGridProps {
  kpis: AutoAnalysis['kpis'];
  isFiltered: boolean;
  onToggleAnomalies?: () => void;
  isOnlyAnomaliesActive?: boolean;
}

export const KPIGrid: React.FC<KPIGridProps> = ({
  kpis,
  isFiltered,
  onToggleAnomalies,
  isOnlyAnomaliesActive
}) => {
  const getIcon = (kpi: AutoAnalysis['kpis'][0], index: number) => {
    const key = kpi.key.toLowerCase();
    const label = kpi.label.toLowerCase();

    if (key.includes('client') || label.includes('cliente')) return <Users className="w-3.5 h-3.5 text-emerald-400" />;
    if (key.includes('estado') || label.includes('estado') || label.includes('uf')) return <MapPin className="w-3.5 h-3.5 text-cyan-400" />;
    if (key.includes('situac') || label.includes('situação') || label.includes('ativo')) return <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />;
    if (key.includes('validac') || label.includes('validação') || key.includes('sintaxe')) return <FileCheck className="w-3.5 h-3.5 text-indigo-400" />;
    if (key.includes('pend') || label.includes('pendência') || label.includes('ruptura')) return <AlertCircle className="w-3.5 h-3.5 text-amber-400" />;
    if (kpi.type === 'currency') return <DollarSign className="w-3.5 h-3.5 text-emerald-400" />;
    if (kpi.type === 'percentage') return <Percent className="w-3.5 h-3.5 text-indigo-400" />;
    if (key.includes('sku') || key.includes('record') || index === 1) return <Layers className="w-3.5 h-3.5 text-neutral-300" />;
    if (index === 2) return <Calculator className="w-3.5 h-3.5 text-neutral-300" />;
    return <BarChart2 className="w-3.5 h-3.5 text-neutral-300" />;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full">
      {kpis.map((kpi, idx) => {
        const isPositive = kpi.changePercent !== undefined ? kpi.changePercent >= 0 : true;
        const trend = kpi.growthTrend;
        const warning = kpi.anomalyWarning;

        return (
          <div
            key={kpi.key}
            className="group relative p-4 rounded-xl bg-[#111215] border border-white/[0.07] hover:border-white/[0.12] transition-all flex flex-col justify-between shadow-xs print-card"
          >
            <div>
              {/* Top Row: Metric Label & Subtle Icon */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-medium text-neutral-400 truncate print-text-muted">
                  {kpi.label}
                </span>
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-white/[0.04] border border-white/[0.07]">
                  {getIcon(kpi, idx)}
                </div>
              </div>

              {/* Main Metric Value & Trend Badge */}
              <div className="flex items-baseline gap-2 flex-wrap mt-0.5">
                <span className="text-2xl font-semibold tracking-tight text-white font-mono tabular-nums print-text-dark">
                  {kpi.formatted}
                </span>

                {/* Growth Trend Badge */}
                {trend && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-md ${
                      trend.direction === 'up'
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                        : trend.direction === 'down'
                        ? 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                        : 'text-neutral-400 bg-white/[0.05] border border-white/[0.08]'
                    }`}
                    title={`Crescimento entre períodos: ${trend.periodLabel}`}
                  >
                    {trend.direction === 'up' ? (
                      <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                    ) : trend.direction === 'down' ? (
                      <ArrowDownRight className="w-3 h-3 text-rose-400" />
                    ) : (
                      <Minus className="w-3 h-3 text-neutral-400" />
                    )}
                    {trend.formatted}
                  </span>
                )}

                {/* Legacy delta fallback */}
                {!trend && kpi.changePercent !== undefined && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-md ${
                      isPositive
                        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                        : 'text-rose-400 bg-rose-500/10 border border-rose-500/20'
                    }`}
                  >
                    {isPositive ? '+' : ''}{kpi.changePercent}%
                  </span>
                )}
              </div>
            </div>

            {/* Bottom Row: Anomaly Alert & Subtitle */}
            <div className="mt-3 pt-2.5 border-t border-white/[0.05] space-y-1.5">
              {/* Subtle Anomaly Badge if Present */}
              {warning && (
                <div
                  onClick={onToggleAnomalies}
                  role={onToggleAnomalies ? 'button' : undefined}
                  className={`flex items-center justify-between px-2 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                    isOnlyAnomaliesActive
                      ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                      : 'bg-amber-500/10 hover:bg-amber-500/15 text-amber-300 border border-amber-500/20'
                  }`}
                  title={`${warning.text} detectadas estatisticamente. Clique para filtrar.`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="truncate">{warning.text}</span>
                  </div>
                  <span className="text-[10px] text-amber-400/80 shrink-0 ml-1">
                    {isOnlyAnomaliesActive ? 'Filtro ativo' : 'Filtrar →'}
                  </span>
                </div>
              )}

              {/* Subtext info */}
              <div className="text-[11px] text-neutral-500 flex items-center justify-between print-text-muted">
                <span className="truncate">{kpi.subtext || 'Consolidado da seleção'}</span>
                {isFiltered && (
                  <span className="text-emerald-400/90 font-mono text-[10px] shrink-0 ml-1">Filtrado</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
