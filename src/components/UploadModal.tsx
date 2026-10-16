import React, { useRef, useState } from 'react';
import { SAMPLE_DATASETS, SampleDatasetInfo } from '../data/sampleDatasets';
import { parseExcelFile, extractSheetData } from '../utils/dataEngine';
import { SheetData } from '../types/dashboard';
import { Upload, FileSpreadsheet, X, Check, Database } from 'lucide-react';
import * as XLSX from 'xlsx';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataLoaded: (data: SheetData, sheetNames?: string[]) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onDataLoaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [multiSheets, setMultiSheets] = useState<{
    workbook: XLSX.WorkBook;
    sheetNames: string[];
    fileName: string;
    fileSize: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert('Por favor, selecione um arquivo válido do Excel (.xlsx, .xls) ou CSV (.csv)');
      return;
    }

    setLoading(true);
    try {
      const { sheetNames, workbook } = await parseExcelFile(file);
      if (sheetNames.length > 1) {
        setMultiSheets({
          workbook,
          sheetNames,
          fileName: file.name,
          fileSize: file.size
        });
        setLoading(false);
      } else {
        const sheetData = extractSheetData(workbook, sheetNames[0], file.name, file.size);
        onDataLoaded(sheetData, sheetNames);
        onClose();
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao processar planilha. Verifique se o arquivo não está corrompido ou protegido por senha.');
      setLoading(false);
    }
  };

  const handleSelectSheet = (sheetName: string) => {
    if (!multiSheets) return;
    const sheetData = extractSheetData(multiSheets.workbook, sheetName, multiSheets.fileName, multiSheets.fileSize);
    onDataLoaded(sheetData, multiSheets.sheetNames);
    setMultiSheets(null);
    onClose();
  };

  const handleLoadSample = (sample: SampleDatasetInfo) => {
    setLoading(true);
    setTimeout(() => {
      let ws: XLSX.WorkSheet;
      if (sample.generateRawGrid) {
        ws = XLSX.utils.aoa_to_sheet(sample.generateRawGrid());
      } else {
        const rows = sample.generateRows();
        ws = XLSX.utils.json_to_sheet(rows);
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sample.name.slice(0, 31));
      const sheetData = extractSheetData(wb, wb.SheetNames[0], sample.fileName, 48000);
      onDataLoaded(sheetData, wb.SheetNames);
      setLoading(false);
      onClose();
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#111215] border border-white/[0.08] rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/[0.05] text-white border border-white/[0.08]">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">Carregar Planilha do Excel</h2>
              <p className="text-xs text-neutral-400">Processamento local privado (.xlsx, .xls, .csv)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {multiSheets ? (
          /* Multi-Sheet Selection View */
          <div className="py-5 space-y-4">
            <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
              <span className="text-xs text-neutral-400">Arquivo selecionado:</span>
              <p className="text-sm font-semibold text-white font-mono mt-0.5">{multiSheets.fileName}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-300 mb-2 block">
                Selecione a aba desejada para o Dashboard:
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                {multiSheets.sheetNames.map(sheet => (
                  <button
                    key={sheet}
                    onClick={() => handleSelectSheet(sheet)}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.15] text-left transition-all text-xs font-medium text-neutral-200"
                  >
                    <span className="truncate pr-2">{sheet}</span>
                    <Check className="w-4 h-4 text-emerald-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-4">
            {/* Dropzone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-xl p-7 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-emerald-400 bg-emerald-500/10'
                  : 'border-white/[0.12] hover:border-white/[0.25] bg-white/[0.02] hover:bg-white/[0.04]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0]);
                }}
              />
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center text-neutral-300 border border-white/[0.08]">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-white">
                    Arraste sua planilha aqui ou clique para selecionar
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Formatos compatíveis: Microsoft Excel (.xlsx, .xls) e CSV (.csv)
                  </p>
                </div>
              </div>
            </div>

            {/* Ready-to-test business datasets */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Database className="w-3.5 h-3.5 text-neutral-400" />
                <span className="text-xs font-medium text-neutral-400">
                  Ou experimente com bases reais demonstrativas:
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {SAMPLE_DATASETS.map(sample => (
                  <button
                    key={sample.id}
                    onClick={() => handleLoadSample(sample)}
                    disabled={loading}
                    className="p-3 text-left rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/[0.12] transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[10px] text-neutral-400 font-mono truncate">
                          {sample.category}
                        </span>
                        <span className="text-[9px] font-mono text-neutral-400 bg-white/[0.06] px-1.5 py-0.2 rounded shrink-0">
                          {sample.archetypeTag}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
                        {sample.name}
                      </h4>
                      <p className="text-[11px] text-neutral-500 line-clamp-2 mt-1">
                        {sample.description}
                      </p>
                    </div>
                    <div className="mt-3 text-[10px] text-neutral-400 flex items-center justify-between border-t border-white/[0.04] pt-2 font-mono">
                      <span>{sample.rowsCount} linhas</span>
                      <span className="text-neutral-300 group-hover:text-white transition-colors">Carregar →</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] text-[11px] text-neutral-500">
          <span>Seus dados nunca saem do navegador. 100% privado.</span>
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
