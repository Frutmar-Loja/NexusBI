import {
  analyzeColumns,
  classifyColumnSemantics,
  detectSpreadsheetArchetype,
  calculateSalesMetricsSummary,
  getValidMetricColumns,
  detectAutoAnalysis,
  computeCentralMetrics,
  computeSegmentBreakdown,
  reconcileDatasetMetrics
} from '../src/utils/dataEngine';
import { SAMPLE_DATASETS } from '../src/data/sampleDatasets';

console.log('====================================================');
console.log('NexusBI Semantic Engine & BI Robustness Test Suite');
console.log('====================================================\n');

let failedTests = 0;
let passedTests = 0;

function assert(condition: boolean, testName: string, errorDetails?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    if (errorDetails) console.error(`   Details: ${errorDetails}`);
    failedTests++;
  }
}

// ==========================================
// TEST 1: Semantic Classification of Sales Columns
// ==========================================
console.log('--- Test Suite 1: Semantic Classification & Identification ---');

const salesDataset = SAMPLE_DATASETS.find(d => d.id === 'vendas_comerciais_1100')!;
const salesRows = salesDataset.generateRows();
const salesColumns = analyzeColumns(salesRows);

const idPedidoCol = salesColumns.find(c => c.key === 'ID Pedido')!;
assert(
  idPedidoCol && idPedidoCol.semanticRole === 'identifier' && idPedidoCol.type !== 'date',
  'ID Pedido classified as identifier and NOT date',
  `Actual: role=${idPedidoCol?.semanticRole}, type=${idPedidoCol?.type}`
);
assert(
  idPedidoCol?.additivity === 'non_additive',
  'ID Pedido is strictly non-additive'
);

const idClienteCol = salesColumns.find(c => c.key === 'ID Cliente')!;
assert(
  idClienteCol && idClienteCol.semanticRole === 'identifier' && idClienteCol.type !== 'date',
  'ID Cliente classified as identifier and NOT date',
  `Actual: role=${idClienteCol?.semanticRole}, type=${idClienteCol?.type}`
);

const skuCol = salesColumns.find(c => c.key === 'SKU')!;
assert(
  skuCol && skuCol.semanticRole === 'identifier' && skuCol.type !== 'date',
  'SKU classified as identifier and NOT date',
  `Actual: role=${skuCol?.semanticRole}, type=${skuCol?.type}`
);

const precoUnitarioCol = salesColumns.find(c => /pre[cç]o.*unit[aá]rio/i.test(c.key))!;
assert(
  precoUnitarioCol && precoUnitarioCol.semanticSubtype === 'unit_price' && precoUnitarioCol.additivity === 'non_additive',
  'Preço Unitário classified as unit_price and non_additive',
  `Actual: subtype=${precoUnitarioCol?.semanticSubtype}, additivity=${precoUnitarioCol?.additivity}`
);

const quantidadeCol = salesColumns.find(c => c.key === 'Quantidade')!;
assert(
  quantidadeCol && quantidadeCol.semanticSubtype === 'quantity' && quantidadeCol.additivity === 'additive',
  'Quantidade classified as quantity and additive'
);

const valorTotalCol = salesColumns.find(c => /valor.*bruto|valor.*total/i.test(c.key))!;
assert(
  valorTotalCol && valorTotalCol.type === 'currency' && valorTotalCol.additivity === 'additive',
  'Valor Total/Bruto classified as currency metric and additive'
);

const dataPedidoCol = salesColumns.find(c => c.key === 'Data Pedido')!;
assert(
  dataPedidoCol && dataPedidoCol.type === 'date' && dataPedidoCol.semanticRole === 'temporal',
  'Data Pedido classified as date and temporal role'
);

// ==========================================
// TEST 2: Domain Detection & Archetype
// ==========================================
console.log('\n--- Test Suite 2: Domain & Archetype Detection ---');

const salesArchetype = detectSpreadsheetArchetype(salesColumns);
assert(
  salesArchetype.archetype === 'financial_sales',
  '1.100 orders spreadsheet detected as financial_sales (NOT crm_clients)',
  `Actual: ${salesArchetype.archetype} (${salesArchetype.label})`
);

const crmDataset = SAMPLE_DATASETS.find(d => d.id === 'base_clientes')!;
const crmColumns = analyzeColumns(crmDataset.generateRows());
const crmArchetype = detectSpreadsheetArchetype(crmColumns);
assert(
  crmArchetype.archetype === 'crm_clients',
  'Client CRM spreadsheet detected as crm_clients',
  `Actual: ${crmArchetype.archetype}`
);

const inventoryDataset = SAMPLE_DATASETS.find(d => d.id === 'estoque_produtos')!;
const inventoryColumns = analyzeColumns(inventoryDataset.generateRows());
const inventoryArchetype = detectSpreadsheetArchetype(inventoryColumns);
assert(
  inventoryArchetype.archetype === 'inventory_products',
  'Inventory spreadsheet detected as inventory_products',
  `Actual: ${inventoryArchetype.archetype}`
);

