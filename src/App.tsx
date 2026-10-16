import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SheetData, AutoAnalysis, FilterState, ViewMode, ColumnSchema, ExecutiveInsight } from './types/dashboard';
import {
  detectAutoAnalysis,
  detectAnomalies,
  computeGrowthTrends,
  generateExecutiveInsights,
  fetchAiExecutiveInsights,
  filterDataset,
  aggregateTimeline,
  aggregateCategory,
  formatValue,
  formatNumber,
  formatCurrency,
  cleanNumericValue,
  reparseSheetWithCustomHeader
} from './utils/dataEngine';
import { SAMPLE_DATASETS } from './data/sampleDatasets';
import { Navbar } from './components/Navbar';
import { ExecutiveInsightsPanel } from './components/ExecutiveInsightsPanel';
import { KPIGrid } from './components/KPIGrid';
import { SlicerBar } from './components/SlicerBar';
import { TrendChart } from './components/charts/TrendChart';
import { BarBreakdownChart } from './components/charts/BarBreakdownChart';
import { DonutChart } from './components/charts/DonutChart';
import { MatrixGrid } from './components/charts/MatrixGrid';
import { DataTable } from './components/DataTable';
import { FieldDictionary } from './components/FieldDictionary';
import { UploadModal } from './components/UploadModal';
import { ExportModal } from './components/ExportModal';
import { SmartTableDetectionModal } from './components/SmartTableDetectionModal';
import { PreGenerationPreviewModal } from './components/PreGenerationPreviewModal';
import { MathematicalAuditModal } from './components/MathematicalAuditModal';
import {
  extractSheetData,
  getValidMetricColumns,
  calculateSalesMetricsSummary,
  computeCentralMetrics,
  computeSegmentBreakdown,
  reconcileDatasetMetrics
} from './utils/dataEngine';
import * as XLSX from 'xlsx';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [activeMetricKey, setActiveMetricKey] = useState<string>('');
  const [activeView, setActiveView] = useState<ViewMode>('dashboard');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSmartDetectionOpen, setIsSmartDetectionOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [pendingSheetData, setPendingSheetData] = useState<SheetData | null>(null);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);

  // AI-generated insights state
  const [aiInsights, setAiInsights] = useState<ExecutiveInsight[] | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    dateRange: { start: null, end: null },
    categoryFilters: {},
    activeCrossFilter: null,
    onlyAnomalies: false
  });

  // Load default dataset on initial mount
  useEffect(() => {
    const defaultSample = SAMPLE_DATASETS[0];
    let ws: XLSX.WorkSheet;
    if (defaultSample.generateRawGrid) {
      ws = XLSX.utils.aoa_to_sheet(defaultSample.generateRawGrid());
    } else {
      const rows = defaultSample.generateRows();
      ws = XLSX.utils.json_to_sheet(rows);
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Planilha1');
    const parsedData = extractSheetData(wb, wb.SheetNames[0], defaultSample.fileName, 54000);
    setSheetData(parsedData);
  }, []);

  // Compute Auto Analysis when sheet data changes
  const autoAnalysis = useMemo<AutoAnalysis | null>(() => {
    if (!sheetData) return null;
    return detectAutoAnalysis(sheetData.columns, sheetData.rows);
  }, [sheetData]);

  // Set active metric when analysis updates
  useEffect(() => {
    if (autoAnalysis && !activeMetricKey) {
      setActiveMetricKey(autoAnalysis.primaryMetricKey);
    }
  }, [autoAnalysis, activeMetricKey]);

  // Reset AI insights when active cross-filter or metric changes so it updates fresh
  useEffect(() => {
    setAiInsights(null);
  }, [filters.activeCrossFilter, filters.onlyAnomalies, activeMetricKey, sheetData?.fileName]);

  // Identify metric columns strictly excluding identifiers like CPF, CNPJ, IDs, Códigos
  const metricColumns = useMemo<ColumnSchema[]>(() => {
    if (!sheetData) return [];
    return getValidMetricColumns(sheetData.columns, autoAnalysis?.archetype || 'generic_analytics');
  }, [sheetData, autoAnalysis]);

  const activeMetricColumn = useMemo<ColumnSchema | undefined>(() => {
    return metricColumns.find(c => c.key === activeMetricKey) || metricColumns[0];
  }, [metricColumns, activeMetricKey]);

  // Anomaly Report for current active metric over sheetData.rows
  const anomalyReport = useMemo(() => {
    if (!sheetData || !activeMetricColumn) return null;
    return detectAnomalies(
      sheetData.rows,
      activeMetricColumn.key,
      activeMetricColumn.label,
      activeMetricColumn.type
    );
  }, [sheetData, activeMetricColumn]);

  // Filtered dataset
  const filteredRows = useMemo(() => {
    if (!sheetData) return [];
    return filterDataset(
      sheetData.rows,
      sheetData.columns,
      filters,
      autoAnalysis?.dateKey,
      anomalyReport?.outlierIndices
    );
  }, [sheetData, filters, autoAnalysis?.dateKey, anomalyReport?.outlierIndices]);

  // Aggregated Timeline with contextual aggregation mode
  const timelineData = useMemo(() => {
    if (!autoAnalysis?.dateKey || !activeMetricColumn) return [];
    const mode = autoAnalysis.contextConfig?.trendAggregationMode || (activeMetricColumn.key === '__count__' ? 'count' : 'sum');
    const metricKey = mode === 'count' ? '__count__' : activeMetricColumn.key;
    const granularity = autoAnalysis.dateSemanticType === 'birth_founding' ? 'year' : 'month';
    return aggregateTimeline(filteredRows, autoAnalysis.dateKey, metricKey, mode, granularity);
  }, [filteredRows, autoAnalysis, activeMetricColumn]);

  // Growth Trend calculated over current timeline (disabled for birth/founding dates to prevent fake commercial growth narratives)
  const growthTrend = useMemo(() => {
    if (autoAnalysis?.dateSemanticType === 'birth_founding') return null;
    return computeGrowthTrends(timelineData);
  }, [timelineData, autoAnalysis?.dateSemanticType]);

  // Dynamic KPIs calculated over filtered rows with anomaly warnings and growth trends
  const dynamicKPIs = useMemo(() => {
    if (!sheetData || !activeMetricColumn || !autoAnalysis) return [];

    const totalRecords = filteredRows.length;
    const metricVals = filteredRows
      .map(r => cleanNumericValue(r[activeMetricColumn.key]))
      .filter((v): v is number => v !== null);

    const sumVal = metricVals.reduce((acc, curr) => acc + curr, 0);
    const avgVal = totalRecords > 0 ? sumVal / totalRecords : 0;

    let anomalyWarning = undefined;
    if (anomalyReport && anomalyReport.hasSignificantAnomalies) {
      anomalyWarning = {
        count: anomalyReport.outlierCount,
        percentage: anomalyReport.outlierPercentage,
        text: `${anomalyReport.outlierCount} anomalia${anomalyReport.outlierCount > 1 ? 's' : ''} (${anomalyReport.outlierPercentage.toFixed(1)}%)`,
        severity: (anomalyReport.outlierPercentage > 5 || anomalyReport.maxDeviationPct > 150 ? 'critical' : 'warning') as 'critical' | 'warning',
        thresholdText: `Fora de ${formatValue(anomalyReport.lowerBound, activeMetricColumn.type)} ~ ${formatValue(anomalyReport.upperBound, activeMetricColumn.type)}`
      };
    }

    // 1. CONTEXTUAL DASHBOARD: CRM & BASE DE CLIENTES
    // Exemplo do usuário: quantidade de clientes, distribuição por estado, situação cadastral e pendências
    if (autoAnalysis.archetype === 'crm_clients') {
      const ufCol = sheetData.columns.find(c => c.semanticSubtype === 'uf' || c.semanticRole === 'geographic' || /uf|estado/i.test(c.key));
      const statusCol = sheetData.columns.find(c => /situa|status|fase|condi/i.test(c.key));
      const pendCol = sheetData.columns.find(c => /pend|inadimpl|bloque/i.test(c.key));

      const crmKPIs: AutoAnalysis['kpis'] = [
        {
          key: 'total_clients',
          label: 'Quantidade de Clientes',
          value: totalRecords,
          formatted: `${formatNumber(totalRecords)} Clientes`,
          type: 'number',
          growthTrend: autoAnalysis.isRegistrationTimeline ? (growthTrend || undefined) : undefined,
          subtext: filteredRows.length < sheetData.rowCount
            ? `${((totalRecords / (sheetData.rowCount || 1)) * 100).toFixed(0)}% da base filtrada`
            : (autoAnalysis.isRegistrationTimeline ? 'Contas cadastradas no sistema' : 'Contas cadastradas ativas')
        }
      ];

      // Distribuição por Estado (UF)
      const distinctUFs = ufCol
        ? new Set(filteredRows.map(r => String(r[ufCol.key] || '').trim()).filter(Boolean)).size
        : 1;
      const topUFs = ufCol ? aggregateCategory(filteredRows, ufCol.key, '__count__', 1, 'count') : [];
      crmKPIs.push({
        key: 'distribuicao_estado',
        label: 'Distribuição por Estado (UF)',
        value: distinctUFs,
        formatted: `${distinctUFs} Estados (UFs)`,
        type: 'number',
        subtext: topUFs[0]
          ? `${topUFs[0].label} lidera com ${topUFs[0].percentage.toFixed(0)}% (${topUFs[0].count} contas)`
          : 'Cobertura federativa nacional'
      });

      // Situação Cadastral (Status CRM)
      const activeCount = statusCol
        ? filteredRows.filter(r => /ativo|regular|aprovado|vigente/i.test(String(r[statusCol.key] || ''))).length
        : totalRecords;
      const activePct = totalRecords > 0 ? (activeCount / totalRecords) * 100 : 100;
      crmKPIs.push({
        key: 'situacao_cadastral',
        label: 'Situação Cadastral (Status CRM)',
        value: activeCount,
        formatted: `${formatNumber(activeCount)} Ativos`,
        type: 'number',
        subtext: `${activePct.toFixed(1)}% com status ativo no sistema`
      });

      // Validação Documental x Pendências Cadastrais
      const docCol = sheetData.columns.find(c => c.semanticSubtype === 'cpf' || c.semanticSubtype === 'cnpj' || /cpf|cnpj|doc/i.test(c.key));
      if (pendCol) {
        const pendingCount = filteredRows.filter(r => !/sem pend|nenhuma|regular/i.test(String(r[pendCol.key] || '')) && String(r[pendCol.key] || '').trim() !== '').length;
        const pendingPct = totalRecords > 0 ? (pendingCount / totalRecords) * 100 : 0;
        crmKPIs.push({
          key: 'pendencias_cadastrais',
          label: 'Pendências Documentais',
          value: pendingCount,
          formatted: `${formatNumber(pendingCount)} Pendências`,
          type: 'number',
          anomalyWarning: pendingCount > 0 ? {
            count: pendingCount,
            percentage: pendingPct,
            text: `${pendingCount} requerem atenção cadastral/documental`,
            severity: pendingPct > 20 ? 'critical' : 'warning',
            thresholdText: 'Registros com pendência'
          } : undefined,
          subtext: pendingCount > 0 ? 'Exigem saneamento documental/onboarding' : 'Sem pendências registradas na coluna'
        });
      } else if (docCol) {
        let validSyntaxCount = 0;
        filteredRows.forEach(r => {
          const rawDoc = String(r[docCol.key] || '').replace(/\D/g, '');
          if (rawDoc.length === 11 || rawDoc.length === 14) validSyntaxCount++;
        });
        const validSyntaxPct = totalRecords > 0 ? (validSyntaxCount / totalRecords) * 100 : 100;
        const invalidSyntaxCount = totalRecords - validSyntaxCount;
        crmKPIs.push({
          key: 'validacao_documental_sintaxe',
          label: 'Validação Documental (Sintaxe)',
          value: validSyntaxCount,
          formatted: `${formatNumber(validSyntaxCount)} Formatados`,
          type: 'number',
          anomalyWarning: invalidSyntaxCount > 0 ? {
            count: invalidSyntaxCount,
            percentage: totalRecords > 0 ? (invalidSyntaxCount / totalRecords) * 100 : 0,
            text: `${invalidSyntaxCount} documentos com padrão incompleto`,
            severity: 'warning',
            thresholdText: 'Sintaxe CPF/CNPJ'
          } : undefined,
          subtext: `${validSyntaxPct.toFixed(0)}% sintaxe CPF/CNPJ (validação fiscal externa não auditada)`
        });
      } else {
        crmKPIs.push({
          key: 'validacao_documental',
          label: 'Validação Documental',
          value: 0,
          formatted: 'Não Auditada',
          type: 'number',
          subtext: 'Base sem coluna fiscal/documental; status reflete apenas CRM'
        });
      }

      // Se o usuário selecionou uma métrica monetária genuína (ex: LTV Acumulado), exibe no primeiro card
      if (activeMetricColumn && (activeMetricColumn.type === 'currency' || activeMetricColumn.semanticSubtype === 'monetary')) {
        crmKPIs[0] = {
          key: 'active_metric_total',
          label: `Total ${activeMetricColumn.label}`,
          value: sumVal,
          formatted: formatValue(sumVal, activeMetricColumn.type),
          type: 'currency',
          growthTrend: growthTrend || undefined,
          anomalyWarning,
          subtext: `Média de ${formatValue(avgVal, activeMetricColumn.type)} por cliente`
        };
      }

      return crmKPIs;
    }

    // 2. CONTEXTUAL DASHBOARD: ESTOQUE & PRODUTOS
    if (autoAnalysis.archetype === 'inventory_products') {
      const statusCol = sheetData.columns.find(c => c.key.toLowerCase().includes('status') || c.key.toLowerCase().includes('estoque'));
      const stockCol = sheetData.columns.find(c => c.key.toLowerCase().includes('estoque atual') || c.key.toLowerCase().includes('quantidade'));
      const valStockCol = sheetData.columns.find(c => c.key.toLowerCase().includes('valor') || c.type === 'currency');
      const rupturas = filteredRows.filter(r => 
        (statusCol && String(r[statusCol.key] || '').toLowerCase().includes('ruptura')) || 
        cleanNumericValue(r['Estoque Atual']) === 0
      ).length;

      const sumStockVal = valStockCol
        ? filteredRows.reduce((acc, r) => acc + (cleanNumericValue(r[valStockCol.key]) || 0), 0)
        : sumVal;
      const totalUnits = stockCol
        ? filteredRows.reduce((acc, r) => acc + (cleanNumericValue(r[stockCol.key]) || 0), 0)
        : totalRecords;

      const inventoryKPIs: AutoAnalysis['kpis'] = [
        {
          key: 'total_skus',
          label: 'Total de SKUs',
          value: totalRecords,
          formatted: formatNumber(totalRecords),
          type: 'number',
          subtext: `${totalUnits.toLocaleString('pt-BR')} unidades físicas em estoque`
        },
        {
          key: 'val_stock',
          label: 'Patrimônio em Estoque',
          value: sumStockVal,
          formatted: formatCurrency(sumStockVal),
          type: 'currency',
          growthTrend: growthTrend || undefined,
          subtext: 'Valor de inventário avaliado'
        },
        {
          key: 'rupturas',
          label: 'Itens em Ruptura',
          value: rupturas,
          formatted: formatNumber(rupturas),
          type: 'number',
          changePercent: rupturas > 0 ? -rupturas * 2 : 0,
          anomalyWarning: rupturas > 0 ? {
            count: rupturas,
            percentage: (rupturas / totalRecords) * 100,
            text: `${rupturas} itens zerados`,
            severity: 'critical',
            thresholdText: 'Estoque zero'
          } : undefined,
          subtext: rupturas > 0 ? 'Requer pedido emergencial aos fornecedores' : 'Estoque abastecido'
        },
        {
          key: 'volume_total',
          label: 'Volume Total Estocado',
          value: totalUnits,
          formatted: formatNumber(totalUnits),
          type: 'number',
          subtext: `Média de ${Math.round(totalUnits / (totalRecords || 1))} itens por SKU`
        }
      ];
      return inventoryKPIs;
    }

    // 3. CONTEXTUAL DASHBOARD: VENDAS & COMERCIAL DETERMINÍSTICO
    if (autoAnalysis.archetype === 'financial_sales') {
      const summary = calculateSalesMetricsSummary(filteredRows, sheetData.columns);
      const isGross = /bruto|gross/i.test(activeMetricColumn.key);
      const displayRevenue = isGross ? summary.grossRevenue : (summary.hasCancellations ? summary.realizedRevenue : summary.grossRevenue);
      const revLabel = isGross ? 'Faturamento Bruto' : (summary.hasCancellations ? 'Receita Realizada (Auditada)' : 'Faturamento Total');

      const salesKPIs: AutoAnalysis['kpis'] = [
        {
          key: 'total_revenue',
          label: revLabel,
          value: displayRevenue,
          formatted: formatCurrency(displayRevenue),
          type: 'currency',
          growthTrend: growthTrend || undefined,
          anomalyWarning,
          subtext: summary.hasCancellations
            ? `Bruto: ${formatCurrency(summary.grossRevenue)} · Realizado: ${formatCurrency(summary.realizedRevenue)}`
            : (growthTrend ? `Crescimento MoM: ${growthTrend.formatted}` : 'Soma total dos pedidos')
        },
        {
          key: 'total_orders',
          label: 'Total de Pedidos',
          value: summary.uniqueOrdersCount,
          formatted: `${formatNumber(summary.uniqueOrdersCount)} Pedidos`,
          type: 'number',
          subtext: summary.hasCancellations
            ? `${summary.completedOrdersCount} faturados (${((summary.completedOrdersCount / (summary.uniqueOrdersCount || 1)) * 100).toFixed(0)}%) · ${summary.canceledOrdersCount} cancelados`
            : (summary.uniqueCustomersCount > 0 ? `${summary.uniqueCustomersCount} clientes únicos` : 'Pedidos processados')
        },
        {
          key: 'avg_ticket',
          label: 'Ticket Médio Realizado',
          value: summary.avgTicket,
          formatted: formatCurrency(summary.avgTicket),
          type: 'currency',
          subtext: summary.hasCancellations
            ? `Base: ${summary.completedOrdersCount} faturados (Média bruta: ${formatCurrency(summary.uniqueOrdersCount > 0 ? summary.grossRevenue / summary.uniqueOrdersCount : 0)})`
            : `Média de ${formatCurrency(summary.avgTicket)} por pedido`
        }
      ];

      if (summary.hasCancellations) {
        salesKPIs.push({
          key: 'cancellation_rate',
          label: 'Taxa de Cancelamento',
          value: summary.cancellationRatePct,
          formatted: `${summary.cancellationRatePct.toFixed(1)}%`,
          type: 'percentage',
          changePercent: summary.cancellationRatePct > 10 ? -summary.cancellationRatePct : 0,
          anomalyWarning: summary.cancellationRatePct > 10 ? {
            count: summary.canceledOrdersCount,
            percentage: summary.cancellationRatePct,
            text: `${summary.canceledOrdersCount} pedidos cancelados (-${formatCurrency(summary.canceledLoss)})`,
            severity: summary.cancellationRatePct > 15 ? 'critical' : 'warning',
            thresholdText: 'Cancelamentos'
          } : undefined,
          subtext: `Perda financeira: -${formatCurrency(summary.canceledLoss)} excluída da receita`
        });
      } else if (summary.weightedMarginPct !== undefined) {
        salesKPIs.push({
          key: 'avg_margin',
          label: 'Margem Bruta Média',
          value: summary.weightedMarginPct,
          formatted: `${summary.weightedMarginPct.toFixed(1)}%`,
          type: 'percentage',
          subtext: 'Ponderada por custo e receita realizada'
        });
      } else {
        salesKPIs.push({
          key: 'unique_customers',
          label: 'Clientes Únicos',
          value: summary.uniqueCustomersCount || totalRecords,
          formatted: `${formatNumber(summary.uniqueCustomersCount || totalRecords)} Clientes`,
          type: 'number',
          subtext: 'Compradores identificados na carteira'
        });
      }

      return salesKPIs;
    }

    // 4. CONTEXTUAL DASHBOARD: GENÉRICO / OUTROS DOMÍNIOS
    const kpis: AutoAnalysis['kpis'] = [
      {
        key: 'active_metric_total',
        label: `Total ${activeMetricColumn.label}`,
        value: sumVal,
        formatted: formatValue(sumVal, activeMetricColumn.type),
        type: activeMetricColumn.type === 'currency' ? 'currency' : 'number',
        growthTrend: growthTrend || undefined,
        anomalyWarning,
        subtext: growthTrend
          ? `Crescimento MoM: ${growthTrend.formatted} (${growthTrend.periodLabel})`
          : 'Soma acumulada da seleção'
      },
      {
        key: 'total_records',
        label: `Total de ${autoAnalysis.countUnitLabel}`,
        value: totalRecords,
        formatted: formatNumber(totalRecords),
        type: 'number',
        subtext: `${((totalRecords / (sheetData.rowCount || 1)) * 100).toFixed(0)}% da base total`
      },
      {
        key: 'active_metric_avg',
        label: `Média de ${activeMetricColumn.label}`,
        value: avgVal,
        formatted: formatValue(avgVal, activeMetricColumn.type),
        type: activeMetricColumn.type === 'currency' ? 'currency' : 'number',
        subtext: 'Média individual'
      }
    ];

    const profitCol = sheetData.columns.find(c => c.key.toLowerCase().includes('lucro') || c.key.toLowerCase().includes('profit') || c.key.toLowerCase().includes('margem'));
    const revCol = sheetData.columns.find(c => c.key.toLowerCase().includes('receita') || c.key.toLowerCase().includes('faturamento') || c.key.toLowerCase().includes('revenue'));

    if (profitCol && revCol) {
      const sumProfit = filteredRows.reduce((acc, r) => acc + (cleanNumericValue(r[profitCol.key]) || 0), 0);
      const sumRev = filteredRows.reduce((acc, r) => acc + (cleanNumericValue(r[revCol.key]) || 0), 0);
      const margin = sumRev > 0 ? (sumProfit / sumRev) * 100 : 0;

      kpis.push({
        key: 'dynamic_margin',
        label: 'Margem Operacional',
        value: margin,
        formatted: `${margin.toFixed(1)}%`,
        type: 'percentage',
        changePercent: margin >= 20 ? 4.5 : -1.8,
        subtext: 'Margem líquida da seleção'
      });
    } else if (metricColumns.length > 1) {
      const secCol = metricColumns.find(c => c.key !== activeMetricColumn.key);
      if (secCol) {
        const secSum = filteredRows.reduce((acc, r) => acc + (cleanNumericValue(r[secCol.key]) || 0), 0);
        kpis.push({
          key: 'secondary_metric_dynamic',
          label: `Total ${secCol.label}`,
          value: secSum,
          formatted: formatValue(secSum, secCol.type),
          type: secCol.type === 'currency' ? 'currency' : 'number',
          subtext: 'Indicador secundário'
        });
      }
    }

    return kpis;
  }, [sheetData, activeMetricColumn, filteredRows, metricColumns, anomalyReport, growthTrend, autoAnalysis]);

  // Causal Heuristic Executive Insights (immediate, zero lag, data-grounded)
  const heuristicInsights = useMemo(() => {
    if (!sheetData || !autoAnalysis || !activeMetricColumn) return [];
    return generateExecutiveInsights(
      filteredRows,
      sheetData.columns,
      {
        archetype: autoAnalysis.archetype,
        label: autoAnalysis.archetypeLabel,
        countUnit: autoAnalysis.countUnitLabel
      },
      activeMetricColumn,
      autoAnalysis.primaryCategoryKey,
      timelineData,
      anomalyReport,
      filters,
      dynamicKPIs.map(k => ({ label: k.label, formatted: k.formatted, value: k.value })),
      sheetData.rows
    );
  }, [filteredRows, sheetData, autoAnalysis, activeMetricColumn, timelineData, anomalyReport, filters, dynamicKPIs]);

  // Trigger LLM Gemini AI-powered deep causal insights
  const handleTriggerAiInsights = useCallback(async () => {
    if (!sheetData || !autoAnalysis || !activeMetricColumn) return;
    setIsLoadingAi(true);

    const topSegments = aggregateCategory(filteredRows, autoAnalysis.primaryCategoryKey, activeMetricColumn.key, 4).map(s => ({
      label: s.label,
      value: s.value,
      percentage: Math.round(s.percentage)
    }));

    const sampleRecords = filteredRows.slice(0, 5).map(r => {
      const clean: Record<string, any> = {};
      Object.keys(r).slice(0, 7).forEach(k => {
        clean[k] = r[k];
      });
      return clean;
    });

    const kpisSummary = dynamicKPIs.map(k => ({
      label: k.label,
      formatted: k.formatted,
      value: k.value
    }));

    const result = await fetchAiExecutiveInsights({
      archetypeLabel: autoAnalysis.archetypeLabel,
      activeFilters: filters,
      activeMetricLabel: activeMetricColumn.label,
      kpis: kpisSummary,
      topSegments,
      timelineTrend: growthTrend,
      anomaliesInfo: anomalyReport ? {
        count: anomalyReport.outlierCount,
        percentage: Math.round(anomalyReport.outlierPercentage),
        bounds: `${anomalyReport.lowerBound} a ${anomalyReport.upperBound}`
      } : null,
      sampleRecords
    });

    if (result && result.length > 0) {
      setAiInsights(result);
    }
    setIsLoadingAi(false);
  }, [sheetData, autoAnalysis, activeMetricColumn, filteredRows, filters, dynamicKPIs, growthTrend, anomalyReport]);

  // Deterministic Centralized Metrics Engine & Reconciliations
  const centralMetrics = useMemo(() => {
    if (!sheetData) return null;
    return computeCentralMetrics(filteredRows, sheetData.columns);
  }, [sheetData, filteredRows]);

  const fullCategoryBreakdown = useMemo(() => {
    if (!autoAnalysis || !activeMetricColumn) return undefined;
    const catKey = autoAnalysis.contextConfig?.barDimensionKey || autoAnalysis.primaryCategoryKey;
    const mode = autoAnalysis.contextConfig?.barAggregationMode || (activeMetricColumn.key === '__count__' ? 'count' : 'sum');
    const metricKey = mode === 'count' ? '__count__' : activeMetricColumn.key;
    return computeSegmentBreakdown(filteredRows, catKey, metricKey, { limit: 8, mode });
  }, [filteredRows, autoAnalysis, activeMetricColumn]);

  const categoryBreakdownData = useMemo(() => {
    return fullCategoryBreakdown ? fullCategoryBreakdown.segments : [];
  }, [fullCategoryBreakdown]);

  const fullDonutBreakdown = useMemo(() => {
    if (!autoAnalysis || !activeMetricColumn) return undefined;
    const dimKey = autoAnalysis.contextConfig?.donutDimensionKey ||
      autoAnalysis.secondaryCategoryKey ||
      sheetData?.columns.find(c => c.type === 'category' && c.key !== autoAnalysis.primaryCategoryKey)?.key ||
      autoAnalysis.primaryCategoryKey;

    if (!dimKey) return undefined;
    const mode = autoAnalysis.contextConfig?.donutAggregationMode || (activeMetricColumn.key === '__count__' ? 'count' : 'sum');
    const metricKey = mode === 'count' ? '__count__' : activeMetricColumn.key;
    return computeSegmentBreakdown(filteredRows, dimKey, metricKey, { limit: 6, mode });
  }, [filteredRows, autoAnalysis, sheetData, activeMetricColumn]);

  const donutData = useMemo(() => {
    return fullDonutBreakdown ? fullDonutBreakdown.segments : [];
  }, [fullDonutBreakdown]);

  const reconciliationReport = useMemo(() => {
    if (!centralMetrics) return null;
    return reconcileDatasetMetrics(centralMetrics, fullCategoryBreakdown, fullDonutBreakdown);
  }, [centralMetrics, fullCategoryBreakdown, fullDonutBreakdown]);

  const hasActiveFilters = useMemo(() => {
    return (
      Boolean(filters.searchQuery.trim()) ||
      Boolean(filters.dateRange.start || filters.dateRange.end) ||
      Object.keys(filters.categoryFilters).some(k => filters.categoryFilters[k]?.length > 0) ||
      Boolean(filters.activeCrossFilter) ||
      Boolean(filters.onlyAnomalies)
    );
  }, [filters]);

  const handleClearFilters = () => {
    setFilters({
      searchQuery: '',
      dateRange: { start: null, end: null },
      categoryFilters: {},
      activeCrossFilter: null,
      onlyAnomalies: false
    });
  };

  const handleToggleAnomalies = () => {
    setFilters(prev => ({ ...prev, onlyAnomalies: !prev.onlyAnomalies }));
  };

  const handleCrossFilter = (columnKey: string, value: string) => {
    if (filters.activeCrossFilter?.columnKey === columnKey && filters.activeCrossFilter?.value === value) {
      setFilters(prev => ({ ...prev, activeCrossFilter: null }));
    } else {
      setFilters(prev => ({
        ...prev,
        activeCrossFilter: { columnKey, value }
      }));
    }
  };

  const handleUpdateHeaderRowIndex = useCallback((headerRowIndex: number) => {
    if (!sheetData) return;
    const updated = reparseSheetWithCustomHeader(sheetData, headerRowIndex);
    setSheetData(updated);
    handleClearFilters();
    setActiveMetricKey('');
  }, [sheetData]);

  const handleConfirmPreview = useCallback((confirmedColumns: ColumnSchema[], activeKeys: string[]) => {
    const sourceData = pendingSheetData || sheetData;
    if (!sourceData) return;

    const activeCols = confirmedColumns.filter(c => activeKeys.includes(c.key));
    const updatedData: SheetData = {
      ...sourceData,
      columns: activeCols
    };

    setSheetData(updatedData);
    setPendingSheetData(null);
    handleClearFilters();
    setActiveMetricKey('');
    setIsPreviewOpen(false);
  }, [pendingSheetData, sheetData]);

  if (!sheetData || !autoAnalysis) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#090A0C] text-white">
        <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mb-3" />
        <p className="text-xs text-neutral-400 font-medium">Estruturando dados da planilha...</p>
      </div>
    );
  }

  const secondaryDimKey = autoAnalysis.secondaryCategoryKey ||
    sheetData.columns.find(c => c.type === 'category' && c.key !== autoAnalysis.primaryCategoryKey)?.key ||
    'Status';

  const activeFilterName = filters.activeCrossFilter
    ? `${filters.activeCrossFilter.columnKey}: ${filters.activeCrossFilter.value}`
    : filters.onlyAnomalies
    ? 'Apenas Anomalias'
    : null;

  return (
    <div className="min-h-screen bg-[#090A0C] text-[#EDEDED] flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Executive Print Only Header */}
      <div className="hidden print:block p-6 border-b border-slate-300 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">NexusBI - Relatório Executivo</h1>
            <p className="text-xs text-slate-500 mt-1">
              Origem: {sheetData.fileName} · Arquétipo: {autoAnalysis.archetypeLabel} · Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
            </p>
          </div>
          <div className="text-right text-xs text-slate-600 font-mono">
            <div>Registros: {filteredRows.length} de {sheetData.rowCount}</div>
            <div>Métrica: {activeMetricColumn?.label}</div>
            {growthTrend && <div>Crescimento MoM: {growthTrend.formatted}</div>}
          </div>
        </div>
      </div>

      {/* Top Bar Navigation */}
      <Navbar
        activeView={activeView}
        onViewChange={setActiveView}
        fileName={sheetData.fileName}
        archetypeLabel={autoAnalysis.archetypeLabel}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenSmartDetection={() => setIsSmartDetectionOpen(true)}
        onOpenPreGenerationPreview={() => {
          setPendingSheetData(sheetData);
          setAvailableSheets(sheetData ? [sheetData.sheetName] : []);
          setIsPreviewOpen(true);
        }}
        onOpenMathematicalAudit={() => setIsAuditModalOpen(true)}
        isReconciled={reconciliationReport?.isFullyReconciled ?? true}
        headerRowIndex={sheetData.smartDetection?.boundary.headerRowIndex}
        filteredCount={filteredRows.length}
        totalCount={sheetData.rowCount}
      />

      {/* Main Workspace Viewport */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* VIEW 1: POWER BI DASHBOARD */}
        {activeView === 'dashboard' && (
          <div id="dashboard-export-container" className="space-y-4 dashboard-canvas">
            {/* Slicers & Filters Bar */}
            <SlicerBar
              columns={sheetData.columns}
              filters={filters}
              dateKey={autoAnalysis.dateKey}
              metricColumns={metricColumns}
              activeMetricKey={activeMetricKey}
              anomaliesCount={anomalyReport?.outlierCount}
              onMetricChange={setActiveMetricKey}
              onFilterChange={setFilters}
              onClearCrossFilter={() => setFilters(prev => ({ ...prev, activeCrossFilter: null }))}
              onToggleAnomalies={handleToggleAnomalies}
            />

            {/* KPI Cards Row with Warning Indicators and Growth Trends */}
            <KPIGrid
              kpis={dynamicKPIs}
              isFiltered={hasActiveFilters}
              onToggleAnomalies={handleToggleAnomalies}
              isOnlyAnomaliesActive={filters.onlyAnomalies}
            />

            {/* Row 1 Charts: Trend Timeline with Growth Trends (2/3 width) + Donut Distribution (1/3 width) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 p-5 rounded-xl bg-[#111215] border border-white/[0.07] hover:border-white/[0.12] transition-all shadow-xs print-card min-h-[300px]">
                <TrendChart
                  data={timelineData}
                  metricLabel={
                    autoAnalysis.archetype === 'crm_clients'
                      ? (autoAnalysis.dateSemanticType === 'birth_founding' ? 'Clientes' : 'Novos Clientes')
                      : activeMetricColumn?.label || 'Métrica'
                  }
                  metricType={autoAnalysis.archetype === 'crm_clients' ? 'number' : activeMetricColumn?.type || 'currency'}
                  title={autoAnalysis.contextConfig?.trendChartTitle || `Evolução Temporal de ${activeMetricColumn?.label || 'Receita'}`}
                  subtitle={autoAnalysis.contextConfig?.trendChartSubtitle || (autoAnalysis.dateKey ? `Série temporal baseada em ${autoAnalysis.dateKey}` : undefined)}
                  growthTrend={autoAnalysis.dateSemanticType === 'birth_founding' ? null : growthTrend}
                />
              </div>

              <div className="p-5 rounded-xl bg-[#111215] border border-white/[0.07] hover:border-white/[0.12] transition-all shadow-xs print-card min-h-[300px]">
                <DonutChart
                  data={donutData}
                  metricLabel={autoAnalysis.archetype === 'crm_clients' ? 'Clientes' : activeMetricColumn?.label || 'Métrica'}
                  metricType={autoAnalysis.archetype === 'crm_clients' ? 'number' : activeMetricColumn?.type || 'currency'}
                  title={autoAnalysis.contextConfig?.donutChartTitle || `Composição por ${secondaryDimKey}`}
                  subtitle={autoAnalysis.contextConfig?.donutChartSubtitle || "Proporção percentual da seleção"}
                  activeCrossFilterValue={filters.activeCrossFilter?.columnKey === (autoAnalysis.contextConfig?.donutDimensionKey || secondaryDimKey) ? filters.activeCrossFilter.value : null}
                  onSelectCategory={val => handleCrossFilter(autoAnalysis.contextConfig?.donutDimensionKey || secondaryDimKey, val)}
                />
              </div>
            </div>

            {/* Row 2 Charts: Category Bar Breakdown (1/2 width) + Cross Heat Matrix (1/2 width) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="p-5 rounded-xl bg-[#111215] border border-white/[0.07] hover:border-white/[0.12] transition-all shadow-xs print-card min-h-[300px]">
                <BarBreakdownChart
                  data={categoryBreakdownData}
                  categoryKey={autoAnalysis.contextConfig?.barDimensionKey || autoAnalysis.primaryCategoryKey}
                  categoryLabel={autoAnalysis.contextConfig?.barDimensionKey || autoAnalysis.primaryCategoryKey}
                  metricLabel={autoAnalysis.archetype === 'crm_clients' ? 'Clientes' : activeMetricColumn?.label || 'Métrica'}
                  metricType={autoAnalysis.archetype === 'crm_clients' ? 'number' : activeMetricColumn?.type || 'currency'}
                  title={autoAnalysis.contextConfig?.barChartTitle || `Distribuição por ${autoAnalysis.primaryCategoryKey}`}
                  subtitle={autoAnalysis.contextConfig?.barChartSubtitle || "Classificação decrescente por volume"}
                  activeCrossFilterValue={filters.activeCrossFilter?.columnKey === (autoAnalysis.contextConfig?.barDimensionKey || autoAnalysis.primaryCategoryKey) ? filters.activeCrossFilter.value : null}
                  onSelectCategory={val => handleCrossFilter(autoAnalysis.contextConfig?.barDimensionKey || autoAnalysis.primaryCategoryKey, val)}
                />
              </div>

              <div className="p-5 rounded-xl bg-[#111215] border border-white/[0.07] hover:border-white/[0.12] transition-all shadow-xs print-card min-h-[300px]">
                <MatrixGrid
                  rows={filteredRows}
                  rowDimKey={autoAnalysis.contextConfig?.matrixRowKey || autoAnalysis.primaryCategoryKey}
                  colDimKey={autoAnalysis.contextConfig?.matrixColKey || secondaryDimKey}
                  metricKey={autoAnalysis.archetype === 'crm_clients' ? '__count__' : activeMetricColumn?.key || ''}
                  metricType={autoAnalysis.archetype === 'crm_clients' ? 'number' : activeMetricColumn?.type || 'currency'}
                  title={autoAnalysis.contextConfig?.matrixTitle || "Matriz de Desempenho Cruzada"}
                  onSelectDimension={(key, val) => handleCrossFilter(key, val)}
                />
              </div>
            </div>

            {/* Executive Insights Panel - Positioned at the bottom of the dashboard */}
            <ExecutiveInsightsPanel
              insights={aiInsights || heuristicInsights}
              archetypeLabel={autoAnalysis.archetypeLabel}
              isLoadingAi={isLoadingAi}
              onRefreshAi={handleTriggerAiInsights}
              activeFilterName={activeFilterName}
              isAiPowered={Boolean(aiInsights)}
              extractedSummaries={sheetData.smartDetection?.summaries}
              extractedNotes={sheetData.smartDetection?.notes}
            />
          </div>
        )}

        {/* VIEW 2: GRANULAR DATA TABLE */}
        {activeView === 'table' && (
          <DataTable
            rows={filteredRows}
            columns={sheetData.columns}
            fileName={sheetData.fileName}
            outlierIndices={anomalyReport?.outlierIndices}
            activeMetricKey={activeMetricKey}
            isOnlyAnomaliesFilterActive={filters.onlyAnomalies}
            smartDetection={sheetData.smartDetection}
            onOpenSmartDetection={() => setIsSmartDetectionOpen(true)}
          />
        )}

        {/* VIEW 3: FIELD STRUCTURE & DICTIONARY */}
        {activeView === 'fields' && (
          <FieldDictionary
            columns={sheetData.columns}
            totalRows={sheetData.rowCount}
            fileName={sheetData.fileName}
          />
        )}
      </main>

      {/* Smart Table Boundary & Segmentation Modal */}
      <SmartTableDetectionModal
        isOpen={isSmartDetectionOpen}
        onClose={() => setIsSmartDetectionOpen(false)}
        sheetData={sheetData}
        onUpdateHeaderRowIndex={handleUpdateHeaderRowIndex}
      />

      {/* Upload Spreadsheet Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onDataLoaded={(data, sheetNames) => {
          setPendingSheetData(data);
          setAvailableSheets(sheetNames && sheetNames.length > 0 ? sheetNames : [data.sheetName]);
          setIsUploadOpen(false);
          setIsPreviewOpen(true);
        }}
      />

      {/* Pre-Generation Preview & Confirmation Modal */}
      {(pendingSheetData || sheetData) && (
        <PreGenerationPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setPendingSheetData(null);
          }}
          sheetData={pendingSheetData || sheetData!}
          availableSheets={availableSheets}
          currentSheetName={pendingSheetData?.sheetName || sheetData?.sheetName}
          onConfirm={handleConfirmPreview}
          onOpenSmartDetection={() => {
            setIsPreviewOpen(false);
            setIsSmartDetectionOpen(true);
          }}
        />
      )}

      {/* Real-Time Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        filteredRows={filteredRows}
        fileName={sheetData.fileName}
        filters={filters}
      />

      {/* Mathematical Audit & Reconciliation Modal */}
      {centralMetrics && reconciliationReport && (
        <MathematicalAuditModal
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
          metrics={centralMetrics}
          reconciliationReport={reconciliationReport}
          categoryBreakdown={fullCategoryBreakdown}
          channelBreakdown={fullDonutBreakdown}
          fileName={sheetData.fileName}
        />
      )}
    </div>
  );
}
