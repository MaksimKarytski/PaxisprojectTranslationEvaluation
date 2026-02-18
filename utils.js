

async function parseStreamingTMX(file, srcLang, tgtLang, maxPairs = 10000) {
  return new Promise((resolve, reject) => {
    const results = [], srcLangLower = srcLang.toLowerCase(), tgtLangLower = tgtLang.toLowerCase();
    const chunkSize = 1024 * 1024;
    let offset = 0, buffer = '', pairsFound = 0;
    
    const readNextChunk = () => {
      if (pairsFound >= maxPairs || offset >= file.size) { resolve(results); return; }
      
      const slice = file.slice(offset, Math.min(offset + chunkSize, file.size));
      const reader = new FileReader();
      
      reader.onload = (e) => {
        buffer += e.target.result;
        const tuRegex = /<tu[^>]*>([\s\S]*?)<\/tu>/gi;
        let match;
        
        while ((match = tuRegex.exec(buffer)) !== null && pairsFound < maxPairs) {
          const tuContent = match[1];
          const tuvRegex = /<tuv[^>]*(?:xml:lang|lang)=["']([^"']+)["'][^>]*>[\s\S]*?<seg>([\s\S]*?)<\/seg>/gi;
          let original = null, translation = null;
          const tuvs = [];
          let tuvMatch;
          
          while ((tuvMatch = tuvRegex.exec(tuContent)) !== null) {
            const lang = tuvMatch[1].toLowerCase().split('-')[0];
            const text = tuvMatch[2].trim().replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
            tuvs.push({ lang, text });
            if (lang === srcLangLower) original = text;
            else if (lang === tgtLangLower) translation = text;
          }
          
          if (!original && tuvs.length >= 2) { original = tuvs[0].text; translation = tuvs[1].text; }
          if (original && original.length > 0 && original.length < 5000) { results.push({ original, translation: translation || null }); pairsFound++; }
        }
        
        const lastTuEnd = buffer.lastIndexOf('</tu>');
        buffer = lastTuEnd > -1 ? buffer.substring(lastTuEnd + 5) : (buffer.length > 50000 ? buffer.substring(buffer.length - 10000) : buffer);
        offset += chunkSize;
        setTimeout(readNextChunk, 0);
      };
      
      reader.onerror = () => reject(new Error('Error reading file chunk'));
      reader.readAsText(slice);
    };
    readNextChunk();
  });
}

function parseJSONTestData(jsonData) {
  const results = [];
  if (Array.isArray(jsonData)) {
    jsonData.forEach(item => {
      if (item.original || item.source || item.text) {
        results.push({ original: item.original || item.source || item.text, translation: item.translation || item.target || item.reference || null });
      }
    });
  } else if (jsonData.pairs || jsonData.data) {
    (jsonData.pairs || jsonData.data).forEach(pair => {
      results.push({ original: pair.original || pair.source || pair[0], translation: pair.translation || pair.target || pair[1] || null });
    });
  }
  return results;
}

function parseCSV(text, delimiter = ',') {
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ''));
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
    const row = {};
    headers.forEach((h, idx) => row[h] = values[idx] || '');
    results.push(row);
  }
  return results;
}

function exportToJSON(data, filename = 'export.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportToCSV(data, filename = 'export.csv') {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  data.forEach(row => {
    const values = headers.map(h => {
      const escaped = String(row[h] || '').replace(/"/g, '""');
      return escaped.includes(',') ? `"${escaped}"` : escaped;
    });
    csvRows.push(values.join(','));
  });
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function applyTestSelection(fullData, selection, limit, startFrom) {
  if (!fullData || fullData.length === 0) return [];
  const maxLimit = Math.min(limit, fullData.length);
  if (selection === 'random') return [...fullData].sort(() => Math.random() - 0.5).slice(0, maxLimit);
  if (selection === 'range') return fullData.slice(Math.min(startFrom, fullData.length - 1), Math.min(startFrom, fullData.length - 1) + maxLimit);
  return fullData.slice(0, maxLimit);
}

function calculateStatistics(evalResults) {
  if (evalResults.length === 0) return null;
  const modelStats = {};
  
  evalResults.forEach(result => {
    Object.entries(result.evaluations).forEach(([model, metrics]) => {
      if (!modelStats[model]) {
        modelStats[model] = { bleu: [], meteor: [], total: [], cer: [], wer: [], jaccard: [], chrF: [], lengthRatio: [], bertScore: [], comet: [], cometQE: [], score: [], fluency: [], adequacy: [], repetition: [], numberPres: [], copyRate: [], time: [], cost: [] };
      }
      Object.keys(modelStats[model]).forEach(key => {
        const value = metrics[key];
        const numVal = parseFloat(value);
        if (value !== undefined && value !== 'N/A' && value !== 'Error' && !isNaN(numVal) && isFinite(numVal)) {
          modelStats[model][key].push(numVal);
        }
      });
    });
  });

  const averages = {};
  Object.entries(modelStats).forEach(([model, metrics]) => {
    averages[model] = {};
    Object.entries(metrics).forEach(([metric, values]) => {
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        if (metric === 'time') {
          averages[model][metric + '_total'] = (sum / 1000).toFixed(2);
          averages[model][metric] = (avg / 1000).toFixed(2);
        } else if (metric === 'cost') {
          averages[model][metric + '_total'] = (sum / 100).toFixed(4);
          averages[model][metric] = (avg / 100).toFixed(4);
        } else {
          const min = Math.min(...values), max = Math.max(...values);
          const std = Math.sqrt(values.map(v => Math.pow(v - avg, 2)).reduce((a, b) => a + b, 0) / values.length);
          averages[model][metric] = avg.toFixed(2);
          averages[model][metric + '_min'] = min.toFixed(2);
          averages[model][metric + '_max'] = max.toFixed(2);
          averages[model][metric + '_std'] = std.toFixed(2);
        }
      }
    });
  });
  return averages;
}
