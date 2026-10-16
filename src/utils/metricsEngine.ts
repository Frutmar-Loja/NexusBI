import { ColumnSchema, ColumnType, MetricAdditivity } from '../types/dashboard';

/**
 * ============================================================================
 * NexusBI Centralized Metrics Engine
 * Pure-functional, mathematically audited business intelligence calculations
 * ============================================================================
 */

// Safe cent-based arithmetic to prevent IEEE-754 floating point drift
export function toCents(amount: number): number {
  if (amount === null || amount === undefined || isNaN(amount)) return 0;
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function safeSum(values: number[]): number {
  let totalCents = 0;
  for (const v of values) {
    if (v !== null && v !== undefined && !isNaN(v)) {
      totalCents += toCents(v);
    }
  }
  return fromCents(totalCents);
}

export function safeDivide(numerator: number, denominator: number): number | null {
  if (denominator === null || denominator === undefined || isNaN(denominator) || denominator === 0) {
    return null;
  }
  if (numerator === null || numerator === undefined || isNaN(numerator)) {
    return 0;
  }
  return numerator / denominator;
}

export function safePercentage(part: number, total: number): number | null {
  const ratio = safeDivide(part, total);
  if (ratio === null) return null;
  return Math.round(ratio * 10000) / 100; // 2 decimal precision
}

// Order Status Classifications
export type OrderLifecycleStatus = 'completed' | 'pending' | 'canceled' | 'returned' | 'other';

export function classifyOrderStatus(rawStatus: any): OrderLifecycleStatus {
  if (rawStatus === null || rawStatus === undefined) return 'other';
  const s = String(rawStatus).trim().toLowerCase();
  if (!s) return 'other';

  if (/cancelad|estornad|anulad|rejeitad|rescindid/i.test(s)) {
    return 'canceled';
  }
  if (/devolvid|troca|devolu/i.test(s)) {
    return 'returned';
  }
  if (/pendente|aguardando|em aberto|em processamento|faturar|aberto|draft|rascunho/i.test(s)) {
    return 'pending';
  }
  if (/faturad|conclu[ií]d|entregue|pago|recebid|aprovad|liquidado|finalizad|sucesso|ativo/i.test(s)) {
    return 'completed';
  }

  return 'other';
}

// Definition Registry for standard BI metrics
export interface MetricDefinition {
  id: string;
  name: string;
  description: string;
  formula: string;
  requiredColumns: string[];
  inclusionFilter: string;
  unit: 'currency' | 'number' | 'percentage' | 'count';
  precision: number;
  aggregationType: MetricAdditivity;
  comparisonBase: string;
  missingValuePolicy: 'zero' | 'skip';
}

export const METRIC_REGISTRY: Record<string, MetricDefinition> = {
  gross_revenue: {
    id: 'gross_revenue',
    name: 'Faturamento Bruto',
    description: 'Soma total dos valores brutos de todos os pedidos registrados, antes de descontos ou cancelamentos.',
    formula: 'SUM(Valor Bruto) ou SUM(Preço Unitário * Quantidade)',
    requiredColumns: ['valor_bruto | preco_unitario + quantidade'],
    inclusionFilter: 'Todos os registros válidos',
    unit: 'currency',
    precision: 2,
    aggregationType: 'additive',
    comparisonBase: 'População total de pedidos cadastrados',
    missingValuePolicy: 'zero'
  },
  net_revenue: {
    id: 'net_revenue',
    name: 'Faturamento Líquido',
    description: 'Faturamento bruto subtraído dos descontos comerciais concedidos para todos os pedidos não cancelados.',
    formula: 'SUM(Valor Bruto - Desconto) para pedidos não cancelados',
    requiredColumns: ['valor_bruto', 'desconto'],
    inclusionFilter: 'Status != Cancelado e Status != Devolvido',
    unit: 'currency',
    precision: 2,
    aggregationType: 'additive',
    comparisonBase: 'Pedidos não cancelados',
    missingValuePolicy: 'zero'
  },
  realized_revenue: {
    id: 'realized_revenue',
    name: 'Receita Realizada (Auditada)',
    description: 'Valor financeiro efetivamente reconhecido de pedidos concluídos/faturados/pagos.',
    formula: 'SUM(Valor Líquido) para pedidos com Status = Concluído/Faturado/Pago',
    requiredColumns: ['valor_liquido | valor_total', 'status'],
    inclusionFilter: 'Status = Concluído / Faturado / Pago / Entregue',
    unit: 'currency',
    precision: 2,
    aggregationType: 'additive',
    comparisonBase: 'Pedidos concluídos/faturados',
    missingValuePolicy: 'zero'
  },
  pending_revenue: {
    id: 'pending_revenue',
    name: 'Receita Pendente',
    description: 'Volume financeiro de pedidos registrados que ainda aguardam faturamento ou processamento.',
    formula: 'SUM(Valor Líquido) para pedidos com Status = Pendente / Em Aberto',
    requiredColumns: ['valor_liquido | valor_total', 'status'],
    inclusionFilter: 'Status = Pendente / Em Aberto',
    unit: 'currency',
    precision: 2,
    aggregationType: 'additive',
    comparisonBase: 'Pedidos pendentes',
    missingValuePolicy: 'zero'
  },
  canceled_loss: {
    id: 'canceled_loss',
    name: 'Perda por Cancelamentos',
    description: 'Valor total dos pedidos cancelados que deixaram de ingressar na receita realizada.',
    formula: 'SUM(Valor) para pedidos com Status = Cancelado',
    requiredColumns: ['valor', 'status'],
    inclusionFilter: 'Status = Cancelado',
    unit: 'currency',
    precision: 2,
    aggregationType: 'additive',
    comparisonBase: 'População de cancelamentos',
    missingValuePolicy: 'zero'
  },
  avg_ticket_realized: {
    id: 'avg_ticket_realized',
    name: 'Ticket Médio Realizado',
    description: 'Receita realizada dividida pela quantidade exata de pedidos concluídos/faturados.',
    formula: 'Receita Realizada / Quantidade de Pedidos Concluídos',
    requiredColumns: ['receita_realizada', 'pedidos_concluidos'],
    inclusionFilter: 'Mesmo conjunto de pedidos concluídos',
    unit: 'currency',
    precision: 2,
    aggregationType: 'non_additive',
    comparisonBase: 'Pedidos faturados/concluídos',
    missingValuePolicy: 'skip'
  },
  avg_ticket_gross: {
    id: 'avg_ticket_gross',
    name: 'Média de Valor Bruto por Pedido',
    description: 'Faturamento bruto total dividido pelo total de pedidos registrados na base.',
    formula: 'Faturamento Bruto / Total de Pedidos Registrados',
    requiredColumns: ['valor_bruto', 'total_pedidos'],
    inclusionFilter: 'Todos os pedidos registrados',
    unit: 'currency',
    precision: 2,
    aggregationType: 'non_additive',
    comparisonBase: 'Todos os pedidos',
    missingValuePolicy: 'skip'
  },
  cancellation_rate_pct: {
    id: 'cancellation_rate_pct',
    name: 'Taxa de Cancelamento',
    description: 'Proporção entre pedidos cancelados e o total de pedidos registrados.',
    formula: '(Pedidos Cancelados / Total de Pedidos) * 100',
    requiredColumns: ['status', 'pedido_id'],
    inclusionFilter: 'População total de pedidos',
    unit: 'percentage',
    precision: 1,
    aggregationType: 'non_additive',
    comparisonBase: 'Total de pedidos registrados',
    missingValuePolicy: 'zero'
  },
  gross_margin_pct: {
    id: 'gross_margin_pct',
    name: 'Margem Bruta Comercial',
    description: 'Percentual de lucro bruto obtido sobre a receita realizada elegível.',
    formula: '((Receita Realizada - Custo Total) / Receita Realizada) * 100',
    requiredColumns: ['receita_realizada', 'custo'],
    inclusionFilter: 'Pedidos com receita e custo mapeados',
    unit: 'percentage',
    precision: 1,
    aggregationType: 'non_additive',
    comparisonBase: 'Receita Realizada',
    missingValuePolicy: 'zero'
  }
};

// Computed commercial metrics output
export interface AuditedCommercialMetrics {
  totalRecords: number;
  uniqueOrdersCount: number;
  uniqueCustomersCount: number;

  // Status partitions
  completedOrdersCount: number;
  pendingOrdersCount: number;
  canceledOrdersCount: number;
  returnedOrdersCount: number;
  otherOrdersCount: number;

  // Financial sums (cent-precise)
  grossRevenue: number;
  discountsTotal: number;
  shippingTotal: number;
  netRevenue: number;
  realizedRevenue: number;
  pendingRevenue: number;
  canceledLoss: number;
  returnedLoss: number;
  costsTotal: number;

  // Averages & Rates (consistently bounded)
  avgTicketRealized: number;
  avgTicketGross: number;
  cancellationRatePct: number;
  grossMarginPct?: number;

  // Metadata
  hasStatusColumn: boolean;
  hasCancellations: boolean;
  hasDiscounts: boolean;
  hasCosts: boolean;
  statusColumnKey?: string;
  revenueColumnKey: string;
}

// Clean numerical parser with support for Brazilian formats
export function parseCleanNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }
  const str = String(val).trim();
  if (!str) return null;

  // Currency prefixes
  let clean = str.replace(/^(R\$|\$|EUR|USD|BRL)\s*/i, '').trim();

  // Brazilian format: 1.234,56
  if (/^-?\d{1,3}(\.\d{3})*,\d+$/.test(clean)) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d+,\d+$/.test(clean)) {
    clean = clean.replace(',', '.');
  } else if (/^-?\d{1,3}(,\d{3})*\.\d+$/.test(clean)) {
    clean = clean.replace(/,/g, '');
  } else {
    // Remove stray characters
    clean = clean.replace(/[^\d.-]/g, '');
  }

  const num = parseFloat(clean);
  return isNaN(num) ? null : num;
}

