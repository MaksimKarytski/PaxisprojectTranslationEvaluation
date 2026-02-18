

function levenshteinDistance(a, b) {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(matrix[j - 1][i] + 1, matrix[j][i - 1] + 1, matrix[j - 1][i - 1] + cost);
    }
  }
  return matrix[b.length][a.length];
}

function calculateBLEU(reference, candidate) {
  const refTokens = reference.toLowerCase().match(/\b\w+\b/g) || [];
  const candTokens = candidate.toLowerCase().match(/\b\w+\b/g) || [];
  if (candTokens.length === 0) return "0.00";
  
  const ngramPrecisions = [];
  for (let n = 1; n <= 4; n++) {
    const refNgrams = {}, candNgrams = {};
    for (let i = 0; i <= refTokens.length - n; i++) {
      const ngram = refTokens.slice(i, i + n).join(' ');
      refNgrams[ngram] = (refNgrams[ngram] || 0) + 1;
    }
    for (let i = 0; i <= candTokens.length - n; i++) {
      const ngram = candTokens.slice(i, i + n).join(' ');
      candNgrams[ngram] = (candNgrams[ngram] || 0) + 1;
    }
    let matches = 0, total = 0;
    for (const ngram in candNgrams) {
      total += candNgrams[ngram];
      if (refNgrams[ngram]) matches += Math.min(candNgrams[ngram], refNgrams[ngram]);
    }
    ngramPrecisions.push(total > 0 ? matches / total : 0);
  }
  
  const logSum = ngramPrecisions.reduce((sum, p) => sum + Math.log(p + 1e-10), 0);
  const geometricMean = Math.exp(logSum / 4);
  const brevityPenalty = Math.min(1, Math.exp(1 - refTokens.length / candTokens.length));
  return (geometricMean * brevityPenalty * 100).toFixed(2);
}

function calculateCER(reference, candidate) {
  if (reference.length === 0) return "0.00";
  const distance = levenshteinDistance(reference, candidate);
  return Math.min(200, (distance / reference.length) * 100).toFixed(2);
}

function calculateWER(reference, candidate) {
  const refWords = reference.toLowerCase().match(/\b\w+\b/g) || [];
  const candWords = candidate.toLowerCase().match(/\b\w+\b/g) || [];
  if (refWords.length === 0) return "0.00";
  const distance = levenshteinDistance(refWords, candWords);
  return Math.min(200, (distance / refWords.length) * 100).toFixed(2);
}

const defaultSynonymGroups = {
  en: [
    ['go', 'walk', 'move', 'travel', 'proceed'],
    ['say', 'tell', 'speak', 'talk', 'state', 'declare'],
    ['think', 'believe', 'consider', 'suppose', 'assume'],
    ['know', 'understand', 'realize', 'recognize', 'comprehend'],
    ['big', 'large', 'huge', 'enormous', 'vast', 'massive'],
    ['small', 'little', 'tiny', 'minute', 'compact'],
    ['good', 'great', 'excellent', 'fine', 'wonderful'],
    ['bad', 'poor', 'terrible', 'awful', 'horrible'],
    ['fast', 'quick', 'rapid', 'swift', 'speedy'],
    ['happy', 'glad', 'joyful', 'pleased', 'delighted'],
    ['important', 'significant', 'crucial', 'vital', 'essential'],
    ['difficult', 'hard', 'challenging', 'tough', 'complex'],
    ['easy', 'simple', 'straightforward', 'effortless']
  ],
  de: [
    ['gehen', 'laufen', 'wandern', 'schreiten'],
    ['sagen', 'sprechen', 'reden', 'erzählen'],
    ['groß', 'riesig', 'enorm', 'gewaltig'],
    ['klein', 'winzig', 'gering', 'kompakt'],
    ['gut', 'prima', 'toll', 'ausgezeichnet'],
    ['schlecht', 'schlimm', 'übel', 'furchtbar'],
    ['schnell', 'rasch', 'zügig', 'flott']
  ],
  ru: [
    ['идти', 'ходить', 'шагать', 'двигаться'],
    ['говорить', 'сказать', 'рассказать', 'произнести'],
    ['большой', 'крупный', 'огромный', 'громадный'],
    ['маленький', 'небольшой', 'мелкий', 'крошечный'],
    ['хороший', 'отличный', 'прекрасный'],
    ['плохой', 'скверный', 'ужасный'],
    ['быстрый', 'скорый', 'стремительный']
  ]
};

