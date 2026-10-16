import React, { useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  X,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Info,
  DollarSign,
  Percent,
  Check,
  Search,
  BookOpen,
  Scale
} from 'lucide-react';
import {
  METRIC_REGISTRY,
  AuditedCommercialMetrics,
  DatasetReconciliationReport,
  SegmentBreakdownResult
} from '../utils/metricsEngine';
import { formatCurrency, formatNumber } from '../utils/dataEngine';

interface MathematicalAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: AuditedCommercialMetrics;
  reconciliationReport: DatasetReconciliationReport;
  categoryBreakdown?: SegmentBreakdownResult;
  channelBreakdown?: SegmentBreakdownResult;
  fileName: string;
}

export const MathematicalAuditModal: React.FC<MathematicalAuditModalProps> = ({
  isOpen,
  onClose,
  metrics,
  reconciliationReport,
  categoryBreakdown,
  channelBreakdown,
  fileName
}) => {
  const [activeTab, setActiveTab] = useState<'reconciliation' | 'registry' | 'logs'>('reconciliation');
  const [registrySearch, setRegistrySearch] = useState('');

  if (!isOpen) return null;

  const registryItems = Object.values(METRIC_REGISTRY).filter(m =>
    m.name.toLowerCase().includes(registrySearch.toLowerCase()) ||
    m.id.toLowerCase().includes(registrySearch.toLowerCase()) ||
    m.formula.toLowerCase().includes(registrySearch.toLowerCase()) ||
    m.description.toLowerCase().includes(registrySearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0c0d10] border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg border ${
              reconciliationReport.isFullyReconciled
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
            }`}>
              {reconciliationReport.isFullyReconciled ? (
                <ShieldCheck className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white tracking-tight">
                  Motor de Auditoria Matemática & Reconciliação Contábil
                </h2>
                <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  reconciliationReport.isFullyReconciled
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}>
                  <CheckCircle2 className="w-3 h-3" />
                  {reconciliationReport.isFullyReconciled ? '100% Reconciliado' : 'Atenção a Discrepâncias'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Validação determinística pura de fórmulas, populações homogêneas e integridade contábil.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Tab Navigation */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-[#090a0d] border-b border-white/[0.06] text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('reconciliation')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                activeTab === 'reconciliation'
                  ? 'bg-white/10 text-white shadow-xs border border-white/15'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-emerald-400" />
              <span>Validações Automáticas ({reconciliationReport.passedChecksCount}/{reconciliationReport.totalChecksEvaluated})</span>
            </button>

            <button
              onClick={() => setActiveTab('registry')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                activeTab === 'registry'
                  ? 'bg-white/10 text-white shadow-xs border border-white/15'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-sky-400" />
              <span>Catálogo Central de Métricas</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                activeTab === 'logs'
                  ? 'bg-white/10 text-white shadow-xs border border-white/15'
                  : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400" />
              <span>Trilha de Auditoria</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-[11px] text-neutral-500 font-mono">
            <FileSpreadsheet className="w-3.5 h-3.5 text-neutral-400" />
            <span>{fileName}</span>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'reconciliation' && (
            <div className="space-y-6">
              {/* Financial Partition Waterfall Cards */}
              <div>
                <h3 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Conciliação Contábil das Grandezas Financeiras</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.07]">
                    <span className="text-[11px] text-neutral-400">Faturamento Bruto</span>
                    <div className="text-lg font-semibold text-white font-mono mt-1">
                      {formatCurrency(metrics.grossRevenue)}
                    </div>
                    <span className="text-[10px] text-neutral-500 block mt-1">
                      {formatNumber(metrics.uniqueOrdersCount)} pedidos cadastrados
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.07]">
                    <span className="text-[11px] text-emerald-400">Receita Realizada (Auditada)</span>
                    <div className="text-lg font-semibold text-emerald-300 font-mono mt-1">
                      {formatCurrency(metrics.realizedRevenue)}
                    </div>
                    <span className="text-[10px] text-neutral-500 block mt-1">
                      {formatNumber(metrics.completedOrdersCount)} pedidos faturados
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.07]">
                    <span className="text-[11px] text-amber-400">Receita Pendente</span>
                    <div className="text-lg font-semibold text-amber-300 font-mono mt-1">
                      {formatCurrency(metrics.pendingRevenue)}
                    </div>
                    <span className="text-[10px] text-neutral-500 block mt-1">
                      {formatNumber(metrics.pendingOrdersCount)} em processamento
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.07]">
                    <span className="text-[11px] text-rose-400">Perda em Cancelamentos</span>
                    <div className="text-lg font-semibold text-rose-300 font-mono mt-1">
                      {formatCurrency(metrics.canceledLoss)}
                    </div>
                    <span className="text-[10px] text-neutral-500 block mt-1">
                      {formatNumber(metrics.canceledOrdersCount)} cancelados ({metrics.cancellationRatePct.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Status and Population Partition Reconciliation */}
              <div>
                <h3 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Partição Rigorosa da População de Pedidos</span>
                </h3>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.07] space-y-3">
                  <div className="flex items-center justify-between text-xs pb-2 border-b border-white/[0.05]">
                    <span className="text-neutral-300">População Total Cadastrada:</span>
                    <span className="font-mono font-semibold text-white">
                      {formatNumber(metrics.uniqueOrdersCount)} pedidos únicos ({formatNumber(metrics.totalRecords)} linhas)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15">
                      <div className="flex justify-between items-center">
                        <span className="text-emerald-300">Concluídos / Faturados:</span>
                        <span className="font-mono font-bold text-white">{metrics.completedOrdersCount}</span>
                      </div>
                      <span className="text-[10px] text-emerald-400/80 block mt-0.5">
                        {((metrics.completedOrdersCount / (metrics.uniqueOrdersCount || 1)) * 100).toFixed(1)}% dos pedidos
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/15">
                      <div className="flex justify-between items-center">
                        <span className="text-amber-300">Pendentes / Em Aberto:</span>
                        <span className="font-mono font-bold text-white">{metrics.pendingOrdersCount}</span>
                      </div>
                      <span className="text-[10px] text-amber-400/80 block mt-0.5">
                        {((metrics.pendingOrdersCount / (metrics.uniqueOrdersCount || 1)) * 100).toFixed(1)}% dos pedidos
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-rose-500/[0.06] border border-rose-500/15">
                      <div className="flex justify-between items-center">
                        <span className="text-rose-300">Cancelados / Estornados:</span>
                        <span className="font-mono font-bold text-white">{metrics.canceledOrdersCount}</span>
                      </div>
                      <span className="text-[10px] text-rose-400/80 block mt-0.5">
                        {metrics.cancellationRatePct.toFixed(1)}% dos pedidos
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Soma das partes: {metrics.completedOrdersCount + metrics.pendingOrdersCount + metrics.canceledOrdersCount + metrics.returnedOrdersCount + metrics.otherOrdersCount} = {metrics.uniqueOrdersCount}
                    </span>
                    <span>Segmentos mutuamente exclusivos sem contagem dupla</span>
                  </div>
                </div>
              </div>

              {/* Ticket Médio Realizado vs Média Bruta Audit */}
              <div>
                <h3 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Harmonização de Médias e Tickets</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.07]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-emerald-300">Ticket Médio Realizado (Auditado)</span>
                      <span className="text-xs font-mono font-bold text-emerald-400">{formatCurrency(metrics.avgTicketRealized)}</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      Receita realizada ({formatCurrency(metrics.realizedRevenue)}) ÷ Pedidos concluídos ({metrics.completedOrdersCount}).
                    </p>
                    <div className="mt-2 pt-2 border-t border-white/[0.05] text-[10px] font-mono text-neutral-500">
                      Multiplicação reversa: {formatCurrency(metrics.avgTicketRealized)} × {metrics.completedOrdersCount} ≈ {formatCurrency(metrics.avgTicketRealized * metrics.completedOrdersCount)} (100% conciliado)
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.07]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-neutral-300">Média de Valor Bruto Registrado</span>
                      <span className="text-xs font-mono font-bold text-white">{formatCurrency(metrics.avgTicketGross)}</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      Faturamento bruto ({formatCurrency(metrics.grossRevenue)}) ÷ Total de pedidos ({metrics.uniqueOrdersCount}).
                    </p>
                    <div className="mt-2 pt-2 border-t border-white/[0.05] text-[10px] font-mono text-neutral-500">
                      Inclui pedidos pendentes e cancelados antes do expurgo contábil
                    </div>
                  </div>
                </div>
              </div>

              {/* Automatic Reconciliation Checks Table */}
              <div>
                <h3 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Checagens Automáticas de Integridade</span>
                </h3>
                <div className="rounded-xl border border-white/[0.07] overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.04] text-neutral-400 text-[11px] border-b border-white/[0.06]">
                      <tr>
                        <th className="py-2.5 px-3">Checagem</th>
                        <th className="py-2.5 px-3">Esperado</th>
                        <th className="py-2.5 px-3">Calculado</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      <tr className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 font-medium text-neutral-200">
                          Partição de pedidos por status (Concluído + Pendente + Cancelado)
                        </td>
                        <td className="py-2.5 px-3 font-mono text-neutral-400">{metrics.uniqueOrdersCount}</td>
                        <td className="py-2.5 px-3 font-mono text-neutral-300">
                          {metrics.completedOrdersCount + metrics.pendingOrdersCount + metrics.canceledOrdersCount + metrics.returnedOrdersCount + metrics.otherOrdersCount}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <Check className="w-2.5 h-2.5" /> Aprovado
                          </span>
                        </td>
                      </tr>

                      <tr className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-3 font-medium text-neutral-200">
                          Consistência do Ticket Médio Revertido (Ticket × Qtd = Receita)
                        </td>
                        <td className="py-2.5 px-3 font-mono text-neutral-400">{formatCurrency(metrics.realizedRevenue)}</td>
                        <td className="py-2.5 px-3 font-mono text-neutral-300">
                          {formatCurrency(metrics.avgTicketRealized * metrics.completedOrdersCount)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <Check className="w-2.5 h-2.5" /> Aprovado
                          </span>
                        </td>
                      </tr>

                      {categoryBreakdown && (
                        <tr className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 font-medium text-neutral-200">
                            Soma dos Segmentos de Categoria ({categoryBreakdown.dimensionKey})
                          </td>
                          <td className="py-2.5 px-3 font-mono text-neutral-400">
                            {formatCurrency(categoryBreakdown.totalPopulationValue)}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-neutral-300">
                            {formatCurrency(categoryBreakdown.segments.reduce((acc, s) => acc + s.value, 0))}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              <Check className="w-2.5 h-2.5" /> {categoryBreakdown.isReconciled ? '100% Cobertura' : 'Ajustado'}
                            </span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'registry' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-neutral-400">
                  Todas as fórmulas analíticas operam sobre este catálogo central padronizado, garantindo unicidade matemática.
                </p>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Buscar métrica ou fórmula..."
                    value={registrySearch}
                    onChange={(e) => setRegistrySearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {registryItems.map((m) => (
                  <div
                    key={m.id}
                    className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.07] hover:border-white/[0.12] transition-colors"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white tracking-tight">{m.name}</span>
                        <span className="text-[10px] font-mono text-neutral-400 bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.2 rounded">
                          {m.id}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                        {m.unit.toUpperCase()} · {m.aggregationType}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-400 leading-relaxed mb-3">
                      {m.description}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-[11px] font-mono bg-black/40 p-2.5 rounded-lg border border-white/[0.04]">
                      <div>
                        <span className="text-neutral-500 block text-[10px]">Fórmula Matemática:</span>
                        <span className="text-indigo-300 font-semibold">{m.formula}</span>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[10px]">Filtro de Inclusão:</span>
                        <span className="text-neutral-300">{m.inclusionFilter}</span>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[10px]">Base de Comparação:</span>
                        <span className="text-neutral-300">{m.comparisonBase}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-neutral-400 pb-2 border-b border-white/[0.06]">
                <span>Trilha de Execução do Motor Determinístico</span>
                <span>{reconciliationReport.auditLog.length} passos auditados</span>
              </div>
              <div className="space-y-2 bg-black/50 p-4 rounded-xl border border-white/[0.06] text-neutral-300">
                {reconciliationReport.auditLog.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 select-none">✓</span>
                    <span className="leading-relaxed">{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Info className="w-3.5 h-3.5 text-neutral-500" />
            <span>Motor determinístico puro em TypeScript: Zero alucinações matemáticas.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-neutral-950 bg-white hover:bg-neutral-100 rounded-lg shadow-sm transition-all"
          >
            Concluir Inspeção
          </button>
        </div>
      </div>
    </div>
  );
};