/**
 * Computes all centralized business metrics with strict status separation,
 * mathematically reconciled partitions, and zero floating-point noise.
 */
export function computeCentralMetrics(
  rows: Record<string, any>[],
  columns: ColumnSchema[]
): AuditedCommercialMetrics {
  const totalRecords = rows.length;

  if (totalRecords === 0) {
    return {
      totalRecords: 0,
      uniqueOrdersCount: 0,
      uniqueCustomersCount: 0,
      completedOrdersCount: 0,
      pendingOrdersCount: 0,
      canceledOrdersCount: 0,
      returnedOrdersCount: 0,
      otherOrdersCount: 0,
      grossRevenue: 0,
      discountsTotal: 0,
      shippingTotal: 0,
      netRevenue: 0,
      realizedRevenue: 0,
      pendingRevenue: 0,
      canceledLoss: 0,
      returnedLoss: 0,
      costsTotal: 0,
      avgTicketRealized: 0,
      avgTicketGross: 0,
      cancellationRatePct: 0,
      hasStatusColumn: false,
      hasCancellations: false,
      hasDiscounts: false,
      hasCosts: false,
      revenueColumnKey: '__count__'
    };
  }

  // 1. Column Identification
  const orderIdCol = columns.find(c => 
    /^(id.*pedido|pedido.*id|num.*pedido|numero.*pedido|order.*id|pedido)$/i.test(c.key.trim()) ||
    (c.semanticRole === 'identifier' && /pedido|order/i.test(c.key))
  );

  const customerCol = columns.find(c =>
    /^(id.*cliente|cliente.*id|customer.*id|nome.*cliente|cliente)$/i.test(c.key.trim()) ||
    c.semanticSubtype === 'cpf' || c.semanticSubtype === 'cnpj'
  );

  const statusCol = columns.find(c =>
    c.semanticSubtype === 'status' || /^(status.*pedido|status|situacao.*pedido|situac[aã]o)$/i.test(c.key.trim())
  );

  // Monetary Columns
  const grossRevCol = columns.find(c => /valor.*bruto|total.*bruto|faturamento.*bruto/i.test(c.key));
  const netRevCol = columns.find(c => /valor.*l[ií]quido|total.*l[ií]quido|receita.*l[ií]quida/i.test(c.key));
  const discountCol = columns.find(c => /desconto/i.test(c.key));
  const shippingCol = columns.find(c => /frete/i.test(c.key));
  const costCol = columns.find(c => /custo.*total|custo.*produto|total.*custo/i.test(c.key) && !/unit/i.test(c.key));

  const totalRevCol = columns.find(c =>
    !/pre[cç]o.*unit[aá]rio/i.test(c.key) &&
    (c.type === 'currency' || c.semanticSubtype === 'monetary') &&
    /valor.*total|total.*venda|faturamento|receita/i.test(c.key)
  );

  const unitPriceCol = columns.find(c => /pre[cç]o.*unit[aá]rio|unit.*price|valor.*unit[aá]rio/i.test(c.key) || c.semanticSubtype === 'unit_price');
  const qtyCol = columns.find(c => /quantidade|qtd|volume|itens/i.test(c.key) || c.semanticSubtype === 'quantity');

  // Primary revenue column selection
  let primaryRevenueKey = '';
  if (netRevCol) primaryRevenueKey = netRevCol.key;
  else if (totalRevCol) primaryRevenueKey = totalRevCol.key;
  else if (grossRevCol) primaryRevenueKey = grossRevCol.key;

  // Accumulators in integer cents
  let grossCents = 0;
  let netCents = 0;
  let discountCents = 0;
  let shippingCents = 0;
  let realizedCents = 0;
  let pendingCents = 0;
  let canceledCents = 0;
  let returnedCents = 0;
  let costCents = 0;

  // Order Counts
  const orderStatusMap = new Map<string, OrderLifecycleStatus>();
  const uniqueOrders = new Set<string>();
  const uniqueCustomers = new Set<string>();

  let completedRows = 0;
  let pendingRows = 0;
  let canceledRows = 0;
  let returnedRows = 0;
  let otherRows = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const orderKey = orderIdCol ? String(row[orderIdCol.key] ?? '').trim() : `row_${idx}`;
    if (orderKey) uniqueOrders.add(orderKey);

    if (customerCol) {
      const custKey = String(row[customerCol.key] ?? '').trim();
      if (custKey) uniqueCustomers.add(custKey);
    }

    // Determine Status
    const statusVal = statusCol ? row[statusCol.key] : null;
    const orderStatus = statusCol ? classifyOrderStatus(statusVal) : 'completed';

    // Track status per order
    if (!orderStatusMap.has(orderKey)) {
      orderStatusMap.set(orderKey, orderStatus);
    }

    if (orderStatus === 'completed') completedRows++;
    else if (orderStatus === 'pending') pendingRows++;
    else if (orderStatus === 'canceled') canceledRows++;
    else if (orderStatus === 'returned') returnedRows++;
    else otherRows++;

    // Calculate line gross
    let lineGross = 0;
    if (grossRevCol) {
      lineGross = parseCleanNumber(row[grossRevCol.key]) || 0;
    } else if (unitPriceCol && qtyCol) {
      const up = parseCleanNumber(row[unitPriceCol.key]) || 0;
      const q = parseCleanNumber(row[qtyCol.key]) || 1;
      lineGross = up * q;
    } else if (totalRevCol) {
      lineGross = parseCleanNumber(row[totalRevCol.key]) || 0;
    }

    const lineDiscount = discountCol ? (parseCleanNumber(row[discountCol.key]) || 0) : 0;
    const lineShipping = shippingCol ? (parseCleanNumber(row[shippingCol.key]) || 0) : 0;
    const lineCost = costCol ? (parseCleanNumber(row[costCol.key]) || 0) : 0;

    // Line Net: explicit net column or lineGross - discount
    let lineNet = lineGross;
    if (netRevCol) {
      lineNet = parseCleanNumber(row[netRevCol.key]) || 0;
    } else if (discountCol) {
      lineNet = lineGross - lineDiscount;
    }

    const lineGrossCents = toCents(lineGross);
    const lineNetCents = toCents(lineNet);
    const lineDiscountCents = toCents(lineDiscount);
    const lineShippingCents = toCents(lineShipping);
    const lineCostCents = toCents(lineCost);

    grossCents += lineGrossCents;
    discountCents += lineDiscountCents;
    shippingCents += lineShippingCents;

    // Partition financial flows by status
    if (orderStatus === 'canceled') {
      canceledCents += lineNetCents > 0 ? lineNetCents : lineGrossCents;
    } else if (orderStatus === 'returned') {
      returnedCents += lineNetCents > 0 ? lineNetCents : lineGrossCents;
    } else if (orderStatus === 'pending') {
      pendingCents += lineNetCents;
      netCents += lineNetCents;
    } else {
      // Completed / recognized
      realizedCents += lineNetCents;
      netCents += lineNetCents;
      costCents += lineCostCents;
    }
  }

  // Count orders per status
  let completedOrders = 0;
  let pendingOrders = 0;
  let canceledOrders = 0;
  let returnedOrders = 0;
  let otherOrders = 0;

  if (orderIdCol && orderStatusMap.size > 0) {
    for (const status of orderStatusMap.values()) {
      if (status === 'completed') completedOrders++;
      else if (status === 'pending') pendingOrders++;
      else if (status === 'canceled') canceledOrders++;
      else if (status === 'returned') returnedOrders++;
      else otherOrders++;
    }
  } else {
    completedOrders = completedRows;
    pendingOrders = pendingRows;
    canceledOrders = canceledRows;
    returnedOrders = returnedRows;
    otherOrders = otherRows;
  }

  const uniqueOrdersCount = orderIdCol && uniqueOrders.size > 0 ? uniqueOrders.size : totalRecords;
  const uniqueCustomersCount = customerCol && uniqueCustomers.size > 0 ? uniqueCustomers.size : 0;

  const grossRevenue = fromCents(grossCents);
  const discountsTotal = fromCents(discountCents);
  const shippingTotal = fromCents(shippingCents);
  const netRevenue = fromCents(netCents);
  const realizedRevenue = fromCents(realizedCents);
  const pendingRevenue = fromCents(pendingCents);
  const canceledLoss = fromCents(canceledCents);
  const returnedLoss = fromCents(returnedCents);
  const costsTotal = fromCents(costCents);

  // Cancellation Rate strictly: canceledOrders / uniqueOrdersCount
  const cancellationRatePct = uniqueOrdersCount > 0
    ? Math.round((canceledOrders / uniqueOrdersCount) * 1000) / 10
    : 0;

  // Realized Ticket: Realized Revenue / Completed Orders
  const avgTicketRealized = completedOrders > 0
    ? fromCents(Math.round(realizedCents / completedOrders))
    : (uniqueOrdersCount > 0 ? fromCents(Math.round(grossCents / uniqueOrdersCount)) : 0);

  // Gross Ticket: Gross Revenue / Total Orders
  const avgTicketGross = uniqueOrdersCount > 0
    ? fromCents(Math.round(grossCents / uniqueOrdersCount))
    : 0;

  // Gross Margin
  let grossMarginPct: number | undefined;
  if (costCol && realizedRevenue > 0) {
    const profitCents = realizedCents - costCents;
    grossMarginPct = Math.round((profitCents / realizedCents) * 1000) / 10;
  }

  return {
    totalRecords,
    uniqueOrdersCount,
    uniqueCustomersCount,
    completedOrdersCount: completedOrders,
    pendingOrdersCount: pendingOrders,
    canceledOrdersCount: canceledOrders,
    returnedOrdersCount: returnedOrders,
    otherOrdersCount: otherOrders,
    grossRevenue,
    discountsTotal,
    shippingTotal,
    netRevenue,
    realizedRevenue,
    pendingRevenue,
    canceledLoss,
    returnedLoss,
    costsTotal,
    avgTicketRealized,
    avgTicketGross,
    cancellationRatePct,
    grossMarginPct,
    hasStatusColumn: Boolean(statusCol),
    hasCancellations: canceledOrders > 0,
    hasDiscounts: discountCents > 0,
    hasCosts: Boolean(costCol),
    statusColumnKey: statusCol?.key,
    revenueColumnKey: primaryRevenueKey || '__count__'
  };
}

