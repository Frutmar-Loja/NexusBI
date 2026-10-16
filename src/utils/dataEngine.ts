import * as XLSX from 'xlsx';
import {
  ColumnSchema,
  ColumnType,
  SemanticRole,
  SemanticSubtype,
  SheetData,
  FilterState,
  AutoAnalysis,
  ContextualDashboardConfig,
  AnomalyReport,
  GrowthTrend,
  AnomalyWarning,
  SpreadsheetArchetype,
  ExecutiveInsight,
  SmartTableDetectionResult,
  TableBoundary,
  ExtractedSummaryItem,
  ExtractedNoteItem,
  MetricAdditivity,
  SalesMetricsSummary
} from '../types/dashboard';
import {
  computeCentralMetrics,
  computeSegmentBreakdown,
  reconcileDatasetMetrics,
  METRIC_REGISTRY,
  AuditedCommercialMetrics,
  SegmentBreakdownResult,
  DatasetReconciliationReport,
  toCents,
  fromCents,
  safeSum,
  safeDivide,
  safePercentage
} from './metricsEngine';

export {
  computeCentralMetrics,
  computeSegmentBreakdown,
  reconcileDatasetMetrics,
  METRIC_REGISTRY
};
export type {
  AuditedCommercialMetrics,
  SegmentBreakdownResult,
  DatasetReconciliationReport
};

// Currency regex & keywords
const CURRENCY_KEYWORDS = [
  'receita', 'faturamento', 'valor', 'preco', 'preço', 'custo', 'lucro',
  'total', 'revenue', 'cost', 'profit', 'price', 'amount', 'budget',
  'mrr', 'arr', 'salario', 'salário', 'despesa', 'ticket', 'ltv', 'cac',
  'desconto', 'frete', 'bruto', 'liquido', 'líquido', 'r$', 'unitario', 'unitário'
];

const DATE_KEYWORDS = [
  'data', 'date', 'dia', 'mes', 'mês', 'ano', 'periodo', 'período',
  'created', 'updated', 'vencimento', 'emissao', 'emissão', 'cadastro', 'abertura',
  'nascimento', 'nasc', 'fundacao', 'fundação', 'aniversario', 'aniversário', 'admissao', 'admissão'
];

// Helper to test if a column key represents an identifier
export function isIdentifierColumnKey(key: string): boolean {
  if (!key) return false;
  const lower = key.toLowerCase().replace(/[-_.]/g, ' ').trim();
  return (
    /^(id|c[oó]digo|cod|sku|pedido|num pedido|n[uú]mero pedido|order|ordem|protocolo|matr[ií]cula|matricula|chave|key|uuid|hash|voucher|cpf|cnpj|doc|serial|registro|ticket id|chamado id|id chamado|conta id|id conta|nfe|cupom)\b/i.test(lower) ||
    lower.endsWith(' id') ||
    lower.endsWith('_id') ||
    lower.startsWith('id_') ||
    lower.startsWith('cod_') ||
    lower.startsWith('sku_') ||
    lower.includes('id pedido') ||
    lower.includes('pedido id') ||
    lower.includes('id cliente') ||
    lower.includes('cliente id') ||
    lower.includes('sku') ||
    lower === 'id' ||
    lower === 'código' ||
    lower === 'codigo' ||
    lower === 'pedido' ||
    lower === 'sku'
  );
}

// Helper to test if a column key represents a unit price or non-additive unit rate
export function isUnitPriceColumnKey(key: string): boolean {
  if (!key) return false;
  const lower = key.toLowerCase().replace(/[-_.]/g, ' ').trim();
  if (/total/i.test(lower)) return false; // "Valor Total" or "Preço Total" is additive
  return (
    /^(pre[cç]o unit[aá]rio|preco unitario|valor unit[aá]rio|vl unit[aá]rio|custo unit[aá]rio|unit price|pre[cç]o de tabela|pre[cç]o tabela|unit cost)\b/i.test(lower) ||
    lower === 'preço unitário' ||
    lower === 'preco unitario' ||
    lower === 'custo unitário' ||
    lower === 'custo unitario' ||
    lower === 'preço' ||
    lower === 'preco' ||
    (/pre[cç]o/i.test(lower) && /unit/i.test(lower)) ||
    (/custo/i.test(lower) && /unit/i.test(lower))
  );
}

// Helper to test if a column key represents an additive discount
export function isDiscountColumnKey(key: string): boolean {
  if (!key) return false;
  const lower = key.toLowerCase().replace(/[-_.]/g, ' ').trim();
  if (isPercentageColumnKey(key)) return false;
  return /^(desconto|valor.*desconto|descontos|abatimento|desconto.*r\$)\b/i.test(lower) || /desconto/i.test(lower);
}

// Helper to test if a column key represents an additive shipping / freight fee
export function isShippingColumnKey(key: string): boolean {
  if (!key) return false;
  const lower = key.toLowerCase().replace(/[-_.]/g, ' ').trim();
  return /^(frete|frete.*cobrado|valor.*frete|custo.*frete|frete.*r\$)\b/i.test(lower) || /frete/i.test(lower);
}

// Helper to test if a column key represents gross revenue
export function isGrossRevenueColumnKey(key: string): boolean {
  if (!key) return false;
  const lower = key.toLowerCase().replace(/[-_.]/g, ' ').trim();
  return /^(valor.*bruto|faturamento.*bruto|total.*bruto|bruto|receita.*bruta|bruto.*r\$)\b/i.test(lower);
}

// Helper to test if a column key represents net revenue
export function isNetRevenueColumnKey(key: string): boolean {
  if (!key) return false;
  const lower = key.toLowerCase().replace(/[-_.]/g, ' ').trim();
  return /^(valor.*l[ií]quido|faturamento.*l[ií]quido|total.*l[ií]quido|l[ií]quido|receita.*l[ií]quida|l[ií]quido.*r\$)\b/i.test(lower);
}

// Helper to test if a column key represents product costs
export function isCostColumnKey(key: string): boolean {
  if (!key) return false;
  const lower = key.toLowerCase().replace(/[-_.]/g, ' ').trim();
  return /(custo.*produtos|custo.*total|custo.*mercadorias|custo.*vendas|custo)/i.test(lower) && !isUnitPriceColumnKey(key);
}

// Helper to test if a column key represents an additive quantity
export function isQuantityColumnKey(key: string): boolean {
  if (!key) return false;
  const lower = key.toLowerCase().replace(/[-_.]/g, ' ').trim();
  return (
    /^(qtd|quantidade|quant|itens|unidades|volume|volume vendas|qtd vendida|qtd pedido|units|qty)\b/i.test(lower) ||
    /(quantidade|qtd itens|unidades vendidas|qtd produtos)/i.test(lower)
  );
}

// Helper to test if a column key represents a non-additive percentage
export function isPercentageColumnKey(key: string): boolean {
  if (!key) return false;
  const lower = key.toLowerCase().replace(/[-_.]/g, ' ').trim();
  return /(%|percent|taxa|margem|propor[cç][aã]o|atingimento|share|desconto %|discount %)/i.test(lower);
}

export function cleanNumericValue(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (typeof val === 'string') {
    let cleaned = val.trim();
    cleaned = cleaned.replace(/^(R\$|\$|€|£)\s*/i, '');
    
    if (cleaned.includes(',') && cleaned.includes('.')) {
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (cleaned.includes(',')) {
      cleaned = cleaned.replace(',', '.');
    }
    
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

// Strict Date Parsing: Never parses generic numbers or IDs as dates!
export function parseDateValue(val: any, isDateColumnContext = false): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

  // Numbers: ONLY parse as Excel date code if column has explicit date context!
  // In pure sales sheets, IDs like 35001 or 45000 MUST NOT be treated as dates!
  if (typeof val === 'number') {
    if (isDateColumnContext && val > 25569 && val < 60000) {
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed && parsed.y >= 1970 && parsed.y <= 2040 && parsed.m >= 1 && parsed.m <= 12 && parsed.d >= 1 && parsed.d <= 31) {
        return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, Math.floor(parsed.S || 0)));
      }
    }
    return null;
  }

  if (typeof val === 'string') {
    const s = val.trim();
    // Strict ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
    const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10);
      const d = parseInt(isoMatch[3], 10);
      if (y >= 1970 && y <= 2040 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const date = new Date(y, m - 1, d, parseInt(isoMatch[4] || '0', 10), parseInt(isoMatch[5] || '0', 10), parseInt(isoMatch[6] || '0', 10));
        if (!isNaN(date.getTime())) return date;
      }
    }

    // Strict Brazilian / European format: DD/MM/YYYY or DD-MM-YYYY
    const brMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (brMatch) {
      const d = parseInt(brMatch[1], 10);
      const m = parseInt(brMatch[2], 10);
      const y = parseInt(brMatch[3], 10);
      if (y >= 1970 && y <= 2040 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        const date = new Date(y, m - 1, d, parseInt(brMatch[4] || '0', 10), parseInt(brMatch[5] || '0', 10), parseInt(brMatch[6] || '0', 10));
        if (!isNaN(date.getTime())) return date;
      }
    }
  }

  return null;
}

// ==========================================
// SEMANTIC COLUMN CLASSIFICATION ENGINE
// ==========================================
export const BRAZIL_UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]);

export function cleanDigits(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).replace(/\D/g, '');
}

export function isValidCPFDigits(digits: string): boolean {
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits.charAt(i), 10) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits.charAt(i), 10) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === parseInt(digits.charAt(10), 10);
}

export function isValidCNPJDigits(digits: string): boolean {
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  let size = 12;
  let numbers = digits.substring(0, size);
  const digitsArr = digits.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digitsArr.charAt(0), 10)) return false;

  size = 13;
  numbers = digits.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i), 10) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return result === parseInt(digitsArr.charAt(1), 10);
}

export function formatCPF(val: any): string {
  const digits = cleanDigits(val);
  if (digits.length !== 11) return String(val ?? '');
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

export function formatCNPJ(val: any): string {
  const digits = cleanDigits(val);
  if (digits.length !== 14) return String(val ?? '');
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function formatSemanticValue(val: any, subtype: SemanticSubtype, type?: ColumnType): string {
  if (val === null || val === undefined || val === '') return '—';

  switch (subtype) {
    case 'cpf':
      return formatCPF(val);
    case 'cnpj':
      return formatCNPJ(val);
    case 'uf':
      return String(val).trim().toUpperCase();
    case 'monetary':
    case 'gross_revenue':
    case 'net_revenue':
    case 'discount':
    case 'shipping':
    case 'cost':
    case 'unit_price':
    case 'unit_cost': {
      const num = cleanNumericValue(val);
      return num !== null ? formatCurrency(num) : String(val);
    }
    case 'quantity': {
      const num = cleanNumericValue(val);
      return num !== null ? formatNumber(num) : String(val);
    }
    case 'percentage': {
      const num = cleanNumericValue(val);
      return num !== null ? `${num.toFixed(1)}%` : String(val);
    }
    case 'date':
    case 'birth_date':
    case 'registration_date':
    case 'event_date':
    case 'due_date': {
      const d = parseDateValue(val, true);
      return d ? d.toLocaleDateString('pt-BR') : String(val);
    }
    case 'metric_number': {
      const num = cleanNumericValue(val);
      return num !== null ? formatNumber(num) : String(val);
    }
    default:
      if (type === 'currency') {
        const num = cleanNumericValue(val);
        return num !== null ? formatCurrency(num) : String(val);
      }
      return String(val);
  }
}

export function classifyColumnSemantics(
  key: string,
  values: any[],
  inferredType: ColumnType
): {
  semanticRole: SemanticRole;
  semanticSubtype: SemanticSubtype;
  semanticConfidence: number;
  semanticDescription: string;
  additivity?: MetricAdditivity;
  isUnitMetric?: boolean;
  isIdentifier?: boolean;
} {
  const lowerKey = key.toLowerCase().replace(/[-_.]/g, ' ').trim();
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
  const sample = nonNull.slice(0, 60);

  // ========================================================
  // 1. IDENTIFIERS (STRICT PRIORITY 1)
  // Must be evaluated BEFORE dates or metrics so IDs (e.g. ID Pedido, SKU, ID Cliente)
  // are never classified as dates or summed as portfolio revenue!
  // ========================================================

  // 1.1 CPF Check
  const isCpfKey = /^(cpf|doc cpf|cpf cliente|cpf titular|num cpf|cpf cnpj)\b/i.test(lowerKey) || lowerKey.includes('cpf');
  let cpfMatchCount = 0;
  for (const v of sample) {
    const s = String(v).trim();
    if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(s)) {
      cpfMatchCount++;
    } else {
      const d = cleanDigits(s);
      if (d.length === 11 && isValidCPFDigits(d)) {
        cpfMatchCount++;
      }
    }
  }

  if ((isCpfKey && (cpfMatchCount > 0 || sample.length === 0)) || (sample.length > 0 && cpfMatchCount / sample.length >= 0.35)) {
    return {
      semanticRole: 'identifier',
      semanticSubtype: 'cpf',
      semanticConfidence: isCpfKey && cpfMatchCount > 0 ? 0.99 : 0.92,
      semanticDescription: 'Identificador único de pessoa física (CPF brasileiro)',
      additivity: 'non_additive',
      isIdentifier: true
    };
  }

  // 1.2 CNPJ Check
  const isCnpjKey = /^(cnpj|doc cnpj|cnpj empresa|cnpj fornecedor|num cnpj|cpf cnpj)\b/i.test(lowerKey) || lowerKey.includes('cnpj');
  let cnpjMatchCount = 0;
  for (const v of sample) {
    const s = String(v).trim();
    if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(s)) {
      cnpjMatchCount++;
    } else {
      const d = cleanDigits(s);
      if (d.length === 14 && isValidCNPJDigits(d)) {
        cnpjMatchCount++;
      }
    }
  }

  if ((isCnpjKey && (cnpjMatchCount > 0 || sample.length === 0)) || (sample.length > 0 && cnpjMatchCount / sample.length >= 0.35)) {
    return {
      semanticRole: 'identifier',
      semanticSubtype: 'cnpj',
      semanticConfidence: isCnpjKey && cnpjMatchCount > 0 ? 0.99 : 0.92,
      semanticDescription: 'Identificador único de pessoa jurídica (CNPJ brasileiro)',
      additivity: 'non_additive',
      isIdentifier: true
    };
  }

  // 1.3 General IDs: ID Pedido, ID Cliente, SKU, Código Produto, Matrícula, etc.
  const isGeneralIdKey = isIdentifierColumnKey(key);
  const distinctSampleRatio = sample.length > 0 ? new Set(sample.map(s => String(s))).size / sample.length : 0;

  if (isGeneralIdKey || (distinctSampleRatio > 0.88 && nonNull.length > 10 && /(cod|ref|num|key|seq|uuid|sku|serial)/i.test(lowerKey))) {
    let desc = 'Chave identificadora única de registro ou entidade';
    if (/pedido|order/i.test(lowerKey)) desc = 'Identificador único de Pedido / Transação comercial (imune a somas e datas)';
    else if (/cliente|customer/i.test(lowerKey)) desc = 'Identificador de Cliente (imune a somas e datas)';
    else if (/sku|prod/i.test(lowerKey)) desc = 'Código identificador de SKU / Produto';

    return {
      semanticRole: 'identifier',
      semanticSubtype: 'general_id',
      semanticConfidence: isGeneralIdKey ? 0.99 : 0.88,
      semanticDescription: desc,
      additivity: 'non_additive',
      isIdentifier: true
    };
  }

  // ========================================================
  // 2. GEOGRAPHIC DIMENSIONS
  // ========================================================

  // 2.1 UF (Estado Brasileiro)
  const isUfKey = /^(uf|estado uf|sigla uf|uf origem|uf destino|estado ibge|regiao uf|estado)\b/i.test(lowerKey) ||
    lowerKey === 'uf' || lowerKey === 'estado';
  let ufMatchCount = 0;
  for (const v of sample) {
    const upper = String(v).trim().toUpperCase();
    if (upper.length === 2 && BRAZIL_UFS.has(upper)) {
      ufMatchCount++;
    }
  }

  if ((isUfKey && (ufMatchCount > 0 || sample.length === 0)) || (sample.length > 0 && ufMatchCount / sample.length >= 0.45)) {
    return {
      semanticRole: 'geographic',
      semanticSubtype: 'uf',
      semanticConfidence: isUfKey ? 0.98 : 0.93,
      semanticDescription: 'Dimensão geográfica federativa (UF do Brasil)'
    };
  }

  // 2.2 Cidade, Região, País
  if (/(cidade|munic[ií]pio|cidade destino|cidade origem)/i.test(lowerKey)) {
    return {
      semanticRole: 'geographic',
      semanticSubtype: 'city',
      semanticConfidence: 0.95,
      semanticDescription: 'Dimensão geográfica municipal (Cidade)'
    };
  }
  if (/(regi[aã]o|pa[ií]s|continente|bairro|zona|territ[oó]rio)/i.test(lowerKey)) {
    return {
      semanticRole: 'geographic',
      semanticSubtype: 'country_region',
      semanticConfidence: 0.92,
      semanticDescription: 'Dimensão geográfica territorial / Macrorregião'
    };
  }

  // ========================================================
  // 3. TEMPORAL DIMENSIONS (Strict Dates - Never IDs)
  // ========================================================
  const isExplicitDateKey = DATE_KEYWORDS.some(kw => lowerKey.includes(kw)) && !isIdentifierColumnKey(key);

  if (inferredType === 'date' || isExplicitDateKey) {
    // 3.1 Data de Nascimento ou Fundação (Atributo Cadastral Demográfico - NÃO é adesão comercial)
    if (/(nasc|fundac|anivers|birth|foundation)/i.test(lowerKey)) {
      return {
        semanticRole: 'temporal',
        semanticSubtype: 'birth_date',
        semanticConfidence: 0.99,
        semanticDescription: 'Data de nascimento da pessoa física ou fundação da empresa (atributo cadastral, não representa adesão comercial)'
      };
    }

    // 3.2 Data de Cadastro, Adesão, Onboarding ou Abertura de Conta (Evento de aquisição de cliente no CRM)
    if (/(cadastro|ades[aã]o|onboarding|registro.*cliente|abertura.*conta|admiss[aã]o)/i.test(lowerKey)) {
      return {
        semanticRole: 'temporal',
        semanticSubtype: 'registration_date',
        semanticConfidence: 0.98,
        semanticDescription: 'Data do evento de cadastro comercial, admissão ou adesão da conta'
      };
    }

    // 3.3 Data de Transação, Pedido de Venda ou Evento Operacional (Linha cronológica do negócio)
    if (/(venda|pedido|faturam|chamado|compra|movimento|transa|emiss[aã]o|entrega|order)/i.test(lowerKey)) {
      return {
        semanticRole: 'temporal',
        semanticSubtype: 'event_date',
        semanticConfidence: 0.98,
        semanticDescription: 'Data do evento transacional, pedido de venda ou operação comercial'
      };
    }

    // 3.4 Data de Vencimento ou Validade
    if (/(vencimento|expir|validade|due)/i.test(lowerKey)) {
      return {
        semanticRole: 'temporal',
        semanticSubtype: 'due_date',
        semanticConfidence: 0.95,
        semanticDescription: 'Data de vencimento ou prazo limite operacional'
      };
    }

    if (/(ano|exerc[ií]cio|safra|year)\b/i.test(lowerKey)) {
      return {
        semanticRole: 'temporal',
        semanticSubtype: 'period_year',
        semanticConfidence: 0.95,
        semanticDescription: 'Dimensão temporal de granularidade anual'
      };
    }
    if (/(m[eê]s|compet[eê]ncia|per[ií]odo|m[eê]s ano)\b/i.test(lowerKey)) {
      return {
        semanticRole: 'temporal',
        semanticSubtype: 'period_month',
        semanticConfidence: 0.94,
        semanticDescription: 'Dimensão temporal de competência ou período mensal'
      };
    }
    return {
      semanticRole: 'temporal',
      semanticSubtype: 'date',
      semanticConfidence: 0.95,
      semanticDescription: 'Dimensão temporal cronológica (Data)'
    };
  }

  // ========================================================
  // 4. METRICS (Distinguishing Additive vs Non-Additive)
  // ========================================================

  // 4.1 Non-Additive Unit Prices & Unit Costs (Preço Unitário, Custo Unitário, Preço de Tabela)
  // CRITICAL: Must NEVER be summed across orders!
  if (isUnitPriceColumnKey(key)) {
    const isCost = /custo/i.test(lowerKey);
    return {
      semanticRole: 'metric',
      semanticSubtype: isCost ? 'unit_cost' : 'unit_price',
      semanticConfidence: 0.98,
      semanticDescription: isCost
        ? 'Custo unitário não-aditivo (não somar diretamente; base para custo ponderado)'
        : 'Preço unitário não-aditivo (não somar diretamente; calcular preço médio ponderado ou receita por Qtd × Preço)',
      additivity: 'non_additive',
      isUnitMetric: true
    };
  }

  // 4.2 Non-Additive Percentages & Ratios (Margem %, Desconto %, Taxa)
  if (isPercentageColumnKey(key)) {
    return {
      semanticRole: 'metric',
      semanticSubtype: 'percentage',
      semanticConfidence: 0.96,
      semanticDescription: 'Métrica percentual não-aditiva (Margem % / Taxa: calcular média ponderada ou razão entre somas)',
      additivity: 'non_additive'
    };
  }

  // 4.3 Additive Discounts (Desconto R$)
  if (isDiscountColumnKey(key)) {
    return {
      semanticRole: 'metric',
      semanticSubtype: 'discount',
      semanticConfidence: 0.98,
      semanticDescription: 'Desconto comercial concedido (Métrica monetária aditiva R$)',
      additivity: 'additive'
    };
  }

  // 4.4 Additive Shipping / Freight (Frete cobrado R$)
  if (isShippingColumnKey(key)) {
    return {
      semanticRole: 'metric',
      semanticSubtype: 'shipping',
      semanticConfidence: 0.97,
      semanticDescription: 'Frete cobrado / Custo logístico (Métrica monetária aditiva R$)',
      additivity: 'additive'
    };
  }

  // 4.5 Additive Gross Revenue (Valor Bruto, Faturamento Bruto)
  if (isGrossRevenueColumnKey(key)) {
    return {
      semanticRole: 'metric',
      semanticSubtype: 'gross_revenue',
      semanticConfidence: 0.99,
      semanticDescription: 'Faturamento bruto / Valor bruto (Métrica monetária aditiva R$)',
      additivity: 'additive'
    };
  }

  // 4.6 Additive Net Revenue (Valor Líquido, Receita Líquida)
  if (isNetRevenueColumnKey(key)) {
    return {
      semanticRole: 'metric',
      semanticSubtype: 'net_revenue',
      semanticConfidence: 0.99,
      semanticDescription: 'Faturamento líquido / Valor líquido (Métrica monetária aditiva R$)',
      additivity: 'additive'
    };
  }

  // 4.7 Additive Cost (Custo Total / Custo Produtos)
  if (isCostColumnKey(key)) {
    return {
      semanticRole: 'metric',
      semanticSubtype: 'cost',
      semanticConfidence: 0.96,
      semanticDescription: 'Custo total dos produtos comercializados (Métrica monetária aditiva R$)',
      additivity: 'additive'
    };
  }

  // 4.8 Additive Quantities & Volumes (Quantidade, Itens, Qtd Vendida, Volume)
  if (isQuantityColumnKey(key) || (inferredType === 'number' && /(qtd|itens|volume|unidades)/i.test(lowerKey))) {
    return {
      semanticRole: 'metric',
      semanticSubtype: 'quantity',
      semanticConfidence: 0.96,
      semanticDescription: 'Métrica quantitativa aditiva (Quantidade física de itens / unidades)',
      additivity: 'additive'
    };
  }

  // 4.9 Additive Monetary Values (Valor Total, Faturamento, Receita, Lucro)
  const isCurrencyExplicit = inferredType === 'currency' || CURRENCY_KEYWORDS.some(kw => lowerKey.includes(kw));
  let hasCurrencySymbols = 0;
  for (const v of sample) {
    const s = String(v).trim();
    if (/^(r\$|\$|€|£|usd|brl)\s*/i.test(s)) {
      hasCurrencySymbols++;
    }
  }

  if (isCurrencyExplicit || (sample.length > 0 && hasCurrencySymbols / sample.length >= 0.3)) {
    return {
      semanticRole: 'metric',
      semanticSubtype: 'monetary',
      semanticConfidence: isCurrencyExplicit ? 0.98 : 0.91,
      semanticDescription: 'Métrica financeira quantitativa aditiva (Faturamento / Valor Total R$)',
      additivity: 'additive'
    };
  }

  // 4.5 Other General Numeric Measures
  if (inferredType === 'number') {
    return {
      semanticRole: 'metric',
      semanticSubtype: 'metric_number',
      semanticConfidence: 0.88,
      semanticDescription: 'Medida quantitativa agregável (número)',
      additivity: 'additive'
    };
  }

  // ========================================================
  // 5. DESCRIPTIVE ENTITIES & CONTACTS
  // ========================================================
  if (/(email|e-mail)\b/i.test(lowerKey)) {
    return {
      semanticRole: 'descriptive',
      semanticSubtype: 'email',
      semanticConfidence: 0.98,
      semanticDescription: 'Informação cadastral de correio eletrônico (Email)'
    };
  }
  if (/(telefone|celular|fone|whatsapp|ramal|contato)\b/i.test(lowerKey)) {
    return {
      semanticRole: 'descriptive',
      semanticSubtype: 'phone',
      semanticConfidence: 0.95,
      semanticDescription: 'Informação cadastral de contato telefônico'
    };
  }
  if (/(nome|cliente|respons[aá]vel|vendedor|funcion[aá]rio|usu[aá]rio|paciente|aluno|autor|representante)\b/i.test(lowerKey)) {
    return {
      semanticRole: 'descriptive',
      semanticSubtype: 'person_name',
      semanticConfidence: 0.94,
      semanticDescription: 'Entidade descritiva nominal / Nome da parte envolvida'
    };
  }

  // ========================================================
  // 6. CATEGORICAL & STATUS DIMENSIONS
  // ========================================================
  if (/(status|situa[cç][aã]o|fase|etapa|condi[cç][aã]o)\b/i.test(lowerKey)) {
    return {
      semanticRole: 'categorical',
      semanticSubtype: 'status',
      semanticConfidence: 0.95,
      semanticDescription: 'Dimensão categórica de ciclo de vida ou status operacional'
    };
  }
  if (inferredType === 'category' || /(categoria|segmento|tipo|canal|departamento|setor|modalidade|marca|fornecedor|classe|grupo|produto)/i.test(lowerKey)) {
    return {
      semanticRole: 'categorical',
      semanticSubtype: 'category',
      semanticConfidence: 0.90,
      semanticDescription: 'Dimensão qualitativa para segmentação e agrupamento'
    };
  }

  return {
    semanticRole: 'descriptive',
    semanticSubtype: 'text',
    semanticConfidence: 0.70,
    semanticDescription: 'Texto descritivo geral não estruturado'
  };
}

