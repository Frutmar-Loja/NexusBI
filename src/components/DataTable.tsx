import React, { useState, useMemo } from 'react';
import { ColumnSchema } from '../types/dashboard';
import { formatCurrency, formatNumber, parseDateValue, cleanNumericValue, formatCPF, formatCNPJ } from '../utils/dataEngine';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  ChevronLeft,
  ChevronRight,
  Search,
  AlertTriangle,
  Fingerprint,
  Building2,
  MapPin,
  DollarSign,
  Calendar,
  Hash,
  Tag
} from 'lucide-react';
import { exportToExcel } from '../utils/dataEngine';

interface DataTableProps {
  rows: Record<string, any>[];
  columns: ColumnSchema[];
  fileName: string;
  outlierIndices?: Set<number>;
  activeMetricKey?: string;
  isOnlyAnomaliesFilterActive?: boolean;
  smartDetection?: import('../types/dashboard').SmartTableDetectionResult;
  onOpenSmartDetection?: () => void;
}

interface RowWithIndex {
  _originalIndex: number;
  [key: string]: any;
}

export const DataTable: React.FC<DataTableProps> = ({
  rows,
  columns,
  fileName,
  outlierIndices,
  activeMetricKey,
  isOnlyAnomaliesFilterActive,
  smartDetection,
  onOpenSmartDetection
}) => {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [tableSearch, setTableSearch] = useState('');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortKey(null);
        setSortDir('asc');
      }
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  const filteredAndSortedRows = useMemo(() => {
    let result: RowWithIndex[] = rows.map((r, originalIdx) => ({
      ...r,
      _originalIndex: originalIdx
    }));

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      result = result.filter(r =>
        Object.entries(r).some(([k, v]) => k !== '_originalIndex' && v !== null && v !== undefined && String(v).toLowerCase().includes(q))
      );
    }

    if (sortKey) {
      const col = columns.find(c => c.key === sortKey);
      result.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];

        if (col?.type === 'number' || col?.type === 'currency') {
          valA = cleanNumericValue(valA) || 0;
          valB = cleanNumericValue(valB) || 0;
          return sortDir === 'asc' ? valA - valB : valB - valA;
        }

        if (col?.type === 'date') {
          const dA = parseDateValue(valA)?.getTime() || 0;
          const dB = parseDateValue(valB)?.getTime() || 0;
          return sortDir === 'asc' ? dA - dB : dB - dA;
        }

        const strA = String(valA ?? '').toLowerCase();
        const strB = String(valB ?? '').toLowerCase();
        return sortDir === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return result;
  }, [rows, tableSearch, sortKey, sortDir, columns]);

  const totalPages = Math.ceil(filteredAndSortedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedRows.slice(start, start + pageSize);
  }, [filteredAndSortedRows, currentPage, pageSize]);

  const formatCellValue = (val: any, col: ColumnSchema, isRowOutlier: boolean) => {
    if (val === null || val === undefined || val === '') return <span className="text-neutral-600">-</span>;
    const isOutlierCol = isRowOutlier && col.key === activeMetricKey;

    // 1. Semantic CPF
    if (col.semanticSubtype === 'cpf') {
      return (
        <span className="font-mono text-neutral-200 tracking-tight">
          {formatCPF(val)}
        </span>
      );
    }

    // 2. Semantic CNPJ
    if (col.semanticSubtype === 'cnpj') {
      return (
        <span className="font-mono text-neutral-200 tracking-tight">
          {formatCNPJ(val)}
        </span>
      );
    }

    // 3. Semantic UF (Estado brasileiro)
    if (col.semanticSubtype === 'uf') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
          <MapPin className="w-2.5 h-2.5 text-emerald-400" />
          {String(val).trim().toUpperCase()}
        </span>
      );
    }

    // 4. Metric Monetary / Currency
    if (col.semanticSubtype === 'monetary' || col.type === 'currency') {
      const num = cleanNumericValue(val);
      return (
        <span className={`font-mono tabular-nums ${isOutlierCol ? 'text-amber-300 font-semibold' : 'text-neutral-200'}`}>
          {formatCurrency(num !== null ? num : 0)}
        </span>
      );
    }

    // 5. Metric Number / Percentage
    if (col.semanticSubtype === 'percentage') {
      const num = cleanNumericValue(val);
      return (
        <span className="font-mono tabular-nums text-neutral-200">
          {num !== null ? `${num.toFixed(1)}%` : String(val)}
        </span>
      );
    }

    if (col.type === 'number') {
      const num = cleanNumericValue(val);
      return (
        <span className={`font-mono tabular-nums ${isOutlierCol ? 'text-amber-300 font-semibold' : 'text-neutral-200'}`}>
          {formatNumber(num !== null ? num : 0)}
        </span>
      );
    }

    // 6. Temporal / Date
    if (col.semanticRole === 'temporal' || col.type === 'date') {
      const d = parseDateValue(val);
      return <span className="font-mono text-neutral-300">{d ? d.toLocaleDateString('pt-BR') : String(val)}</span>;
    }

    if (col.type === 'boolean') {
      return (
        <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
          val ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.05] text-neutral-400'
        }`}>
          {val ? 'Sim' : 'Não'}
        </span>
      );
    }
    return <span className="text-neutral-300">{String(val)}</span>;
  };

  const getHeaderSemanticIcon = (col: ColumnSchema) => {
    if (col.semanticSubtype === 'cpf') return <Fingerprint className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    if (col.semanticSubtype === 'cnpj') return <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    if (col.semanticSubtype === 'uf') return <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    if (col.semanticRole === 'geographic') return <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />;
    if (col.semanticSubtype === 'monetary' || col.type === 'currency') return <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    if (col.semanticRole === 'temporal' || col.type === 'date') return <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
    if (col.semanticRole === 'metric') return <Hash className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    return null;
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#111215] border border-white/[0.07] rounded-xl overflow-hidden shadow-xs">
      {/* Smart Table Boundary & Segmentation Ribbon */}
      {smartDetection && (smartDetection.summaries.length > 0 || smartDetection.notes.length > 0 || smartDetection.boundary.headerRowIndex > 0) && (
        <div className="flex items-center justify-between px-4 py-2 bg-white/[0.02] border-b border-white/[0.05] text-[11px] text-neutral-400 flex-wrap gap-2">
          <div className="flex items-center gap-2 truncate">
            <span className="text-emerald-400 font-mono font-medium">Tabela Segregada:</span>
            <span>Cabeçalho identificado na Linha {smartDetection.boundary.headerRowIndex + 1}</span>
            {smartDetection.summaries.length > 0 && (
              <>
                <span className="text-neutral-600">·</span>
                <span>{smartDetection.summaries.length} resumos pré-tabela</span>
              </>
            )}
            {smartDetection.notes.length > 0 && (
              <>
                <span className="text-neutral-600">·</span>
                <span>{smartDetection.notes.length} notas de auditoria</span>
              </>
            )}
            {smartDetection.footers.length > 0 && (
              <>
                <span className="text-neutral-600">·</span>
                <span>{smartDetection.footers.length} totais de rodapé</span>
              </>
            )}
          </div>
          {onOpenSmartDetection && (
            <button
              onClick={onOpenSmartDetection}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium underline shrink-0 ml-1"
            >
              Ver limites, resumos e notas →
            </button>
          )}
        </div>
      )}

      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500" />
            <input
              type="text"
              value={tableSearch}
              onChange={e => { setTableSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Buscar em todas as colunas..."
              className="bg-white/[0.03] border border-white/[0.08] rounded-lg pl-8.5 pr-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-white/[0.2] w-60"
            />
          </div>
          <span className="text-xs text-neutral-400">
            {filteredAndSortedRows.length} de {rows.length} registros
          </span>

          {isOnlyAnomaliesFilterActive && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Anomalias filtradas
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <span>Linhas:</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-white/[0.03] border border-white/[0.08] text-neutral-200 text-xs rounded-md px-2 py-1 focus:outline-none"
            >
              <option value={15} className="bg-[#16171B]">15</option>
              <option value={25} className="bg-[#16171B]">25</option>
              <option value={50} className="bg-[#16171B]">50</option>
              <option value={100} className="bg-[#16171B]">100</option>
            </select>
          </div>

          <button
            onClick={() => exportToExcel(filteredAndSortedRows, fileName)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-neutral-200 border border-white/[0.08] rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-neutral-300" />
            Exportar dados (.xlsx)
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto flex-1 min-h-[420px]">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-[#0D0E11] text-neutral-400 border-b border-white/[0.06] sticky top-0 z-10">
            <tr>
              <th className="py-2.5 px-3 text-[11px] font-mono text-neutral-500 w-16 text-center">#</th>
              {columns.map(col => {
                const isSorted = sortKey === col.key;
                const isMetric = col.key === activeMetricKey;

                return (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`py-2.5 px-3 font-semibold hover:text-white cursor-pointer select-none whitespace-nowrap ${
                      isMetric ? 'text-emerald-300' : 'text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {getHeaderSemanticIcon(col)}
                      <span>{col.label}</span>
                      <span className="text-neutral-500">
                        {isSorted ? (
                          sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-400" /> : <ArrowDown className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 opacity-30 hover:opacity-100" />
                        )}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="py-12 text-center text-neutral-500">
                  Nenhum registro encontrado para este filtro de busca.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row, idx) => {
                const isRowOutlier = outlierIndices ? outlierIndices.has(row._originalIndex) : false;
                const rowNum = (currentPage - 1) * pageSize + idx + 1;

                return (
                  <tr
                    key={idx}
                    className={`transition-colors ${
                      isRowOutlier
                        ? 'bg-amber-500/[0.06] hover:bg-amber-500/[0.1]'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className="py-2 px-3 text-center text-neutral-500 font-mono text-[11px] whitespace-nowrap">
                      {isRowOutlier ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 font-mono" title="Registro com desvio estatístico">
                          <AlertTriangle className="w-3 h-3 text-amber-400" /> {rowNum}
                        </span>
                      ) : (
                        <span>{rowNum}</span>
                      )}
                    </td>
                    {columns.map(col => (
                      <td key={col.key} className="py-2 px-3 whitespace-nowrap">
                        {formatCellValue(row[col.key], col, isRowOutlier)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06] bg-white/[0.02] text-xs text-neutral-400">
        <span>
          Página <span className="text-white font-medium">{currentPage}</span> de <span className="text-white font-medium">{totalPages}</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-md hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed text-neutral-300"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-md hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed text-neutral-300"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