function getSynonymGroups() {
  return window.synonymGroups || defaultSynonymGroups;
}

function buildSynonymMap(lang) {
  const synonymGroups = getSynonymGroups();
  const map = new Map();
  const groups = synonymGroups[lang] || synonymGroups['en'] || [];
  groups.forEach((group) => {
    group.forEach(word => {
      const lower = word.toLowerCase();
      if (!map.has(lower)) map.set(lower, new Set());
      group.forEach(syn => map.get(lower).add(syn.toLowerCase()));
    });
  });
  return map;
}

function areSynonyms(word1, word2, synonymMap) {
  const w1 = word1.toLowerCase(), w2 = word2.toLowerCase();
  if (w1 === w2) return true;
  const syns = synonymMap.get(w1);
  return syns ? syns.has(w2) : false;
}

function calculateMETEOR(reference, candidate, lang = 'en') {
  const refTokens = reference.toLowerCase().match(/\b\w+\b/g) || [];
  const candTokens = candidate.toLowerCase().match(/\b\w+\b/g) || [];
  if (refTokens.length === 0 || candTokens.length === 0) return "0.00";
  
  const synonymMap = buildSynonymMap(lang);
  const refMatched = new Set(), candMatched = new Set();
  
  candTokens.forEach((cToken, cIdx) => {
    refTokens.forEach((rToken, rIdx) => {
      if (!refMatched.has(rIdx) && !candMatched.has(cIdx) && cToken === rToken) {
        refMatched.add(rIdx); candMatched.add(cIdx);
      }
    });
  });
  
  candTokens.forEach((cToken, cIdx) => {
    if (candMatched.has(cIdx)) return;
    refTokens.forEach((rToken, rIdx) => {
      if (!refMatched.has(rIdx) && !candMatched.has(cIdx) && areSynonyms(cToken, rToken, synonymMap)) {
        refMatched.add(rIdx); candMatched.add(cIdx);
      }
    });
  });
  
  const matches = candMatched.size;
  if (matches === 0) return "0.00";
  
  const precision = matches / candTokens.length;
  const recall = matches / refTokens.length;
  const fMean = (10 * precision * recall) / (9 * precision + recall);
  
  let chunks = 0, lastRefIdx = -2;
  [...refMatched].sort((a, b) => a - b).forEach(idx => {
    if (idx !== lastRefIdx + 1) chunks++;
    lastRefIdx = idx;
  });
  const fragPenalty = 0.5 * Math.pow(chunks / matches, 3);
  return (fMean * (1 - fragPenalty) * 100).toFixed(2);
}

function calculateJaccard(reference, candidate) {
  const refWords = new Set(reference.toLowerCase().match(/\b\w+\b/g) || []);
  const candWords = new Set(candidate.toLowerCase().match(/\b\w+\b/g) || []);
  if (refWords.size === 0 && candWords.size === 0) return "100.00";
  const intersection = new Set([...refWords].filter(x => candWords.has(x)));
  const union = new Set([...refWords, ...candWords]);
  return ((intersection.size / union.size) * 100).toFixed(2);
}