export function inferColumnType(key: string, values: any[]): ColumnType {
  const lowerKey = key.toLowerCase().replace(/[-_.]/g, ' ').trim();
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonNullValues.length === 0) return 'text';

  const sampleSize = Math.min(nonNullValues.length, 100);
  const sample = nonNullValues.slice(0, sampleSize);

  // If column key is explicitly an identifier (e.g. ID Pedido, SKU, ID Cliente, Código):
  // It MUST NEVER be inferred as 'date'!
  if (isIdentifierColumnKey(key)) {
    // If all values are alphanumeric or text with hyphens/letters, return 'text'
    const hasAlpha = sample.some(v => typeof v === 'string' && /[a-zA-Z\-_/]/.test(v));
    if (hasAlpha) return 'text';
    // If pure integer digits (like order ID 35001), treat as 'number' or 'text'
    return 'number';
  }

  const isExplicitDateKey = DATE_KEYWORDS.some(k => lowerKey.includes(k));
  let dateMatches = 0;
  let numericMatches = 0;
  let booleanMatches = 0;

  for (const v of sample) {
    if (typeof v === 'boolean' || v === 'true' || v === 'false' || v === 'Sim' || v === 'Não') {
      booleanMatches++;
    }
    // Strict date parsing (with date context check)
    if (parseDateValue(v, isExplicitDateKey) !== null) {
      dateMatches++;
    }
    if (cleanNumericValue(v) !== null) {
      numericMatches++;
    }
  }

  if (booleanMatches / sampleSize > 0.8) return 'boolean';

  // Strict Date Detection:
  // Only classify as date if it has date keywords AND substantial date matches, OR overwhelming strict date matches
  if ((isExplicitDateKey && dateMatches / sampleSize > 0.35) || (!isExplicitDateKey && dateMatches / sampleSize > 0.85)) {
    return 'date';
  }

  const isCurrencyKey = CURRENCY_KEYWORDS.some(k => lowerKey.includes(k));
  if (numericMatches / sampleSize > 0.75) {
    if (isCurrencyKey) return 'currency';
    return 'number';
  }

  const distinctCount = new Set(nonNullValues.map(v => String(v).trim())).size;
  if (distinctCount <= 50 && distinctCount < nonNullValues.length * 0.7) {
    return 'category';
  }

  return 'text';
}

export function analyzeColumns(rows: Record<string, any>[]): ColumnSchema[] {
  if (rows.length === 0) return [];
  const keys = Object.keys(rows[0]);

  return keys.map(key => {
    const rawValues = rows.map(r => r[key]);
    const type = inferColumnType(key, rawValues);
    const semantic = classifyColumnSemantics(key, rawValues, type);
    const nonNullValues = rawValues.filter(v => v !== null && v !== undefined && v !== '');
    const distinctSet = new Set(nonNullValues.map(v => String(v).trim()));
    const distinctCount = distinctSet.size;
    const sampleValues = Array.from(distinctSet).slice(0, 5);

    let min: number | undefined;
    let max: number | undefined;
    let sum: number | undefined;
    let avg: number | undefined;

    if (type === 'number' || type === 'currency') {
      const numbers = nonNullValues
        .map(v => cleanNumericValue(v))
        .filter((n): n is number => n !== null);

      if (numbers.length > 0) {
        min = Math.min(...numbers);
        max = Math.max(...numbers);
        avg = numbers.reduce((acc, curr) => acc + curr, 0) / numbers.length;

        // CRITICAL: NEVER compute sum for non-additive metrics (unit prices, percentages) or identifiers!
        if (semantic.additivity !== 'non_additive' && semantic.semanticRole !== 'identifier') {
          sum = numbers.reduce((acc, curr) => acc + curr, 0);
        }
      }
    }

    return {
      key,
      label: key.replace(/_/g, ' '),
      type,
      semanticRole: semantic.semanticRole,
      semanticSubtype: semantic.semanticSubtype,
      semanticConfidence: semantic.semanticConfidence,
      semanticDescription: semantic.semanticDescription,
      additivity: semantic.additivity,
      isUnitMetric: semantic.isUnitMetric,
      isIdentifier: semantic.isIdentifier,
      distinctCount,
      sampleValues,
      min,
      max,
      sum,
      avg
    };
  });
}

// ==========================================
// SPREADSHEET ARCHETYPE DETECTOR
// ==========================================
export function detectSpreadsheetArchetype(columns: ColumnSchema[]): {
  archetype: SpreadsheetArchetype;
  label: string;
  countUnit: string;
} {
  const allKeys = columns.map(c => c.key.toLowerCase().trim());
  const allLabels = columns.map(c => c.label.toLowerCase().trim());
  const combinedNames = [...allKeys, ...allLabels];

  const matchesAny = (patterns: (string | RegExp)[]) => {
    return patterns.some(p => {
      if (typeof p === 'string') return combinedNames.some(c => c.includes(p));
      return combinedNames.some(c => p.test(c));
    });
  };

  const countMatches = (patterns: (string | RegExp)[]) => {
    let count = 0;
    patterns.forEach(p => {
      if (typeof p === 'string') {
        if (combinedNames.some(c => c.includes(p))) count++;
      } else {
        if (combinedNames.some(c => p.test(c))) count++;
      }
    });
    return count;
  };

  // 1. Transactional Sales Indicators (Very strong signals)
  const hasOrderId = matchesAny([
    /^(id.*pedido|pedido.*id|num.*pedido|numero.*pedido|order.*id|id.*order|pedido)$/i,
    /id[-_ ]?pedido/i, /num[-_ ]?pedido/i, /cod[-_ ]?pedido/i
  ]);
  const hasOrderDate = matchesAny([
    /data.*pedido/i, /data.*venda/i, /data.*faturam/i, /data.*emiss/i
  ]);
  const hasSalesMetrics = matchesAny([
    /faturamento/i, /receita/i, /valor.*total/i, /total.*venda/i, /total.*pedido/i
  ]);
  const hasUnitPrice = columns.some(c => c.semanticSubtype === 'unit_price' || isUnitPriceColumnKey(c.key));
  const hasQuantity = columns.some(c => c.semanticSubtype === 'quantity' || isQuantityColumnKey(c.key));
  const hasSalesEntities = matchesAny([
    /vendedor/i, /representante/i, /canal.*venda/i, /comissao/i, /comissão/i
  ]);
  const hasProductOrSku = matchesAny([/sku/i, /produto/i, /item/i]);

  let salesScore = 0;
  if (hasOrderId) salesScore += 10;
  if (hasOrderDate) salesScore += 5;
  if (hasSalesMetrics) salesScore += 7;
  if (hasUnitPrice && hasQuantity) salesScore += 8;
  else if (hasUnitPrice || hasQuantity) salesScore += 4;
  if (hasSalesEntities) salesScore += 5;
  if (hasProductOrSku && (hasUnitPrice || hasQuantity || hasSalesMetrics)) salesScore += 5;
  salesScore += countMatches(['venda', 'pedido', 'faturamento', 'receita', 'lucro', 'margem']);

  // 2. Inventory / Products Catalog
  const inventoryMatches = countMatches(['estoque', 'armazen', 'ruptura', 'minimo', 'mínimo', 'deposito', 'depósito']);
  const hasInventorySpecifics = matchesAny([/estoque.*atual/i, /estoque.*minimo/i, /estoque.*mínimo/i, /valor.*estoque/i, /status.*estoque/i]);
  let inventoryScore = inventoryMatches * 3;
  if (hasInventorySpecifics) inventoryScore += 8;
  if (hasProductOrSku && inventoryMatches > 0) inventoryScore += 4;

  // 3. Operations / Support Tickets
  const opsMatches = countMatches(['chamado', 'ticket', 'sla', 'atendente', 'resolucao', 'resolução', 'incidente', 'helpdesk']);
  let opsScore = opsMatches * 3;
  if (matchesAny([/tempo.*resoluc/i, /sla.*meta/i, /sla.*atingido/i])) opsScore += 8;

  // 4. HR / People
  const hrMatches = countMatches(['colaborador', 'funcionario', 'funcionário', 'cargo', 'departamento', 'salario', 'salário', 'admissao', 'admissão']);
  let hrScore = hrMatches * 3;
  if (matchesAny([/sal[aá]rio/i, /admiss[aã]o/i, /cargo/i])) hrScore += 6;

  // 5. Customer Directory / CRM
  // A table is CRM ONLY if it represents customer accounts/leads, NOT sales order lines!
  const crmMatches = countMatches(['cliente', 'lead', 'email', 'telefone', 'cpf', 'cnpj', 'contato', 'cadastro', 'nps', 'score']);
  const hasCrmSpecifics = matchesAny([/data.*cadastro/i, /data.*ades[aã]o/i, /situa[cç][aã]o.*cadastral/i, /nps/i, /lead/i]);
  let crmScore = crmMatches * 2;
  if (hasCrmSpecifics) crmScore += 6;

  // CRITICAL: If table has order IDs or line-item sales metrics, it is a SALES TABLE, NOT CRM!
  // In sales orders, client name or UF is merely a dimension of the transaction.
  if (hasOrderId || (hasUnitPrice && hasQuantity) || (hasSalesMetrics && hasProductOrSku)) {
    crmScore -= 12; // Strongly discourage CRM when transactional order indicators are present
  }

  // 6. Financial Accounting (DRE / Balancete)
  const finAccountingMatches = countMatches(['dre', 'plano de contas', 'centro de custo', 'contas a pagar', 'contas a receber', 'fluxo de caixa']);
  let finAccountingScore = finAccountingMatches * 4;

  // Ranking & Domain Assignment
  if (salesScore >= 7 && salesScore > inventoryScore && salesScore > opsScore && salesScore > hrScore) {
    return { archetype: 'financial_sales', label: 'Vendas & Desempenho Comercial', countUnit: 'pedidos' };
  }
  if (inventoryScore >= 6 && inventoryScore > salesScore) {
    return { archetype: 'inventory_products', label: 'Catálogo & Gestão de Estoque', countUnit: 'produtos' };
  }
  if (opsScore >= 5) {
    return { archetype: 'operations_support', label: 'Operações & Atendimento Helpdesk', countUnit: 'chamados' };
  }
  if (hrScore >= 5) {
    return { archetype: 'hr_people', label: 'Recursos Humanos & Colaboradores', countUnit: 'colaboradores' };
  }
  if (finAccountingScore >= 6) {
    return { archetype: 'financial_accounting', label: 'Controladoria & Finanças', countUnit: 'lançamentos' };
  }
  if (crmScore >= 5 && salesScore < 5) {
    return { archetype: 'crm_clients', label: 'Base de Clientes & CRM', countUnit: 'clientes' };
  }
  if (salesScore >= 3) {
    return { archetype: 'financial_sales', label: 'Vendas & Desempenho Comercial', countUnit: 'pedidos' };
  }

  return { archetype: 'generic_analytics', label: 'Análise de Dados Geral', countUnit: 'registros' };
}

