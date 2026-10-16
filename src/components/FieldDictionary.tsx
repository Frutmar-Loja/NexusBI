import React, { useState, useMemo } from 'react';
import { ColumnSchema, SemanticRole } from '../types/dashboard';
import { formatCurrency, formatNumber, formatSemanticValue } from '../utils/dataEngine';
import {
  Hash,
  Calendar,
  DollarSign,
  Tag,
  Type,
  MapPin,
  Fingerprint,
  Building2,
  CheckCircle2,
  Sparkles,
  Info,
  Clock,
  Layers
} from 'lucide-react';

interface FieldDictionaryProps {
  columns: ColumnSchema[];
  totalRows: number;
  fileName: string;
}

export const FieldDictionary: React.FC<FieldDictionaryProps> = ({ columns, totalRows, fileName }) => {
  const [activeFilter, setActiveFilter] = useState<'all' | SemanticRole>('all');

  // Semantic Counts
  const semanticCounts = useMemo(() => {
    const counts = {
      all: columns.length,
      identifier: 0,
      geographic: 0,
      metric: 0,
      temporal: 0,
      categorical: 0,
      descriptive: 0
    };

    columns.forEach(col => {
      if (counts[col.semanticRole] !== undefined) {
        counts[col.semanticRole]++;
      }
    });

    return counts;
  }, [columns]);

  const filteredColumns = useMemo(() => {
    if (activeFilter === 'all') return columns;
    return columns.filter(c => c.semanticRole === activeFilter);
  }, [columns, activeFilter]);

  const getSemanticBadge = (col: ColumnSchema) => {
    switch (col.semanticSubtype) {
      case 'cpf':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
            <Fingerprint className="w-3 h-3 text-amber-400" />
            Identificador · CPF
          </span>
        );
      case 'cnpj':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
            <Building2 className="w-3 h-3 text-amber-400" />
            Identificador · CNPJ
          </span>
        );
      case 'general_id':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
            <Hash className="w-3 h-3" />
            Identificador · Código/ID
          </span>
        );
      case 'uf':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
            <MapPin className="w-3 h-3 text-emerald-400" />
            Geográfico · UF Brasil
          </span>
        );
      case 'city':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-teal-300 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md">
            <MapPin className="w-3 h-3 text-teal-400" />
            Geográfico · Cidade
          </span>
        );
      case 'country_region':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-teal-300 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md">
            <MapPin className="w-3 h-3 text-teal-400" />
            Geográfico · Região
          </span>
        );
      case 'unit_price':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
            <DollarSign className="w-3 h-3 text-amber-400" />
            Métrica · Preço Unitário (Não Aditivo)
          </span>
        );
      case 'quantity':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
            <Hash className="w-3 h-3 text-emerald-400" />
            Métrica · Quantidade (Aditivo)
          </span>
        );
      case 'monetary':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
            <DollarSign className="w-3 h-3 text-emerald-400" />
            Métrica · Faturamento / Monetário (Aditivo)
          </span>
        );
      case 'percentage':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
            <Hash className="w-3 h-3" />
            Métrica · Percentual / Margem (Não Aditivo)
          </span>
        );
      case 'metric_number':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2 py-0.5 rounded-md">
            <Hash className="w-3 h-3" />
            Métrica · Quantitativo
          </span>
        );
      case 'birth_date':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-md">
            <Calendar className="w-3 h-3 text-violet-400" />
            Atributo Cadastral · Nasc. / Fundação
          </span>
        );
      case 'registration_date':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
            <Calendar className="w-3 h-3 text-emerald-400" />
            Temporal · Adesão / Onboarding
          </span>
        );
      case 'event_date':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
            <Calendar className="w-3 h-3 text-indigo-400" />
            Temporal · Data do Pedido / Transação
          </span>
        );
      case 'date':
      case 'period_year':
      case 'period_month':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
            <Calendar className="w-3 h-3 text-indigo-400" />
            Temporal · Dimensão de Tempo
          </span>
        );
      case 'status':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-md">
            <Tag className="w-3 h-3 text-violet-400" />
            Categórico · Status
          </span>
        );
      case 'category':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-md">
            <Tag className="w-3 h-3 text-violet-400" />
            Categórico · Segmentação
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-neutral-400 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-md">
            <Type className="w-3 h-3" />
            Descritivo · Texto
          </span>
        );
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Top Banner with Semantic Summary */}
      <div className="p-4 rounded-xl bg-[#111215] border border-white/[0.07] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white tracking-tight">Classificação Semântica & Dicionário de Campos</h2>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Reconhecimento semântico automático de identificadores (CPF/CNPJ), dimensões geográficas (UF), métricas monetárias e temporais em <span className="text-white font-mono">{fileName}</span>
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-neutral-400">
            <div>Colunas: <span className="text-white font-semibold">{columns.length}</span></div>
            <div className="text-white/20">|</div>
            <div>Linhas: <span className="text-white font-semibold">{formatNumber(totalRows)}</span></div>
          </div>
        </div>

        {/* Semantic Role Filters */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/[0.05]">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeFilter === 'all'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <span>Todos</span>
            <span className="text-[10px] font-mono opacity-60">({semanticCounts.all})</span>
          </button>

          <button
            onClick={() => setActiveFilter('identifier')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeFilter === 'identifier'
                ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                : 'text-neutral-400 hover:text-amber-300 hover:bg-white/[0.04]'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5 text-amber-400" />
            <span>Identificadores (CPF/CNPJ)</span>
            <span className="text-[10px] font-mono opacity-80">({semanticCounts.identifier})</span>
          </button>

          <button
            onClick={() => setActiveFilter('geographic')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeFilter === 'geographic'
                ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                : 'text-neutral-400 hover:text-emerald-300 hover:bg-white/[0.04]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>Geográfico (UF)</span>
            <span className="text-[10px] font-mono opacity-80">({semanticCounts.geographic})</span>
          </button>

          <button
            onClick={() => setActiveFilter('metric')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeFilter === 'metric'
                ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                : 'text-neutral-400 hover:text-emerald-300 hover:bg-white/[0.04]'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>Métricas (Monetário)</span>
            <span className="text-[10px] font-mono opacity-80">({semanticCounts.metric})</span>
          </button>

          <button
            onClick={() => setActiveFilter('temporal')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeFilter === 'temporal'
                ? 'bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30'
                : 'text-neutral-400 hover:text-indigo-300 hover:bg-white/[0.04]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span>Temporal (Datas)</span>
            <span className="text-[10px] font-mono opacity-80">({semanticCounts.temporal})</span>
          </button>

          <button
            onClick={() => setActiveFilter('categorical')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeFilter === 'categorical'
                ? 'bg-violet-500/20 text-violet-300 font-semibold border border-violet-500/30'
                : 'text-neutral-400 hover:text-violet-300 hover:bg-white/[0.04]'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-violet-400" />
            <span>Categóricos</span>
            <span className="text-[10px] font-mono opacity-80">({semanticCounts.categorical})</span>
          </button>
        </div>
      </div>

      {/* Grid of Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredColumns.map(col => (
          <div
            key={col.key}
            className="p-4 rounded-xl bg-[#111215] border border-white/[0.07] hover:border-white/[0.14] transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-white break-all">{col.key}</span>
                {getSemanticBadge(col)}
              </div>

              {/* Description & Confidence */}
              <div className="text-[11px] text-neutral-400 mb-2.5 flex items-center justify-between">
                <span>{col.distinctCount} valores distintos</span>
                {col.semanticConfidence && (
                  <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    {Math.round(col.semanticConfidence * 100)}% precisão
                  </span>
                )}
              </div>

              {col.semanticDescription && (
                <p className="text-[11px] text-neutral-500 mb-3 bg-white/[0.02] p-2 rounded-lg border border-white/[0.04]">
                  {col.semanticDescription}
                </p>
              )}

              {/* Metric stats if applicable */}
              {(col.type === 'currency' || col.type === 'number') && col.sum !== undefined && (
                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05] space-y-1 text-xs font-mono tabular-nums mb-3">
                  <div className="flex justify-between text-neutral-400">
                    <span>Soma Total:</span>
                    <span className="text-white font-semibold">
                      {col.type === 'currency' ? formatCurrency(col.sum) : formatNumber(col.sum)}
                    </span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Média:</span>
                    <span className="text-neutral-300">
                      {col.type === 'currency' ? formatCurrency(col.avg || 0) : formatNumber(col.avg || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-neutral-500 text-[11px]">
                    <span>Mín / Máx:</span>
                    <span>
                      {col.min !== undefined ? (col.type === 'currency' ? formatCurrency(col.min) : col.min) : 0} ~ {col.max !== undefined ? (col.type === 'currency' ? formatCurrency(col.max) : col.max) : 0}
                    </span>
                  </div>
                </div>
              )}

              {/* Sample values properly formatted */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-neutral-400">Amostra formatada:</span>
                <div className="flex flex-wrap gap-1.5">
                  {col.sampleValues.slice(0, 4).map((val, i) => (
                    <span
                      key={i}
                      className="text-[11px] font-mono bg-white/[0.04] text-neutral-300 px-2 py-0.5 rounded-md border border-white/[0.06] truncate max-w-[150px]"
                    >
                      {formatSemanticValue(val, col.semanticSubtype, col.type)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-white/[0.04] flex items-center justify-between text-[11px] text-neutral-500">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Classificado semântico</span>
              </div>
              <span className="font-mono uppercase text-[10px] text-neutral-600">{col.type}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