function calculateChrF(reference, candidate, n = 6, beta = 2) {
  const getCharNgrams = (text, n) => {
    const ngrams = {}, cleaned = text.toLowerCase().replace(/\s+/g, ' ');
    for (let i = 0; i <= cleaned.length - n; i++) {
      const ngram = cleaned.substring(i, i + n);
      ngrams[ngram] = (ngrams[ngram] || 0) + 1;
    }
    return ngrams;
  };
  
  let totalPrecision = 0, totalRecall = 0, count = 0;
  for (let order = 1; order <= n; order++) {
    const refNgrams = getCharNgrams(reference, order);
    const candNgrams = getCharNgrams(candidate, order);
    let matches = 0, candTotal = 0, refTotal = 0;
    for (const ngram in candNgrams) {
      candTotal += candNgrams[ngram];
      if (refNgrams[ngram]) matches += Math.min(candNgrams[ngram], refNgrams[ngram]);
    }
    for (const ngram in refNgrams) refTotal += refNgrams[ngram];
    if (candTotal > 0 && refTotal > 0) {
      totalPrecision += matches / candTotal;
      totalRecall += matches / refTotal;
      count++;
    }
  }
  
  if (count === 0) return "0.00";
  const avgPrecision = totalPrecision / count, avgRecall = totalRecall / count;
  if (avgPrecision + avgRecall === 0) return "0.00";
  const fScore = (1 + beta * beta) * avgPrecision * avgRecall / (beta * beta * avgPrecision + avgRecall);
  return (fScore * 100).toFixed(2);
}

function calculateLengthRatio(reference, candidate) {
  if (reference.length === 0) return "100.00";
  return ((candidate.length / reference.length) * 100).toFixed(2);
}

function calculateRepetitionRatio(text, n = 3) {
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  if (words.length < n * 2) return "0.00";
  const ngrams = {};
  let total = 0, repeated = 0;
  for (let i = 0; i <= words.length - n; i++) {
    const ngram = words.slice(i, i + n).join(' ');
    if (ngrams[ngram]) repeated++;
    ngrams[ngram] = (ngrams[ngram] || 0) + 1;
    total++;
  }
  return ((repeated / total) * 100).toFixed(2);
}

function calculateNumberPreservation(original, translation) {
  const extractNumbers = (text) => (text.match(/\d+([.,]\d+)?/g) || []).map(n => n.replace(',', '.')).sort();
  const origNums = extractNumbers(original), transNums = extractNumbers(translation);
  if (origNums.length === 0) return { preserved: 100, missing: 0, extra: transNums.length };
  
  let preserved = 0;
  const transCopy = [...transNums];
  origNums.forEach(num => {
    const idx = transCopy.indexOf(num);
    if (idx !== -1) { preserved++; transCopy.splice(idx, 1); }
  });
  return { preserved: ((preserved / origNums.length) * 100).toFixed(1), missing: origNums.length - preserved, extra: transCopy.length };
}

function calculateCopyRate(original, translation) {
  const origWords = new Set((original.toLowerCase().match(/\b\w{3,}\b/g) || []));
  const transWords = translation.toLowerCase().match(/\b\w{3,}\b/g) || [];
  if (transWords.length === 0) return "0.00";
  return ((transWords.filter(w => origWords.has(w)).length / transWords.length) * 100).toFixed(2);
}

function calculateBasicStats(text) {
  return {
    charCount: text.length,
    charNoSpace: text.replace(/\s/g, '').length,
    wordCount: (text.match(/\b\w+\b/g) || []).length,
    sentenceCount: (text.match(/[.!?。？！]+/g) || []).length || 1
  };
}