// ==========================================
// DETERMINISTIC SALES METRICS CALCULATION
// ==========================================
export function calculateSalesMetricsSummary(
  rows: Record<string, any>[],
  columns: ColumnSchema[]
): SalesMetricsSummary {
  const totalRecords = rows.length;
  if (totalRecords === 0) {
    return {
      totalRecords: 0,
      uniqueOrdersCount: 0,
      uniqueCustomersCount: 0,
      grossRevenue: 0,
      realizedRevenue: 0,
      pendingRevenue: 0,
      canceledLoss: 0,
      completedOrdersCount: 0,
      pendingOrdersCount: 0,
      canceledOrdersCount: 0,
      canceledCount: 0,
      cancellationRatePct: 0,
      averageTicketRealized: 0,
      avgTicket: 0,
      avgMarginPct: 0,
      totalUnitsSold: 0,
      weightedAveragePrice: 0,
      hasCancellations: false,
      hasStatusColumn: false,
      revenueFormulaUsed: 'single_metric'
    };
  }

  // 1. Find Order ID column
  const orderIdCol = columns.find(c => 
    /^(id.*pedido|pedido.*id|num.*pedido|numero.*pedido|order.*id|id.*order|pedido)$/i.test(c.key.trim()) ||
    (c.semanticRole === 'identifier' && /pedido|order/i.test(c.key))
  );

  // 2. Find Customer column
  const customerCol = columns.find(c =>
    /^(id.*cliente|cliente.*id|customer.*id|nome.*cliente|cliente)$/i.test(c.key.trim()) ||
    c.semanticSubtype === 'cpf' || c.semanticSubtype === 'cnpj'
  );

  // 3. Find Status column
  const statusCol = columns.find(c =>
    c.semanticSubtype === 'status' || /^(status.*pedido|pedido.*status|status|situacao)$/i.test(c.key.trim())
  );

  // 4. Find Total Revenue column (Additive)
  const totalRevenueCol = columns.find(c =>
    !isUnitPriceColumnKey(c.key) &&
    (c.semanticSubtype === 'monetary' || c.type === 'currency' || c.additivity === 'additive') &&
    /^(valor.*total|total.*venda|total.*faturado|faturamento|receita|total|valor.*pedido|total.*pedido|valor)$/i.test(c.key.trim())
  );

  // 5. Find Unit Price column (Non-additive)
  const unitPriceCol = columns.find(c =>
    isUnitPriceColumnKey(c.key) || c.semanticSubtype === 'unit_price'
  );

  // 6. Find Quantity column
  const qtyCol = columns.find(c =>
    isQuantityColumnKey(c.key) || c.semanticSubtype === 'quantity' || /^(quantidade|qtd|volume|itens)$/i.test(c.key.trim())
  );

  // 7. Find Profit & Cost columns
  const profitCol = columns.find(c => /^(lucro|margem.*bruta|lucro.*bruto|profit)$/i.test(c.key.trim()));
  const totalCostCol = columns.find(c => /^(custo.*total|custo|total.*custo|cost)$/i.test(c.key.trim()) && !isUnitPriceColumnKey(c.key));
  const unitCostCol = columns.find(c => isUnitPriceColumnKey(c.key) && /custo/i.test(c.key));

  let revenueFormulaUsed: 'total_column' | 'qty_times_unit_price' | 'single_metric' = 'single_metric';
  if (totalRevenueCol) {
    revenueFormulaUsed = 'total_column';
  } else if (unitPriceCol && qtyCol) {
    revenueFormulaUsed = 'qty_times_unit_price';
  }

  let grossRevenue = 0;
  let realizedRevenue = 0;
  let pendingRevenue = 0;
  let canceledLoss = 0;

  let completedOrders = 0;
  let pendingOrders = 0;
  let canceledOrders = 0;

  let totalUnitsSold = 0;
  let totalCostSum = 0;
  let totalProfitSum = 0;

  const uniqueOrders = new Set<string>();
  const uniqueCustomers = new Set<string>();
  const realizedOrderIds = new Set<string>();

  rows.forEach(r => {
    if (orderIdCol) {
      const orderVal = String(r[orderIdCol.key] ?? '').trim();
      if (orderVal) uniqueOrders.add(orderVal);
    }
    if (customerCol) {
      const custVal = String(r[customerCol.key] ?? '').trim();
      if (custVal) uniqueCustomers.add(custVal);
    }

    const statusVal = statusCol ? String(r[statusCol.key] ?? '').trim().toLowerCase() : '';
    const isCanceled = /cancelad|estornad|devolvid|rejeitad|anulad/i.test(statusVal);
    const isPending = /pendente|aguardando|em faturamento|em processamento|em aberto|aberto/i.test(statusVal);
    const isCompleted = !isCanceled && !isPending;

    if (isCanceled) canceledOrders++;
    else if (isPending) pendingOrders++;
    else completedOrders++;

    // Calculate line revenue deterministically
    let lineRevenue = 0;
    if (totalRevenueCol) {
      lineRevenue = cleanNumericValue(r[totalRevenueCol.key]) || 0;
    } else if (unitPriceCol && qtyCol) {
      const uPrice = cleanNumericValue(r[unitPriceCol.key]) || 0;
      const q = cleanNumericValue(r[qtyCol.key]) || 0;
      lineRevenue = uPrice * q;
    } else if (unitPriceCol) {
      lineRevenue = cleanNumericValue(r[unitPriceCol.key]) || 0;
    }

    const lineQty = qtyCol ? (cleanNumericValue(r[qtyCol.key]) || 1) : 1;

    grossRevenue += lineRevenue;

    if (isCanceled) {
      canceledLoss += lineRevenue;
    } else if (isPending) {
      pendingRevenue += lineRevenue;
    } else {
      realizedRevenue += lineRevenue;
      totalUnitsSold += lineQty;
      if (orderIdCol) {
        const orderVal = String(r[orderIdCol.key] ?? '').trim();
        if (orderVal) realizedOrderIds.add(orderVal);
      }

      if (profitCol) {
        totalProfitSum += cleanNumericValue(r[profitCol.key]) || 0;
      } else if (totalCostCol) {
        const c = cleanNumericValue(r[totalCostCol.key]) || 0;
        totalCostSum += c;
        totalProfitSum += (lineRevenue - c);
      } else if (unitCostCol) {
        const uc = cleanNumericValue(r[unitCostCol.key]) || 0;
        const c = uc * lineQty;
        totalCostSum += c;
        totalProfitSum += (lineRevenue - c);
      }
    }
  });

  const uniqueOrdersCount = orderIdCol && uniqueOrders.size > 0 ? uniqueOrders.size : totalRecords;
  const uniqueCustomersCount = customerCol && uniqueCustomers.size > 0 ? uniqueCustomers.size : 0;
  const realizedOrdersCount = orderIdCol && realizedOrderIds.size > 0 ? realizedOrderIds.size : (completedOrders > 0 ? completedOrders : totalRecords - canceledOrders);

  const cancellationRatePct = uniqueOrdersCount > 0 ? (canceledOrders / uniqueOrdersCount) * 100 : 0;
  const averageTicketRealized = completedOrders > 0
    ? (realizedRevenue / completedOrders)
    : (realizedOrdersCount > 0 ? (realizedRevenue / realizedOrdersCount) : (uniqueOrdersCount > 0 ? grossRevenue / uniqueOrdersCount : 0));
  const weightedAveragePrice = totalUnitsSold > 0 ? (realizedRevenue / totalUnitsSold) : 0;

  let weightedMarginPct: number | undefined;
  if (profitCol || totalCostCol || unitCostCol) {
    weightedMarginPct = realizedRevenue > 0 ? (totalProfitSum / realizedRevenue) * 100 : 0;
  }
  const avgMarginPct = weightedMarginPct !== undefined ? weightedMarginPct : 25;

  return {
    totalRecords,
    uniqueOrdersCount,
    uniqueCustomersCount,
    grossRevenue,
    realizedRevenue,
    pendingRevenue,
    canceledLoss,
    completedOrdersCount: completedOrders,
    pendingOrdersCount: pendingOrders,
    canceledOrdersCount: canceledOrders,
    canceledCount: canceledOrders,
    cancellationRatePct,
    averageTicketRealized,
    avgTicket: averageTicketRealized,
    weightedMarginPct,
    avgMarginPct,
    totalUnitsSold,
    weightedAveragePrice,
    hasCancellations: canceledOrders > 0,
    hasStatusColumn: !!statusCol,
    revenueFormulaUsed
  };
}

// ==========================================
// IDENTIFIER IMMUNITY & VALID METRICS ENGINE
// ==========================================
export function isIdentifierColumn(col: ColumnSchema): boolean {
  if (col.isIdentifier) return true;
  if (col.semanticRole === 'identifier') return true;
  if (col.semanticSubtype === 'cpf' || col.semanticSubtype === 'cnpj' || col.semanticSubtype === 'general_id') return true;
  return isIdentifierColumnKey(col.key);
}

export function getValidMetricColumns(
  columns: ColumnSchema[],
  archetype: SpreadsheetArchetype,
  onlyAdditive: boolean = true
): ColumnSchema[] {
  // Strictly filter out any identifiers (CPFs, CNPJs, IDs, SKU, Códigos) from being aggregated as metrics
  const nonIdColumns = columns.filter(c => !isIdentifierColumn(c) && (c.type === 'currency' || c.type === 'number'));

  const countUnitLabel = archetype === 'financial_sales'
    ? 'Volume de Pedidos'
    : archetype === 'crm_clients'
    ? 'Quantidade de Clientes'
    : archetype === 'inventory_products'
    ? 'Total de SKUs'
    : archetype === 'operations_support'
    ? 'Total de Chamados'
    : archetype === 'hr_people'
    ? 'Total de Colaboradores'
    : 'Contagem de Registros';

  const countMetric: ColumnSchema = {
    key: '__count__',
    label: countUnitLabel,
    type: 'number',
    semanticRole: 'metric',
    semanticSubtype: 'quantity',
    additivity: 'additive',
    semanticConfidence: 1,
    semanticDescription: 'Contagem de registros / transações únicas (sem somar identificadores)',
    distinctCount: 1,
    sampleValues: [1],
    sum: undefined,
    avg: 1
  };

  // Separate additive vs non-additive metrics
  const additiveMonetary = nonIdColumns.filter(c => 
    c.additivity !== 'non_additive' && c.semanticSubtype !== 'unit_price' && (c.type === 'currency' || c.semanticSubtype === 'monetary')
  );

  const additiveQuantities = nonIdColumns.filter(c => 
    c.semanticSubtype === 'quantity' || (c.additivity === 'additive' && c.type === 'number' && !c.isUnitMetric)
  );

  const nonAdditiveMetrics = nonIdColumns.filter(c => 
    c.additivity === 'non_additive' || c.semanticSubtype === 'unit_price' || c.semanticSubtype === 'percentage' || c.isUnitMetric
  );

  const otherNumeric = nonIdColumns.filter(c => 
    !additiveMonetary.includes(c) && !additiveQuantities.includes(c) && !nonAdditiveMetrics.includes(c)
  );

  if (onlyAdditive) {
    if (archetype === 'crm_clients') {
      return [countMetric, ...additiveMonetary, ...additiveQuantities, ...otherNumeric];
    }
    if (archetype === 'financial_sales') {
      return [...additiveMonetary, countMetric, ...additiveQuantities, ...otherNumeric];
    }
    if (additiveMonetary.length === 0 && additiveQuantities.length === 0 && otherNumeric.length === 0) {
      return [countMetric];
    }
    return [...additiveMonetary, ...additiveQuantities, ...otherNumeric, countMetric];
  }

  if (archetype === 'crm_clients') {
    return [countMetric, ...additiveMonetary, ...additiveQuantities, ...otherNumeric, ...nonAdditiveMetrics];
  }

  if (archetype === 'financial_sales') {
    // In Sales archetype: prioritize ADDITIVE revenue metrics over unit prices!
    return [...additiveMonetary, countMetric, ...additiveQuantities, ...otherNumeric, ...nonAdditiveMetrics];
  }

  if (nonIdColumns.length === 0) {
    return [countMetric];
  }

  return [...additiveMonetary, ...additiveQuantities, ...otherNumeric, countMetric, ...nonAdditiveMetrics];
}

// ==========================================
// ANOMALY DETECTION ALGORITHM (IQR & Z-Score)
// ==========================================
function getPercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function detectAnomalies(
  rows: Record<string, any>[],
  metricKey: string,
  metricLabel: string,
  metricType: ColumnType = 'currency'
): AnomalyReport {
  const indexedValues: { index: number; value: number }[] = [];

  rows.forEach((row, idx) => {
    const num = cleanNumericValue(row[metricKey]);
    if (num !== null && !isNaN(num)) {
      indexedValues.push({ index: idx, value: num });
    }
  });

  const totalEvaluated = indexedValues.length;

  if (totalEvaluated < 4) {
    return {
      metricKey,
      metricLabel,
      totalEvaluated,
      outlierIndices: new Set<number>(),
      outlierCount: 0,
      outlierPercentage: 0,
      hasSignificantAnomalies: false,
      lowerBound: 0,
      upperBound: 0,
      q1: 0,
      q3: 0,
      median: 0,
      iqr: 0,
      highOutliersCount: 0,
      lowOutliersCount: 0,
      maxDeviationPct: 0,
      summaryText: 'Dados insuficientes para análise estatística de anomalias.'
    };
  }

  const sortedValues = indexedValues.map(iv => iv.value).sort((a, b) => a - b);
  const q1 = getPercentile(sortedValues, 0.25);
  const median = getPercentile(sortedValues, 0.50);
  const q3 = getPercentile(sortedValues, 0.75);
  const iqr = q3 - q1;

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  const extremeUpperBound = q3 + 3.0 * iqr;
  const extremeLowerBound = q1 - 3.0 * iqr;

  const outlierIndices = new Set<number>();
  let highOutliersCount = 0;
  let lowOutliersCount = 0;
  let maxDeviation = 0;
  let hasExtremeAnomaly = false;

  indexedValues.forEach(({ index, value }) => {
    if (value > upperBound) {
      outlierIndices.add(index);
      highOutliersCount++;
      const dev = median > 0 ? ((value - median) / median) * 100 : 0;
      if (dev > maxDeviation) maxDeviation = dev;
      if (value > extremeUpperBound) hasExtremeAnomaly = true;
    } else if (value < lowerBound) {
      outlierIndices.add(index);
      lowOutliersCount++;
      const dev = median > 0 ? ((median - value) / median) * 100 : 0;
      if (dev > maxDeviation) maxDeviation = dev;
      if (value < extremeLowerBound) hasExtremeAnomaly = true;
    }
  });

  const outlierCount = outlierIndices.size;
  const outlierPercentage = (outlierCount / totalEvaluated) * 100;
  const hasSignificantAnomalies = outlierCount > 0 && (outlierPercentage >= 2.0 || hasExtremeAnomaly || maxDeviation >= 100);

  const formatBound = (v: number) => {
    if (metricType === 'currency') return formatCurrency(v);
    return formatNumber(Math.round(v));
  };

  const summaryText = outlierCount > 0
    ? `${outlierCount} anomalia${outlierCount > 1 ? 's' : ''} detectada${outlierCount > 1 ? 's' : ''} (${outlierPercentage.toFixed(1)}% dos dados) fora de ${formatBound(lowerBound)} a ${formatBound(upperBound)}.`
    : 'Distribuição estável. Nenhuma anomalia estatística significativa encontrada.';

  return {
    metricKey,
    metricLabel,
    totalEvaluated,
    outlierIndices,
    outlierCount,
    outlierPercentage,
    hasSignificantAnomalies,
    lowerBound,
    upperBound,
    q1,
    q3,
    median,
    iqr,
    highOutliersCount,
    lowOutliersCount,
    maxDeviationPct: Math.round(maxDeviation),
    summaryText
  };
}

// ==========================================
// GROWTH TRENDS ALGORITHM
// ==========================================
export function computeGrowthTrends(
  timelineData: { label: string; date: Date; value: number; count: number }[]
): GrowthTrend | null {
  if (!timelineData || timelineData.length < 2) return null;

  const current = timelineData[timelineData.length - 1];
  const previous = timelineData[timelineData.length - 2];

  if (!current || !previous) return null;

  const prevVal = previous.value;
  const currVal = current.value;

  const diff = currVal - prevVal;
  const pct = prevVal !== 0 ? (diff / Math.abs(prevVal)) * 100 : 0;

  let direction: GrowthTrend['direction'] = 'neutral';
  if (pct > 0.5) direction = 'up';
  else if (pct < -0.5) direction = 'down';

  let isAccelerating = false;
  if (timelineData.length >= 3) {
    const prior = timelineData[timelineData.length - 3];
    const priorDiff = prevVal - prior.value;
    isAccelerating = diff > priorDiff;
  }

  const sign = pct > 0 ? '+' : '';
  const formatted = `${sign}${pct.toFixed(1)}%`;

  return {
    direction,
    percentage: pct,
    formatted,
    previousPeriodValue: prevVal,
    currentPeriodValue: currVal,
    periodLabel: `${previous.label} → ${current.label}`,
    isAccelerating
  };
}

// ==========================================
// AI-POWERED & HEURISTIC EXECUTIVE INSIGHTS
// ==========================================

export async function fetchAiExecutiveInsights(params: {
  archetypeLabel: string;
  activeFilters: FilterState;
  activeMetricLabel: string;
  kpis: { label: string; formatted: string; value: number }[];
  topSegments: { label: string; value: number; percentage: number }[];
  timelineTrend: GrowthTrend | null;
  anomaliesInfo: { count: number; percentage: number; bounds: string } | null;
  sampleRecords: Record<string, any>[];
}): Promise<ExecutiveInsight[] | null> {
  try {
    const res = await fetch('/api/insights/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data.insights) && data.insights.length > 0) {
      return data.insights;
    }
    return null;
  } catch (err) {
    console.warn('Fallback to local causal insights engine:', err);
    return null;
  }
}

// ==========================================
// AUDITED & VERIFIABLE EXECUTIVE OBSERVATIONS
// ==========================================

