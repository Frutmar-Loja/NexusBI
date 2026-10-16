import React, { useState, useMemo } from 'react';
import {
  ColumnSchema,
  ColumnType,
  SemanticRole,
  SemanticSubtype,
  SheetData,
  SpreadsheetArchetype
} from '../types/dashboard';
import {
  detectSpreadsheetArchetype,
  formatCPF,
  formatCNPJ,
  formatCurrency,
  formatNumber,
  formatSemanticValue
} from '../utils/dataEngine';
import {
  X,
  Check,
  CheckSquare,
  Square,
  Search,
  FileSpreadsheet,
  Layers,
  ShieldCheck,
  Fingerprint,
  Building2,
  MapPin,
  DollarSign,
  Calendar,
  Tag,
  Hash,
  Sparkles,
  SlidersHorizontal,
  Table,
  ArrowRight,
  Info,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Users,
  TrendingUp
} from 'lucide-react';

interface PreGenerationPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  sheetData: SheetData;
  availableSheets?: string[];
  currentSheetName?: string;
  onSelectSheet?: (sheetName: string) => void;
  onConfirm: (confirmedColumns: ColumnSchema[], activeColumnKeys: string[]) => void;
  onOpenSmartDetection?: () => void;
}

export const PreGenerationPreviewModal: React.FC<PreGenerationPreviewModalProps> = ({
  isOpen,
  onClose,
  sheetData,
  availableSheets = [],
  currentSheetName,
  onSelectSheet,
  onConfirm,
  onOpenSmartDetection
}) => {
  // Local state for selected column keys (all checked by default)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => {
    return new Set(sheetData.columns.map(c => c.key));
  });

  // Local state for role overrides (columnKey -> { semanticRole, semanticSubtype, type })
  const [roleOverrides, setRoleOverrides] = useState<
    Record<string, { role: SemanticRole; subtype: SemanticSubtype; type: ColumnType }>
  >({});

  const [searchFilter, setSearchFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'columns' | 'preview_grid' | 'context'>('columns');

  // Update selected keys whenever sheetData changes
  React.useEffect(() => {
    setSelectedKeys(new Set(sheetData.columns.map(c => c.key)));
    setRoleOverrides({});
  }, [sheetData]);

  if (!isOpen) return null;

  // Active columns reflecting any overrides
  const effectiveColumns: ColumnSchema[] = sheetData.columns.map(col => {
    const override = roleOverrides[col.key];
    if (override) {
      return {
        ...col,
        semanticRole: override.role,
        semanticSubtype: override.subtype,
        type: override.type
      };
    }
    return col;
  });

  // Filter columns by user search
  const filteredColumns = effectiveColumns.filter(col => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      col.label.toLowerCase().includes(q) ||
      col.key.toLowerCase().includes(q) ||
      col.semanticRole.toLowerCase().includes(q) ||
      col.semanticSubtype.toLowerCase().includes(q)
    );
  });

  const selectedCount = selectedKeys.size;
  const totalCount = sheetData.columns.length;
  const isAllSelected = selectedCount === totalCount;

  // Archetype detected with current effective columns
  const activeColumnsForArchetype = effectiveColumns.filter(c => selectedKeys.has(c.key));
  const detectedArchetype = detectSpreadsheetArchetype(
    activeColumnsForArchetype.length > 0 ? activeColumnsForArchetype : effectiveColumns
  );

  const toggleColumn = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size <= 1) return prev; // Keep at least one column
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedKeys(new Set(sheetData.columns.map(c => c.key)));
  };

  const handleDeselectNonEssential = () => {
    // Keep metrics, categories, geographic, temporal; deselect purely descriptive/IDs
    const essentials = sheetData.columns.filter(c => c.semanticRole !== 'descriptive');
    if (essentials.length > 0) {
      setSelectedKeys(new Set(essentials.map(c => c.key)));
    }
  };

  const handleRoleChange = (key: string, newRole: SemanticRole) => {
    const col = sheetData.columns.find(c => c.key === key);
    if (!col) return;

    let subtype: SemanticSubtype = col.semanticSubtype;
    let type: ColumnType = col.type;

    if (newRole === 'identifier') {
      subtype = /cpf/i.test(key) ? 'cpf' : /cnpj/i.test(key) ? 'cnpj' : 'general_id';
      type = 'text';
    } else if (newRole === 'geographic') {
      subtype = /uf|estado/i.test(key) ? 'uf' : 'city';
      type = 'category';
    } else if (newRole === 'metric') {
      subtype = /valor|preco|preço|faturam|receita|custo|r\$/i.test(key) ? 'monetary' : 'metric_number';
      type = subtype === 'monetary' ? 'currency' : 'number';
    } else if (newRole === 'temporal') {
      subtype = 'date';
      type = 'date';
    } else if (newRole === 'categorical') {
      subtype = /status|situac|fase/i.test(key) ? 'status' : 'category';
      type = 'category';
    } else {
      subtype = 'text';
      type = 'text';
    }

    setRoleOverrides(prev => ({
      ...prev,
      [key]: { role: newRole, subtype, type }
    }));
  };

  const handleConfirm = () => {
    const finalColumns = effectiveColumns.filter(c => selectedKeys.has(c.key));
    const activeKeys = Array.from(selectedKeys);
    onConfirm(finalColumns, activeKeys);
    onClose();
  };

  // Semantic Icon Helper
  const getSemanticBadge = (col: ColumnSchema) => {
    if (col.semanticSubtype === 'cpf') {
      return {
        label: 'Identificador (CPF)',
        badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
        icon: <Fingerprint className="w-3.5 h-3.5 text-amber-400" />,
        isProtected: true,
        protectionText: 'Protegido: imune a somas matemáticas (usado para contagem única)'
      };
    }
    if (col.semanticSubtype === 'cnpj') {
      return {
        label: 'Identificador (CNPJ)',
        badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
        icon: <Building2 className="w-3.5 h-3.5 text-amber-400" />,
        isProtected: true,
        protectionText: 'Protegido: imune a somas matemáticas (usado para contagem única)'
      };
    }
    if (col.semanticRole === 'identifier') {
      return {
        label: 'Identificador (Código / ID)',
        badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
        icon: <Hash className="w-3.5 h-3.5 text-amber-400" />,
        isProtected: true,
        protectionText: 'Protegido: não será somado como métrica'
      };
    }
    if (col.semanticSubtype === 'uf' || col.semanticRole === 'geographic') {
      return {
        label: col.semanticSubtype === 'uf' ? 'Geográfico (UF / Estado)' : 'Geográfico (Região)',
        badgeClass: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/25',
        icon: <MapPin className="w-3.5 h-3.5 text-cyan-400" />,
        isProtected: false,
        protectionText: 'Dimensão geográfica para mapas e distribuição regional'
      };
    }
    if (col.semanticSubtype === 'unit_price') {
      return {
        label: 'Preço Unitário (Não Aditivo)',
        badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
        icon: <DollarSign className="w-3.5 h-3.5 text-amber-400" />,
        isProtected: true,
        protectionText: 'Protegido: métrica não aditiva (não somar com total de vendas; requer cálculo ponderado)'
      };
    }
    if (col.semanticSubtype === 'quantity') {
      return {
        label: 'Quantidade / Volume (Aditivo)',
        badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
        icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />,
        isProtected: false,
        protectionText: 'Métrica aditiva somável: unidades físicas comercializadas'
      };
    }
    if (col.semanticSubtype === 'monetary' || col.type === 'currency') {
      return {
        label: 'Métrica (Monetário R$)',
        badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
        icon: <DollarSign className="w-3.5 h-3.5 text-emerald-400" />,
        isProtected: false,
        protectionText: 'Métrica monetária aditiva para apuração de faturamento e receitas'
      };
    }
    if (col.semanticSubtype === 'birth_date') {
      return {
        label: 'Atributo Cadastral (Nasc. / Fundação)',
        badgeClass: 'bg-violet-500/10 text-violet-300 border-violet-500/25',
        icon: <Calendar className="w-3.5 h-3.5 text-violet-400" />,
        isProtected: false,
        protectionText: 'Atributo biográfico/demográfico da entidade (NÃO é adesão comercial; imune a falsas narrativas de expansão comercial)'
      };
    }
    if (col.semanticSubtype === 'registration_date') {
      return {
        label: 'Adesão / Cadastro Comercial',
        badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25',
        icon: <Calendar className="w-3.5 h-3.5 text-emerald-400" />,
        isProtected: false,
        protectionText: 'Data oficial de aquisição/adesão da conta (utilizada para análise de crescimento MoM)'
      };
    }
    if (col.semanticRole === 'temporal' || col.type === 'date') {
      return {
        label: 'Temporal (Data / Período)',
        badgeClass: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25',
        icon: <Calendar className="w-3.5 h-3.5 text-indigo-400" />,
        isProtected: false,
        protectionText: 'Dimensão cronológica para séries temporais e evolução de indicadores'
      };
    }
    if (col.semanticSubtype === 'status') {
      return {
        label: 'Categórico (Situação / Status)',
        badgeClass: 'bg-purple-500/10 text-purple-300 border-purple-500/25',
        icon: <Tag className="w-3.5 h-3.5 text-purple-400" />,
        isProtected: false,
        protectionText: 'Dimensão de status operacional (ativo/inativo). Não infere regularidade documental ou fiscal.'
      };
    }
    if (col.semanticRole === 'metric') {
      return {
        label: 'Métrica (Quantidade / Numérico)',
        badgeClass: 'bg-blue-500/10 text-blue-300 border-blue-500/25',
        icon: <TrendingUp className="w-3.5 h-3.5 text-blue-400" />,
        isProtected: false,
        protectionText: 'Indicador quantitativo somável'
      };
    }
    return {
      label: 'Categórico (Segmento / Tipo)',
      badgeClass: 'bg-neutral-500/10 text-neutral-300 border-neutral-500/25',
      icon: <Tag className="w-3.5 h-3.5 text-neutral-400" />,
      isProtected: false,
      protectionText: 'Dimensão categórica para agrupamento e filtros'
    };
  };

  // Preview cell formatter
  const formatPreviewCell = (val: any, col: ColumnSchema) => {
    if (val === null || val === undefined || val === '') {
      return <span className="text-neutral-600">-</span>;
    }
    if (col.semanticSubtype === 'cpf') {
      return <span className="font-mono text-amber-300/90 text-xs">{formatCPF(val)}</span>;
    }
    if (col.semanticSubtype === 'cnpj') {
      return <span className="font-mono text-amber-300/90 text-xs">{formatCNPJ(val)}</span>;
    }
    if (col.semanticSubtype === 'uf') {
      return (
        <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
          {String(val).toUpperCase().trim()}
        </span>
      );
    }
    if (col.type === 'currency' || col.semanticSubtype === 'monetary') {
      return (
        <span className="font-mono font-medium text-emerald-400 text-xs">
          {formatCurrency(Number(val) || 0)}
        </span>
      );
    }
    return <span className="text-neutral-300 text-xs truncate">{String(val)}</span>;
  };

  // Contextual Preview Cards for Archetype
  const renderContextualExplanation = () => {
    if (detectedArchetype.archetype === 'crm_clients') {
      return {
        title: 'Contexto Identificado: Base de Clientes & CRM',
        desc: 'O dashboard gerará automaticamente métricas de Quantidade de Clientes, Distribuição por Estado (UF), Situação Cadastral e Pendências. Identificadores (CPF, CNPJ e IDs) serão preservados para contagem única e nunca somados numericamente.',
        kpisPreview: [
          { label: 'Quantidade de Clientes', val: `${formatNumber(sheetData.rowCount)} Clientes`, icon: <Users className="w-4 h-4 text-emerald-400" /> },
          { label: 'Distribuição por Estado', val: 'Ranking Regional (UF)', icon: <MapPin className="w-4 h-4 text-cyan-400" /> },
          { label: 'Situação Cadastral', val: 'Ativos vs Inativos', icon: <CheckCircle2 className="w-4 h-4 text-blue-400" /> },
          { label: 'Pendências Cadastrais', val: 'Alertas & Regularização', icon: <AlertTriangle className="w-4 h-4 text-amber-400" /> }
        ]
      };
    }
    if (detectedArchetype.archetype === 'financial_sales') {
      return {
        title: 'Contexto Identificado: Vendas & Desempenho Financeiro',
        desc: 'O dashboard focará em Faturamento Total (R$), Volume de Pedidos, Ticket Médio e Margem Operacional por categoria e canal.',
        kpisPreview: [
          { label: 'Faturamento Total', val: 'Receita Bruta (R$)', icon: <DollarSign className="w-4 h-4 text-emerald-400" /> },
          { label: 'Total de Pedidos', val: `${formatNumber(sheetData.rowCount)} Pedidos`, icon: <Layers className="w-4 h-4 text-blue-400" /> },
          { label: 'Ticket Médio', val: 'Valor Médio por Venda', icon: <TrendingUp className="w-4 h-4 text-indigo-400" /> },
          { label: 'Desempenho Regional', val: 'Faturamento por UF', icon: <MapPin className="w-4 h-4 text-cyan-400" /> }
        ]
      };
    }
    if (detectedArchetype.archetype === 'inventory_products') {
      return {
        title: 'Contexto Identificado: Catálogo & Gestão de Estoque',
        desc: 'O dashboard priorizará Total de SKUs, Patrimônio em Estoque, Itens em Ruptura ou Estoque Crítico e Giro por Categoria.',
        kpisPreview: [
          { label: 'Total de SKUs', val: `${formatNumber(sheetData.rowCount)} Produtos`, icon: <Layers className="w-4 h-4 text-blue-400" /> },
          { label: 'Patrimônio em Estoque', val: 'Valor Total (R$)', icon: <DollarSign className="w-4 h-4 text-emerald-400" /> },
          { label: 'Itens em Ruptura', val: 'Estoque Baixo / Zerado', icon: <AlertTriangle className="w-4 h-4 text-rose-400" /> },
          { label: 'Volume Físico', val: 'Unidades Disponíveis', icon: <TrendingUp className="w-4 h-4 text-cyan-400" /> }
        ]
      };
    }
    return {
      title: 'Contexto Identificado: Análise de Dados Geral',
      desc: 'O dashboard estruturará indicadores métricos, proporções categóricas e evolução temporal respeitando a classificação semântica de cada campo.',
      kpisPreview: [
        { label: 'Total de Registros', val: `${formatNumber(sheetData.rowCount)} Itens`, icon: <Layers className="w-4 h-4 text-blue-400" /> },
        { label: 'Métrica Principal', val: 'Consolidado da Seleção', icon: <DollarSign className="w-4 h-4 text-emerald-400" /> },
        { label: 'Média Unitária', val: 'Média por Registro', icon: <TrendingUp className="w-4 h-4 text-indigo-400" /> },
        { label: 'Distribuição Categórica', val: 'Segmentos Líderes', icon: <Tag className="w-4 h-4 text-purple-400" /> }
      ]
    };
  };

  const contextInfo = renderContextualExplanation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-5xl bg-[#111215] border border-white/[0.09] rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Top Header */}
        <div className="p-5 border-b border-white/[0.07] bg-[#141519] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white tracking-tight">
                  Prévia & Confirmação da Análise
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  {detectedArchetype.label}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Confirme as tabelas, abas e colunas que farão parte do dashboard antes de iniciar a geração.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenSmartDetection && sheetData.smartDetection && (
              <button
                onClick={onOpenSmartDetection}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg transition-colors"
                title="Ajustar limites de cabeçalho e rodapés da tabela"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Limites da Tabela</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sub-Header: Sheet/Table Selection & Stats Bar */}
        <div className="px-5 py-3 border-b border-white/[0.06] bg-[#0E0F12] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-neutral-400">Origem:</span>
            <span className="font-medium text-white font-mono bg-white/[0.05] px-2 py-0.5 rounded border border-white/[0.08]">
              {sheetData.fileName}
            </span>

            {/* Multi-Sheet Switcher if applicable */}
            {availableSheets && availableSheets.length > 1 && onSelectSheet && (
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-neutral-400">Aba / Tabela:</span>
                <div className="flex items-center gap-1 bg-white/[0.03] p-0.5 rounded-lg border border-white/[0.06]">
                  {availableSheets.map(s => (
                    <button
                      key={s}
                      onClick={() => onSelectSheet(s)}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                        s === (currentSheetName || sheetData.sheetName)
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 text-neutral-400">
            <span>
              <strong className="text-white font-mono">{sheetData.rowCount}</strong> linhas
            </span>
            <span>·</span>
            <span>
              <strong className="text-white font-mono">{selectedCount}</strong> de{' '}
              <strong className="text-white font-mono">{totalCount}</strong> colunas selecionadas
            </span>
          </div>
        </div>

        {/* Navigation Tabs between Columns Checklist, Live Preview Grid, and Context Explanation */}
        <div className="px-5 pt-3 border-b border-white/[0.06] flex items-center justify-between gap-4 bg-[#111215] shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('columns')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
                activeTab === 'columns'
                  ? 'border-emerald-400 text-white font-semibold'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Seleção & Classificação de Colunas ({selectedCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('preview_grid')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
                activeTab === 'preview_grid'
                  ? 'border-emerald-400 text-white font-semibold'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Table className="w-3.5 h-3.5 text-neutral-400" />
              <span>Prévia dos Dados Tabulares (Primeiras Linhas)</span>
            </button>
            <button
              onClick={() => setActiveTab('context')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-all ${
                activeTab === 'context'
                  ? 'border-emerald-400 text-white font-semibold'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
              <span>Dashboard Contextualizado</span>
            </button>
          </div>

          {activeTab === 'columns' && (
            <div className="flex items-center gap-2 pb-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar colunas..."
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  className="w-44 text-xs bg-white/[0.04] border border-white/[0.08] rounded-lg pl-8 pr-2.5 py-1 text-white placeholder-neutral-500 focus:outline-hidden focus:border-emerald-500/50"
                />
              </div>
              <button
                onClick={handleSelectAll}
                className="px-2.5 py-1 text-[11px] font-medium text-neutral-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg transition-colors whitespace-nowrap"
              >
                Todas
              </button>
              <button
                onClick={handleDeselectNonEssential}
                className="px-2.5 py-1 text-[11px] font-medium text-neutral-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg transition-colors whitespace-nowrap"
                title="Desmarcar colunas de texto puramente descritivo"
              >
                Apenas Essenciais
              </button>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* TAB 1: COLUMNS CHECKLIST WITH SEMANTIC ROLES */}
          {activeTab === 'columns' && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-neutral-300">
                    O NexusBI detecta automaticamente campos de <strong>CPF/CNPJ</strong> e <strong>Códigos</strong> como identificadores, protegendo-os de somas numéricas acidentais.
                  </span>
                </div>
                <span className="font-mono text-[11px] text-emerald-400 font-semibold shrink-0">
                  {selectedCount} de {totalCount} ativas
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredColumns.map(col => {
                  const isSelected = selectedKeys.has(col.key);
                  const badge = getSemanticBadge(col);

                  return (
                    <div
                      key={col.key}
                      onClick={() => toggleColumn(col.key)}
                      className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[#15171C] border-white/[0.12] shadow-sm'
                          : 'bg-[#101114]/50 border-white/[0.04] opacity-50 hover:opacity-80'
                      }`}
                    >
                      {/* Top: Checkbox, Label, Role Selector */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              toggleColumn(col.key);
                            }}
                            className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center transition-colors shrink-0 ${
                              isSelected
                                ? 'bg-emerald-500 text-neutral-950 font-bold'
                                : 'border border-white/20 bg-white/[0.02]'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-semibold truncate ${
                                  isSelected ? 'text-white' : 'text-neutral-400 line-through'
                                }`}
                              >
                                {col.label}
                              </span>
                              {badge.isProtected && (
                                <span
                                  className="p-0.5 rounded text-amber-400 bg-amber-500/10"
                                  title={badge.protectionText}
                                >
                                  <ShieldCheck className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-neutral-500 font-mono block truncate">
                              Chave original: {col.key}
                            </span>
                          </div>
                        </div>

                        {/* Semantic Role Dropdown (allow quick override) */}
                        <div
                          onClick={e => e.stopPropagation()}
                          className="shrink-0 flex items-center gap-1.5"
                        >
                          <select
                            value={col.semanticRole}
                            onChange={e => handleRoleChange(col.key, e.target.value as SemanticRole)}
                            className="text-[11px] font-medium bg-white/[0.04] hover:bg-white/[0.07] text-neutral-300 border border-white/[0.09] rounded-md px-2 py-1 focus:outline-hidden focus:border-emerald-500/50 cursor-pointer"
                          >
                            <option value="identifier">🏷️ Identificador</option>
                            <option value="geographic">🗺️ Geográfico</option>
                            <option value="metric">💰 Métrica</option>
                            <option value="temporal">📅 Temporal</option>
                            <option value="categorical">🗂️ Categórico</option>
                            <option value="descriptive">📝 Descritivo</option>
                          </select>
                        </div>
                      </div>

                      {/* Middle: Semantic Badge with Description */}
                      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${badge.badgeClass}`}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>

                        <span className="text-[10px] text-neutral-500 font-mono">
                          {col.distinctCount} valores únicos
                        </span>
                      </div>

                      {/* Bottom: Sample Values Chips */}
                      {col.sampleValues && col.sampleValues.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/[0.04] flex items-center gap-1.5 overflow-hidden">
                          <span className="text-[10px] text-neutral-500 shrink-0">Amostra:</span>
                          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                            {col.sampleValues.slice(0, 3).map((val, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.2 rounded text-[10px] font-mono text-neutral-400 bg-white/[0.03] border border-white/[0.05] truncate max-w-[120px]"
                              >
                                {col.semanticSubtype === 'cpf'
                                  ? formatCPF(val)
                                  : col.semanticSubtype === 'cnpj'
                                  ? formatCNPJ(val)
                                  : String(val)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: LIVE TABULAR DATA PREVIEW */}
          {activeTab === 'preview_grid' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span>
                  Exibindo prévia das <strong>primeiras 8 linhas</strong> com as {selectedCount} colunas selecionadas.
                </span>
                <span className="text-[11px] font-mono text-emerald-400">
                  {selectedCount} colunas ativas para o dashboard
                </span>
              </div>

              <div className="overflow-x-auto border border-white/[0.08] rounded-xl bg-[#0F1013]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#141519] border-b border-white/[0.08] text-neutral-400">
                    <tr>
                      <th className="py-2.5 px-3 font-mono text-[11px] text-neutral-500 w-10 text-center">
                        #
                      </th>
                      {effectiveColumns
                        .filter(col => selectedKeys.has(col.key))
                        .map(col => {
                          const badge = getSemanticBadge(col);
                          return (
                            <th key={col.key} className="py-2.5 px-3 font-medium whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                {badge.icon}
                                <span className="text-white font-semibold">{col.label}</span>
                              </div>
                            </th>
                          );
                        })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {sheetData.rows.slice(0, 8).map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 px-3 font-mono text-[10px] text-neutral-600 text-center">
                          {rowIdx + 1}
                        </td>
                        {effectiveColumns
                          .filter(col => selectedKeys.has(col.key))
                          .map(col => (
                            <td key={col.key} className="py-2 px-3 whitespace-nowrap">
                              {formatPreviewCell(row[col.key], col)}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: CONTEXTUAL DASHBOARD EXPLANATION */}
          {activeTab === 'context' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent border border-emerald-500/20">
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">{contextInfo.title}</h3>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">{contextInfo.desc}</p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2.5">
                  Indicadores que serão gerados para este contexto:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {contextInfo.kpisPreview.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-[#141519] border border-white/[0.07] flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between text-neutral-400 mb-2">
                        <span className="text-xs font-medium">{item.label}</span>
                        <div className="p-1 rounded bg-white/[0.04]">{item.icon}</div>
                      </div>
                      <span className="text-base font-semibold text-white font-mono">{item.val}</span>
                      <span className="text-[10px] text-emerald-400/90 mt-1">Configurado para o contexto</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#141519] border border-white/[0.07] space-y-2 text-xs text-neutral-300">
                <h4 className="font-semibold text-white flex items-center gap-2">
                  <Info className="w-4 h-4 text-cyan-400" />
                  Como o NexusBI evita soma de códigos e identificadores:
                </h4>
                <p className="text-neutral-400 leading-relaxed">
                  Planilhas corporativas contêm colunas com numerais que não devem ser somados (ex: CPF, CNPJ, Código do Cliente, CEP, Matrícula). O algoritmo semântico do NexusBI classifica essas colunas como <strong>Identificador</strong> ou <strong>Dimensão Geográfica</strong>, permitindo agregações de contagem única e agrupamento, mas impedindo somas aritméticas distorcidas.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions Bar */}
        <div className="p-4 px-5 border-t border-white/[0.07] bg-[#141519] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span>Resumo:</span>
            <span className="font-medium text-white font-mono">{selectedCount} colunas confirmadas</span>
            <span>·</span>
            <span className="text-emerald-400 font-medium">{detectedArchetype.label}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] rounded-lg transition-colors"
            >
              Cancelar
            </button>

            <button
              onClick={handleConfirm}
              className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-md hover:shadow-emerald-500/20 transition-all font-sans"
            >
              <Sparkles className="w-3.5 h-3.5 text-neutral-950 fill-neutral-950" />
              <span>Confirmar e Gerar Dashboard ({selectedCount})</span>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-950" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