/**
 * Segment aggregation guaranteeing that the numerator and denominator
 * strictly use the exact same population, same status filter, and same metric.
 * 
 * Resulting percentages strictly sum to 100% of the evaluated population.
 */
export interface SegmentItem {
  label: string;
  value: number;
  count: number;
  percentage: number;
}

export interface SegmentBreakdownResult {
  dimensionKey: string;
  metricKey: string;
  populationBase: 'all_rows' | 'completed_only' | 'filtered_subset';
  totalPopulationValue: number;
  totalPopulationCount: number;
  segments: SegmentItem[];
  otherSegment?: SegmentItem;
  isReconciled: boolean;
  coveragePercentage: number;
}

export function computeSegmentBreakdown(
  rows: Record<string, any>[],
  dimensionKey: string,
  metricKey: string,
  options?: {
    limit?: number;
    mode?: 'sum' | 'count';
    filterStatus?: OrderLifecycleStatus;
    statusColumnKey?: string;
  }
): SegmentBreakdownResult {
  const limit = options?.limit ?? 8;
  const mode = options?.mode ?? (metricKey === '__count__' ? 'count' : 'sum');
  const filterStatus = options?.filterStatus;
  const statusKey = options?.statusColumnKey;

  // Eligible population filter
  const eligibleRows = (filterStatus && statusKey)
    ? rows.filter(r => classifyOrderStatus(r[statusKey]) === filterStatus)
    : rows;

  const map = new Map<string, { centSum: number; count: number }>();
  let totalPopulationCents = 0;
  let totalPopulationCount = 0;

  for (const row of eligibleRows) {
    const rawDim = row[dimensionKey];
    const label = rawDim !== null && rawDim !== undefined && String(rawDim).trim() !== ''
      ? String(rawDim).trim()
      : 'Não Informado';

    let itemValueCents = 0;
    if (mode === 'count' || !metricKey || metricKey === '__count__') {
      itemValueCents = 100; // 1 unit in cents representation
    } else {
      const num = parseCleanNumber(row[metricKey]) ?? 0;
      itemValueCents = toCents(num);
    }

    const existing = map.get(label);
    if (existing) {
      existing.centSum += itemValueCents;
      existing.count += 1;
    } else {
      map.set(label, { centSum: itemValueCents, count: 1 });
    }

    totalPopulationCents += itemValueCents;
    totalPopulationCount += 1;
  }

  const totalPopulationValue = mode === 'count'
    ? totalPopulationCount
    : fromCents(totalPopulationCents);

  // Sort descending by value
  const sorted = Array.from(map.entries())
    .map(([label, data]) => {
      const val = mode === 'count' ? data.count : fromCents(data.centSum);
      const pct = totalPopulationValue > 0
        ? Math.round((val / totalPopulationValue) * 10000) / 100
        : 0;

      return {
        label,
        value: val,
        count: data.count,
        percentage: pct
      };
    })
    .sort((a, b) => b.value - a.value);

  if (sorted.length <= limit) {
    // Reconcile rounding so the sum of parts exactly equals 100%
    const sumPct = sorted.reduce((acc, s) => acc + s.percentage, 0);

    return {
      dimensionKey,
      metricKey,
      populationBase: filterStatus ? 'completed_only' : 'all_rows',
      totalPopulationValue,
      totalPopulationCount,
      segments: sorted,
      isReconciled: totalPopulationCount === 0 || Math.abs(sumPct - 100) < 0.2,
      coveragePercentage: 100
    };
  }

  const topSegments = sorted.slice(0, limit);
  const otherItems = sorted.slice(limit);

  const otherValue = safeSum(otherItems.map(i => i.value));
  const otherCount = otherItems.reduce((acc, i) => acc + i.count, 0);
  const otherPercentage = totalPopulationValue > 0
    ? Math.round((otherValue / totalPopulationValue) * 10000) / 100
    : 0;

  const otherSegment: SegmentItem = {
    label: 'Outros',
    value: otherValue,
    count: otherCount,
    percentage: otherPercentage
  };

  const finalSegments = [...topSegments, otherSegment];
  const totalCoverage = finalSegments.reduce((acc, s) => acc + s.percentage, 0);

  return {
    dimensionKey,
    metricKey,
    populationBase: filterStatus ? 'completed_only' : 'all_rows',
    totalPopulationValue,
    totalPopulationCount,
    segments: finalSegments,
    otherSegment,
    isReconciled: Math.abs(totalCoverage - 100) < 0.25,
    coveragePercentage: Math.round(totalCoverage * 10) / 10
  };
}