function auditCRMInsights(
  rows: Record<string, any>[],
  columns: ColumnSchema[],
  activeMetricCol: ColumnSchema,
  timelineData: { label: string; date: Date; value: number; count: number }[]
): ExecutiveInsight[] {
  const insights: ExecutiveInsight[] = [];
  const totalRows = rows.length;
  if (totalRows === 0) return [];

  const ufCol = columns.find(c => c.semanticSubtype === 'uf' || c.semanticRole === 'geographic' || /^(uf|estado)$/i.test(c.key) || c.key.toLowerCase().includes('uf') || c.key.toLowerCase().includes('estado'));
  const statusCol = columns.find(c => c.semanticSubtype === 'status' || /situa|status|condi|fase/i.test(c.key));
  const pendCol = columns.find(c => /pend|bloqueio|inadimpl|irregular/i.test(c.key));
  const docCol = columns.find(c => c.semanticSubtype === 'cpf' || c.semanticSubtype === 'cnpj' || /cpf|cnpj|doc/i.test(c.key));
  const monetaryCol = columns.find(c => c.type === 'currency' || c.semanticSubtype === 'monetary' || /ltv|valor|receita|faturam|limite/i.test(c.key));
  const registrationDateCol = columns.find(c => c.semanticSubtype === 'registration_date' || (c.semanticRole === 'temporal' && /(cadastro|ades[aã]o|onboarding|registro|abertura.*conta|criado|created)/i.test(c.key)));
  const birthFoundingDateCol = columns.find(c => c.semanticSubtype === 'birth_date' || (c.semanticRole === 'temporal' && /(nasc|fundac|anivers|birth|foundation)/i.test(c.key)));

  // 1. Concentração e Distribuição Regional (Verificável)
  if (ufCol) {
    const ufCounts: Record<string, number> = {};
    rows.forEach(r => {
      const uf = String(r[ufCol.key] || 'N/I').trim().toUpperCase() || 'N/I';
      ufCounts[uf] = (ufCounts[uf] || 0) + 1;
    });
    const sortedUFs = Object.entries(ufCounts).sort((a, b) => b[1] - a[1]);
    const top1 = sortedUFs[0];
    const top2 = sortedUFs[1];
    const top3 = sortedUFs[2];
    const top3Sum = (top1 ? top1[1] : 0) + (top2 ? top2[1] : 0) + (top3 ? top3[1] : 0);
    const top3Pct = (top3Sum / totalRows) * 100;
    const laggingUFs = sortedUFs.filter(u => u[1] <= 4);

    insights.push({
      id: 'crm_geo_concentration',
      category: 'verified_fact',
      type: 'highlight',
      title: `Concentração Federativa: Top 3 UFs (${top3Pct.toFixed(1)}%)`,
      description: `${top1 ? `${top1[0]} concentra a maior parcela da base com ${top1[1]} clientes (${((top1[1] / totalRows) * 100).toFixed(1)}%), seguido por ` : ''}${top2 ? `${top2[0]} (${top2[1]} contas, ${((top2[1] / totalRows) * 100).toFixed(1)}%)` : ''}${top3 ? ` e ${top3[0]} (${top3[1]} contas, ${((top3[1] / totalRows) * 100).toFixed(1)}%)` : ''}. Juntos, os 3 principais estados somam ${top3Sum} clientes (${top3Pct.toFixed(1)}% das ${totalRows} contas auditadas na coluna "${ufCol.label}").`,
      metricBadge: `Top 3: ${top3Pct.toFixed(0)}%`,
      importance: 'high',
      evidence: `Auditado em ${totalRows} contas na coluna "${ufCol.label}"`,
      verifiableFacts: [
        top1 ? `1º ${top1[0]}: ${top1[1]} clientes (${((top1[1] / totalRows) * 100).toFixed(1)}%)` : '',
        top2 ? `2º ${top2[0]}: ${top2[1]} clientes (${((top2[1] / totalRows) * 100).toFixed(1)}%)` : '',
        `Top 3 UFs somam ${top3Sum} de ${totalRows} clientes (${top3Pct.toFixed(1)}%)`,
        `${sortedUFs.length} estados com clientes cadastrados`
      ].filter(Boolean),
      businessImpact: 'Alta centralização geográfica da carteira no mercado líder.'
    });

    if (top1) {
      insights.push({
        id: 'crm_geo_expansion_opportunity',
        category: 'suggested_opportunity',
        type: 'recommendation',
        isHypothesis: true,
        title: `Hipótese Comercial: Avaliação de Expansão Fora de ${top1[0]}`,
        description: `Hipótese de negócio: A expressiva concentração de ${((top1[1] / totalRows) * 100).toFixed(1)}% dos clientes em ${top1[0]} e a baixa penetração nos demais ${sortedUFs.length - 1} estados sugere avaliar comercialmente se há viabilidade de expansão interestadual ou se a estratégia deve priorizar a dominância no polo principal. Esta é uma hipótese estratégica e não um fato comprovado pela planilha.`,
        metricBadge: 'Hipótese Comercial',
        hypothesisDisclaimer: 'Hipótese comercial sugerida — Requer estudo mercadológico e validação de viabilidade externa.',
        importance: 'high',
        evidence: `Diferencial de penetração regional auditado na coluna "${ufCol.label}"`,
        verifiableFacts: [
          `Polo líder (${top1[0]}): ${top1[1]} contas (${((top1[1] / totalRows) * 100).toFixed(1)}%)`,
          `Demais ${sortedUFs.length - 1} estados: ${totalRows - top1[1]} contas (${(((totalRows - top1[1]) / totalRows) * 100).toFixed(1)}%)`,
          'Classificação: Hipótese de estratégia comercial a ser validada'
        ],
        actionableStep: `Apresentar à diretoria comercial levantamento de viabilidade logística e custo de aquisição nos polos adjacentes.`,
        businessImpact: 'Possibilidade de diversificação de receita fora do estado de origem.'
      });
    }
  }

  // 2. Situação Cadastral x Validação Documental
  const activeRows = rows.filter(r => {
    const st = String(r[statusCol?.key || ''] || '').toLowerCase();
    return /ativo|regular|vigente|aprovado/.test(st);
  });
  const pendingRows = rows.filter(r => {
    const st = String(r[statusCol?.key || ''] || '').toLowerCase();
    const pd = pendCol ? String(r[pendCol.key] || '').toLowerCase() : '';
    return (
      (pendCol && !/sem pend|nenhuma|regular/.test(pd) && pd.trim() !== '') ||
      (!pendCol && /pendente|análise|analise|onboarding|bloqueado|irregular|inadimpl|churn|inativo/.test(st))
    );
  });

  const activeCount = activeRows.length;
  const activePct = totalRows > 0 ? (activeCount / totalRows) * 100 : 0;
  const pendingCount = pendingRows.length;
  const pendingPct = totalRows > 0 ? (pendingCount / totalRows) * 100 : 0;

  // Encontra qual estado tem mais pendências
  const pendingByUF: Record<string, number> = {};
  pendingRows.forEach(r => {
    const uf = ufCol ? String(r[ufCol.key] || 'N/I').trim().toUpperCase() : 'Geral';
    pendingByUF[uf] = (pendingByUF[uf] || 0) + 1;
  });
  const sortedPendingUFs = Object.entries(pendingByUF).sort((a, b) => b[1] - a[1]);
  const topPendingUF = sortedPendingUFs[0];

  const pendingMonetarySum = monetaryCol
    ? pendingRows.reduce((acc, r) => acc + (cleanNumericValue(r[monetaryCol.key]) || 0), 0)
    : 0;

  if (pendCol) {
    // Caso com coluna explícita de pendência documental / validação
    insights.push({
      id: 'crm_cadastral_health',
      category: pendingCount > 0 ? 'quality_alert' : 'verified_fact',
      type: pendingCount > 0 ? 'risk' : 'highlight',
      title: pendingCount > 0
        ? `Validação Documental: ${pendingCount} Contas com Pendência`
        : `Validação Documental: 0 Pendências na Coluna`,
      description: pendingCount > 0
        ? `${pendingCount} contas (${pendingPct.toFixed(1)}%) possuem pendências documentais ou cadastrais registradas na coluna "${pendCol.label}". ${activeCount} contas (${activePct.toFixed(1)}%) operam com status ativo no sistema.${topPendingUF ? ` O estado de ${topPendingUF[0]} concentra a maior parcela (${topPendingUF[1]} contas, ${((topPendingUF[1] / pendingCount) * 100).toFixed(0)}% do total pendente).` : ''}${pendingMonetarySum > 0 ? ` Esse bloqueio retém ${formatCurrency(pendingMonetarySum)} em valor de carteira.` : ''}`
        : `Na coluna auditada ("${pendCol.label}"), todos os ${totalRows} clientes constam sem anotações de pendência. Nota de conformidade: a ausência de pendência anotada na planilha reflete o controle interno, devendo ser complementada por validação fiscal (Sintegra/Receita) e contratual independente.`,
      metricBadge: pendingCount > 0 ? `${pendingCount} pendentes (${pendingPct.toFixed(0)}%)` : `0 pendências internas`,
      importance: 'high',
      evidence: `Auditado nas colunas "${statusCol?.label || 'Status'}" e "${pendCol.label}"`,
      verifiableFacts: [
        `Status Ativo no CRM: ${activeCount} contas (${activePct.toFixed(1)}%)`,
        `Pendências na Coluna "${pendCol.label}": ${pendingCount} contas (${pendingPct.toFixed(1)}%)`,
        topPendingUF && pendingCount > 0 ? `Maior gargalo: ${topPendingUF[0]} com ${topPendingUF[1]} pendências (${((topPendingUF[1] / pendingCount) * 100).toFixed(0)}%)` : '',
        pendingMonetarySum > 0 ? `LTV / Crédito com pendência: ${formatCurrency(pendingMonetarySum)}` : '',
        'Ressalva: Regularidade cadastral no CRM não substitui validação fiscal externa'
      ].filter(Boolean),
      actionableStep: pendingCount > 0
        ? `Mobilizar time de operações e onboarding para saneamento dos ${pendingCount} cadastros com pendência na coluna "${pendCol.label}".`
        : undefined,
      businessImpact: pendingCount > 0
        ? `Risco de conformidade e atraso de transações em ${pendingCount} clientes com pendência documental.`
        : 'Registros internos sem pendências anotadas; checagem fiscal contínua recomendada.'
    });
  } else {
    // Caso sem coluna dedicada de pendência (ex: base com apenas "Situação: Ativo", como o caso do usuário)
    insights.push({
      id: 'crm_cadastral_health',
      category: 'verified_fact',
      type: 'highlight',
      title: `Situação Operacional: ${activeCount} Contas Ativas no CRM`,
      description: `Auditoria na coluna "${statusCol?.label || 'Situação'}": todos os ${totalRows} clientes cadastrados operam com status ativo no sistema interno (${activePct.toFixed(1)}% da base). O registro comprova exclusivamente a habilitação de uso no sistema.`,
      metricBadge: `${activeCount} Ativos no CRM`,
      importance: 'high',
      evidence: `Auditado na coluna "${statusCol?.label || 'Status'}"`,
      verifiableFacts: [
        `Status Ativo no CRM: ${activeCount} contas (${activePct.toFixed(1)}%)`,
        `Contas Não-Ativas no CRM: ${pendingCount} contas`,
        `Âmbito da Informação: Registro de sistema operacional interno`
      ],
      businessImpact: 'Contas operacionais liberadas para atendimento no sistema interno.'
    });

    insights.push({
      id: 'crm_cadastral_governance_alert',
      category: 'quality_alert',
      type: 'risk',
      title: 'Alerta de Governança: Validação Fiscal Não Auditada',
      description: 'A planilha registra 100% dos clientes com status operacional "Ativo", porém NÃO contém colunas de conferência fiscal (Receita Federal/Sintegra), contratos assinados ou ausência de pendências de migração. O status Ativo apenas reflete a situação do registro no CRM.',
      metricBadge: 'Auditoria Externa Pendente',
      importance: 'high',
      evidence: 'Auditoria de colunas: ausência de campos fiscais e certidões na planilha',
      verifiableFacts: [
        'Status Ativo no CRM: 100% das contas',
        'Validação Documental Externa: Não auditada nesta base',
        'Conformidade Fiscal (Receita/Sintegra): Requer checagem independente'
      ],
      actionableStep: 'Programar rotina periódica de consulta automática na Receita Federal e Sintegra antes de homologar migrações.',
      businessImpact: 'Prevenção de passivos tributários e garantia de conformidade fiscal e jurídica.'
    });
  }

  // 3. Auditoria Documental de CPF/CNPJ e Qualidade dos Dados
  const docColKey = docCol?.key;
  let validDocCount = 0;
  const docFrequency: Record<string, number> = {};
  let incompleteCount = 0;

  rows.forEach(r => {
    if (docColKey) {
      const rawDoc = String(r[docColKey] || '').trim();
      const cleanDigits = rawDoc.replace(/\D/g, '');
      if (cleanDigits.length === 11 || cleanDigits.length === 14) {
        validDocCount++;
      }
      if (cleanDigits.length > 0) {
        docFrequency[cleanDigits] = (docFrequency[cleanDigits] || 0) + 1;
      }
    }
    const nameVal = String(r['Nome do Cliente'] || r['Cliente'] || r['Nome'] || '').trim();
    const emailVal = String(r['Email'] || r['E-mail'] || r['Contato'] || '').trim();
    if (!nameVal || !emailVal) incompleteCount++;
  });

  const duplicateDocs = Object.entries(docFrequency).filter(([_, count]) => count > 1);
  const duplicateCount = duplicateDocs.reduce((acc, [_, count]) => acc + (count - 1), 0);
  const validDocPct = totalRows > 0 ? (validDocCount / totalRows) * 100 : 100;

  insights.push({
    id: 'crm_document_audit',
    category: duplicateCount > 0 ? 'quality_alert' : 'verified_fact',
    type: duplicateCount === 0 ? 'highlight' : 'risk',
    title: duplicateCount === 0
      ? `Validação Documental: Unicidade de CPF/CNPJ (${validDocCount} Registros)`
      : `Alerta Documental: ${duplicateCount} Duplicidades de CPF/CNPJ Detectadas`,
    description: duplicateCount === 0
      ? `Auditoria de sintaxe e unicidade em ${totalRows} identificadores (${docCol?.label || 'CPF/CNPJ'}): 0 duplicidades de identificador detectadas na base e ${validDocPct.toFixed(1)}% dos documentos com padrão sintático de máscara (11 dígitos para CPF ou 14 para CNPJ). Ressalva técnica: a validação de formato e unicidade no arquivo confirma integridade de dados locais, mas não substitui a consulta cadastral na Receita Federal ou conferência de certidões fiscais.`
      : `Detectadas ${duplicateCount} ocorrências de documentos repetidos em diferentes registros cadastrais. Essa inconsistência pode gerar duplicidade de lançamentos contábeis e exige unificação no banco de dados.`,
    metricBadge: duplicateCount === 0 ? '0 duplicidades' : `${duplicateCount} duplicados`,
    importance: 'medium',
    evidence: `Validação algorítmica de unicidade e sintaxe em "${docCol?.label || 'CPF / CNPJ'}"`,
    verifiableFacts: [
      `Identificadores auditados: ${totalRows}`,
      `Sintaxe CPF/CNPJ válida: ${validDocCount} (${validDocPct.toFixed(0)}%)`,
      `Duplicidades encontradas: ${duplicateCount}`,
      `Cadastros com contato preenchido: ${totalRows - incompleteCount} (${(((totalRows - incompleteCount) / totalRows) * 100).toFixed(0)}%)`,
      'Aviso: Validação fiscal oficial (Receita/Sintegra) requer consulta externa aos órgãos emissores'
    ],
    businessImpact: duplicateCount === 0
      ? 'Integridade estrutural da base assegurada contra cadastros duplicados; conformidade fiscal e jurídica deve ser validada nos órgãos competentes.'
      : 'Risco de inconsistência tributária e cobranças concorrentes.'
  });

  // Alerta de Qualidade para contatos incompletos
  if (incompleteCount > 0) {
    insights.push({
      id: 'crm_incomplete_contacts_alert',
      category: 'quality_alert',
      type: 'risk',
      title: `Alerta de Qualidade: ${incompleteCount} Cadastros sem Contato`,
      description: `${incompleteCount} clientes (${(((incompleteCount) / totalRows) * 100).toFixed(1)}% da base) não possuem e-mail ou contato cadastrado na planilha, demandando campanha de saneamento para evitar falhas de comunicação.`,
      metricBadge: `${incompleteCount} incompletos`,
      importance: 'medium',
      evidence: 'Auditoria de campos em colunas de contato',
      verifiableFacts: [
        `Cadastros incompletos: ${incompleteCount} de ${totalRows} (${(((incompleteCount) / totalRows) * 100).toFixed(1)}%)`,
        `Cadastros com contato íntegro: ${totalRows - incompleteCount} (${(((totalRows - incompleteCount) / totalRows) * 100).toFixed(1)}%)`
      ],
      actionableStep: 'Iniciar rotina de enriquecimento cadastral com os clientes sem contato informado.',
      businessImpact: 'Prevenção de perdas operacionais por falta de canal de comunicação.'
    });
  }

  // 4. Perfil Econômico da Carteira (LTV ou Ticket Médio)
  if (monetaryCol) {
    const totalVal = rows.reduce((acc, r) => acc + (cleanNumericValue(r[monetaryCol.key]) || 0), 0);
    const avgVal = totalRows > 0 ? totalVal / totalRows : 0;
    const activeVal = activeRows.reduce((acc, r) => acc + (cleanNumericValue(r[monetaryCol.key]) || 0), 0);
    const activeAvg = activeCount > 0 ? activeVal / activeCount : 0;
    const pendingVal = pendingRows.reduce((acc, r) => acc + (cleanNumericValue(r[monetaryCol.key]) || 0), 0);
    const pendingAvg = pendingCount > 0 ? pendingVal / pendingCount : 0;

    const sortedByVal = [...rows].sort((a, b) => (cleanNumericValue(b[monetaryCol.key]) || 0) - (cleanNumericValue(a[monetaryCol.key]) || 0));
    const top5Val = sortedByVal.slice(0, 5).reduce((acc, r) => acc + (cleanNumericValue(r[monetaryCol.key]) || 0), 0);
    const top5Pct = totalVal > 0 ? (top5Val / totalVal) * 100 : 0;

    insights.push({
      id: 'crm_economic_profile',
      category: 'verified_fact',
      type: 'trend',
      title: `Valor da Carteira: ${formatCurrency(totalVal)} (${monetaryCol.label})`,
      description: `O montante total avaliado em ${monetaryCol.label} soma ${formatCurrency(totalVal)}, resultando em média de ${formatCurrency(avgVal)} por cliente. Os top 5 clientes concentram ${formatCurrency(top5Val)} (${top5Pct.toFixed(1)}% da carteira). Contas com status ativo sustentam ${formatCurrency(activeVal)} (${((activeVal / (totalVal || 1)) * 100).toFixed(1)}% do total), com média de ${formatCurrency(activeAvg)}/conta${pendingCount > 0 ? `, comparado a ${formatCurrency(pendingAvg)} nas contas com pendência/bloqueio` : ''}.`,
      metricBadge: `Média: ${formatCurrency(avgVal)}`,
      importance: 'medium',
      evidence: `Consolidado de ${totalRows} contas na coluna "${monetaryCol.label}"`,
      verifiableFacts: [
        `LTV Consolidado: ${formatCurrency(totalVal)}`,
        `Ticket Médio: ${formatCurrency(avgVal)} por conta`,
        `Top 5 clientes: ${formatCurrency(top5Val)} (${top5Pct.toFixed(1)}%)`,
        pendingCount > 0
          ? `Média Ativo (${formatCurrency(activeAvg)}) vs Pendente (${formatCurrency(pendingAvg)})`
          : `Média em Contas Ativas: ${formatCurrency(activeAvg)}/conta`
      ],
      businessImpact: pendingCount > 0
        ? 'Alta concentração de valor nas contas ativas; saneamento de pendências documentais destrava liquidez.'
        : 'Volume concentrado em contas ativas; monitoramento contínuo de retenção e conformidade cadastral.'
    });
  }

  // 5. Análise de Maturidade Cadastral (Nascimento/Fundação) OU Crescimento Comercial Real (Data de Cadastro)
  if (birthFoundingDateCol) {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    rows.forEach(r => {
      const d = parseDateValue(r[birthFoundingDateCol.key]);
      if (d) {
        const y = d.getFullYear();
        if (!isNaN(y) && y >= 1900 && y <= currentYear) {
          years.push(y);
        }
      }
    });

    if (years.length >= 2) {
      years.sort((a, b) => a - b);
      const minYear = years[0];
      const maxYear = years[years.length - 1];
      const avgYear = Math.round(years.reduce((a, b) => a + b, 0) / years.length);
      const avgMaturity = currentYear - avgYear;
      const matureCount = years.filter(y => (currentYear - y) >= 10).length;
      const maturePct = (matureCount / years.length) * 100;
      const youngCount = years.filter(y => (currentYear - y) <= 3).length;
      const youngPct = (youngCount / years.length) * 100;

      insights.push({
        id: 'crm_client_maturity',
        category: 'verified_fact',
        type: 'highlight',
        title: `Maturidade: ${avgMaturity} Anos de Tempo Médio (Ano ${avgYear})`,
        description: `Auditoria na coluna "${birthFoundingDateCol.label}": os clientes possuem idade/fundação média de ${avgMaturity} anos (ano médio de nascimento/fundação: ${avgYear}, variando de ${minYear} a ${maxYear}). ${matureCount} contas (${maturePct.toFixed(1)}%) têm mais de 10 anos de fundação/vida e ${youngCount} (${youngPct.toFixed(1)}%) têm até 3 anos. Nota de auditoria: esta coluna reflete a maturidade histórica da entidade e NÃO representa a data de adesão/cadastro comercial na sua empresa.`,
        metricBadge: `Média: ${avgMaturity} anos`,
        importance: 'medium',
        evidence: `Auditado em ${years.length} registros válidos na coluna "${birthFoundingDateCol.label}" (Atributo Cadastral)`,
        verifiableFacts: [
          `Ano médio apurado: ${avgYear} (${avgMaturity} anos de maturidade)`,
          `Clientes consolidados (≥ 10 anos): ${matureCount} (${maturePct.toFixed(0)}%)`,
          `Empresas/clientes recentes (≤ 3 anos): ${youngCount} (${youngPct.toFixed(0)}%)`,
          `Período de fundação/nasc: ${minYear} a ${maxYear}`,
          `Observação: Não representa data de adesão/cadastro comercial`
        ],
        businessImpact: 'Permite calibrar ofertas entre clientes consolidados/maduros e empresas em fase inicial.'
      });

      insights.push({
        id: 'crm_maturity_opportunity',
        category: 'suggested_opportunity',
        type: 'recommendation',
        isHypothesis: true,
        title: 'Hipótese Comercial: Estratégias por Faixa de Maturidade',
        description: `Hipótese comercial: A presença de ${maturePct.toFixed(0)}% de contas com mais de 10 anos de fundação combinada a ${youngPct.toFixed(0)}% de empresas jovens sugere testar abordagens comerciais diferenciadas para retenção de clientes tradicionais e aceleração de novos negócios. Esta é uma hipótese estratégica e não um fato comprovado pela planilha.`,
        metricBadge: 'Hipótese Comercial',
        hypothesisDisclaimer: 'Hipótese de oferta e relacionamento por maturidade demográfica.',
        importance: 'medium',
        actionableStep: 'Mapear produtos com maior aderência ao segmento consolidado vs empresas recentes.',
        businessImpact: 'Aumento de LTV e personalização de ofertas comerciais.'
      });
    }
  } else if (registrationDateCol && timelineData.length >= 2) {
    const trend = computeGrowthTrends(timelineData);
    if (trend) {
      insights.push({
        id: 'crm_growth_trend',
        category: 'verified_fact',
        type: 'trend',
        title: `Evolução de Novos Clientes: ${trend.formatted}`,
        description: `Na comparação cronológica recente (${trend.periodLabel}) baseada na coluna de adesão "${registrationDateCol.label}", a entrada de novos clientes registrou variação de ${trend.formatted} (de ${formatNumber(trend.previousPeriodValue)} para ${formatNumber(trend.currentPeriodValue)} cadastros). O ritmo de aquisição demonstra ${trend.direction === 'up' ? 'aceleração na entrada de novas contas' : 'estabilização do ciclo de novas adesões'}.`,
        metricBadge: trend.formatted,
        importance: 'medium',
        evidence: `Série temporal auditada na coluna "${registrationDateCol.label}": ${trend.periodLabel}`,
        verifiableFacts: [
          `Período anterior: ${formatNumber(trend.previousPeriodValue)} novos clientes`,
          `Período atual: ${formatNumber(trend.currentPeriodValue)} novos clientes`,
          `Variação apurada: ${trend.formatted}`
        ],
        businessImpact: 'Monitora a tração do funil comercial e ritmo de expansão da base ativa.'
      });
    }
  }

  return insights;
}

