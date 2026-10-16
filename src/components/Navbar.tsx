import React from 'react';
import { ViewMode } from '../types/dashboard';
import { BarChart3, Download, UploadCloud, Table, Sparkles, RotateCcw, FileSpreadsheet, Layers, SlidersHorizontal, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  fileName: string;
  archetypeLabel?: string;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onOpenUpload: () => void;
  onOpenExport: () => void;
  onOpenSmartDetection?: () => void;
  onOpenPreGenerationPreview?: () => void;
  onOpenMathematicalAudit?: () => void;
  isReconciled?: boolean;
  headerRowIndex?: number;
  filteredCount: number;
  totalCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  onViewChange,
  fileName,
  archetypeLabel,
  hasActiveFilters,
  onClearFilters,
  onOpenUpload,
  onOpenExport,
  onOpenSmartDetection,
  onOpenPreGenerationPreview,
  onOpenMathematicalAudit,
  isReconciled = true,
  headerRowIndex,
  filteredCount,
  totalCount
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.07] bg-[#090A0C]/90 backdrop-blur-xl px-4 sm:px-6 py-2.5 no-print">
      <div className="flex items-center justify-between gap-4 max-w-[1600px] mx-auto">
        {/* Brand & Breadcrumbs */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.1] text-white">
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-white tracking-tight">NexusBI</span>
            <span className="text-white/20">/</span>
            <div className="flex items-center gap-1.5 text-neutral-400">
              <FileSpreadsheet className="w-3 h-3 text-neutral-500" />
              <span className="truncate max-w-[150px] sm:max-w-[200px] font-medium text-neutral-300" title={fileName}>
                {fileName}
              </span>
            </div>
            {archetypeLabel && (
              <span className="hidden md:inline-flex text-[11px] text-neutral-500 font-normal">
                · {archetypeLabel}
              </span>
            )}
          </div>
        </div>

        {/* View Switcher Tabs (Segmented Control) */}
        <nav className="flex items-center bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5 shrink-0">
          <button
            onClick={() => onViewChange('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              activeView === 'dashboard'
                ? 'bg-white/[0.09] text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-neutral-400" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => onViewChange('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              activeView === 'table'
                ? 'bg-white/[0.09] text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Table className="w-3.5 h-3.5 text-neutral-400" />
            <span>Tabela ({filteredCount})</span>
          </button>
          <button
            onClick={() => onViewChange('fields')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
              activeView === 'fields'
                ? 'bg-white/[0.09] text-white shadow-xs'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
            <span>Estrutura</span>
          </button>
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mathematical Audit & Reconciliation Trigger */}
          {onOpenMathematicalAudit && (
            <button
              onClick={onOpenMathematicalAudit}
              title="Auditoria matemática e reconciliação contábil do motor determinístico"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-200 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/25 rounded-lg transition-all whitespace-nowrap"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Auditoria Contábil</span>
              <span className={`inline-flex w-1.5 h-1.5 rounded-full ${isReconciled ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
            </button>
          )}

          {/* Pre-Generation Preview & Column Selection Trigger */}
          {onOpenPreGenerationPreview && (
            <button
              onClick={onOpenPreGenerationPreview}
              title="Prévia antes da geração: confirmar tabelas e colunas analisadas"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] rounded-lg transition-all whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-400" />
              <span className="hidden sm:inline">Prévia & Colunas</span>
            </button>
          )}

          {/* Smart Table Boundary Inspection Trigger */}
          {onOpenSmartDetection && (
            <button
              onClick={onOpenSmartDetection}
              title="Inspecionar detecção inteligente de tabelas, resumos e notas"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] rounded-lg transition-all whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden lg:inline">Detecção de Tabela</span>
              {headerRowIndex !== undefined && (
                <span className="font-mono text-[10px] text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-1 py-0.2 rounded">
                  L{headerRowIndex + 1}
                </span>
              )}
            </button>
          )}

          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              title="Redefinir todos os filtros"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 rounded-lg transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Limpar</span>
              <span className="font-mono text-[11px]">({filteredCount})</span>
            </button>
          )}

          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] rounded-lg transition-all whitespace-nowrap"
          >
            <UploadCloud className="w-3.5 h-3.5 text-neutral-400" />
            <span className="hidden sm:inline">Carregar Planilha</span>
            <span className="sm:hidden">Planilha</span>
          </button>

          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-neutral-950 bg-white hover:bg-neutral-100 rounded-lg shadow-sm transition-all whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-neutral-950" />
            <span>Exportar</span>
          </button>
        </div>
      </div>
    </header>
  );
};
