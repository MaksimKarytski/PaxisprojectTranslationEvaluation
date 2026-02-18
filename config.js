

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' }
];

const AVAILABLE_MODELS = [
  // Anthropic
  { id: 'claude-opus-4.5', name: 'Claude Opus 4.5', provider: 'anthropic', model: 'claude-opus-4-5-20251101', supportsPrompts: true, cost: 'high' },
  { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', supportsPrompts: true, cost: 'medium' },
  { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5', provider: 'anthropic', model: 'claude-haiku-4-5-20251001', supportsPrompts: true, cost: 'low' },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'anthropic', model: 'claude-sonnet-4-20250514', supportsPrompts: true, cost: 'medium' },
  // OpenAI
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', model: 'gpt-4o', supportsPrompts: true, cost: 'medium' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', model: 'gpt-4o-mini', supportsPrompts: true, cost: 'low' },
  // DeepSeek
  { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', model: 'deepseek-chat', supportsPrompts: true, cost: 'very-low' },
  // API services
  { id: 'deepl', name: 'DeepL', provider: 'deepl', model: 'deepl', supportsPrompts: false, cost: 'low' },
  { id: 'google', name: 'Google Translate', provider: 'google', model: 'google-translate', supportsPrompts: false, cost: 'low' },
  // Local models
  { id: 'argos', name: '🖥️ Argos Translate', provider: 'argos', model: 'argos', supportsPrompts: false, cost: 'free', local: true },
  { id: 'nllb-200', name: '🖥️ NLLB-200 (Meta)', provider: 'nllb', model: 'nllb-200', supportsPrompts: false, cost: 'free', local: true },
  { id: 'opus-mt', name: '🖥️ OPUS-MT (Helsinki)', provider: 'opus', model: 'opus-mt', supportsPrompts: false, cost: 'free', local: true }
];

const MODEL_PRICING = {
  // Anthropic ($ per 1M tokens)
  'claude-opus-4-5-20251101': { input: 15.00, output: 75.00 },
  'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },
  'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },
  'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
  // OpenAI
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  // DeepSeek
  'deepseek-chat': { input: 0.14, output: 0.28 },
  // Fixed cost ($ per 1M chars)
  'deepl': { input: 0, output: 0, fixedCostPerMChar: 20 },
  'google-translate': { input: 0, output: 0, fixedCostPerMChar: 20 },
  // Local (free)
  'argos': { input: 0, output: 0 },
  'nllb-200': { input: 0, output: 0 },
  'opus-mt': { input: 0, output: 0 }
};

const DEFAULT_METRIC_WEIGHTS = {
  bleu: 10, meteor: 10, cer: 5, wer: 5, jaccard: 5, chrf: 10, lengthRatio: 5, bertScore: 20, comet: 15, bleurt: 15
};

const DEFAULT_NOREF_WEIGHTS = {
  repetition: 10, numberPres: 15, copyRate: 10, lengthRatio: 5, llmScore: 30, cometQE: 30
};

const METRIC_DESCRIPTIONS = {
  bleu: "BLEU - N-gram precision. Higher is better. Excellent: >60, Good: >40",
  meteor: "METEOR - Considers synonyms and stemming. Higher is better. Excellent: >50, Good: >30",
  cer: "CER - Character Error Rate. Lower is better. Excellent: <10%, Good: <20%",
  wer: "WER - Word Error Rate. Lower is better. Excellent: <15%, Good: <30%",
  jaccard: "Jaccard - Word overlap. Higher is better",
  chrf: "chrF - Character n-gram F-score. Higher is better",
  lengthRatio: "Length Ratio - Closer to 100% is better",
  total: "Total Score - Weighted combination. Higher is better",
  bertScore: "BERTScore - Semantic similarity. Higher is better. Requires Python backend",
  comet: "COMET - Neural MT metric. Higher is better. Requires Python backend",
  cometQE: "COMET-QE - Quality Estimation without reference. Higher is better",
  score: "LLM Overall Score - Quality assessment 1-10. Higher is better",
  fluency: "Fluency - Grammatical correctness 1-10",
  adequacy: "Adequacy - Meaning preservation 1-10",
  repetition: "Repetition Ratio - Lower is better (hallucination detector)",
  numberPres: "Number Preservation - Higher is better (100% = perfect)",
  copyRate: "Copy Rate - Context-dependent (5-25% is often optimal)"
};

const METRICS_INFO = {
  bleu: { name: 'BLEU', betterDirection: 'higher', excellent: 60, good: 40, poor: 20 },
  meteor: { name: 'METEOR', betterDirection: 'higher', excellent: 50, good: 30, poor: 15 },
  total: { name: 'Total', betterDirection: 'higher', excellent: 70, good: 50, poor: 30 },
  cer: { name: 'CER', betterDirection: 'lower', excellent: 10, good: 20, poor: 30 },
  wer: { name: 'WER', betterDirection: 'lower', excellent: 15, good: 30, poor: 50 },
  jaccard: { name: 'Jaccard', betterDirection: 'higher', excellent: 75, good: 60, poor: 40 },
  chrF: { name: 'chrF', betterDirection: 'higher', excellent: 75, good: 60, poor: 40 },
  lengthRatio: { name: 'Length Ratio', betterDirection: 'optimal', excellent: [90, 110], good: [80, 120], poor: [70, 130] },
  repetition: { name: 'Repetition', betterDirection: 'lower', excellent: 5, good: 15, poor: 25 },
  numberPres: { name: 'Numbers', betterDirection: 'higher', excellent: 100, good: 80, poor: 50 },
  bertScore: { name: 'BERTScore', betterDirection: 'higher', excellent: 90, good: 80, poor: 70 },
  comet: { name: 'COMET', betterDirection: 'higher', excellent: 0.85, good: 0.75, poor: 0.60 },
  cometQE: { name: 'COMET-QE', betterDirection: 'higher', excellent: 0.3, good: 0.2, poor: 0.0 },
  score: { name: 'Overall', betterDirection: 'higher', excellent: 8.5, good: 7.0, poor: 5.0 },
  fluency: { name: 'Fluency', betterDirection: 'higher', excellent: 8.5, good: 7.0, poor: 5.0 },
  adequacy: { name: 'Adequacy', betterDirection: 'higher', excellent: 8.5, good: 7.0, poor: 5.0 }
};

const DEFAULT_SYSTEM_PROMPT = 'You are a professional translator. Provide ONLY the translation, no explanations or commentary.';
const DEFAULT_STYLE_INSTRUCTIONS = 'Output ONLY the translated text. Do not add explanations, notes, alternatives, or meta-commentary.';
const DEFAULT_EVALUATOR_MODEL = 'deepseek-chat';
const DEFAULT_PYTHON_BACKEND_URL = 'http://localhost:5001';

function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}

function calculateCost(model, inputText, outputText, usage = null) {
  const modelId = model.model || model.id;
  const pricing = MODEL_PRICING[modelId];
  
  if (!pricing) {
    if (model.provider === 'anthropic') {
      const inputTokens = usage?.input_tokens || estimateTokens(inputText);
      const outputTokens = usage?.output_tokens || estimateTokens(outputText);
      return ((inputTokens * 3.00 + outputTokens * 15.00) / 1000000) * 100;
    } else if (model.provider === 'openai') {
      const inputTokens = usage?.prompt_tokens || estimateTokens(inputText);
      const outputTokens = usage?.completion_tokens || estimateTokens(outputText);
      return ((inputTokens * 2.50 + outputTokens * 10.00) / 1000000) * 100;
    }
    return 0;
  }
  
  if (pricing.fixedCostPerMChar) {
    const charCount = inputText?.length || 0;
    return (charCount / 1000000) * pricing.fixedCostPerMChar * 100;
  }
  
  const inputTokens = usage?.input_tokens || usage?.prompt_tokens || estimateTokens(inputText);
  const outputTokens = usage?.output_tokens || usage?.completion_tokens || estimateTokens(outputText);
  return ((inputTokens * pricing.input + outputTokens * pricing.output) / 1000000) * 100;
}

function getMetricColorClass(metric, value) {
  const info = METRICS_INFO[metric];
  if (!info) return 'bg-gray-100 text-gray-800';
  
  const numValue = parseFloat(value);
  if (isNaN(numValue) || !isFinite(numValue)) return 'bg-red-300 text-red-900';
  
  if (info.betterDirection === 'higher') {
    if (numValue >= info.excellent) return 'bg-green-600 text-white';
    if (numValue >= info.good) return 'bg-green-400 text-white';
    if (numValue >= info.poor) return 'bg-yellow-400 text-gray-800';
    return 'bg-red-400 text-white';
  } else if (info.betterDirection === 'lower') {
    if (numValue <= info.excellent) return 'bg-green-600 text-white';
    if (numValue <= info.good) return 'bg-green-400 text-white';
    if (numValue <= info.poor) return 'bg-yellow-400 text-gray-800';
    return 'bg-red-400 text-white';
  } else if (info.betterDirection === 'optimal') {
    const [excMin, excMax] = info.excellent;
    const [goodMin, goodMax] = info.good;
    if (numValue >= excMin && numValue <= excMax) return 'bg-green-600 text-white';
    if (numValue >= goodMin && numValue <= goodMax) return 'bg-green-400 text-white';
    return 'bg-yellow-400 text-gray-800';
  }
  
  return 'bg-gray-100 text-gray-800';
}