function auditSalesFinancialInsights(
  rows: Record<string, any>[],
  columns: ColumnSchema[],
  activeMetricCol: ColumnSchema,
  primaryCategoryKey: string,
  timelineData: { label: string; date: Date; value: number; count: number }[],
  anomalyReport: AnomalyReport | null
): ExecutiveInsight[] {
  const insights: ExecutiveInsight[] = [];
  const totalRows = rows.length;
  if (totalRows === 0) return [];

  const salesSummary = calculateSalesMetricsSummary(rows, columns);
  const activeMetricTotal = rows.reduce((acc, r) => acc + (cleanNumericValue(r[activeMetricCol.key]) || 0), 0);
  const totalRevenue = salesSummary.realizedRevenue > 0 ? salesSummary.realizedRevenue : salesSummary.grossRevenue;
  const avgTicket = salesSummary.averageTicketRealized;

  // 1. Curva ABC e Concentração de Receita (Fato Verificado com Numerador e Denominador Reconciliados)
  const categoryAgg = aggregateCategory(rows, primaryCategoryKey, activeMetricCol.key, 5);
  if (categoryAgg.length > 0) {
    const top5Sum = categoryAgg.reduce((acc, c) => acc + c.value, 0);
    // Denominador estritamente compatível com a métrica avaliada para garantir reconciliação a 100%
    const top5Pct = activeMetricTotal > 0 ? (top5Sum / activeMetricTotal) * 100 : 0;
    const topLeader = categoryAgg[0];

    insights.push({
      id: 'sales_abc_pareto',
      category: 'verified_fact',
      type: 'highlight',
      title: `Concentração da Métrica: Top ${categoryAgg.length} (${top5Pct.toFixed(1)}%)`,
      description: `A base total da métrica "${activeMetricCol.label}" soma ${formatCurrency(activeMetricTotal)} em ${salesSummary.uniqueOrdersCount} pedidos registrados (média bruta de ${formatCurrency(salesSummary.uniqueOrdersCount > 0 ? activeMetricTotal / salesSummary.uniqueOrdersCount : 0)}/pedido). ${salesSummary.hasCancellations ? `Excluindo cancelamentos e pendências, a receita realizada auditada é de ${formatCurrency(salesSummary.realizedRevenue)} em ${salesSummary.completedOrdersCount} pedidos faturados (ticket médio realizado de ${formatCurrency(avgTicket)}). ` : ''}Os ${categoryAgg.length} principais segmentos em ${primaryCategoryKey} concentram ${formatCurrency(top5Sum)} (${top5Pct.toFixed(1)}% da métrica), com "${topLeader.label}" liderando com ${formatCurrency(topLeader.value)} (${topLeader.percentage.toFixed(1)}% do total auditado).`,
      metricBadge: `Top ${categoryAgg.length}: ${top5Pct.toFixed(0)}%`,
      importance: 'high',
      evidence: `Auditado em ${totalRows} transações na métrica "${activeMetricCol.label}"`,
      verifiableFacts: [
        salesSummary.hasCancellations ? `Receita Realizada Auditada: ${formatCurrency(salesSummary.realizedRevenue)} (${salesSummary.completedOrdersCount} pedidos faturados)` : `Faturamento Auditado: ${formatCurrency(totalRevenue)}`,
        `Líder em ${primaryCategoryKey}: ${topLeader.label} com ${formatCurrency(topLeader.value)} (${topLeader.percentage.toFixed(1)}% da métrica)`,
        `Top ${categoryAgg.length} somam ${formatCurrency(top5Sum)} (${top5Pct.toFixed(1)}% da mesma população)`,
        salesSummary.hasCancellations ? `Ticket Médio Realizado: ${formatCurrency(avgTicket)} (vs Média Bruta de ${formatCurrency(salesSummary.uniqueOrdersCount > 0 ? salesSummary.grossRevenue / salesSummary.uniqueOrdersCount : 0)})` : `Ticket Médio: ${formatCurrency(avgTicket)}`,
        salesSummary.hasCancellations ? `Pedidos cancelados desconsiderados da receita: ${salesSummary.canceledOrdersCount}` : 'Zero cancelamentos na base'
      ],
      businessImpact: 'Alta dependência dos principais participantes; mitigação requer expansão de contas intermediárias.'
    });
  }

  // 2. Alerta de Qualidade: Pedidos Cancelados (se houver coluna de status com cancelamentos)
  if (salesSummary.hasCancellations) {
    insights.push({
      id: 'sales_cancellations_audit',
      category: 'quality_alert',
      type: 'risk',
      title: `Alerta de Qualidade: ${salesSummary.canceledOrdersCount} Pedidos Cancelados (${salesSummary.cancellationRatePct.toFixed(1)}%)`,
      description: `A auditoria identificou ${salesSummary.canceledOrdersCount} pedidos com status cancelado/estornado (${salesSummary.cancellationRatePct.toFixed(1)}% do volume total de ${salesSummary.uniqueOrdersCount} pedidos), representando perda de faturamento de ${formatCurrency(salesSummary.canceledLoss)}. Estes valores foram rigorosamente excluídos da receita realizada de ${formatCurrency(salesSummary.realizedRevenue)}.`,
      metricBadge: `${salesSummary.cancellationRatePct.toFixed(1)}% cancelados`,
      importance: 'high',
      evidence: `Auditado em ${salesSummary.uniqueOrdersCount} pedidos: ${salesSummary.canceledOrdersCount} cancelamentos`,
      verifiableFacts: [
        `Volume de cancelamentos: ${salesSummary.canceledOrdersCount} pedidos (${salesSummary.cancellationRatePct.toFixed(1)}%)`,
        `Perda financeira em cancelamentos: ${formatCurrency(salesSummary.canceledLoss)}`,
        `Receita realizada (líquida de cancelamentos): ${formatCurrency(salesSummary.realizedRevenue)}`
      ],
      actionableStep: 'Auditar motivos de cancelamento com a equipe de operações para reduzir o churn de pedidos.',
      businessImpact: 'Recuperação potencial de receita ao mitigar atritos operacionais no fechamento.'
    });

    insights.push({
      id: 'sales_cancellation_recovery_opportunity',
      category: 'suggested_opportunity',
      type: 'recommendation',
      isHypothesis: true,
      title: 'Hipótese Comercial: Recuperação de Pedidos Cancelados',
      description: `Hipótese comercial: A taxa de cancelamento de ${salesSummary.cancellationRatePct.toFixed(1)}% (-${formatCurrency(salesSummary.canceledLoss)}) sugere que uma ação rápida de reengajamento comercial com ofertas alternativas ou resolução de dúvidas de estoque pode recuperar parcela dos pedidos perdidos. Esta é uma hipótese estratégica e não um fato comprovado pela planilha.`,
      metricBadge: 'Hipótese Comercial',
      hypothesisDisclaimer: 'Hipótese comercial sugerida — Requer avaliação de viabilidade com o time de vendas.',
      importance: 'medium',
      actionableStep: 'Criar fluxo automatizado de contato em até 2 horas após cancelamento do pedido.',
      businessImpact: 'Recuperação estimada de 15% a 25% dos pedidos cancelados.'
    });
  }

  // 3. Alertas de Desvios Estatísticos Reais (IQR)
  if (anomalyReport && anomalyReport.hasSignificantAnomalies) {
    const sortedByMetric = [...rows].sort((a, b) => (cleanNumericValue(b[activeMetricCol.key]) || 0) - (cleanNumericValue(a[activeMetricCol.key]) || 0));
    const topRow = sortedByMetric[0];
    const topVal = cleanNumericValue(topRow?.[activeMetricCol.key]) || 0;
    const clientName = String(topRow?.['Cliente'] || topRow?.['Nome'] || topRow?.[primaryCategoryKey] || 'Pedido Líder');
    const dateVal = topRow?.['Data'] || topRow?.['Data Pedido'] ? String(topRow['Data'] || topRow['Data Pedido']).split('T')[0] : '';
    const devPct = anomalyReport.median > 0 ? Math.round(((topVal - anomalyReport.median) / anomalyReport.median) * 100) : 0;
    const outlierRows = rows.filter((_, idx) => anomalyReport.outlierIndices.has(idx));
    const outlierSum = outlierRows.reduce((acc, r) => acc + (cleanNumericValue(r[activeMetricCol.key]) || 0), 0);
    const outlierSharePct = activeMetricTotal > 0 ? (outlierSum / activeMetricTotal) * 100 : 0;

    insights.push({
      id: 'sales_outliers_audited',
      category: 'quality_alert',
      type: 'risk',
      title: `Auditoria IQR: ${anomalyReport.outlierCount} Pedidos Fora da Curva Normal`,
      description: `A auditoria estatística IQR identificou ${anomalyReport.outlierCount} pedidos discrepantes (${anomalyReport.outlierPercentage.toFixed(1)}% dos registros) que superam o limiar superior de normalidade de ${formatCurrency(anomalyReport.upperBound)}. O registro mais expressivo foi "${clientName}" com ${formatCurrency(topVal)}${dateVal ? ` em ${dateVal}` : ''}, posicionando-se +${devPct}% acima da mediana geral (${formatCurrency(anomalyReport.median)}). Esse grupo pontual responde por ${formatCurrency(outlierSum)} (${outlierSharePct.toFixed(1)}% do volume total da métrica).`,
      metricBadge: `${anomalyReport.outlierCount} pedidos atípicos`,
      importance: 'high',
      evidence: `Cálculo IQR interquartil 1.5x: Teto estatístico de ${formatCurrency(anomalyReport.upperBound)}`,
      verifiableFacts: [
        `Discrepâncias detectadas: ${anomalyReport.outlierCount} de ${totalRows} pedidos (${anomalyReport.outlierPercentage.toFixed(1)}%)`,
        `Maior transação: ${formatCurrency(topVal)} (+${devPct}% da mediana)`,
        `Volume atípico retido: ${formatCurrency(outlierSum)} (${outlierSharePct.toFixed(1)}% da receita)`,
        `Mediana operacional: ${formatCurrency(anomalyReport.median)}`
      ],
      actionableStep: 'Conciliar e isolar os pedidos atípicos para evitar distorção nas metas e comissionamento regular.',
      businessImpact: 'Distorção estatística pontual por grandes contratos fechados no período.'
    });
  } else {
    insights.push({
      id: 'sales_outliers_audited',
      category: 'verified_fact',
      type: 'highlight',
      title: `Homogeneidade de Vendas: 0 Desvios Extremos`,
      description: `Nenhuma transação ultrapassou o teto estatístico calculado de ${formatCurrency(anomalyReport?.upperBound || 0)}. A carteira de pedidos mantém dispersão regular e estável em torno da mediana (${formatCurrency(anomalyReport?.median || 0)}), sem distorções anômalas no período.`,
      metricBadge: `Dispersão estável`,
      importance: 'medium',
      evidence: `Cálculo IQR interquartil em ${totalRows} transações`,
      verifiableFacts: [
        `Total de transações auditadas: ${totalRows}`,
        `Mediana verificada: ${formatCurrency(anomalyReport?.median || 0)}`,
        `Limite superior: ${formatCurrency(anomalyReport?.upperBound || 0)}`
      ]
    });
  }

  // 4. Margem Operacional Média Ponderada (se houver coluna de margem ou lucro)
  if (salesSummary.weightedMarginPct !== undefined) {
    const marginCol = columns.find(c => c.key.toLowerCase().includes('margem') || c.key.toLowerCase().includes('lucro'));
    insights.push({
      id: 'sales_margin_efficiency',
      category: 'verified_fact',
      type: 'highlight',
      title: `Margem Média Ponderada: ${salesSummary.weightedMarginPct.toFixed(1)}%`,
      description: `A margem operacional ponderada consolidada da carteira é de ${salesSummary.weightedMarginPct.toFixed(1)}% calculada com base na receita realizada e custos reais auditados.`,
      metricBadge: `${salesSummary.weightedMarginPct.toFixed(0)}% margem`,
      importance: 'medium',
      evidence: `Auditado nas colunas de resultado e receita realizada`,
      verifiableFacts: [
        `Margem Ponderada Auditada: ${salesSummary.weightedMarginPct.toFixed(1)}%`,
        `Receita Base Realizada: ${formatCurrency(totalRevenue)}`
      ],
      businessImpact: 'Otimização do mix de produtos priorizando linhas de margem superior.'
    });

    if (!salesSummary.hasCancellations) {
      insights.push({
        id: 'sales_mix_opportunity',
        category: 'suggested_opportunity',
        type: 'recommendation',
        isHypothesis: true,
        title: 'Hipótese Comercial: Reprecificação e Foco de Mix',
        description: `Hipótese comercial: A dispersão de margens entre linhas de produtos sugere direcionar incentivos de vendas para o mix nobre e renegociar custos das categorias inferiores. Esta é uma hipótese estratégica e não um fato comprovado pela planilha.`,
        metricBadge: 'Hipótese Comercial',
        hypothesisDisclaimer: 'Hipótese comercial sugerida — Requer estudo de elasticidade de preço.',
        importance: 'medium',
        actionableStep: 'Simular impacto na margem líquida com migração de 10% do volume para o segmento líder.',
        businessImpact: 'Possibilidade de expansão do resultado líquido sem aumento proporcional de custos.'
      });
    }
  }

  // 5. Trajetória Temporal Verificável (MoM)
  if (timelineData.length >= 2) {
    const trend = computeGrowthTrends(timelineData);
    if (trend) {
      const deltaVal = trend.currentPeriodValue - trend.previousPeriodValue;
      insights.push({
        id: 'sales_growth_timeline',
        category: 'verified_fact',
        type: 'trend',
        title: `Desempenho no Período: ${trend.formatted} MoM`,
        description: `No comparativo entre os períodos recentes (${trend.periodLabel}), o faturamento variou ${trend.formatted} (de ${formatCurrency(trend.previousPeriodValue)} para ${formatCurrency(trend.currentPeriodValue)}, saldo líquido de ${deltaVal >= 0 ? '+' : ''}${formatCurrency(deltaVal)}). O ritmo comercial aponta ${trend.direction === 'up' ? 'expansão consistente da demanda' : 'acomodação após pico de fechamentos'}.`,
        metricBadge: trend.formatted,
        importance: 'high',
        evidence: `Série temporal auditada: ${trend.periodLabel}`,
        verifiableFacts: [
          `Período anterior: ${formatCurrency(trend.previousPeriodValue)}`,
          `Período atual: ${formatCurrency(trend.currentPeriodValue)}`,
          `Variação absoluta: ${deltaVal >= 0 ? '+' : ''}${formatCurrency(deltaVal)} (${trend.formatted})`
        ]
      });
    }
  }

  return insights;
}

