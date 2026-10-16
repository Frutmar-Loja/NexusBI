import React, { useState } from 'react';
import { FilterState } from '../types/dashboard';
import { exportToExcel } from '../utils/dataEngine';
import { Download, FileText, Image, FileSpreadsheet, X, Check, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  filteredRows: Record<string, any>[];
  fileName: string;
  filters: FilterState;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  filteredRows,
  fileName,
  filters
}) => {
  const [exportingPNG, setExportingPNG] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExportExcel = () => {
    try {
      exportToExcel(filteredRows, fileName);
      setExportSuccess('Planilha Excel gerada com sucesso!');
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (e) {
      console.error(e);
      alert('Erro ao exportar planilha Excel.');
    }
  };

  const handleExportPNG = async () => {
    setExportingPNG(true);
    try {
      const dashboardEl = document.getElementById('dashboard-export-container');
      if (!dashboardEl) {
        alert('Elemento do dashboard não encontrado.');
        setExportingPNG(false);
        return;
      }

      const canvas = await html2canvas(dashboardEl, {
        scale: 2, // High-resolution 2x DPR
        backgroundColor: '#090A0C',
        useCORS: true,
        logging: false
      });

      const image = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = image;
      a.download = `${fileName.replace(/\.[^/.]+$/, '')}_dashboard_hd.png`;
      a.click();

      setExportSuccess('Imagem PNG em alta resolução baixada!');
      setTimeout(() => setExportSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      alert('Erro ao gerar imagem PNG.');
    } finally {
      setExportingPNG(false);
    }
  };

  const handleExportPDF = () => {
    // Open system print dialog formatted for executive PDF
    onClose();
    setTimeout(() => {
      window.print();
    }, 200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-[#111215] border border-white/[0.08] rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/[0.05] text-white border border-white/[0.08]">
              <Download className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">Exportar Dashboard</h2>
              <p className="text-xs text-neutral-400">Exportações em tempo real com os dados filtrados</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Alert Banner */}
        {exportSuccess && (
          <div className="mt-4 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportSuccess}</span>
          </div>
        )}

        {/* Export Options Grid */}
        <div className="py-5 space-y-2.5">
          {/* Option 1: Executive PDF */}
          <button
            onClick={handleExportPDF}
            className="w-full flex items-start gap-3.5 p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/[0.15] transition-all text-left group"
          >
            <div className="p-2.5 rounded-lg bg-white/[0.04] text-neutral-300 group-hover:text-white border border-white/[0.06] shrink-0">
              <FileText className="w-5 h-5 text-neutral-300" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white">Relatório PDF Executivo</h3>
                <span className="text-[10px] font-mono text-neutral-400">A4 / Apresentação</span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                Diagramação limpa em alta legibilidade sem poluição visual, ideal para diretoria e reuniões.
              </p>
            </div>
          </button>

          {/* Option 2: High-Resolution PNG */}
          <button
            onClick={handleExportPNG}
            disabled={exportingPNG}
            className="w-full flex items-start gap-3.5 p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/[0.15] transition-all text-left group disabled:opacity-50"
          >
            <div className="p-2.5 rounded-lg bg-white/[0.04] text-neutral-300 group-hover:text-white border border-white/[0.06] shrink-0">
              {exportingPNG ? (
                <Loader2 className="w-5 h-5 animate-spin text-neutral-300" />
              ) : (
                <Image className="w-5 h-5 text-neutral-300" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white">Snapshot PNG (2x HD)</h3>
                <span className="text-[10px] font-mono text-neutral-400">Alta Densidade</span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                Captura cristalina do canvas e gráficos para apresentações no PowerPoint, Slack ou Notion.
              </p>
            </div>
          </button>

          {/* Option 3: Cleaned Excel Spreadsheet */}
          <button
            onClick={handleExportExcel}
            className="w-full flex items-start gap-3.5 p-3.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/[0.15] transition-all text-left group"
          >
            <div className="p-2.5 rounded-lg bg-white/[0.04] text-neutral-300 group-hover:text-white border border-white/[0.06] shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-neutral-300" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-white">Planilha Tratada (.xlsx)</h3>
                <span className="text-[10px] font-mono text-neutral-400">Excel</span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                Exporta apenas as {filteredRows.length} linhas selecionadas com colunas normalizadas.
              </p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-[11px] text-neutral-500">
          <span>Geração instantânea e segura via cliente.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 text-neutral-400 hover:text-white rounded-md hover:bg-white/[0.04] transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
