
async function calculateBERTScoreAPI(reference, candidate, lang = 'en', backendUrl = 'http://localhost:5000') {
  try {
    const response = await fetch(`${backendUrl}/bertscore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference, candidate, lang })
    });
    if (!response.ok) throw new Error('BERTScore backend error');
    const data = await response.json();
    return {
      precision: (data.precision * 100).toFixed(2),
      recall: (data.recall * 100).toFixed(2),
      f1: (data.f1 * 100).toFixed(2)
    };
  } catch (error) {
    console.error('BERTScore error:', error);
    return null;
  }
}


async function calculateCOMETAPI(source, reference, candidate, backendUrl = 'http://localhost:5000') {
  try {
    const response = await fetch(`${backendUrl}/comet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, reference, candidate })
    });
    if (!response.ok) throw new Error('COMET backend error');
    const data = await response.json();
    return data.score.toFixed(4);
  } catch (error) {
    console.error('COMET error:', error);
    return null;
  }
}


async function calculateCOMETQEAPI(source, candidate, backendUrl = 'http://localhost:5000') {
  try {
    const response = await fetch(`${backendUrl}/comet-qe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, candidate })
    });
    if (!response.ok) throw new Error('COMET-QE backend error');
    const data = await response.json();
    return data.score.toFixed(4);
  } catch (error) {
    console.error('COMET-QE error:', error);
    return null;
  }
}


async function calculateNeuralMetricsBatchAPI(pairs, metricsToCalc, backendUrl = 'http://localhost:5000') {
  try {
    const response = await fetch(`${backendUrl}/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairs, metrics: metricsToCalc })
    });
    if (!response.ok) throw new Error('Batch neural metrics error');
    return await response.json();
  } catch (error) {
    console.error('Batch neural metrics error:', error);
    return null;
  }
}


async function evaluateWithLLMAPI(original, translation, fromLang, toLang, evaluatorKey, evaluatorModel, availableModels, calculateCostFn) {
  const startTime = Date.now();
  

  const hasEvaluatorKey = evaluatorKey && evaluatorKey.trim() !== '';
  
  if (!hasEvaluatorKey) {
    return null; 
  }

  const evaluatorPrompt = `You are a professional translation quality evaluator. Evaluate the following translation on a scale of 1-10 for:
1. Fluency (grammar, naturalness, readability)
2. Adequacy (meaning preservation, completeness)
3. Overall quality

Original text (${fromLang}):
${original}

Translation (${toLang}):
${translation}

Respond ONLY with a valid JSON object in this exact format (no other text):
{
  "fluency": 8.5,
  "adequacy": 9.0,
  "overall": 8.7,
  "feedback": "Brief explanation of the scores"
}`;

  try {
    let res, data, usage;
    const isAnthropicKey = evaluatorKey.startsWith('sk-ant-');
    
    if (isAnthropicKey) {
      const model = availableModels.find(m => m.id === evaluatorModel);
      if (!model) {
        throw new Error(`Evaluator model ${evaluatorModel} not found`);
      }
      res = await fetch("/translate/anthropic", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: evaluatorPrompt,
          api_key: evaluatorKey,
          model: model.model,
          system_prompt: "You are a professional translation quality evaluator.",
          temperature: 0.3,
          max_tokens: 1000
        })
      });
      
      const endTime = Date.now();
      const timeMs = endTime - startTime;
      
      data = await res.json();
      usage = data.usage;
      let responseText = data.translation;
      

      responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      const evaluation = JSON.parse(responseText);
      const cost = calculateCostFn(model, evaluatorPrompt, responseText, usage);
      
      return {
        score: evaluation.overall?.toFixed(1) || 'N/A',
        fluency: evaluation.fluency?.toFixed(1) || 'N/A',
        adequacy: evaluation.adequacy?.toFixed(1) || 'N/A',
        feedback: evaluation.feedback || '',
        time: timeMs,
        cost: cost
      };
    } else {
      // Assume OpenAI or DeepSeek key if not Anthropic
      const isDeepSeekKey = evaluatorModel.includes('deepseek');
      const modelName = isDeepSeekKey ? evaluatorModel : 'gpt-4o';
      
      res = await fetch(isDeepSeekKey ? '/translate/deepseek' : '/translate/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: evaluatorPrompt,
          api_key: evaluatorKey,
          model: modelName,
          system_prompt: "You are a professional translation quality evaluator.",
          temperature: 0.3,
          max_tokens: 1000
        })
      });
      
      const endTime = Date.now();
      const timeMs = endTime - startTime;
      
      data = await res.json();
      usage = data.usage;
      let responseText = data.translation;
      responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      const evaluation = JSON.parse(responseText);
      const pseudoModel = { provider: isDeepSeekKey ? 'deepseek' : 'openai', model: modelName, id: modelName };
      const cost = calculateCostFn(pseudoModel, evaluatorPrompt, responseText, usage);
      
      return {
        score: evaluation.overall?.toFixed(1) || 'N/A',
        fluency: evaluation.fluency?.toFixed(1) || 'N/A',
        adequacy: evaluation.adequacy?.toFixed(1) || 'N/A',
        feedback: evaluation.feedback || '',
        time: timeMs,
        cost: cost
      };
    }
  } catch (error) {
    console.error('LLM evaluation error:', error);
    return {
      score: 'Error',
      fluency: 'Error',
      adequacy: 'Error',
      feedback: `LLM evaluation failed: ${error.message}`,
      time: Date.now() - startTime,
      cost: 0
    };
  }
}


// Build translation prompt
function buildTranslationPrompt(fromLang, toLang, languages, systemPrompt, styleInstructions, customPrompt = null) {
  const fromName = languages.find(l => l.code === fromLang)?.name || fromLang;
  const toName = languages.find(l => l.code === toLang)?.name || toLang;
  
  if (customPrompt) {
    if (customPrompt.includes('Translate from') || customPrompt.includes('translate from')) {
      return `${customPrompt}\n\nIMPORTANT: Output ONLY the translated text. Do not add explanations, notes, commentary, or meta-discussion about the translation.`;
    }
    return `${customPrompt}\n\nTranslate from ${fromName} to ${toName}.\n\nIMPORTANT: Output ONLY the translated text. Do not add explanations, notes, commentary, or meta-discussion about the translation.`;
  }
  
  // Build default prompt
  let prompt = systemPrompt;
  if (styleInstructions) {
    prompt += `\n\n${styleInstructions}`;
  }
  prompt += `\n\nTranslate from ${fromName} to ${toName}.\n\nIMPORTANT: Output ONLY the translated text. Do not add explanations, notes, commentary, or meta-discussion about the translation.`;
  return prompt;
}
