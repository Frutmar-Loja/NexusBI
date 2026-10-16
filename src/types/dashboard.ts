export type ColumnType = 'currency' | 'number' | 'date' | 'category' | 'boolean' | 'text';

export type MetricAdditivity = 'additive' | 'semi_additive' | 'non_additive';

export type SemanticRole =
  | 'identifier'   // CPF, CNPJ, IDs, SKUs, Códigos
  | 'geographic'   // UF, Estado, Região, Cidade, País
  | 'metric'       // Valores Monetários, Faturamento, Quantidades, Percentuais
  | 'temporal'     // Datas, Competências, Anos, Meses
  | 'categorical'  // Categorias, Segmentos, Status, Canais
  | 'descriptive'; // Nomes, Descrições, Textos livres

export type SemanticSubtype =
  | 'cpf'
  | 'cnpj'
  | 'general_id'
  | 'uf'
  | 'city'
  | 'country_region'
  | 'monetary'        // Faturamento, Receita, Valor Total (Aditivo)
  | 'gross_revenue'   // Valor Bruto, Faturamento Bruto (Aditivo)
  | 'net_revenue'     // Valor Líquido, Receita Líquida (Aditivo)
  | 'discount'        // Desconto concedido (Aditivo R$)
  | 'shipping'        // Frete cobrado (Aditivo R$)
  | 'cost'            // Custo total / Custo produtos (Aditivo R$)
  | 'unit_price'      // Preço Unitário (Não-aditivo)
  | 'unit_cost'       // Custo Unitário (Não-aditivo)
  | 'quantity'        // Quantidade, Qtd, Itens, Volume (Aditivo)
  | 'metric_number'   // Medida numérica genérica
  | 'percentage'      // Percentuais, Margem %, Taxas (Não-aditivo)
  | 'date'
  | 'birth_date'
  | 'registration_date'
  | 'event_date'
  | 'due_date'
  | 'period_year'
  | 'period_month'
  | 'status'
  | 'category'
  | 'email'
  | 'phone'
  | 'person_name'
  | 'text';

export type SpreadsheetArchetype =
  | 'financial_sales'
  | 'crm_clients'
  | 'inventory_products'
  | 'operations_support'
  | 'hr_people'
  | 'financial_accounting'
  | 'generic_analytics';

export interface ColumnSchema {
  key: string;
  label: string;
  type: ColumnType;
  semanticRole: SemanticRole;
  semanticSubtype: SemanticSubtype;
  semanticConfidence: number; // 0 to 1
  semanticDescription?: string;
  additivity?: MetricAdditivity;
  isUnitMetric?: boolean;
  isIdentifier?: boolean;
  distinctCount: number;
  sampleValues: (string | number | boolean)[];
  min?: number;
  max?: number;
  sum?: number;
  avg?: number;
}

export interface ExtractedSummaryItem {
  label: string;
  value: string;
  rawRowIndex?: number;
}

export interface ExtractedNoteItem {
  text: string;
  type: 'title' | 'observation' | 'footnote' | 'metadata';
  rawRowIndex?: number;
}

export interface TableBoundary {
  headerRowIndex: number;
  startDataRowIndex: number;
  endDataRowIndex: number;
  totalRawRows: number;
  totalColumns: number;
  detectedTitle?: string;
  hasPreTableSummaries: boolean;
  hasPostTableFooters: boolean;
  hasObservations: boolean;
}

export interface SmartTableDetectionResult {
  boundary: TableBoundary;
  summaries: ExtractedSummaryItem[];
  notes: ExtractedNoteItem[];
  footers: ExtractedSummaryItem[];
  rawGridSample: any[][];
}

export interface SheetData {
  sheetName: string;
  columns: ColumnSchema[];
  rows: Record<string, any>[];
  fileName: string;
  fileSize: number;
  rowCount: number;
  smartDetection?: SmartTableDetectionResult;
  rawGrid?: any[][];
}

export interface GrowthTrend {
  direction: 'up' | 'down' | 'neutral';
  percentage: number;
  formatted: string;
  previousPeriodValue: number;
  currentPeriodValue: number;
  periodLabel: string;
  isAccelerating?: boolean;
}