// Generic / Unknown Domain
const genericData = [
  { 'Protocolo': 'PR-101', 'Medição Sensor A': 45.2, 'Medição Sensor B': 12.8, 'Lote': 'LT-01' },
  { 'Protocolo': 'PR-102', 'Medição Sensor A': 46.1, 'Medição Sensor B': 14.1, 'Lote': 'LT-01' }
];
const genericColumns = analyzeColumns(genericData);
const genericArchetype = detectSpreadsheetArchetype(genericColumns);
assert(
  genericArchetype.archetype === 'generic_analytics',
  'Unknown domain classified as generic_analytics without commercial assumptions',
  `Actual: ${genericArchetype.archetype}`
);

// ==========================================
// TEST 3: Deterministic Metric Engine
// ==========================================
console.log('\n--- Test Suite 3: Deterministic Metric Engine & Sales Calculations ---');

const salesSummary = calculateSalesMetricsSummary(salesRows, salesColumns);

assert(salesSummary.totalRecords === 1100, 'Total records equals 1100');
assert(salesSummary.hasCancellations === true, 'Correctly detected canceled orders');
assert(
  salesSummary.realizedRevenue < salesSummary.grossRevenue,
  'Realized revenue is less than gross revenue due to cancellations',
  `Realized: R$ ${salesSummary.realizedRevenue}, Gross: R$ ${salesSummary.grossRevenue}`
);
assert(
  Math.abs(salesSummary.grossRevenue - (salesSummary.realizedRevenue + salesSummary.canceledLoss + salesSummary.pendingRevenue)) < 0.05,
  'Gross revenue equals Realized + Canceled + Pending',
  `Gross: ${salesSummary.grossRevenue}, Sum of parts: ${salesSummary.realizedRevenue + salesSummary.canceledLoss + salesSummary.pendingRevenue}`
);
assert(
  salesSummary.cancellationRatePct > 0 && salesSummary.cancellationRatePct < 25,
  'Cancellation rate is properly computed percentage (between 0% and 25%)',
  `Actual: ${salesSummary.cancellationRatePct}%`
);
assert(
  salesSummary.uniqueCustomersCount === 280,
  'Correctly identified 280 unique customers instead of treating 1100 orders as 1100 customers',
  `Actual: ${salesSummary.uniqueCustomersCount}`
);
assert(
  salesSummary.avgTicket > 0 && Math.abs(salesSummary.avgTicket - (salesSummary.realizedRevenue / salesSummary.completedOrdersCount)) < 0.01,
  'Average ticket calculated deterministically over realized revenue and completed orders',
  `Ticket: ${salesSummary.avgTicket}, Realized / Completed: ${salesSummary.realizedRevenue / salesSummary.completedOrdersCount}`
);

// Verify valid metrics selector does NOT pick unit price as default sum
const validMetrics = getValidMetricColumns(salesColumns, salesArchetype.archetype);
assert(
  validMetrics[0]?.key === 'Valor Bruto (R$)' || validMetrics[0]?.key === 'Valor Total' || validMetrics[0]?.key === 'Valor Líquido (R$)',
  'Primary metric selected is Valor Bruto / Total (additive monetary), NOT Preço Unitário or ID',
  `Actual: ${validMetrics[0]?.key}`
);
assert(
  !validMetrics.some(m => m.key === 'Preço Unitário' || m.key === 'ID Pedido' || m.key === 'ID Cliente'),
  'Valid metric list excludes Preço Unitário and IDs from default additive aggregation'
);

// ==========================================
// TEST 4: Contextual Dashboard & Insights Auditability
// ==========================================
console.log('\n--- Test Suite 4: Contextual Dashboard & Insights Auditability ---');

const autoAnalysis = detectAutoAnalysis(salesColumns, salesRows);

// Verify date column used for timeline is Data Pedido, NOT ID Pedido!
assert(
  autoAnalysis.dateKey === 'Data Pedido',
  'Timeline chart uses Data Pedido and NEVER ID Pedido or SKU',
  `Actual dateKey: ${autoAnalysis.dateKey}`
);

// Verify KPIs for sales
const kpiKeys = autoAnalysis.kpis.map(k => k.key);
assert(
  kpiKeys.includes('total_revenue') && kpiKeys.includes('total_orders') && kpiKeys.includes('avg_ticket'),
  'Sales dashboard prioritas revenue, order volume and avg ticket',
  `KPIs: ${kpiKeys.join(', ')}`
);
assert(
  !kpiKeys.includes('situacao_cadastral'),
  'Sales dashboard does NOT show CRM "Situação Cadastral" KPI'
);

