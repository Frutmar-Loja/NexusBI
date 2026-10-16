import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI server-side with required User-Agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// API endpoint for AI-powered Executive Insights with causal reasoning
app.post('/api/insights/generate', async (req, res) => {
  try {
    const {
      archetypeLabel,
      activeFilters,
      activeMetricLabel,
      kpis,
      topSegments,
      timelineTrend,
      anomaliesInfo,
      sampleRecords
    } = req.body;

    const hasApiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');

    if (!hasApiKey) {
      return res.status(200).json({
        insights: null,
        message: 'Chave Gemini não configurada no servidor, utilizando motor heurístico nativo.'
      });
    }

    const prompt = `Você é um diretor executivo sênior de Business Intelligence e Auditoria de Dados.
Analise os dados desta planilha e gere insights executivos rigorosamente BASEADOS NOS DADOS, substituindo qualquer alerta genérico por observações verificáveis e relevantes ao negócio (em português do Brasil).

DADOS DO DASHBOARD:
- Arquétipo da Planilha: ${archetypeLabel}
- Métrica em Foco: ${activeMetricLabel}
- Filtros Cruzados Ativos aplicados pelo usuário: ${JSON.stringify(activeFilters)}
- KPIs Atuais: ${JSON.stringify(kpis)}
- Principais Segmentos da Seleção: ${JSON.stringify(topSegments)}
- Tendência Cronológica Recente: ${JSON.stringify(timelineTrend)}
- Anomalias / Desvios Estatísticos: ${JSON.stringify(anomaliesInfo)}
- Amostra dos Registros: ${JSON.stringify(sampleRecords)}

DIRETRIZES FUNDAMENTAIS:
1. RIGOR SEMÂNTICO EM DATAS E CRESCIMENTO COMERCIAL:
   - JAMAIS confunda Data de Nascimento ou Fundação da empresa com data de cadastro, adesão ou crescimento de vendas. Nascimento e fundação são atributos demográficos da entidade/pessoa física, NÃO representam aquisição de novos clientes ou expansão da sua carteira comercial.
   - Se os dados contiverem apenas nascimento ou fundação, analise a maturidade/idade média da carteira em vez de afirmar falsamente "crescimento de clientes".
2. RIGOR NA SITUAÇÃO CADASTRAL vs. VALIDAÇÃO DOCUMENTAL / FISCAL:
   - Uma coluna com valor "Ativo" ou "Regular" reflete unicamente o STATUS OPERACIONAL da conta no sistema interno (CRM/ERP).
   - JAMAIS afirme que os clientes estão "regulares e sem pendências", "sem pendências fiscais" ou "livres de pendências de migração" unicamente porque a coluna de status contém "Ativo".
   - Diferencie explicitamente Situação Cadastral (status do registro operacional) de Validação Documental (conferência de documentos, contratos assinados, certidões negativas, Sintegra, Receita Federal).
   - Se a planilha não possuir colunas dedicadas de auditoria documental externa ou certidão fiscal, ressalte com clareza que o status "Ativo" é interno e que a conformidade fiscal e documental depende de validação independente.
3. SUBSTITUA ALERTAS GENÉRICOS POR OBSERVAÇÕES VERIFICÁVEIS:
   - PROIBIDO usar clichês vagos como "na maioria das vezes isso ocorre por..." ou tutoriais de interface como "experimente clicar nas barras...".
   - CITE números exatos dos dados (quantidades reais de clientes, porcentagens calculadas, nomes de estados/segmentos/produtos específicos, valores em R$).
4. IDENTIFIQUE CAUSALIDADE E IMPACTO REAL NO NEGÓCIO:
   - Se houver filtros cruzados ou segmentos líderes, explique O QUE esse corte revela e qual a consequência prática na operação ou no faturamento.
   - Destaque pendências, riscos de ruptura ou gargalos com números comprováveis.
5. SEPARAÇÃO RIGOROSA EM TRÊS CATEGORIAS OBRIGATÓRIAS (category):
   - 'verified_fact' (Fatos Verificados): observações estritamente comprovadas pelos números da planilha. PROIBIDO fazer suposições comerciais aqui. Por exemplo: a concentração em Goiás (88,4%) é um fato estatístico; afirmar que 'representa oportunidade de expansão' é uma hipótese comercial e JAMAIS deve ser tratada como fato.
   - 'quality_alert' (Alertas de Qualidade): pendências cadastrais, campos nulos/vazios, ausência de validação fiscal externa (ex: Sintegra/Receita), documentos incompletos, anomalias e integridade de governança.
   - 'suggested_opportunity' (Oportunidades Sugeridas): hipóteses comerciais, estratégias de expansão e sugestões de processos. DEVE ser redigida explicitamente como uma HIPÓTESE comercial a ser validada pela diretoria (ex: "Hipótese Comercial: Avaliar viabilidade de expansão interestadual..."). Defina isHypothesis: true e inclua hypothesisDisclaimer.

ESTRUTURA DOS INSIGHTS (crie de 4 a 6 insights balanceados cobrindo as 3 categorias):
- Pelo menos 2 'verified_fact'
- Pelo menos 1 'quality_alert'
- Pelo menos 1 'suggested_opportunity'`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              category: {
                type: Type.STRING,
                description: 'verified_fact | quality_alert | suggested_opportunity'
              },
              type: { type: Type.STRING, description: 'highlight | trend | risk | recommendation' },
              title: { type: Type.STRING, description: 'Título curto e objetivo com métrica (máx 6 palavras)' },
              description: { type: Type.STRING, description: 'Explicação precisa e fundamentada (2 a 3 frases)' },
              metricBadge: { type: Type.STRING, description: 'Selo com métrica verificável, percentual ou tag de hipótese' },
              importance: { type: Type.STRING, description: 'high | medium' },
              evidence: { type: Type.STRING, description: 'Fonte ou fórmula comprovável nos dados' },
              verifiableFacts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Fatos numéricos exatos comprovados'
              },
              actionableStep: { type: Type.STRING, description: 'Passo prático recomendado' },
              businessImpact: { type: Type.STRING, description: 'Impacto concreto para a diretoria ou operação' },
              isHypothesis: { type: Type.BOOLEAN, description: 'True se for hipótese comercial sugerida' },
              hypothesisDisclaimer: { type: Type.STRING, description: 'Aviso de hipótese comercial não comprovada pela planilha' }
            },
            required: ['id', 'category', 'type', 'title', 'description', 'importance']
          }
        }
      }
    });

    const insightsText = response.text?.trim() || '[]';
    const parsedInsights = JSON.parse(insightsText);

    return res.json({ insights: parsedInsights });
  } catch (err: any) {
    console.error('Gemini Insights generation error:', err);
    return res.status(500).json({ error: err.message || 'Falha ao processar com Gemini' });
  }
});

// Vite middleware for development; static serve for production
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(port, '0.0.0.0', () => {
  console.log(`NexusBI server running on http://0.0.0.0:${port}`);
});