export interface AnomalyWarning {
  count: number;
  percentage: number;
  text: string;
  severity: 'warning' | 'critical';
  thresholdText: string;
}

export interface AnomalyReport {
  metricKey: string;
  metricLabel: string;
  totalEvaluated: number;
  outlierIndices: Set<number>;
  outlierCount: number;
  outlierPercentage: number;
  hasSignificantAnomalies: boolean;
  lowerBound: number;
  upperBound: number;
  q1: number;
  q3: number;
  median: number;
  iqr: number;
  highOutliersCount: number;
  lowOutliersCount: number;
  maxDeviationPct: number;
  summaryText: string;
}

export type InsightCategory = 'verified_fact' | 'quality_alert' | 'suggested_opportunity';

export interface ExecutiveInsight {
  id: string;
  category: InsightCategory;
  type: 'highlight' | 'trend' | 'risk' | 'recommendation';
  title: string;
  description: string;
  metricBadge?: string;
  importance: 'high' | 'medium';
  evidence?: string;
  verifiableFacts?: string[];
  actionableStep?: string;
  businessImpact?: string;
  isHypothesis?: boolean;
  hypothesisDisclaimer?: string;
  // Rigorous audit metadata
  metricId?: string;
  calculatedValue?: number;
  comparisonBase?: string;
  period?: string;
  appliedFiltersSummary?: string;
  reconciliationStatus?: 'verified' | 'unverified' | 'flagged';
}

export interface ContextualDashboardConfig {
  kpiTitle?: string;
  barChartTitle: string;
  barChartSubtitle?: string;
  barDimensionKey: string;
  barAggregationMode: 'sum' | 'count';
  donutChartTitle: string;
  donutChartSubtitle?: string;
  donutDimensionKey: string;
  donutAggregationMode: 'sum' | 'count';
  trendChartTitle: string;
  trendChartSubtitle?: string;
  trendAggregationMode: 'sum' | 'count';
  matrixRowKey: string;
  matrixColKey: string;
  matrixTitle: string;
}

export interface AutoAnalysis {
  archetype: SpreadsheetArchetype;
  archetypeLabel: string;
  countUnitLabel: string;
  primaryMetricKey: string;
  secondaryMetricKey?: string;
  dateKey?: string;
  dateSemanticType?: 'registration' | 'event' | 'birth_founding' | 'period' | 'generic';
  isRegistrationTimeline?: boolean;
  primaryCategoryKey: string;
  secondaryCategoryKey?: string;
  contextConfig?: ContextualDashboardConfig;
  insights: ExecutiveInsight[];
  kpis: {
    key: string;
    label: string;
    value: number;
    formatted: string;
    type: 'currency' | 'number' | 'percentage';
    changePercent?: number;
    growthTrend?: GrowthTrend;
    anomalyWarning?: AnomalyWarning;
    subtext?: string;
  }[];
}

export interface FilterState {
  searchQuery: string;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  categoryFilters: Record<string, string[]>; // columnKey -> selected values
  activeCrossFilter: {
    columnKey: string;
    value: string;
  } | null;
  onlyAnomalies?: boolean;
}

export interface SalesMetricsSummary {
  totalRecords: number;
  uniqueOrdersCount: number;
  uniqueCustomersCount: number;
  grossRevenue: number;
  realizedRevenue: number;
  pendingRevenue: number;
  canceledLoss: number;
  completedOrdersCount: number;
  pendingOrdersCount: number;
  canceledOrdersCount: number;
  canceledCount: number;
  cancellationRatePct: number;
  averageTicketRealized: number;
  avgTicket: number;
  weightedMarginPct?: number;
  avgMarginPct: number;
  totalUnitsSold: number;
  weightedAveragePrice: number;
  hasCancellations: boolean;
  hasStatusColumn: boolean;
  revenueFormulaUsed: 'total_column' | 'qty_times_unit_price' | 'single_metric';
}

export type ViewMode = 'dashboard' | 'table' | 'fields';