// Verify insight categories (Fatos verificados, Alertas de qualidade, Hipóteses sugeridas)
const facts = autoAnalysis.insights.filter(i => i.category === 'verified_fact');
const alerts = autoAnalysis.insights.filter(i => i.category === 'quality_alert');
const hypotheses = autoAnalysis.insights.filter(i => i.category === 'suggested_opportunity');

assert(facts.length > 0, `Generated ${facts.length} verified facts supported by data`);
assert(alerts.length > 0, `Generated ${alerts.length} data quality & risk alerts`);
assert(hypotheses.length > 0, `Generated ${hypotheses.length} suggested opportunities`);

for (const hyp of hypotheses) {
  assert(
    hyp.isHypothesis === true && Boolean(hyp.hypothesisDisclaimer),
    `Hypothesis "${hyp.title}" is explicitly flagged with isHypothesis and disclaimer`,
    `Disclaimer: ${hyp.hypothesisDisclaimer}`
  );
}

// Verify no fiscal compliance invented when no fiscal document column exists
const hasInventedFiscalFact = autoAnalysis.insights.some(i => 
  i.category === 'verified_fact' && /regularidade fiscal|cpf regular|sem pendências fiscais/i.test(i.title + i.description)
);
assert(!hasInventedFiscalFact, 'No fake fiscal compliance claims made on commercial sales sheet');

// ==========================================
// TEST 5: Mathematical Reconciliation & Audit Rigor
// ==========================================
console.log('\n--- Test Suite 5: Mathematical Reconciliation & Audit Rigor ---');

const centralMetrics = computeCentralMetrics(salesRows, salesColumns);

// Check 5.1: Cent-precise financial partition
assert(
  centralMetrics.grossRevenue === 270943.90,
  'Gross revenue exactly matches audited R$ 270.943,90',
  `Actual: ${centralMetrics.grossRevenue}`
);
assert(
  centralMetrics.realizedRevenue === 213416.80,
  'Realized revenue exactly matches audited R$ 213.416,80',
  `Actual: ${centralMetrics.realizedRevenue}`
);
assert(
  centralMetrics.uniqueOrdersCount === 1100,
  'Unique orders strictly equals 1.100',
  `Actual: ${centralMetrics.uniqueOrdersCount}`
);
assert(
  centralMetrics.completedOrdersCount === 863,
  'Completed orders strictly equals 863',
  `Actual: ${centralMetrics.completedOrdersCount}`
);
assert(
  centralMetrics.canceledOrdersCount === 125,
  'Canceled orders strictly equals 125',
  `Actual: ${centralMetrics.canceledOrdersCount}`
);
assert(
  centralMetrics.pendingOrdersCount === 112,
  'Pending orders strictly equals 112',
  `Actual: ${centralMetrics.pendingOrdersCount}`
);

// Check 5.2: Distinct Tickets: Realized vs Gross
assert(
  centralMetrics.avgTicketRealized === 247.30,
  'Realized Ticket is R$ 247,30 (213.416,80 / 863)',
  `Actual: ${centralMetrics.avgTicketRealized}`
);
assert(
  centralMetrics.avgTicketGross === 246.31,
  'Gross average is R$ 246,31 (270.943,90 / 1.100)',
  `Actual: ${centralMetrics.avgTicketGross}`
);

// Check 5.3: Category Breakdown Reconciliation & 100% Rule
const categoryBreakdown = computeSegmentBreakdown(salesRows, 'Categoria', 'Valor Bruto (R$)', { limit: 5 });
const categorySum = categoryBreakdown.segments.reduce((acc, s) => acc + s.value, 0);
const categoryPctSum = categoryBreakdown.segments.reduce((acc, s) => acc + s.percentage, 0);

assert(
  Math.abs(categorySum - centralMetrics.grossRevenue) < 0.1,
  'Sum of category values equals total gross revenue',
  `CatSum: ${categorySum}, Gross: ${centralMetrics.grossRevenue}`
);
assert(
  Math.abs(categoryPctSum - 100) < 0.2,
  'Sum of category percentages reconciles to 100%',
  `Actual sum: ${categoryPctSum}%`
);
assert(
  categoryBreakdown.segments.every(s => s.percentage <= 100),
  'No category share exceeds 100% (NEVER 127%!)'
);

// Check 5.4: Reconciliation Report Audit
const reconciliation = reconcileDatasetMetrics(centralMetrics, categoryBreakdown);
assert(
  reconciliation.isFullyReconciled === true,
  'Dataset is certified as 100% mathematically reconciled',
  `Discrepancies: ${JSON.stringify(reconciliation.discrepancies)}`
);
assert(
  reconciliation.passedChecksCount >= 4,
  `Passed ${reconciliation.passedChecksCount} of ${reconciliation.totalChecksEvaluated} automated consistency checks`
);

console.log('\n====================================================');
console.log(`Test Execution Finished: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('====================================================');

if (failedTests > 0) {
  process.exit(1);
}