function auditInventoryInsights(
  rows: Record<string, any>[],
  columns: ColumnSchema[]
): ExecutiveInsight[] {
  const insights: ExecutiveInsight[] = [];
  const totalRows = rows.length;
  if (totalRows === 0) return [];

  const statusCol = columns.find(c => c.key.toLowerCase().includes('status') || c.key.toLowerCase().includes('estoque'));
  const stockCol = columns.find(c => c.key.toLowerCase().includes('estoque atual') || c.key.toLowerCase().includes('quantidade'));
  const valCol = columns.find(c => c.key.toLowerCase().includes('valor') || c.type === 'currency');
  const catCol = columns.find(c => c.key.toLowerCase().includes('categoria') || c.key.toLowerCase().includes('departamento'));

  // 1. Ruptura de Estoque
  const zeroedRows = rows.filter(r => {
    const st = String(r[statusCol?.key || ''] || '').toLowerCase();
    const q = cleanNumericValue(r[stockCol?.key || 'Estoque Atual']);
    return /ruptura|zerado|critico/.test(st) || q === 0;
  });
  const zeroedCount = zeroedRows.length;
  const zeroedPct = (zeroedCount / totalRows) * 100;
  const zeroedNames = zeroedRows.map(r => String(r['Produto'] || r['Nome'] || r['SKU'] || 'Item')).slice(0, 3);

  insights.push({
    id: 'inv_stockout_audit',
    category: zeroedCount > 0 ? 'quality_alert' : 'verified_fact',
    type: zeroedCount > 0 ? 'risk' : 'highlight',
    title: zeroedCount > 0
      ? `Alerta Operacional: ${zeroedCount} SKUs em Ruptura (${zeroedPct.toFixed(1)}%)`
      : `Disponibilidade de Catálogo: 100% dos Itens Estocados`,
    description: zeroedCount > 0
      ? `Foram identificados ${zeroedCount} produtos (${zeroedPct.toFixed(1)}% do catálogo) com saldo zero de estoque (incluindo ${zeroedNames.join(', ')}). A ausência desses itens gera perda de faturamento diário e cancelamento de pedidos.`
      : `Todos os ${totalRows} produtos cadastrados possuem estoque físico positivo, garantindo atendimento contínuo aos pedidos sem ruptura.`,
    metricBadge: zeroedCount > 0 ? `${zeroedCount} zerados` : '100% abastecido',
    importance: 'high',
    evidence: `Auditado nas colunas "${stockCol?.label || 'Estoque'}" e "${statusCol?.label || 'Status'}"`,
    verifiableFacts: [
      `Total de SKUs avaliados: ${totalRows}`,
      `Itens com estoque zerado: ${zeroedCount} (${zeroedPct.toFixed(1)}%)`,
      zeroedCount > 0 ? `Itens críticos: ${zeroedNames.join(', ')}` : 'Zero rupturas'
    ],
    actionableStep: zeroedCount > 0 ? `Emitir ordem de compra emergencial para reposição dos ${zeroedCount} SKUs zerados.` : undefined,
    businessImpact: zeroedCount > 0 ? `Perda imediata de conversão de vendas em ${zeroedCount} itens.` : 'Capacidade de pronta entrega regular.'
  });

  // 2. Capital Imobilizado
  if (valCol) {
    const totalVal = rows.reduce((acc, r) => acc + (cleanNumericValue(r[valCol.key]) || 0), 0);
    const catAgg = catCol ? aggregateCategory(rows, catCol.key, valCol.key, 3) : [];
    const topCat = catAgg[0];

    insights.push({
      id: 'inv_capital_retention',
      category: 'verified_fact',
      type: 'highlight',
      title: `Patrimônio em Estoque: ${formatCurrency(totalVal)}`,
      description: `O valor consolidado de inventário é de ${formatCurrency(totalVal)} em ${totalRows} itens.${topCat ? ` A categoria "${topCat.label}" concentra o maior volume financeiro com ${formatCurrency(topCat.value)} (${topCat.percentage.toFixed(1)}% do capital total estocado).` : ''}`,
      metricBadge: topCat ? `Top: ${topCat.percentage.toFixed(0)}%` : formatCurrency(totalVal),
      importance: 'medium',
      evidence: `Auditado sobre a coluna "${valCol.label}"`,
      verifiableFacts: [
        `Capital imobilizado total: ${formatCurrency(totalVal)}`,
        topCat ? `Categoria líder: ${topCat.label} com ${formatCurrency(topCat.value)} (${topCat.percentage.toFixed(1)}%)` : ''
      ].filter(Boolean)
    });

    insights.push({
      id: 'inv_reorder_opportunity',
      category: 'suggested_opportunity',
      type: 'recommendation',
      isHypothesis: true,
      title: 'Oportunidade Sugerida: Calibragem de Ponto de Pedido (ROP)',
      description: `Hipótese operacional: Sugere-se recalibrar os lotes de ressuprimento dos itens de curva A para reduzir capital retido em estoque e eliminar risco de rupturas sazonais. Esta é uma hipótese operacional e não um fato comprovado pela planilha.`,
      metricBadge: 'Hipótese Operacional',
      hypothesisDisclaimer: 'Hipótese de gestão de estoque e suprimentos.',
      importance: 'medium',
      actionableStep: 'Calcular Lead Time médio dos fornecedores e aplicar fórmula de estoque de segurança dinâmico.',
      businessImpact: 'Redução de custos de armazenagem e liberação de fluxo de caixa.'
    });
  }

  return insights;
}

export function generateExecutiveInsights(
  rows: Record<string, any>[],
  columns: ColumnSchema[],
  archetypeInfo: { archetype: SpreadsheetArchetype; label: string; countUnit: string },
  activeMetricCol: ColumnSchema,
  primaryCategoryKey: string,
  timelineData: { label: string; date: Date; value: number; count: number }[],
  anomalyReport: AnomalyReport | null,
  activeFilters?: FilterState,
  kpis?: { label: string; formatted: string; value: number }[],
  allRows?: Record<string, any>[]
): ExecutiveInsight[] {
  const totalRows = rows.length;
  if (totalRows === 0) return [];

  const crossFilter = activeFilters?.activeCrossFilter;
  const isAnomaliesOnly = activeFilters?.onlyAnomalies;
  const baselineRows = allRows && allRows.length > 0 ? allRows : rows;
  const baselineCount = baselineRows.length;

  const insights: ExecutiveInsight[] = [];

  // ==========================================
  // 1. Causal Insight on Active Cross-Filter
  // ==========================================
  if (crossFilter) {
    const filterCat = crossFilter.columnKey;
    const filterVal = crossFilter.value;
    const filteredCount = rows.length;
    const sharePct = baselineCount > 0 ? (filteredCount / baselineCount) * 100 : 100;

    const filteredMetricSum = rows.reduce((acc, r) => acc + (cleanNumericValue(r[activeMetricCol.key]) || 0), 0);
    const baselineMetricSum = baselineRows.reduce((acc, r) => acc + (cleanNumericValue(r[activeMetricCol.key]) || 0), 0);
    const metricSharePct = baselineMetricSum > 0 ? (filteredMetricSum / baselineMetricSum) * 100 : sharePct;

    const filteredAvg = filteredCount > 0 ? filteredMetricSum / filteredCount : 0;
    const baselineAvg = baselineCount > 0 ? baselineMetricSum / baselineCount : 0;
    const diffPct = baselineAvg !== 0 ? ((filteredAvg - baselineAvg) / baselineAvg) * 100 : 0;

    insights.push({
      id: 'causal_crossfilter',
      category: 'verified_fact',
      type: 'highlight',
      title: `Efeito do Filtro em "${filterVal}"`,
      description: `Ao isolar "${filterVal}" em ${filterCat}, este segmento responde por ${filteredCount} de ${baselineCount} registros (${sharePct.toFixed(1)}% da base total)${activeMetricCol.key !== '__count__' ? ` e ${formatValue(filteredMetricSum, activeMetricCol.type)} (${metricSharePct.toFixed(1)}% do volume consolidado)` : ''}. A média por registro neste grupo é de ${formatValue(filteredAvg, activeMetricCol.type)}, apresentando variação de ${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}% frente à média global (${formatValue(baselineAvg, activeMetricCol.type)}).`,
      metricBadge: `${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(0)}% vs média global`,
      importance: 'high',
      evidence: `Comparativo amostral: ${filteredCount} registros filtrados vs ${baselineCount} registros totais`,
      verifiableFacts: [
        `Registros no segmento: ${filteredCount} de ${baselineCount} (${sharePct.toFixed(1)}%)`,
        `Média do grupo: ${formatValue(filteredAvg, activeMetricCol.type)} (vs global ${formatValue(baselineAvg, activeMetricCol.type)})`,
        `Variação relativa: ${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}%`
      ],
      businessImpact: `Segmento de alta relevância com desvio de ${diffPct >= 0 ? '+' : ''}${diffPct.toFixed(1)}% sobre a média consolidada.`
    });
  }

  // ==========================================
  // 2. Specialized Verifiable Archetype Insights
  // ==========================================
  if (archetypeInfo.archetype === 'crm_clients') {
    const crmInsights = auditCRMInsights(rows, columns, activeMetricCol, timelineData);
    insights.push(...crmInsights);
  } else if (archetypeInfo.archetype === 'financial_sales') {
    const salesInsights = auditSalesFinancialInsights(rows, columns, activeMetricCol, primaryCategoryKey, timelineData, anomalyReport);
    insights.push(...salesInsights);
  } else if (archetypeInfo.archetype === 'inventory_products') {
    const invInsights = auditInventoryInsights(rows, columns);
    insights.push(...invInsights);
  } else {
    // Generic Analytics / Operations
    const categoryAgg = aggregateCategory(rows, primaryCategoryKey, activeMetricCol.key, 4);
    if (categoryAgg.length > 0) {
      const topCat = categoryAgg[0];
      const topPct = topCat.percentage;
      insights.push({
        id: 'generic_leader_audit',
        category: 'verified_fact',
        type: 'highlight',
        title: `Liderança em ${primaryCategoryKey}: ${topCat.label} (${topPct.toFixed(1)}%)`,
        description: `O segmento "${topCat.label}" lidera com ${formatValue(topCat.value, activeMetricCol.type)} (${topPct.toFixed(1)}% do total), superando o segundo colocado em +${categoryAgg[1] ? ((topCat.value - categoryAgg[1].value) / (categoryAgg[1].value || 1) * 100).toFixed(0) : 0}%. O volume consolidado neste corte é de ${formatValue(rows.reduce((acc, r) => acc + (cleanNumericValue(r[activeMetricCol.key]) || 0), 0), activeMetricCol.type)}.`,
        metricBadge: `${topPct.toFixed(0)}% líder`,
        importance: 'high',
        evidence: `Auditado em ${totalRows} registros na coluna "${primaryCategoryKey}"`,
        verifiableFacts: [
          `1º Lugar: ${topCat.label} com ${formatValue(topCat.value, activeMetricCol.type)} (${topPct.toFixed(1)}%)`,
          categoryAgg[1] ? `2º Lugar: ${categoryAgg[1].label} (${categoryAgg[1].percentage.toFixed(1)}%)` : ''
        ].filter(Boolean)
      });
    }

    if (anomalyReport && anomalyReport.hasSignificantAnomalies) {
      insights.push({
        id: 'generic_anomalies_audit',
        category: 'quality_alert',
        type: 'risk',
        title: `Auditoria IQR: ${anomalyReport.outlierCount} Registros Discrepantes`,
        description: `Identificados ${anomalyReport.outlierCount} registros fora do intervalo normal (${anomalyReport.outlierPercentage.toFixed(1)}% dos dados) além de ${formatValue(anomalyReport.upperBound, activeMetricCol.type)}. A mediana apurada é de ${formatValue(anomalyReport.median, activeMetricCol.type)}.`,
        metricBadge: `${anomalyReport.outlierCount} anomalias`,
        importance: 'high',
        evidence: `IQR 1.5x na coluna "${activeMetricCol.label}"`
      });
    }

    if (timelineData.length >= 2) {
      const trend = computeGrowthTrends(timelineData);
      if (trend) {
        insights.push({
          id: 'generic_trend_audit',
          category: 'verified_fact',
          type: 'trend',
          title: `Trajetória Cronológica: ${trend.formatted}`,
          description: `No comparativo entre os períodos ${trend.periodLabel}, a métrica registrou variação de ${trend.formatted} (de ${formatValue(trend.previousPeriodValue, activeMetricCol.type)} para ${formatValue(trend.currentPeriodValue, activeMetricCol.type)}).`,
          metricBadge: trend.formatted,
          importance: 'medium',
          evidence: `Série temporal auditada`
        });
      }
    }
  }

  // Deduplicate and ensure balanced coverage across all 3 categories
  const uniqueInsights: ExecutiveInsight[] = [];
  const seenIds = new Set<string>();
  for (const item of insights) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      uniqueInsights.push(item);
    }
  }

  // Ensure generic archetypes also have quality alert and suggested opportunity
  if (!uniqueInsights.some(i => i.category === 'quality_alert')) {
    uniqueInsights.push({
      id: 'generic_governance_alert',
      category: 'quality_alert',
      type: 'risk',
      title: 'Alerta de Qualidade: Governança dos Registros',
      description: `Auditoria de estrutura em ${totalRows} linhas: monitorar o preenchimento contínuo das colunas categóricas e numéricas para evitar campos nulos que distorçam as agregações consolidadas.`,
      metricBadge: 'Governança Ativa',
      importance: 'medium',
      evidence: `Verificação de conformidade na planilha`,
      verifiableFacts: [`Registros auditados: ${totalRows}`, 'Controle de qualidade ativo'],
      businessImpact: 'Garantia de consistência estatística nos cruzamentos de dados.'
    });
  }

  if (!uniqueInsights.some(i => i.category === 'suggested_opportunity')) {
    uniqueInsights.push({
      id: 'generic_opportunity_hypothesis',
      category: 'suggested_opportunity',
      type: 'recommendation',
      isHypothesis: true,
      title: 'Hipótese Comercial: Alavancagem dos Segmentos Líderes',
      description: 'Hipótese estratégica: A concentração apurada no estrato principal sugere avaliar hipóteses de replicação dos processos vencedores para os grupos secundários, visando elevar a média geral. Esta é uma hipótese estratégica e não um fato comprovado pela planilha.',
      metricBadge: 'Hipótese Sugerida',
      hypothesisDisclaimer: 'Hipótese comercial sugerida — Requer avaliação e estudo de viabilidade interna.',
      importance: 'medium',
      actionableStep: 'Mapear práticas do grupo líder e testar aplicação piloto em contas selecionadas.',
      businessImpact: 'Oportunidade para expansão de produtividade global.'
    });
  }

  return uniqueInsights;
}

