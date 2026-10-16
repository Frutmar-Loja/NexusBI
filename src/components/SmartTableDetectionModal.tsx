import React, { useState } from 'react';
import { SheetData } from '../types/dashboard';
import {
  Sparkles,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Bookmark,
  Check
} from 'lucide-react';

interface SmartTableDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetData: SheetData;
  onUpdateHeaderRowIndex: (headerRowIndex: number) => void;
}

export const SmartTableDetectionModal: React.FC<SmartTableDetectionModalProps> = ({
  isOpen,
  onClose,
  sheetData,
  onUpdateHeaderRowIndex
}) => {
  const smart = sheetData.smartDetection;
  const rawGrid = sheetData.rawGrid || smart?.rawGridSample || [];
  const currentHeaderIndex = smart?.boundary.headerRowIndex ?? 0;
  const [selectedHeaderRow, setSelectedHeaderRow] = useState<number>(currentHeaderIndex);

  if (!isOpen || !smart) return null;

  const { boundary, summaries, notes, footers } = smart;

  const handleApplyHeaderChange = (index: number) => {
    setSelectedHeaderRow(index);
    onUpdateHeaderRowIndex(index);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-3xl bg-[#111215] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06] bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
                <span>Detecção Inteligente de Tabelas</span>
                <span className="text-[10px] font-mono font-normal text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                  Ativo
                </span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Isolamento automático de cabeçalhos, resumos, notas de auditoria e totais de rodapé
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content - Scrollable */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Status Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider block">Cabeçalho Real</span>
              <span className="text-base font-semibold text-emerald-300 font-mono tabular-nums">
                Linha {boundary.headerRowIndex + 1}
              </span>
              <span className="text-[11px] text-neutral-400 block mt-0.5">Identificado com precisão</span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider block">Extensão de Dados</span>
              <span className="text-base font-semibold text-white font-mono tabular-nums">
                L{boundary.startDataRowIndex + 1} ~ L{boundary.endDataRowIndex + 1}
              </span>
              <span className="text-[11px] text-neutral-400 block mt-0.5">{sheetData.rowCount} registros válidos</span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider block">Resumos & Metas</span>
              <span className="text-base font-semibold text-white font-mono tabular-nums">
                {summaries.length} item{summaries.length !== 1 ? 's' : ''}
              </span>
              <span className="text-[11px] text-neutral-400 block mt-0.5">Pré-tabela segregados</span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider block">Observações / Notas</span>
              <span className="text-base font-semibold text-white font-mono tabular-nums">
                {notes.length} nota{notes.length !== 1 ? 's' : ''}
              </span>
              <span className="text-[11px] text-neutral-400 block mt-0.5">Isoladas da análise</span>
            </div>
          </div>

          {/* Title or Institutional Metadata Detected */}
          {boundary.detectedTitle && (
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-start gap-3">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider block">Título / Bloco Institucional Detectado</span>
                <p className="text-xs font-medium text-white mt-0.5">{boundary.detectedTitle}</p>
              </div>
            </div>
          )}

          {/* Section 1: Pre-Table Summaries & KPIs */}
          {summaries.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Resumos & Parâmetros Pré-Tabela (Segregados)</span>
                </span>
                <span className="text-[11px] text-neutral-500 font-mono">
                  Não contaminam os dados da tabela
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {summaries.map((s, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <span className="text-[10px] text-neutral-400 font-medium block truncate">{s.label}</span>
                    <span className="text-xs font-semibold text-white font-mono mt-0.5 block truncate">{s.value}</span>
                    {s.rawRowIndex !== undefined && (
                      <span className="text-[9px] text-neutral-500 font-mono block mt-1">Linha {s.rawRowIndex + 1} original</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Observations & Audit Notes */}
          {notes.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-neutral-400" />
                <span>Observações, Ressalvas & Notas de Auditoria</span>
              </span>

              <div className="space-y-1.5">
                {notes.map((n, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs text-neutral-300 flex items-start gap-2">
                    <span className="text-[10px] font-mono text-neutral-500 shrink-0 mt-0.5">
                      {n.type === 'observation' ? 'Obs' : n.type === 'footnote' ? 'Rodapé' : 'Meta'} {n.rawRowIndex !== undefined ? `(L${n.rawRowIndex + 1})` : ''}:
                    </span>
                    <p className="flex-1 text-[11px] text-neutral-300 leading-relaxed">{n.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Post-Table Footers / Totals Disengaged */}
          {footers.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Totais de Rodapé Desacoplados</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {footers.map((f, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between text-xs">
                    <span className="text-neutral-400 font-medium truncate">{f.label}</span>
                    <span className="text-emerald-300 font-mono font-semibold ml-2">{f.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Interactive Header Row Selector & Raw Grid Preview */}
          <div className="space-y-2 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Ajuste da Linha de Cabeçalho</span>
                </span>
                <p className="text-[11px] text-neutral-400">
                  Clique em qualquer linha abaixo se desejar redefinir o ponto de início dos dados
                </p>
              </div>

              <div className="text-xs font-mono text-neutral-400">
                Cabeçalho ativo: <span className="text-emerald-400 font-bold">Linha {selectedHeaderRow + 1}</span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-white/[0.08] bg-[#0A0B0E]">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.03] text-neutral-400 border-b border-white/[0.06]">
                    <th className="py-2 px-3 font-mono text-[11px] w-24 text-center">Linha</th>
                    <th className="py-2 px-3 font-mono text-[11px] w-28">Papel Detectado</th>
                    <th className="py-2 px-3 text-[11px]">Conteúdo das Células</th>
                    <th className="py-2 px-3 text-right text-[11px] w-24">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {rawGrid.slice(0, Math.min(rawGrid.length, 10)).map((row, rIdx) => {
                    const isCurrentHeader = rIdx === selectedHeaderRow;
                    const isBeforeHeader = rIdx < selectedHeaderRow;
                    const populated = row.filter((c: any) => c !== null && c !== undefined && String(c).trim() !== '');

                    return (
                      <tr
                        key={rIdx}
                        className={`transition-colors cursor-pointer ${
                          isCurrentHeader
                            ? 'bg-emerald-500/10 hover:bg-emerald-500/15'
                            : isBeforeHeader
                            ? 'bg-white/[0.01] hover:bg-white/[0.04] text-neutral-400'
                            : 'hover:bg-white/[0.03]'
                        }`}
                        onClick={() => handleApplyHeaderChange(rIdx)}
                      >
                        <td className="py-2 px-3 font-mono text-center text-[11px]">
                          <span className={`inline-block px-1.5 py-0.5 rounded ${isCurrentHeader ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-neutral-500'}`}>
                            L{rIdx + 1}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[11px]">
                          {isCurrentHeader ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold font-mono">
                              <Check className="w-3 h-3" /> Cabeçalho
                            </span>
                          ) : isBeforeHeader ? (
                            <span className="text-neutral-400 text-[10px] font-mono">
                              {rIdx === 0 ? 'Título/Meta' : 'Resumo/Nota'}
                            </span>
                          ) : (
                            <span className="text-neutral-400 text-[10px] font-mono">
                              Dado (Registro #{rIdx - selectedHeaderRow})
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 truncate max-w-[340px] text-[11px]">
                          <div className="flex items-center gap-1.5 truncate">
                            {populated.slice(0, 5).map((cell: any, cIdx: number) => (
                              <span
                                key={cIdx}
                                className={`px-1.5 py-0.5 rounded text-[10px] truncate max-w-[120px] ${
                                  isCurrentHeader
                                    ? 'bg-emerald-500/20 text-emerald-200 font-medium'
                                    : 'bg-white/[0.04] text-neutral-300'
                                }`}
                              >
                                {String(cell)}
                              </span>
                            ))}
                            {populated.length > 5 && (
                              <span className="text-[10px] text-neutral-500">+{populated.length - 5} colunas</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApplyHeaderChange(rIdx);
                            }}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-all whitespace-nowrap ${
                              isCurrentHeader
                                ? 'bg-emerald-500 text-black font-semibold'
                                : 'bg-white/[0.04] hover:bg-white/[0.08] text-neutral-300'
                            }`}
                          >
                            {isCurrentHeader ? 'Ativo' : 'Definir'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/[0.06] bg-white/[0.02] flex items-center justify-between text-xs text-neutral-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-neutral-400" />
            <span>Dados tratados automaticamente sem duplicações nos cálculos de KPIs.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-black bg-white hover:bg-neutral-200 rounded-lg shadow-sm transition-all"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