function calculateTotalScore(metrics, metricWeights) {
  let totalWeight = 0, weightedSum = 0;
  
  if (metrics.bleu !== undefined && metricWeights.bleu > 0) {
    weightedSum += (parseFloat(metrics.bleu) || 0) * metricWeights.bleu;
    totalWeight += metricWeights.bleu;
  }
  if (metrics.meteor !== undefined && metricWeights.meteor > 0) {
    weightedSum += (parseFloat(metrics.meteor) || 0) * metricWeights.meteor;
    totalWeight += metricWeights.meteor;
  }
  if (metrics.cer !== undefined && metricWeights.cer > 0) {
    weightedSum += Math.max(0, 100 - (parseFloat(metrics.cer) || 0)) * metricWeights.cer;
    totalWeight += metricWeights.cer;
  }
  if (metrics.wer !== undefined && metricWeights.wer > 0) {
    weightedSum += Math.max(0, 100 - (parseFloat(metrics.wer) || 0)) * metricWeights.wer;
    totalWeight += metricWeights.wer;
  }
  if (metrics.jaccard !== undefined && metricWeights.jaccard > 0) {
    weightedSum += (parseFloat(metrics.jaccard) || 0) * metricWeights.jaccard;
    totalWeight += metricWeights.jaccard;
  }
  if (metrics.chrF !== undefined && metricWeights.chrf > 0) {
    weightedSum += (parseFloat(metrics.chrF) || 0) * metricWeights.chrf;
    totalWeight += metricWeights.chrf;
  }
  if (metrics.lengthRatio !== undefined && metricWeights.lengthRatio > 0) {
    const deviation = Math.abs((parseFloat(metrics.lengthRatio) || 100) - 100);
    weightedSum += Math.max(0, 100 - deviation * 2) * metricWeights.lengthRatio;
    totalWeight += metricWeights.lengthRatio;
  }
  if (metrics.bertScore !== undefined && metrics.bertScore !== 'N/A' && metricWeights.bertScore > 0) {
    weightedSum += (parseFloat(metrics.bertScore) || 0) * metricWeights.bertScore;
    totalWeight += metricWeights.bertScore;
  }
  if (metrics.comet !== undefined && metrics.comet !== 'N/A' && metricWeights.comet > 0) {
    weightedSum += ((parseFloat(metrics.comet) || 0) * 100) * metricWeights.comet;
    totalWeight += metricWeights.comet;
  }
  
  if (totalWeight === 0) return "N/A";
  return (weightedSum / totalWeight).toFixed(1);
}

function calculateNoRefTotalScore(metrics, noRefWeights) {
  let totalWeight = 0, weightedSum = 0;
  
  if (metrics.repetition !== undefined && noRefWeights.repetition > 0) {
    weightedSum += Math.max(0, 100 - (parseFloat(metrics.repetition) || 0)) * noRefWeights.repetition;
    totalWeight += noRefWeights.repetition;
  }
  if (metrics.numberPres !== undefined && noRefWeights.numberPres > 0) {
    weightedSum += (parseFloat(metrics.numberPres) || 0) * noRefWeights.numberPres;
    totalWeight += noRefWeights.numberPres;
  }
  if (metrics.copyRate !== undefined && noRefWeights.copyRate > 0) {
    const copyVal = parseFloat(metrics.copyRate) || 0;
    let score = copyVal < 5 ? 70 + copyVal * 6 : copyVal <= 25 ? 100 : Math.max(0, 100 - (copyVal - 25) * 2);
    weightedSum += score * noRefWeights.copyRate;
    totalWeight += noRefWeights.copyRate;
  }
  if (metrics.lengthRatio !== undefined && noRefWeights.lengthRatio > 0) {
    const deviation = Math.abs((parseFloat(metrics.lengthRatio) || 100) - 100);
    weightedSum += Math.max(0, 100 - deviation * 2) * noRefWeights.lengthRatio;
    totalWeight += noRefWeights.lengthRatio;
  }
  if (metrics.score !== undefined && metrics.score !== 'N/A' && noRefWeights.llmScore > 0) {
    const val = Math.max(0, Math.min(100, ((parseFloat(metrics.score) || 1) - 1) * 100 / 9));
    weightedSum += val * noRefWeights.llmScore;
    totalWeight += noRefWeights.llmScore;
  }
  if (metrics.cometQE !== undefined && metrics.cometQE !== 'N/A' && noRefWeights.cometQE > 0) {
    weightedSum += ((parseFloat(metrics.cometQE) || 0) * 100) * noRefWeights.cometQE;
    totalWeight += noRefWeights.cometQE;
  }
  
  if (totalWeight === 0) return "N/A";
  return (weightedSum / totalWeight).toFixed(1);
}
