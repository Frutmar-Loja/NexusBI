import React, { useState, useMemo } from 'react';
import { ExecutiveInsight, InsightCategory } from '../types/dashboard';
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  RefreshCw,
  Cpu,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Info
} from 'lucide-react';

interface ExecutiveInsightsPanelProps {
  insights: ExecutiveInsight[];
  archetypeLabel: string;
  isLoadingAi?: boolean;
  onRefreshAi?: () => void;
  activeFilterName?: string | null;
  isAiPowered?: boolean;
  extractedSummaries?: import('../types/dashboard').ExtractedSummaryItem[];
  extractedNotes?: import('../types/dashboard').ExtractedNoteItem[];
}

export const ExecutiveInsightsPanel: React.FC<ExecutiveInsightsPanelProps> = ({
  insights,
  archetypeLabel,
  isLoadingAi = false,
  onRefreshAi,
  activeFilterName,
  isAiPowered = false,
  extractedSummaries,
  extractedNotes
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'all' | InsightCategory>('all');

  // Normalize category in case of legacy cache
  const normalizedInsights = useMemo(() => {
    if (!insights) return [];
    return insights.map((item) => {
      let category = item.category;
      if (!category) {
        if (item.isHypothesis || item.type === 'recommendation') {
          category = 'suggested_opportunity';
        } else if (item.type === 'risk') {
          category = 'quality_alert';
        } else {
          category = 'verified_fact';
        }
      }
      return { ...item, category };
    });
  }, [insights]);

  const categoryCounts = useMemo(() => {
    const counts = {
      all: normalizedInsights.length,
      verified_fact: 0,
      quality_alert: 0,
      suggested_opportunity: 0
    };
    normalizedInsights.forEach((item) => {
      if (item.category in counts) {
        counts[item.category as InsightCategory]++;
      }
    });
    return counts;
  }, [normalizedInsights]);

  const filteredInsights = useMemo(() => {
    if (selectedCategory === 'all') return normalizedInsights;
    return normalizedInsights.filter((item) => item.category === selectedCategory);
  }, [normalizedInsights, selectedCategory]);

  if (!insights || insights.length === 0) return null;

  const getCategoryBadge = (category: InsightCategory) => {
    switch (category) {
      case 'verified_fact':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Fato Verificado</span>
          </span>
        );
      case 'quality_alert':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Alerta de Qualidade</span>
          </span>
        );
      case 'suggested_opportunity':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded">
            <Lightbulb className="w-3 h-3 text-sky-400 shrink-0" />
            <span>Oportunidade Sugerida</span>
          </span>
        );
      default:
        return null;
    }
  };

  const getInsightIcon = (item: ExecutiveInsight) => {
    if (item.category === 'suggested_opportunity') {
      return <Lightbulb className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    }
    if (item.category === 'quality_alert') {
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
    if (item.type === 'trend') {
      return <ArrowUpRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
    }
    return <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
  };

  return (
    <div className="w-full rounded-xl bg-[#111215] border border-white/[0.07] transition-all overflow-hidden print-card shadow-xs">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06] flex-wrap gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center justify-center w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3 h-3" />
          </div>
          <span className="text-xs font-semibold text-white tracking-tight">
            Insights Executivos Categorizados
          </span>
          <span className="text-xs text-neutral-600 hidden sm:inline" aria-hidden="true">·</span>
          <span className="text-xs text-neutral-400 font-medium">
            {archetypeLabel}
          </span>

          <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
            <CheckCircle2 className="w-2.5 h-2.5" />
            Auditado sem Extrapolações
          </span>

          {isAiPowered && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
              <Cpu className="w-2.5 h-2.5 text-emerald-400" />
              IA Gemini Ativa
            </span>
          )}

          {extractedSummaries && extractedSummaries.length > 0 && (
            <span
              className="text-[10px] font-mono text-neutral-300 bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 rounded-md truncate max-w-[200px]"
              title={`${extractedSummaries[0].label}: ${extractedSummaries[0].value}`}
            >
              {extractedSummaries[0].label}: {extractedSummaries[0].value}
            </span>
          )}

          {activeFilterName && (
            <span className="text-[10px] font-mono text-neutral-300 bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 rounded-md truncate max-w-[200px]">
              Filtro: {activeFilterName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {onRefreshAi && (
            <button
              onClick={onRefreshAi}
              disabled={isLoadingAi}
              title="Aprofundar narrativa analítica com IA"
              className="flex items-center gap-1 text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] px-2.5 py-1 rounded-md transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 text-neutral-300 ${isLoadingAi ? 'animate-spin' : ''}`} />
              <span>{isLoadingAi ? 'Analisando...' : 'Aprofundar com IA'}</span>
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-neutral-200 px-2 py-1 rounded-md hover:bg-white/[0.04] transition-colors"
          >
            <span>{isExpanded ? 'Recolher' : 'Expandir'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Category Tabs Bar */}
      {isExpanded && (
        <div className="px-4 py-2 bg-[#0c0d0f] border-b border-white/[0.05] flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-all flex items-center gap-1.5 ${
                selectedCategory === 'all'
                  ? 'bg-white/10 text-white shadow-xs border border-white/15'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <span>Todos os Insights</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-white/10 text-neutral-300">
                {categoryCounts.all}
              </span>
            </button>

            <button
              onClick={() => setSelectedCategory('verified_fact')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-all flex items-center gap-1.5 ${
                selectedCategory === 'verified_fact'
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-neutral-400 hover:text-emerald-300 hover:bg-emerald-500/[0.06]'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Fatos Verificados</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300">
                {categoryCounts.verified_fact}
              </span>
            </button>

            <button
              onClick={() => setSelectedCategory('quality_alert')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-all flex items-center gap-1.5 ${
                selectedCategory === 'quality_alert'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'text-neutral-400 hover:text-amber-300 hover:bg-amber-500/[0.06]'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span>Alertas de Qualidade</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300">
                {categoryCounts.quality_alert}
              </span>
            </button>

            <button
              onClick={() => setSelectedCategory('suggested_opportunity')}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-all flex items-center gap-1.5 ${
                selectedCategory === 'suggested_opportunity'
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                  : 'text-neutral-400 hover:text-sky-300 hover:bg-sky-500/[0.06]'
              }`}
            >
              <Lightbulb className="w-3 h-3 text-sky-400" />
              <span>Oportunidades Sugeridas</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-sky-500/20 text-sky-300">
                {categoryCounts.suggested_opportunity}
              </span>
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-neutral-500">
            <Info className="w-3 h-3 text-neutral-400" />
            <span>Separação rigorosa entre comprovação matemática e hipóteses comerciais.</span>
          </div>
        </div>
      )}

      {/* Expanded Insights Cards */}
      {isExpanded && (
        <div className="p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-in fade-in">
          {isLoadingAi ? (
            /* Skeleton loader */
            [1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.05] animate-pulse space-y-2.5"
              >
                <div className="flex justify-between items-center">
                  <div className="h-3 bg-white/[0.08] rounded w-24"></div>
                  <div className="h-3 bg-white/[0.08] rounded w-12"></div>
                </div>
                <div className="h-2.5 bg-white/[0.05] rounded w-full"></div>
                <div className="h-2.5 bg-white/[0.05] rounded w-4/5"></div>
              </div>
            ))
          ) : filteredInsights.length === 0 ? (
            <div className="col-span-full py-8 text-center bg-white/[0.01] rounded-lg border border-dashed border-white/[0.08]">
              <p className="text-xs text-neutral-400">
                Nenhum insight encontrado para a categoria selecionada.
              </p>
              <button
                onClick={() => setSelectedCategory('all')}
                className="mt-2 text-xs text-emerald-400 hover:underline"
              >
                Ver todos os insights ({categoryCounts.all})
              </button>
            </div>
          ) : (
            filteredInsights.map((item) => {
              const isOpportunity = item.category === 'suggested_opportunity' || item.isHypothesis;
              const isQuality = item.category === 'quality_alert';

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-lg transition-all flex flex-col justify-between ${
                    isQuality
                      ? 'border border-amber-500/25 hover:border-amber-500/40 bg-amber-500/[0.02]'
                      : isOpportunity
                      ? 'border border-sky-500/25 hover:border-sky-500/40 bg-sky-500/[0.02]'
                      : 'border border-white/[0.07] hover:border-emerald-500/30 bg-white/[0.02]'
                  }`}
                >
                  <div>
                    {/* Category Label & Metric Badge */}
                    <div className="flex items-center justify-between gap-1.5 mb-2.5">
                      {getCategoryBadge(item.category)}
                      {item.metricBadge && (
                        <span className="text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-300 shrink-0 border border-white/[0.06]">
                          {item.metricBadge}
                        </span>
                      )}
                    </div>

                    {/* Card Title with Icon */}
                    <div className="flex items-start gap-1.5 mb-2">
                      <div className="mt-0.5">{getInsightIcon(item)}</div>
                      <h4 className="text-xs font-semibold text-neutral-100 leading-snug">
                        {item.title}
                      </h4>
                    </div>

                    {/* Description */}
                    <p className="text-[11px] text-neutral-400 leading-relaxed font-normal">
                      {item.description}
                    </p>

                    {/* Specific Disclaimer for Suggested Opportunities */}
                    {isOpportunity && (
                      <div className="mt-2 text-[10px] bg-sky-500/10 border border-sky-500/20 rounded p-2 text-sky-200/90 flex items-start gap-1.5 font-normal">
                        <Sparkles className="w-3 h-3 text-sky-400 shrink-0 mt-0.5" />
                        <span className="leading-tight">
                          <strong className="font-semibold text-sky-300">Hipótese Comercial: </strong>
                          {item.hypothesisDisclaimer ||
                            'Sugestão estratégica a ser validada pela diretoria; não é um fato garantido pela planilha.'}
                        </span>
                      </div>
                    )}

                    {/* Verifiable Facts List */}
                    {item.verifiableFacts && item.verifiableFacts.length > 0 && (
                      <div className="mt-2.5 space-y-1 bg-black/40 rounded-md p-2 border border-white/[0.04]">
                        <div className="text-[9px] font-mono text-neutral-400 flex items-center gap-1 font-semibold uppercase tracking-wider">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                          <span>Fatos Auditados:</span>
                        </div>
                        <div className="space-y-0.5">
                          {item.verifiableFacts.map((fact, idx) => (
                            <div key={idx} className="text-[10px] font-mono text-neutral-300 flex items-start gap-1">
                              <span className="text-emerald-500/70 shrink-0 font-bold">✓</span>
                              <span className="leading-tight">{fact}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Business Impact Note */}
                    {item.businessImpact && (
                      <div className="mt-2 text-[10px] leading-snug text-neutral-400">
                        <span className="font-semibold text-neutral-300">Relevância ao Negócio: </span>
                        <span>{item.businessImpact}</span>
                      </div>
                    )}

                    {/* Actionable Step */}
                    {item.actionableStep && (
                      <div className="mt-2 text-[10px] text-emerald-400/95 font-mono leading-snug flex items-start gap-1.5 bg-emerald-500/[0.06] border border-emerald-500/15 rounded px-2 py-1.5">
                        <ArrowRight className="w-3 h-3 mt-0.5 text-emerald-400 shrink-0" />
                        <span>{item.actionableStep}</span>
                      </div>
                    )}
                  </div>

                  {/* Audit Evidence Footer */}
                  <div className="mt-3 pt-2 border-t border-white/[0.04] text-[9px] text-neutral-500 flex items-center justify-between font-mono gap-1">
                    <span
                      className="truncate text-neutral-400 flex items-center gap-1"
                      title={item.evidence || 'Verificado nos dados da planilha'}
                    >
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                      <span className="truncate">{item.evidence || 'Auditado na planilha'}</span>
                    </span>
                    <span className="shrink-0 text-neutral-500">
                      {item.category === 'verified_fact'
                        ? 'Fato Comprovado'
                        : item.category === 'quality_alert'
                        ? 'Auditoria de Qualidade'
                        : 'Hipótese Comercial'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