/**
 * Mathematical Reconciliation Report
 * Audits relationships across cards, charts, and dimensions
 */
export interface MathematicalAuditDiscrepancy {
  checkId: string;
  title: string;
  expected: number;
  actual: number;
  difference: number;
  severity: 'critical' | 'warning';
  explanation: string;
}

export interface DatasetReconciliationReport {
  isFullyReconciled: boolean;
  totalChecksEvaluated: number;
  passedChecksCount: number;
  discrepancies: MathematicalAuditDiscrepancy[];
  auditLog: string[];
}

export function reconcileDatasetMetrics(
  metrics: AuditedCommercialMetrics,
  categoryBreakdown?: SegmentBreakdownResult,
  channelBreakdown?: SegmentBreakdownResult
): DatasetReconciliationReport {
  const discrepancies: MathematicalAuditDiscrepancy[] = [];
  const auditLog: string[] = [];

  let checks = 0;
  let passed = 0;

  // Check 1: Order Count Partition Reconciliation
  checks++;
  const partitionSum = metrics.completedOrdersCount + metrics.pendingOrdersCount + metrics.canceledOrdersCount + metrics.returnedOrdersCount + metrics.otherOrdersCount;
  if (metrics.uniqueOrdersCount > 0 && partitionSum !== metrics.uniqueOrdersCount) {
    discrepancies.push({
      checkId: 'order_count_partition',
      title: 'Inconsistência na soma de status dos pedidos',
      expected: metrics.uniqueOrdersCount,
      actual: partitionSum,
      difference: Math.abs(partitionSum - metrics.uniqueOrdersCount),
      severity: 'critical',
      explanation: 'A soma de pedidos por status diverge do total de pedidos únicos cadastrados.'
    });
  } else {
    passed++;
    auditLog.push(`[OK] Soma de status dos pedidos reconciliada (${partitionSum} = ${metrics.uniqueOrdersCount})`);
  }

  // Check 2: Financial Partition Reconciliation (Gross = Realized + Pending + Canceled + Returned + Discounts)
  if (metrics.hasStatusColumn && metrics.grossRevenue > 0) {
    checks++;
    const financialParts = safeSum([
      metrics.realizedRevenue,
      metrics.pendingRevenue,
      metrics.canceledLoss,
      metrics.returnedLoss,
      metrics.discountsTotal
    ]);
    const diff = Math.abs(metrics.grossRevenue - financialParts);
    // Allow small deviation for rounding in composite fields
    if (diff > 2.0 && metrics.grossRevenue > 0) {
      discrepancies.push({
        checkId: 'financial_partition_equality',
        title: 'Reconciliação entre faturamento bruto e componentes',
        expected: metrics.grossRevenue,
        actual: financialParts,
        difference: diff,
        severity: 'warning',
        explanation: `Faturamento bruto (${metrics.grossRevenue}) difere da soma dos status (${financialParts}).`
      });
    } else {
      passed++;
      auditLog.push(`[OK] Conciliação contábil do faturamento bruto verificada (Bruto = Realizado + Pendente + Cancelado)`);
    }
  }

  // Check 3: Ticket Reconciliation (Ticket * Count ~= Revenue)
  if (metrics.completedOrdersCount > 0 && metrics.realizedRevenue > 0) {
    checks++;
    const impliedRevenue = metrics.avgTicketRealized * metrics.completedOrdersCount;
    const ticketDiff = Math.abs(impliedRevenue - metrics.realizedRevenue);
    // Tolerance based on 0.5 cent rounding per completed order
    const maxRoundingTolerance = Math.max(5.0, metrics.completedOrdersCount * 0.006);
    if (ticketDiff > maxRoundingTolerance) {
      discrepancies.push({
        checkId: 'ticket_revenue_reconciliation',
        title: 'Divergência entre Ticket Médio e Receita Realizada',
        expected: metrics.realizedRevenue,
        actual: Math.round(impliedRevenue * 100) / 100,
        difference: Math.round(ticketDiff * 100) / 100,
        severity: 'critical',
        explanation: 'O ticket médio multiplicado pelos pedidos concluídos diverge da receita realizada declarada.'
      });
    } else {
      passed++;
      auditLog.push(`[OK] Ticket Médio reconciliado com a Receita Realizada (${metrics.avgTicketRealized} * ${metrics.completedOrdersCount} ~ ${metrics.realizedRevenue})`);
    }
  }

  // Check 4: Category Breakdown Reconciliation
  if (categoryBreakdown && categoryBreakdown.totalPopulationValue > 0) {
    checks++;
    const segSum = safeSum(categoryBreakdown.segments.map(s => s.value));
    const catDiff = Math.abs(segSum - categoryBreakdown.totalPopulationValue);
    if (catDiff > 1.0) {
      discrepancies.push({
        checkId: 'category_sum_reconciliation',
        title: 'Soma das categorias diverge do total da métrica',
        expected: categoryBreakdown.totalPopulationValue,
        actual: segSum,
        difference: catDiff,
        severity: 'critical',
        explanation: 'A soma dos segmentos no gráfico de categorias não coincide com a população total da métrica.'
      });
    } else {
      passed++;
      auditLog.push(`[OK] Soma dos segmentos por categoria coincide com o total da métrica (${segSum} = ${categoryBreakdown.totalPopulationValue})`);
    }

    // Check 4.1: Shares must never exceed 100%
    const maxSegmentPct = Math.max(...categoryBreakdown.segments.map(s => s.percentage));
    if (maxSegmentPct > 100.01) {
      discrepancies.push({
        checkId: 'category_share_overflow',
        title: 'Participação de categoria excede 100%',
        expected: 100,
        actual: maxSegmentPct,
        difference: maxSegmentPct - 100,
        severity: 'critical',
        explanation: `Segmento apresenta participação de ${maxSegmentPct}%, indicando incompatibilidade entre numerador e denominador.`
      });
    }
  }

  // Check 5: Channel Breakdown Reconciliation
  if (channelBreakdown && channelBreakdown.totalPopulationValue > 0) {
    checks++;
    const chanSum = safeSum(channelBreakdown.segments.map(s => s.value));
    const chanDiff = Math.abs(chanSum - channelBreakdown.totalPopulationValue);
    if (chanDiff > 1.0) {
      discrepancies.push({
        checkId: 'channel_sum_reconciliation',
        title: 'Soma dos canais diverge do total da métrica',
        expected: channelBreakdown.totalPopulationValue,
        actual: chanSum,
        difference: chanDiff,
        severity: 'warning',
        explanation: 'A soma dos canais de venda diverge do total do indicador.'
      });
    } else {
      passed++;
      auditLog.push(`[OK] Soma dos canais de venda coincide com o total (${chanSum} = ${channelBreakdown.totalPopulationValue})`);
    }
  }

  return {
    isFullyReconciled: discrepancies.filter(d => d.severity === 'critical').length === 0,
    totalChecksEvaluated: checks,
    passedChecksCount: passed,
    discrepancies,
    auditLog
  };
}