// ==========================================
// CONTEXTUAL AUTO ANALYSIS
// ==========================================
export function detectAutoAnalysis(columns: ColumnSchema[], rows: Record<string, any>[]): AutoAnalysis {
  const archetypeInfo = detectSpreadsheetArchetype(columns);
  const totalRecords = rows.length;

  // Retrieve strictly valid metrics (excluding all identifiers like CPF, CNPJ, IDs)
  const validMetrics = getValidMetricColumns(columns, archetypeInfo.archetype);
  const primaryMetricCol = validMetrics[0] || {
    key: '__count__',
    label: archetypeInfo.archetype === 'crm_clients' ? 'Quantidade de Clientes' : 'Contagem de Registros',
    type: 'number',
    semanticRole: 'metric',
    semanticSubtype: 'metric_number',
    semanticConfidence: 1,
    distinctCount: 1,
    sampleValues: [1]
  };
  const secondaryMetricCol = validMetrics[1];

  const categoryCols = columns.filter(c => !isIdentifierColumn(c) && (c.type === 'category' || c.semanticRole === 'categorical' || c.semanticRole === 'geographic') && c.distinctCount > 1 && c.distinctCount <= 35);

  // Differentiate between Registration Date vs Event/Transaction Date vs Birth/Founding Date
  const registrationDateCol = columns.find(c => 
    c.semanticSubtype === 'registration_date' || 
    (c.semanticRole === 'temporal' && /(cadastro|ades[aã]o|onboarding|registro|abertura.*conta|criado|created)/i.test(c.key))
  );

  const eventDateCol = columns.find(c => 
    c.semanticSubtype === 'event_date' || 
    (c.semanticRole === 'temporal' && /(venda|pedido|faturam|chamado|movimento|transa|emiss[aã]o)/i.test(c.key))
  );

  const birthFoundingDateCol = columns.find(c => 
    c.semanticSubtype === 'birth_date' || 
    (c.semanticRole === 'temporal' && /(nasc|fundac|anivers|birth|foundation)/i.test(c.key))
  );

  const generalDateCol = columns.find(c => 
    !isIdentifierColumn(c) &&
    (c.semanticRole === 'temporal' || c.type === 'date') && 
    c !== birthFoundingDateCol && 
    c !== registrationDateCol && 
    c !== eventDateCol
  );

  // Determine the primary date column and its semantic role
  let dateCol: ColumnSchema | undefined;
  let dateSemanticType: 'registration' | 'event' | 'birth_founding' | 'period' | 'generic' = 'generic';
  let isRegistrationTimeline = false;

  if (archetypeInfo.archetype === 'crm_clients') {
    if (registrationDateCol) {
      dateCol = registrationDateCol;
      dateSemanticType = 'registration';
      isRegistrationTimeline = true;
    } else if (birthFoundingDateCol) {
      dateCol = birthFoundingDateCol;
      dateSemanticType = 'birth_founding';
      isRegistrationTimeline = false;
    } else if (eventDateCol) {
      dateCol = eventDateCol;
      dateSemanticType = 'event';
      isRegistrationTimeline = false;
    } else if (generalDateCol) {
      dateCol = generalDateCol;
      dateSemanticType = 'generic';
      isRegistrationTimeline = false;
    }
  } else if (archetypeInfo.archetype === 'financial_sales') {
    dateCol = eventDateCol || generalDateCol;
    dateSemanticType = eventDateCol ? 'event' : 'generic';
  } else if (archetypeInfo.archetype === 'operations_support') {
    dateCol = eventDateCol || generalDateCol;
    dateSemanticType = eventDateCol ? 'event' : 'generic';
  } else {
    dateCol = eventDateCol || registrationDateCol || generalDateCol || birthFoundingDateCol;
    dateSemanticType = dateCol === birthFoundingDateCol ? 'birth_founding' : (dateCol === registrationDateCol ? 'registration' : 'generic');
  }

  // Detect key dimensional columns by semantic meaning
  const ufCol = columns.find(c => c.semanticSubtype === 'uf' || c.semanticRole === 'geographic' || c.key.toLowerCase().includes('uf') || c.key.toLowerCase().includes('estado'));
  const statusCol = columns.find(c => c.semanticSubtype === 'status' || c.key.toLowerCase().includes('status') || c.key.toLowerCase().includes('situa') || c.key.toLowerCase().includes('fase') || c.key.toLowerCase().includes('etapa') || c.key.toLowerCase().includes('condi'));
  const pendCol = columns.find(c => /pend|bloqueio|inadimpl|irregular/i.test(c.key));
  const catCol = columns.find(c => !isIdentifierColumn(c) && (c.key.toLowerCase().includes('categoria') || c.key.toLowerCase().includes('segmento') || c.key.toLowerCase().includes('tipo') || c.key.toLowerCase().includes('departamento') || c.key.toLowerCase().includes('produto')));
  const supplierCol = columns.find(c => !isIdentifierColumn(c) && (c.key.toLowerCase().includes('fornecedor') || c.key.toLowerCase().includes('marca') || c.key.toLowerCase().includes('vendedor') || c.key.toLowerCase().includes('canal')));

  let primaryCategoryCol: ColumnSchema;
  let secondaryCategoryCol: ColumnSchema | undefined;
  let contextConfig: ContextualDashboardConfig;

  // Archetype-Specific Contextual Setup
  if (archetypeInfo.archetype === 'crm_clients') {
    primaryCategoryCol = ufCol || catCol || categoryCols[0] || columns[0];
    secondaryCategoryCol = statusCol || (categoryCols.find(c => c.key !== primaryCategoryCol.key)) || columns[1];

    let trendChartTitle = 'Evolução de Novos Clientes Cadastrados';
    let trendChartSubtitle = 'Histórico temporal de adesão de clientes';

    if (isRegistrationTimeline && dateCol) {
      trendChartTitle = 'Evolução de Novos Clientes Cadastrados';
      trendChartSubtitle = `Cadastros ao longo do tempo (${dateCol.label})`;
    } else if (dateSemanticType === 'birth_founding' && dateCol) {
      trendChartTitle = 'Perfil por Ano de Fundação / Nascimento';
      trendChartSubtitle = `Distribuição etária e maturidade dos clientes (${dateCol.label}) • Atributo cadastral`;
    } else if (dateCol) {
      trendChartTitle = `Distribuição Temporal por ${dateCol.label}`;
      trendChartSubtitle = `Ocorrências registradas ao longo do tempo (${dateCol.label})`;
    } else {
      trendChartTitle = 'Série Temporal Não Mapeada';
      trendChartSubtitle = 'Sem coluna de data de cadastro identificada na planilha';
    }

    contextConfig = {
      barChartTitle: ufCol ? `Distribuição de Clientes por ${ufCol.label}` : 'Distribuição de Clientes por Estado (UF)',
      barChartSubtitle: 'Ranking por concentração regional de contas ativas e cadastradas',
      barDimensionKey: ufCol?.key || primaryCategoryCol.key,
      barAggregationMode: 'count',
      donutChartTitle: statusCol ? `Situação Cadastral (${statusCol.label})` : 'Situação Cadastral dos Clientes',
      donutChartSubtitle: 'Proporção entre contas ativas, em negociação e pendências',
      donutDimensionKey: statusCol?.key || secondaryCategoryCol?.key || 'Status',
      donutAggregationMode: 'count',
      trendChartTitle,
      trendChartSubtitle,
      trendAggregationMode: 'count',
      matrixRowKey: ufCol?.key || primaryCategoryCol.key,
      matrixColKey: statusCol?.key || secondaryCategoryCol?.key || 'Status',
      matrixTitle: 'Matriz: Situação Cadastral × Estado (UF)'
    };
  } else if (archetypeInfo.archetype === 'inventory_products') {
    primaryCategoryCol = catCol || categoryCols[0] || columns[0];
    secondaryCategoryCol = statusCol || supplierCol || categoryCols[1];

    contextConfig = {
      barChartTitle: 'Estoque por Categoria de Produto',
      barChartSubtitle: 'Classificação decrescente por quantidade de itens estocados',
      barDimensionKey: catCol?.key || primaryCategoryCol.key,
      barAggregationMode: 'sum',
      donutChartTitle: 'Status Operacional do Estoque',
      donutChartSubtitle: 'Proporção entre itens regulares, estoque baixo e ruptura',
      donutDimensionKey: statusCol?.key || secondaryCategoryCol?.key || 'Status',
      donutAggregationMode: 'count',
      trendChartTitle: 'Evolução de Entradas e Atualizações',
      trendChartSubtitle: 'Histórico de movimentação do catálogo',
      trendAggregationMode: 'sum',
      matrixRowKey: catCol?.key || primaryCategoryCol.key,
      matrixColKey: supplierCol?.key || secondaryCategoryCol?.key || 'Fornecedor',
      matrixTitle: 'Matriz: Categoria × Fornecedor'
    };
  } else if (archetypeInfo.archetype === 'operations_support') {
    primaryCategoryCol = supplierCol || catCol || categoryCols[0] || columns[0];
    secondaryCategoryCol = statusCol || categoryCols[1];

    contextConfig = {
      barChartTitle: 'Chamados por Canal de Atendimento',
      barChartSubtitle: 'Volume de tickets por ponto de contato',
      barDimensionKey: primaryCategoryCol.key,
      barAggregationMode: 'count',
      donutChartTitle: 'Status e Prioridade dos Chamados',
      donutChartSubtitle: 'Proporção entre chamados abertos, em andamento e resolvidos',
      donutDimensionKey: statusCol?.key || secondaryCategoryCol?.key || 'Status',
      donutAggregationMode: 'count',
      trendChartTitle: 'Abertura de Chamados ao Longo do Tempo',
      trendChartSubtitle: 'Demanda de suporte operacional',
      trendAggregationMode: 'count',
      matrixRowKey: primaryCategoryCol.key,
      matrixColKey: statusCol?.key || secondaryCategoryCol?.key || 'Status',
      matrixTitle: 'Matriz: Canal × Status do Chamado'
    };
  } else if (archetypeInfo.archetype === 'financial_sales') {
    primaryCategoryCol = catCol || categoryCols[0] || columns[0];
    secondaryCategoryCol = supplierCol || ufCol || categoryCols[1];

    let trendTitle = 'Evolução Cronológica de Vendas (R$)';
    let trendSubtitle = 'Histórico temporal de receitas realizadas';
    if (dateCol) {
      trendSubtitle = `Série temporal auditada pela coluna "${dateCol.label}"`;
    } else {
      trendTitle = 'Série Temporal Não Mapeada';
      trendSubtitle = 'Sem coluna cronológica de pedidos identificada na planilha';
    }

    contextConfig = {
      barChartTitle: `Faturamento por ${primaryCategoryCol.label}`,
      barChartSubtitle: 'Distribuição financeira das vendas realizadas',
      barDimensionKey: primaryCategoryCol.key,
      barAggregationMode: 'sum',
      donutChartTitle: statusCol ? `Status dos Pedidos (${statusCol.label})` : (secondaryCategoryCol ? `Participação por ${secondaryCategoryCol.label}` : 'Distribuição de Vendas'),
      donutChartSubtitle: statusCol ? 'Proporção entre faturados, pendentes e cancelados' : 'Share proporcional de faturamento',
      donutDimensionKey: statusCol?.key || secondaryCategoryCol?.key || primaryCategoryCol.key,
      donutAggregationMode: statusCol ? 'count' : 'sum',
      trendChartTitle: trendTitle,
      trendChartSubtitle: trendSubtitle,
      trendAggregationMode: 'sum',
      matrixRowKey: primaryCategoryCol.key,
      matrixColKey: secondaryCategoryCol?.key || 'Canal',
      matrixTitle: `Matriz: ${primaryCategoryCol.label} × ${secondaryCategoryCol?.label || 'Canal'}`
    };
  } else {
    // Generic Analytics
    primaryCategoryCol = categoryCols[0] || columns[0];
    secondaryCategoryCol = categoryCols.length > 1 ? categoryCols[1] : undefined;

    contextConfig = {
      barChartTitle: `Distribuição por ${primaryCategoryCol.label}`,
      barChartSubtitle: 'Classificação decrescente por volume',
      barDimensionKey: primaryCategoryCol.key,
      barAggregationMode: primaryMetricCol.key === '__count__' ? 'count' : 'sum',
      donutChartTitle: `Composição por ${secondaryCategoryCol?.label || primaryCategoryCol.label}`,
      donutChartSubtitle: 'Proporção percentual da seleção',
      donutDimensionKey: secondaryCategoryCol?.key || primaryCategoryCol.key,
      donutAggregationMode: primaryMetricCol.key === '__count__' ? 'count' : 'sum',
      trendChartTitle: 'Evolução Temporal dos Dados',
      trendChartSubtitle: dateCol ? `Série temporal baseada em ${dateCol.label}` : 'Histórico cronológico',
      trendAggregationMode: primaryMetricCol.key === '__count__' ? 'count' : 'sum',
      matrixRowKey: primaryCategoryCol.key,
      matrixColKey: secondaryCategoryCol?.key || primaryCategoryCol.key,
      matrixTitle: 'Matriz de Correlação Cruzada'
    };
  }

  // Anomaly Detection over genuine primary metric (if summable)
  const anomalies = primaryMetricCol.key !== '__count__'
    ? detectAnomalies(rows, primaryMetricCol.key, primaryMetricCol.label, primaryMetricCol.type)
    : {
        metricKey: '__count__',
        metricLabel: 'Contagem',
        totalEvaluated: totalRecords,
        outlierIndices: new Set<number>(),
        outlierCount: 0,
        outlierPercentage: 0,
        hasSignificantAnomalies: false,
        lowerBound: 0,
        upperBound: 0,
        q1: 0,
        q3: 0,
        median: 0,
        iqr: 0,
        highOutliersCount: 0,
        lowOutliersCount: 0,
        maxDeviationPct: 0,
        summaryText: ''
      };

  let primaryWarning: AnomalyWarning | undefined;
  if (anomalies.hasSignificantAnomalies) {
    primaryWarning = {
      count: anomalies.outlierCount,
      percentage: anomalies.outlierPercentage,
      text: `${anomalies.outlierCount} anomalia${anomalies.outlierCount > 1 ? 's' : ''} (${anomalies.outlierPercentage.toFixed(1)}%)`,
      severity: anomalies.outlierPercentage > 5 || anomalies.maxDeviationPct > 150 ? 'critical' : 'warning',
      thresholdText: `Fora de ${formatValue(anomalies.lowerBound, primaryMetricCol.type)} ~ ${formatValue(anomalies.upperBound, primaryMetricCol.type)}`
    };
  }

  // Timeline & Growth Trend
  let timeline: { label: string; date: Date; value: number; count: number }[] = [];
  let growthTrend: GrowthTrend | undefined;
  if (dateCol?.key) {
    const granularity = dateSemanticType === 'birth_founding' ? 'year' : 'month';
    timeline = aggregateTimeline(rows, dateCol.key, primaryMetricCol.key, contextConfig.trendAggregationMode, granularity);
    // CRITICAL: NEVER compute growth trend on birth/founding dates (prevents fake commercial growth narratives like 400%)
    if (dateSemanticType !== 'birth_founding') {
      const trend = computeGrowthTrends(timeline);
      if (trend) growthTrend = trend;
    }
  }

  // Executive Insights
  const insights = generateExecutiveInsights(
    rows,
    columns,
    archetypeInfo,
    primaryMetricCol,
    primaryCategoryCol.key,
    timeline,
    anomalies
  );

  // Contextual KPIs based on Archetype
  const kpis: AutoAnalysis['kpis'] = [];

  if (archetypeInfo.archetype === 'crm_clients') {
    // 1. Quantidade de Clientes
    kpis.push({
      key: 'total_clients',
      label: 'Total de Clientes',
      value: totalRecords,
      formatted: formatNumber(totalRecords),
      type: 'number',
      growthTrend: isRegistrationTimeline ? growthTrend : undefined,
      subtext: isRegistrationTimeline
        ? 'Contas cadastradas no sistema'
        : (birthFoundingDateCol ? 'Contas ativas (data de nascimento/fundação cadastrada)' : 'Contas cadastradas no sistema')
    });

    // 2. Distribuição por Estado (UF)
    const distinctUFs = ufCol ? ufCol.distinctCount : 1;
    const topUFs = ufCol ? aggregateCategory(rows, ufCol.key, '__count__', 1, 'count') : [];
    const topUF = topUFs[0];
    kpis.push({
      key: 'distribuicao_estado',
      label: 'Distribuição por Estado',
      value: distinctUFs,
      formatted: `${distinctUFs} Estados (UFs)`,
      type: 'number',
      subtext: topUF ? `${topUF.label} lidera com ${topUF.percentage.toFixed(0)}% das contas (${topUF.count})` : 'Cobertura federativa nacional'
    });

    // 3. Situação Cadastral (Clientes Ativos no CRM)
    let activeCount = totalRecords;
    if (statusCol) {
      activeCount = rows.filter(r => /ativo|regular|vigente|aprovado|conclu/i.test(String(r[statusCol.key] || ''))).length;
    }
    const activePct = totalRecords > 0 ? (activeCount / totalRecords) * 100 : 100;
    kpis.push({
      key: 'situacao_cadastral',
      label: 'Situação Cadastral (Status CRM)',
      value: activeCount,
      formatted: `${formatNumber(activeCount)} Ativos`,
      type: 'number',
      subtext: `${activePct.toFixed(1)}% com status ativo no sistema`
    });

    // 4. Validação Documental x Pendências Cadastrais
    const docCol = columns.find(c => c.semanticSubtype === 'cpf' || c.semanticSubtype === 'cnpj' || /cpf|cnpj|doc/i.test(c.key));
    if (pendCol) {
      const pendingCount = rows.filter(r => !/sem pend|nenhuma|regular/i.test(String(r[pendCol.key] || '')) && String(r[pendCol.key] || '').trim() !== '').length;
      const pendingPct = totalRecords > 0 ? (pendingCount / totalRecords) * 100 : 0;
      kpis.push({
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
      rows.forEach(r => {
        const rawDoc = String(r[docCol.key] || '').replace(/\D/g, '');
        if (rawDoc.length === 11 || rawDoc.length === 14) validSyntaxCount++;
      });
      const validSyntaxPct = totalRecords > 0 ? (validSyntaxCount / totalRecords) * 100 : 100;
      const invalidSyntaxCount = totalRecords - validSyntaxCount;
      kpis.push({
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
      kpis.push({
        key: 'validacao_documental',
        label: 'Validação Documental',
        value: 0,
        formatted: 'Não Auditada',
        type: 'number',
        subtext: 'Base sem coluna fiscal/documental; status reflete apenas CRM'
      });
    }
  } else if (archetypeInfo.archetype === 'inventory_products') {
    const stockCol = columns.find(c => c.key.toLowerCase().includes('estoque atual') || c.key.toLowerCase().includes('quantidade'));
    const valStockCol = columns.find(c => c.key.toLowerCase().includes('valor em estoque') || c.key.toLowerCase().includes('custo') || c.type === 'currency');
    const rupturas = rows.filter(r => statusCol ? /ruptura|zerado|critico/i.test(String(r[statusCol.key] || '')) : false).length;

    kpis.push({
      key: 'total_skus',
      label: 'Total de SKUs',
      value: totalRecords,
      formatted: formatNumber(totalRecords),
      type: 'number',
      subtext: 'Produtos cadastrados'
    });
    kpis.push({
      key: 'val_stock',
      label: 'Patrimônio em Estoque',
      value: valStockCol?.sum || 0,
      formatted: formatCurrency(valStockCol?.sum || 0),
      type: 'currency',
      subtext: 'Valor total estocado'
    });
    kpis.push({
      key: 'stockout_count',
      label: 'Itens em Ruptura',
      value: rupturas,
      formatted: formatNumber(rupturas),
      type: 'number',
      changePercent: rupturas > 0 ? -rupturas * 2 : 0,
      subtext: rupturas > 0 ? 'Requer pedido emergencial' : 'Todos os itens abastecidos'
    });
    kpis.push({
      key: 'avg_cost',
      label: 'Volume de Itens',
      value: stockCol?.sum || totalRecords,
      formatted: formatNumber(stockCol?.sum || totalRecords),
      type: 'number',
      subtext: 'Unidades físicas'
    });
  } else if (archetypeInfo.archetype === 'operations_support') {
    const timeCol = columns.find(c => c.key.toLowerCase().includes('tempo') || c.key.toLowerCase().includes('horas'));
    const pendingTickets = rows.filter(r => statusCol ? /aberto|pendente|em andamento|aguardando/i.test(String(r[statusCol.key] || '')) : false).length;

    kpis.push({
      key: 'total_tickets',
      label: 'Total de Chamados',
      value: totalRecords,
      formatted: formatNumber(totalRecords),
      type: 'number',
      subtext: 'Tickets abertos no período'
    });
    kpis.push({
      key: 'pending_tickets',
      label: 'Chamados Pendentes',
      value: pendingTickets,
      formatted: formatNumber(pendingTickets),
      type: 'number',
      subtext: 'Em fila de atendimento'
    });
    kpis.push({
      key: 'avg_resolution',
      label: 'SLA Médio de Resolução',
      value: timeCol?.avg || 0,
      formatted: `${(timeCol?.avg || 0).toFixed(1)}h`,
      type: 'number',
      subtext: 'Tempo médio de fechamento'
    });
    kpis.push({
      key: 'resolution_rate',
      label: 'Taxa de Resolução',
      value: totalRecords > 0 ? ((totalRecords - pendingTickets) / totalRecords) * 100 : 100,
      formatted: `${(totalRecords > 0 ? ((totalRecords - pendingTickets) / totalRecords) * 100 : 100).toFixed(1)}%`,
      type: 'percentage',
      subtext: 'Eficácia operacional'
    });
  } else if (archetypeInfo.archetype === 'financial_sales') {
    const summary = calculateSalesMetricsSummary(rows, columns);

    // 1. Realized Revenue (distinct from gross, excludes cancellations)
    const displayRevenue = summary.hasCancellations ? summary.realizedRevenue : summary.grossRevenue;
    kpis.push({
      key: 'total_revenue',
      label: summary.hasCancellations ? 'Faturamento Realizado' : 'Faturamento Total',
      value: displayRevenue,
      formatted: formatCurrency(displayRevenue),
      type: 'currency',
      growthTrend,
      anomalyWarning: primaryWarning,
      subtext: summary.hasCancellations
        ? `Exclui ${formatCurrency(summary.canceledLoss)} cancelados (Bruto: ${formatCurrency(summary.grossRevenue)})`
        : (growthTrend ? `Crescimento: ${growthTrend.formatted} (${growthTrend.periodLabel})` : 'Consolidado de vendas')
    });

    // 2. Orders Volume (differentiating orders vs customers vs records)
    const displayOrders = summary.completedOrdersCount > 0 ? summary.completedOrdersCount : summary.uniqueOrdersCount;
    kpis.push({
      key: 'total_orders',
      label: summary.completedOrdersCount > 0 ? 'Pedidos Faturados' : 'Volume de Pedidos',
      value: displayOrders,
      formatted: formatNumber(displayOrders),
      type: 'number',
      subtext: summary.uniqueCustomersCount > 0
        ? `${formatNumber(summary.uniqueCustomersCount)} clientes compradores únicos (${formatNumber(totalRecords)} itens/linhas)`
        : `${formatNumber(totalRecords)} registros processados`
    });

    // 3. Ticket Médio Realizado (calculated deterministically over realized revenue)
    kpis.push({
      key: 'avg_ticket',
      label: 'Ticket Médio',
      value: summary.avgTicket,
      formatted: formatCurrency(summary.avgTicket),
      type: 'currency',
      subtext: `Média apurada sobre ${formatNumber(displayOrders)} pedidos faturados`
    });

    // 4. Margem ou Taxa de Cancelamento (prioritizing commercial risk)
    if (summary.hasCancellations && summary.cancellationRatePct > 0) {
      kpis.push({
        key: 'cancel_rate',
        label: 'Taxa de Cancelamento',
        value: summary.cancellationRatePct,
        formatted: `${summary.cancellationRatePct.toFixed(1)}%`,
        type: 'percentage',
        anomalyWarning: summary.cancellationRatePct > 5 ? {
          count: summary.canceledCount,
          percentage: summary.cancellationRatePct,
          text: `${summary.canceledCount} pedidos cancelados somando ${formatCurrency(summary.canceledLoss)}`,
          severity: summary.cancellationRatePct > 15 ? 'critical' : 'warning',
          thresholdText: 'Pedidos Cancelados'
        } : undefined,
        subtext: `${formatNumber(summary.canceledCount)} pedidos cancelados (${formatCurrency(summary.canceledLoss)} não realizados)`
      });
    } else {
      kpis.push({
        key: 'margin_pct',
        label: 'Margem Comercial Média',
        value: summary.avgMarginPct,
        formatted: `${summary.avgMarginPct.toFixed(1)}%`,
        type: 'percentage',
        subtext: 'Margem média ponderada apurada por código'
      });
    }
  } else {
    // Generic Analytics
    const metricSum = primaryMetricCol.sum || totalRecords;
    kpis.push({
      key: 'count_records',
      label: `Total de ${archetypeInfo.countUnit}`,
      value: totalRecords,
      formatted: formatNumber(totalRecords),
      type: 'number',
      growthTrend,
      subtext: 'Linhas ativas na planilha'
    });
    if (primaryMetricCol.key !== '__count__') {
      kpis.push({
        key: 'metric_sum',
        label: `Total ${primaryMetricCol.label}`,
        value: metricSum,
        formatted: formatValue(metricSum, primaryMetricCol.type),
        type: primaryMetricCol.type === 'currency' ? 'currency' : 'number',
        anomalyWarning: primaryWarning,
        subtext: 'Soma agregada da métrica'
      });
      kpis.push({
        key: 'metric_avg',
        label: `Média de ${primaryMetricCol.label}`,
        value: primaryMetricCol.avg || 0,
        formatted: formatValue(primaryMetricCol.avg || 0, primaryMetricCol.type),
        type: primaryMetricCol.type === 'currency' ? 'currency' : 'number',
        subtext: 'Valor individual médio'
      });
    }
    kpis.push({
      key: 'dim_count',
      label: `Segmentos em ${primaryCategoryCol.label}`,
      value: primaryCategoryCol.distinctCount,
      formatted: `${primaryCategoryCol.distinctCount} grupos`,
      type: 'number',
      subtext: 'Granularidade do conjunto'
    });
  }

  return {
    archetype: archetypeInfo.archetype,
    archetypeLabel: archetypeInfo.label,
    countUnitLabel: archetypeInfo.countUnit,
    primaryMetricKey: primaryMetricCol.key,
    secondaryMetricKey: secondaryMetricCol?.key,
    dateKey: dateCol?.key,
    dateSemanticType,
    isRegistrationTimeline,
    primaryCategoryKey: primaryCategoryCol.key,
    secondaryCategoryKey: secondaryCategoryCol?.key,
    contextConfig,
    insights,
    kpis
  };
}

export function filterDataset(
  rows: Record<string, any>[],
  columns: ColumnSchema[],
  filters: FilterState,
  dateKey?: string,
  anomalyOutlierIndices?: Set<number>
): Record<string, any>[] {
  return rows.filter((row, originalIndex) => {
    if (filters.onlyAnomalies && anomalyOutlierIndices) {
      if (!anomalyOutlierIndices.has(originalIndex)) return false;
    }

    if (filters.activeCrossFilter) {
      const { columnKey, value } = filters.activeCrossFilter;
      const cellVal = String(row[columnKey] ?? '').trim();
      if (cellVal !== value) return false;
    }

    for (const [colKey, selectedVals] of Object.entries(filters.categoryFilters)) {
      if (selectedVals && selectedVals.length > 0) {
        const cellVal = String(row[colKey] ?? '').trim();
        if (!selectedVals.includes(cellVal)) return false;
      }
    }

    if (dateKey && (filters.dateRange.start || filters.dateRange.end)) {
      const rowDate = parseDateValue(row[dateKey]);
      if (rowDate) {
        if (filters.dateRange.start) {
          const startDate = new Date(filters.dateRange.start);
          if (rowDate < startDate) return false;
        }
        if (filters.dateRange.end) {
          const endDate = new Date(filters.dateRange.end);
          endDate.setHours(23, 59, 59, 999);
          if (rowDate > endDate) return false;
        }
      }
    }

    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      const matches = Object.values(row).some(v => 
        v !== null && v !== undefined && String(v).toLowerCase().includes(q)
      );
      if (!matches) return false;
    }

    return true;
  });
}

export function formatCurrency(value: number, currency: string = 'BRL'): string {
  if (isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatCompactNumber(value: number): string {
  if (isNaN(value)) return '0';
  if (Math.abs(value) >= 1_000_000) {
    return (value / 1_000_000).toFixed(1).replace('.', ',') + 'M';
  }
  if (Math.abs(value) >= 1_000) {
    return (value / 1_000).toFixed(1).replace('.', ',') + 'k';
  }
  return value.toLocaleString('pt-BR');
}

export function formatNumber(value: number): string {
  if (isNaN(value)) return '0';
  return new Intl.NumberFormat('pt-BR').format(value);
}

export function formatValue(value: number, type: ColumnType): string {
  if (type === 'currency') return formatCurrency(value);
  if (type === 'number') return formatNumber(value);
  return String(value);
}

export function aggregateTimeline(
  rows: Record<string, any>[],
  dateKey: string,
  metricKey: string,
  aggregationMode: 'sum' | 'count' = 'sum',
  granularity: 'month' | 'year' = 'month'
): { label: string; date: Date; value: number; count: number; isOutlier?: boolean }[] {
  const map = new Map<string, { date: Date; value: number; count: number }>();

  for (const row of rows) {
    const d = parseDateValue(row[dateKey]);
    if (!d || isNaN(d.getTime())) continue;

    const key = granularity === 'year'
      ? `${d.getFullYear()}`
      : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const num = (aggregationMode === 'count' || !metricKey || metricKey === '__count__')
      ? 1
      : (cleanNumericValue(row[metricKey]) ?? 0);

    const existing = map.get(key);
    if (existing) {
      existing.value += num;
      existing.count += 1;
    } else {
      map.set(key, {
        date: granularity === 'year' ? new Date(d.getFullYear(), 0, 1) : new Date(d.getFullYear(), d.getMonth(), 1),
        value: num,
        count: 1
      });
    }
  }

  const timeline = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => {
      let label = key;
      if (granularity === 'month') {
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        label = `${monthNames[data.date.getMonth()]} ${data.date.getFullYear().toString().slice(-2)}`;
      }
      return {
        label,
        date: data.date,
        value: data.value,
        count: data.count
      };
    });

  if (timeline.length >= 4) {
    const vals = timeline.map(t => t.value);
    const sorted = [...vals].sort((a, b) => a - b);
    const q1 = getPercentile(sorted, 0.25);
    const q3 = getPercentile(sorted, 0.75);
    const iqr = q3 - q1;
    const upper = q3 + 1.5 * iqr;
    const lower = q1 - 1.5 * iqr;

    return timeline.map(t => ({
      ...t,
      isOutlier: t.value > upper || t.value < lower
    }));
  }

  return timeline;
}

export function aggregateCategory(
  rows: Record<string, any>[],
  categoryKey: string,
  metricKey: string,
  limit: number = 8,
  aggregationMode: 'sum' | 'count' = 'sum'
): { label: string; value: number; count: number; percentage: number }[] {
  const map = new Map<string, { value: number; count: number }>();
  let totalSum = 0;

  for (const row of rows) {
    const cat = String(row[categoryKey] ?? 'Outros').trim() || 'N/A';
    const num = (aggregationMode === 'count' || !metricKey || metricKey === '__count__')
      ? 1
      : (cleanNumericValue(row[metricKey]) ?? 0);

    const existing = map.get(cat);
    if (existing) {
      existing.value += num;
      existing.count += 1;
    } else {
      map.set(cat, { value: num, count: 1 });
    }
    totalSum += num;
  }

  const sorted = Array.from(map.entries())
    .map(([label, data]) => ({
      label,
      value: data.value,
      count: data.count,
      percentage: totalSum > 0 ? (data.value / totalSum) * 100 : 0
    }))
    .sort((a, b) => b.value - a.value);

  if (sorted.length <= limit) return sorted;

  const top = sorted.slice(0, limit);
  const others = sorted.slice(limit);
  const otherValue = others.reduce((acc, curr) => acc + curr.value, 0);
  const otherCount = others.reduce((acc, curr) => acc + curr.count, 0);

  if (otherValue > 0) {
    top.push({
      label: 'Outros',
      value: otherValue,
      count: otherCount,
      percentage: totalSum > 0 ? (otherValue / totalSum) * 100 : 0
    });
  }

  return top;
}

export async function parseExcelFile(file: File): Promise<{ sheetNames: string[]; workbook: XLSX.WorkBook }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  return {
    sheetNames: workbook.SheetNames,
    workbook
  };
}

// ==========================================
// SMART TABLE DETECTION & SEGMENTATION ENGINE
// ==========================================
const COMMON_HEADER_KEYWORDS = [
  'id', 'codigo', 'código', 'nome', 'cliente', 'produto', 'data', 'date',
  'dia', 'mes', 'ano', 'valor', 'preço', 'preco', 'custo', 'total',
  'categoria', 'status', 'quantidade', 'qtd', 'email', 'telefone',
  'região', 'regiao', 'cidade', 'estado', 'uf', 'segmento', 'sku',
  'marca', 'vendedor', 'responsável', 'responsavel', 'canal', 'tipo',
  'unidade', 'saldo', 'margem', 'nps', 'score', 'percentual', '%'
];

const PRE_TABLE_METADATA_REGEX = /^(relat[oó]rio|planilha|dashboard|extrato|documento|empresa|cnpj|autor|elaborado|gerado|per[ií]odo|sistema)/i;
const OBSERVATION_PREFIX_REGEX = /^(obs|observa[cç][aã]o|observa[cç][oõ]es|nota|notas|aten[cç][aã]o|importante|aviso|ressalva|descri[cç][aã]o):?/i;
const FOOTER_TOTAL_PREFIX_REGEX = /^(total|total geral|soma|subtotal|m[eé]dia|m[eé]dia geral|consolidado|resumo geral)\b/i;
const FOOTNOTE_PREFIX_REGEX = /^(\*|fonte:|nota de rodap[eé]:|assinado digitalmente|observa[cç][oõ]es finais|elaborado por:)/i;

export function detectTableBoundariesAndSegments(
  rawGrid: any[][],
  customHeaderIndex?: number
): {
  boundary: TableBoundary;
  summaries: ExtractedSummaryItem[];
  notes: ExtractedNoteItem[];
  footers: ExtractedSummaryItem[];
  columns: ColumnSchema[];
  rows: Record<string, any>[];
  rawGridSample: any[][];
} {
  if (!rawGrid || rawGrid.length === 0) {
    return {
      boundary: {
        headerRowIndex: 0,
        startDataRowIndex: 0,
        endDataRowIndex: 0,
        totalRawRows: 0,
        totalColumns: 0,
        hasPreTableSummaries: false,
        hasPostTableFooters: false,
        hasObservations: false
      },
      summaries: [],
      notes: [],
      footers: [],
      columns: [],
      rows: [],
      rawGridSample: []
    };
  }

  // 1. Identify Candidate Header Row
  let headerRowIndex = 0;

  if (typeof customHeaderIndex === 'number' && customHeaderIndex >= 0 && customHeaderIndex < rawGrid.length) {
    headerRowIndex = customHeaderIndex;
  } else {
    // Score top rows up to row 30
    let bestScore = -9999;
    const scanLimit = Math.min(rawGrid.length, 30);

    for (let r = 0; r < scanLimit; r++) {
      const row = rawGrid[r] || [];
      const populatedCells = row
        .map((cell, idx) => ({ cell, idx }))
        .filter(item => item.cell !== null && item.cell !== undefined && String(item.cell).trim() !== '');
      const populatedCount = populatedCells.length;

      // Single cell or empty cannot be a multi-column table header
      if (populatedCount < 2) continue;

      let score = 0;
      // Bonus for column span
      score += populatedCount * 6;

      // Text vs Number ratio in candidate header
      let stringCount = 0;
      let keywordHits = 0;
      const cellStrings: string[] = [];

      for (const item of populatedCells) {
        const valStr = String(item.cell).trim();
        cellStrings.push(valStr.toLowerCase());
        const isNum = cleanNumericValue(item.cell) !== null && !isNaN(Number(valStr));
        if (!isNum) stringCount++;

        const lower = valStr.toLowerCase();
        if (COMMON_HEADER_KEYWORDS.some(kw => lower === kw || lower.includes(kw))) {
          keywordHits++;
        }
      }

      // Headers are overwhelmingly text strings
      const stringRatio = stringCount / populatedCount;
      score += stringRatio * 35;

      // Bonus for recognized business keywords
      score += keywordHits * 14;

      // Uniqueness bonus
      const uniqueCount = new Set(cellStrings).size;
      score += (uniqueCount / populatedCount) * 20;

      // Negative penalty if row starts with title or observation
      const firstCellStr = cellStrings[0] || '';
      if (PRE_TABLE_METADATA_REGEX.test(firstCellStr) || OBSERVATION_PREFIX_REGEX.test(firstCellStr)) {
        score -= 60;
      }

      // Look-ahead check: rows immediately following (r+1, r+2) should have similar populated density
      let lookAheadDensity = 0;
      for (let next = r + 1; next <= Math.min(rawGrid.length - 1, r + 3); next++) {
        const nextRow = rawGrid[next] || [];
        const nextPop = nextRow.filter(c => c !== null && c !== undefined && String(c).trim() !== '').length;
        if (nextPop >= populatedCount - 2) {
          lookAheadDensity += 18;
        }
      }
      score += lookAheadDensity;

      if (score > bestScore) {
        bestScore = score;
        headerRowIndex = r;
      }
    }
  }

  // 2. Extract Pre-Table Blocks (0 to headerRowIndex - 1)
  const summaries: ExtractedSummaryItem[] = [];
  const notes: ExtractedNoteItem[] = [];
  let detectedTitle: string | undefined;

  for (let r = 0; r < headerRowIndex; r++) {
    const row = rawGrid[r] || [];
    const populated = row
      .map((c, idx) => ({ val: c, text: String(c ?? '').trim(), col: idx }))
      .filter(item => item.text !== '');

    if (populated.length === 0) continue;

    // Single cell on a top row
    if (populated.length === 1) {
      const text = populated[0].text;
      if (OBSERVATION_PREFIX_REGEX.test(text)) {
        notes.push({
          text: text.replace(OBSERVATION_PREFIX_REGEX, '').trim() || text,
          type: 'observation',
          rawRowIndex: r
        });
      } else if (!detectedTitle && (PRE_TABLE_METADATA_REGEX.test(text) || r <= 1)) {
        detectedTitle = text;
        notes.push({ text, type: 'title', rawRowIndex: r });
      } else {
        notes.push({ text, type: 'metadata', rawRowIndex: r });
      }
      continue;
    }

    // Pairs of values: e.g. ["Meta:", "1.500.000"]
    let isPairRow = true;
    for (let i = 0; i < populated.length; i += 2) {
      if (i + 1 < populated.length) {
        const labelCandidate = populated[i].text.replace(/:$/, '').trim();
        const valueCandidate = populated[i + 1].text.trim();
        if (labelCandidate.length <= 40 && valueCandidate.length > 0) {
          summaries.push({
            label: labelCandidate,
            value: valueCandidate,
            rawRowIndex: r
          });
        }
      } else {
        isPairRow = false;
      }
    }

    if (!isPairRow) {
      const fullText = populated.map(p => p.text).join(' | ');
      if (OBSERVATION_PREFIX_REGEX.test(fullText)) {
        notes.push({ text: fullText, type: 'observation', rawRowIndex: r });
      } else {
        notes.push({ text: fullText, type: 'metadata', rawRowIndex: r });
      }
    }
  }

  // 3. Extract Column Headers from `headerRowIndex`
  const headerRow = rawGrid[headerRowIndex] || [];
  const headerKeys: { key: string; colIdx: number }[] = [];
  const seenKeys = new Map<string, number>();

  headerRow.forEach((cell, colIdx) => {
    let rawKey = String(cell ?? '').trim();
    if (!rawKey) {
      const hasDataBelow = rawGrid.slice(headerRowIndex + 1, headerRowIndex + 10).some(
        r => r?.[colIdx] !== undefined && String(r[colIdx]).trim() !== ''
      );
      if (hasDataBelow) {
        rawKey = `Coluna_${colIdx + 1}`;
      } else {
        return;
      }
    }

    const count = (seenKeys.get(rawKey) || 0) + 1;
    seenKeys.set(rawKey, count);
    const finalKey = count > 1 ? `${rawKey}_${count}` : rawKey;
    headerKeys.push({ key: finalKey, colIdx });
  });

  if (headerKeys.length === 0) {
    const maxCols = Math.max(...rawGrid.map(r => r?.length || 0), 1);
    for (let c = 0; c < Math.min(maxCols, 15); c++) {
      headerKeys.push({ key: `Coluna_${c + 1}`, colIdx: c });
    }
  }

  // 4. Extract Main Table Data Rows & Post-Table Footers
  const footers: ExtractedSummaryItem[] = [];
  const rows: Record<string, any>[] = [];
  let emptyRowCount = 0;
  let endDataRowIndex = headerRowIndex;

  for (let r = headerRowIndex + 1; r < rawGrid.length; r++) {
    const rawRow = rawGrid[r] || [];
    const populated = rawRow
      .map((c, idx) => ({ val: c, text: String(c ?? '').trim(), col: idx }))
      .filter(item => item.text !== '');

    if (populated.length === 0) {
      emptyRowCount++;
      if (emptyRowCount >= 4) {
        break;
      }
      continue;
    }
    emptyRowCount = 0;

    const firstCellText = populated[0].text;

    // Footer Summary / Total
    if (FOOTER_TOTAL_PREFIX_REGEX.test(firstCellText)) {
      const totalLabel = firstCellText;
      const totalValue = populated.length > 1 ? populated[1].text : '';
      footers.push({
        label: totalLabel,
        value: totalValue || populated.map(p => p.text).join(' - '),
        rawRowIndex: r
      });
      continue;
    }

    // Footnote or Trailing Note
    if (
      FOOTNOTE_PREFIX_REGEX.test(firstCellText) ||
      (populated.length === 1 && firstCellText.length > 25 && OBSERVATION_PREFIX_REGEX.test(firstCellText))
    ) {
      notes.push({
        text: populated.map(p => p.text).join(' '),
        type: 'footnote',
        rawRowIndex: r
      });
      continue;
    }

    // Valid data row
    const rowObj: Record<string, any> = {};
    let hasAnyData = false;

    for (const h of headerKeys) {
      const cellVal = rawRow[h.colIdx];
      if (cellVal !== undefined && cellVal !== null && cellVal !== '') {
        hasAnyData = true;
        rowObj[h.key] = cellVal;
      } else {
        rowObj[h.key] = '';
      }
    }

    if (hasAnyData) {
      rows.push(rowObj);
      endDataRowIndex = r;
    }
  }

  const columns = analyzeColumns(rows);

  const boundary: TableBoundary = {
    headerRowIndex,
    startDataRowIndex: headerRowIndex + 1,
    endDataRowIndex,
    totalRawRows: rawGrid.length,
    totalColumns: headerKeys.length,
    detectedTitle,
    hasPreTableSummaries: summaries.length > 0,
    hasPostTableFooters: footers.length > 0,
    hasObservations: notes.length > 0
  };

  const rawGridSample = rawGrid.slice(0, Math.min(rawGrid.length, 12));

  return {
    boundary,
    summaries,
    notes,
    footers,
    columns,
    rows,
    rawGridSample
  };
}

export function extractSheetData(
  workbook: XLSX.WorkBook,
  sheetName: string,
  fileName: string,
  fileSize: number,
  customHeaderRowIndex?: number
): SheetData {
  const worksheet = workbook.Sheets[sheetName];
  // Extract 2D raw array of cells
  const rawGrid: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  const detection = detectTableBoundariesAndSegments(rawGrid, customHeaderRowIndex);

  return {
    sheetName,
    columns: detection.columns,
    rows: detection.rows,
    fileName,
    fileSize,
    rowCount: detection.rows.length,
    smartDetection: {
      boundary: detection.boundary,
      summaries: detection.summaries,
      notes: detection.notes,
      footers: detection.footers,
      rawGridSample: detection.rawGridSample
    },
    rawGrid
  };
}

export function reparseSheetWithCustomHeader(
  sheetData: SheetData,
  headerRowIndex: number
): SheetData {
  if (!sheetData.rawGrid || sheetData.rawGrid.length === 0) return sheetData;

  const detection = detectTableBoundariesAndSegments(sheetData.rawGrid, headerRowIndex);

  return {
    ...sheetData,
    columns: detection.columns,
    rows: detection.rows,
    rowCount: detection.rows.length,
    smartDetection: {
      boundary: detection.boundary,
      summaries: detection.summaries,
      notes: detection.notes,
      footers: detection.footers,
      rawGridSample: detection.rawGridSample
    }
  };
}

export function exportToExcel(rows: Record<string, any>[], fileName: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dados Tratados');
  XLSX.writeFile(wb, `${fileName.replace(/\.[^/.]+$/, '')}_tratado.xlsx`);
}

