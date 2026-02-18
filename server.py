
"""
Translation Testing Suite - Unified Server
Run: python server.py
Open: http://localhost:5000
"""

import os
import sys

# Cache paths for non-ASCII usernames
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
os.environ['HF_HOME'] = os.path.join(_SCRIPT_DIR, 'hf_cache')
os.environ['XDG_DATA_HOME'] = _SCRIPT_DIR
os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'

from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
import requests
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
LOCAL_PACKAGES_DIR = os.path.join(SCRIPT_DIR, 'local')

if os.path.exists(LOCAL_PACKAGES_DIR):
    sys.path.insert(0, LOCAL_PACKAGES_DIR)
    for subdir in ['Lib/site-packages', 'lib/python3.12/site-packages', 'lib/python3.11/site-packages', 'lib/python3.10/site-packages']:
        sp = os.path.join(LOCAL_PACKAGES_DIR, subdir)
        if os.path.exists(sp): sys.path.insert(0, sp)

app = Flask(__name__)
CORS(app)

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"
DEEPL_FREE_API_URL = "https://api-free.deepl.com/v2/translate"
DEEPL_PRO_API_URL = "https://api.deepl.com/v2/translate"

_local_models = {'nllb_600m': None, 'nllb_600m_tokenizer': None, 'nllb_1_3b': None, 'nllb_1_3b_tokenizer': None, 'nllb_3_3b': None, 'nllb_3_3b_tokenizer': None, 'opus_mt': {}}
_metric_models = {'bertscore': None, 'comet': None, 'comet_qe': None, 'bleurt': None}

NLLB_LANG_CODES = {
    'en': 'eng_Latn', 'de': 'deu_Latn', 'fr': 'fra_Latn', 'es': 'spa_Latn', 'it': 'ita_Latn', 'pt': 'por_Latn',
    'nl': 'nld_Latn', 'pl': 'pol_Latn', 'ru': 'rus_Cyrl', 'uk': 'ukr_Cyrl', 'cs': 'ces_Latn', 'sk': 'slk_Latn',
    'bg': 'bul_Cyrl', 'ro': 'ron_Latn', 'hu': 'hun_Latn', 'el': 'ell_Grek', 'tr': 'tur_Latn', 'ar': 'arb_Arab',
    'he': 'heb_Hebr', 'fa': 'pes_Arab', 'hi': 'hin_Deva', 'bn': 'ben_Beng', 'zh': 'zho_Hans', 'ja': 'jpn_Jpan',
    'ko': 'kor_Hang', 'sv': 'swe_Latn', 'da': 'dan_Latn', 'no': 'nob_Latn', 'fi': 'fin_Latn', 'et': 'est_Latn',
    'lv': 'lvs_Latn', 'lt': 'lit_Latn',
}

NLLB_VARIANTS = {'nllb-200-600m': 'facebook/nllb-200-distilled-600M', 'nllb-200-1.3b': 'facebook/nllb-200-distilled-1.3B', 'nllb-200-3.3b': 'facebook/nllb-200-3.3B'}

def get_torch_device():
    try:
        import torch
        if torch.cuda.is_available(): return "cuda"
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available(): return "mps"
    except ImportError: pass
    return "cpu"

def get_bertscore():
    global _metric_models
    if _metric_models['bertscore'] is None:
        try:
            from bert_score import BERTScorer
            logger.info("Loading BERTScore...")
            _metric_models['bertscore'] = BERTScorer(lang="en", rescale_with_baseline=True, device=get_torch_device())
            logger.info(f"BERTScore loaded on {get_torch_device()}")
        except Exception as e:
            logger.error(f"BERTScore error: {e}")
            return None
    return _metric_models['bertscore']

def get_comet():
    global _metric_models
    if _metric_models['comet'] is None:
        try:
            from comet import download_model, load_from_checkpoint
            logger.info("Loading COMET...")
            _metric_models['comet'] = load_from_checkpoint(download_model("Unbabel/wmt22-comet-da"))
            logger.info(f"COMET loaded on {get_torch_device()}")
        except Exception as e:
            logger.error(f"COMET error: {e}")
            return None
    return _metric_models['comet']

def get_comet_qe():
    global _metric_models
    if _metric_models['comet_qe'] is None:
        try:
            from comet import download_model, load_from_checkpoint
            logger.info("Loading COMET-QE...")
            for model_name in ["Unbabel/wmt22-cometkiwi-da", "Unbabel/wmt20-comet-qe-da"]:
                try:
                    _metric_models['comet_qe'] = load_from_checkpoint(download_model(model_name))
                    logger.info(f"COMET-QE loaded: {model_name}")
                    break
                except: continue
        except Exception as e:
            logger.error(f"COMET-QE error: {e}")
            return None
    return _metric_models['comet_qe']

def get_bleurt():
    global _metric_models
    if _metric_models['bleurt'] is None:
        try:
            from bleurt_pytorch import BleurtForSequenceClassification, BleurtTokenizer
            import torch
            logger.info("Loading BLEURT...")
            model_name = 'lucadiliello/BLEURT-20'
            _metric_models['bleurt'] = {'model': BleurtForSequenceClassification.from_pretrained(model_name), 'tokenizer': BleurtTokenizer.from_pretrained(model_name)}
            device = get_torch_device()
            if device != 'cpu': _metric_models['bleurt']['model'] = _metric_models['bleurt']['model'].to(device)
            _metric_models['bleurt']['model'].eval()
            logger.info(f"BLEURT loaded on {device}")
        except Exception as e:
            logger.error(f"BLEURT error: {e}")
            return None
    return _metric_models['bleurt']

def get_argos_translator(from_code, to_code):
    try:
        import argostranslate.translate, argostranslate.package
        try: argostranslate.package.update_package_index()
        except: pass
        installed = argostranslate.translate.get_installed_languages()
        from_lang = next((l for l in installed if l.code == from_code), None)
        to_lang = next((l for l in installed if l.code == to_code), None)
        if from_lang and to_lang:
            translator = from_lang.get_translation(to_lang)
            if translator: return translator
        logger.info(f"Argos: Installing {from_code}-{to_code}...")
        available = argostranslate.package.get_available_packages()
        pkg = next((p for p in available if p.from_code == from_code and p.to_code == to_code), None)
        if pkg:
            argostranslate.package.install_from_path(pkg.download())
            installed = argostranslate.translate.get_installed_languages()
            from_lang = next((l for l in installed if l.code == from_code), None)
            to_lang = next((l for l in installed if l.code == to_code), None)
            if from_lang and to_lang: return from_lang.get_translation(to_lang)
        return None
    except Exception as e:
        logger.error(f"Argos error: {e}")
        return None

def get_argos_installed_pairs():
    try:
        import argostranslate.translate
        installed = argostranslate.translate.get_installed_languages()
        return [f"{f.code}-{t.code}" for f in installed for t in installed if f.code != t.code and f.get_translation(t)]
    except: return []

def get_nllb_model(variant='nllb-200-600m'):
    global _local_models
    model_key = variant.replace('-', '_').replace('.', '_').replace('nllb_200_', 'nllb_')
    tok_key = model_key + '_tokenizer'
    if model_key not in _local_models: model_key, tok_key = 'nllb_600m', 'nllb_600m_tokenizer'
    if _local_models[model_key] is None:
        try:
            from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
            hf_name = NLLB_VARIANTS.get(variant, NLLB_VARIANTS['nllb-200-600m'])
            logger.info(f"Loading {hf_name}...")
            _local_models[tok_key] = AutoTokenizer.from_pretrained(hf_name)
            _local_models[model_key] = AutoModelForSeq2SeqLM.from_pretrained(hf_name)
            logger.info(f"{hf_name} loaded")
        except Exception as e:
            logger.error(f"NLLB error: {e}")
            return None, None
    return _local_models[model_key], _local_models[tok_key]

def get_opus_pipeline(from_code, to_code):
    global _local_models
    key = f"{from_code}-{to_code}"
    if key not in _local_models['opus_mt']:
        try:
            from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
            model_name = f"Helsinki-NLP/opus-mt-{from_code}-{to_code}"
            logger.info(f"Loading OPUS-MT: {model_name}")
            _local_models['opus_mt'][key] = {'model': AutoModelForSeq2SeqLM.from_pretrained(model_name), 'tokenizer': AutoTokenizer.from_pretrained(model_name, use_fast=False)}
            logger.info(f"OPUS-MT {key} loaded")
        except Exception as e:
            logger.error(f"OPUS-MT error: {e}")
            return None
    return _local_models['opus_mt'].get(key)

@app.route('/')
def index():
    html_path = os.path.join(SCRIPT_DIR, 'translator.html')
    return send_file(html_path) if os.path.exists(html_path) else (jsonify({'error': 'translator.html not found'}), 404)

@app.route('/translator.html')
def translator_html():
    return send_file(os.path.join(SCRIPT_DIR, 'translator.html'))

@app.route('/synonyms.js')
def synonyms_js():
    js_path = os.path.join(SCRIPT_DIR, 'synonyms.js')
    return send_file(js_path) if os.path.exists(js_path) else ("// No synonyms.js", 200)

@app.route('/bertscore', methods=['POST'])
def bertscore():
    try:
        data = request.json
        scorer = get_bertscore()
        if scorer is None: return jsonify({'error': 'BERTScore not available'}), 500
        P, R, F1 = scorer.score([data.get('candidate', '')], [data.get('reference', '')])
        return jsonify({'precision': float(P[0]), 'recall': float(R[0]), 'f1': float(F1[0])})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/comet', methods=['POST'])
def comet():
    try:
        import torch
        data = request.json
        model = get_comet()
        if model is None: return jsonify({'error': 'COMET not available'}), 500
        output = model.predict([{"src": data.get('source', ''), "mt": data.get('candidate', ''), "ref": data.get('reference', '')}], batch_size=1, gpus=1 if torch.cuda.is_available() else 0)
        return jsonify({'score': float(output.scores[0])})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/comet-qe', methods=['POST'])
def comet_qe():
    try:
        import torch
        data = request.json
        model = get_comet_qe()
        if model is None: return jsonify({'error': 'COMET-QE not available'}), 500
        output = model.predict([{"src": data.get('source', ''), "mt": data.get('candidate', '')}], batch_size=1, gpus=1 if torch.cuda.is_available() else 0)
        return jsonify({'score': float(output.scores[0])})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/bleurt', methods=['POST'])
def bleurt():
    try:
        import torch
        data = request.json
        bleurt_model = get_bleurt()
        if bleurt_model is None: return jsonify({'error': 'BLEURT not available'}), 500
        inputs = bleurt_model['tokenizer']([data.get('reference', '')], [data.get('candidate', '')], return_tensors='pt', padding=True, truncation=True, max_length=512)
        device = next(bleurt_model['model'].parameters()).device
        inputs = {k: v.to(device) for k, v in inputs.items()}
        with torch.no_grad(): scores = bleurt_model['model'](**inputs).logits.squeeze().tolist()
        return jsonify({'score': scores if isinstance(scores, float) else float(scores)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/translate/argos', methods=['POST'])
def translate_argos():
    try:
        data = request.json
        text, src, tgt = data.get('text'), data.get('source_lang', 'en'), data.get('target_lang', 'de')
        if not text: return jsonify({'error': 'Text required'}), 400
        translator = get_argos_translator(src, tgt)
        if not translator: return jsonify({'error': f'Argos: {src}-{tgt} not available', 'installed_pairs': get_argos_installed_pairs()}), 400
        return jsonify({'translation': translator.translate(text), 'model': f'argos-{src}-{tgt}', 'provider': 'argos', 'local': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/translate/nllb', methods=['POST'])
def translate_nllb():
    try:
        data = request.json
        text, src, tgt, variant = data.get('text'), data.get('source_lang', 'en'), data.get('target_lang', 'de'), data.get('model', 'nllb-200-600m')
        if not text: return jsonify({'error': 'Text required'}), 400
        src_code, tgt_code = NLLB_LANG_CODES.get(src), NLLB_LANG_CODES.get(tgt)
        if not src_code or not tgt_code: return jsonify({'error': f'Unsupported language: {src} or {tgt}'}), 400
        model, tokenizer = get_nllb_model(variant)
        if model is None: return jsonify({'error': f'NLLB {variant} not available'}), 500
        tokenizer.src_lang = src_code
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        translated = model.generate(**inputs, forced_bos_token_id=tokenizer.convert_tokens_to_ids(tgt_code), max_length=512)
        return jsonify({'translation': tokenizer.decode(translated[0], skip_special_tokens=True), 'model': variant, 'provider': 'nllb', 'local': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/translate/opus', methods=['POST'])
def translate_opus():
    try:
        data = request.json
        text, src, tgt = data.get('text'), data.get('source_lang', 'en'), data.get('target_lang', 'de')
        if not text: return jsonify({'error': 'Text required'}), 400
        pipeline = get_opus_pipeline(src, tgt)
        if not pipeline: return jsonify({'error': f'OPUS-MT {src}-{tgt} not available'}), 500
        inputs = pipeline['tokenizer'](text, return_tensors="pt", truncation=True, max_length=512)
        outputs = pipeline['model'].generate(**inputs, max_length=512)
        return jsonify({'translation': pipeline['tokenizer'].decode(outputs[0], skip_special_tokens=True), 'model': f'opus-mt-{src}-{tgt}', 'provider': 'opus', 'local': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/translate/anthropic', methods=['POST'])
def translate_anthropic():
    try:
        data = request.json
        text, api_key, model = data.get('text'), data.get('api_key'), data.get('model', 'claude-sonnet-4-20250514')
        if not text or not api_key: return jsonify({'error': 'Text and API key required'}), 400
        res = requests.post(ANTHROPIC_API_URL, headers={'Content-Type': 'application/json', 'x-api-key': api_key, 'anthropic-version': '2023-06-01'},
            json={'model': model, 'max_tokens': 2000, 'system': data.get('system_prompt', 'You are a professional translator.'), 'messages': [{'role': 'user', 'content': text}], 'temperature': 0.3}, timeout=60)
        if res.status_code != 200: return jsonify({'error': res.json().get('error', {}).get('message', f'API error {res.status_code}')}), res.status_code
        result = res.json()
        return jsonify({'translation': result['content'][0]['text'].strip(), 'model': model, 'usage': result.get('usage', {}), 'provider': 'anthropic', 'local': False})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/translate/openai', methods=['POST'])
def translate_openai():
    try:
        data = request.json
        text, api_key, model = data.get('text'), data.get('api_key'), data.get('model', 'gpt-4o')
        if not text or not api_key: return jsonify({'error': 'Text and API key required'}), 400
        res = requests.post(OPENAI_API_URL, headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'},
            json={'model': model, 'messages': [{'role': 'system', 'content': data.get('system_prompt', 'You are a professional translator.')}, {'role': 'user', 'content': text}], 'temperature': 0.3, 'max_tokens': 2000}, timeout=60)
        if res.status_code != 200: return jsonify({'error': res.json().get('error', {}).get('message', f'API error {res.status_code}')}), res.status_code
        result = res.json()
        return jsonify({'translation': result['choices'][0]['message']['content'].strip(), 'model': model, 'usage': result.get('usage', {}), 'provider': 'openai', 'local': False})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/translate/deepseek', methods=['POST'])
def translate_deepseek():
    try:
        data = request.json
        text, api_key, model = data.get('text'), data.get('api_key'), data.get('model', 'deepseek-chat')
        if not text or not api_key: return jsonify({'error': 'Text and API key required'}), 400
        res = requests.post(DEEPSEEK_API_URL, headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'},
            json={'model': model, 'messages': [{'role': 'system', 'content': data.get('system_prompt', 'You are a professional translator.')}, {'role': 'user', 'content': text}], 'temperature': 0.3, 'max_tokens': 2000}, timeout=60)
        if res.status_code != 200: return jsonify({'error': res.json().get('error', {}).get('message', f'API error {res.status_code}')}), res.status_code
        result = res.json()
        return jsonify({'translation': result['choices'][0]['message']['content'].strip(), 'model': model, 'usage': result.get('usage', {}), 'provider': 'deepseek', 'local': False})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/translate/deepl', methods=['POST'])
def translate_deepl():
    try:
        data = request.json
        text, api_key, target_lang = data.get('text'), data.get('api_key'), data.get('target_lang', 'EN').upper()
        source_lang = data.get('source_lang', '').upper()
        if not text or not api_key: return jsonify({'error': 'Text and API key required'}), 400
        url = DEEPL_FREE_API_URL if api_key.endswith(':fx') else DEEPL_PRO_API_URL
        target_lang = {'EN': 'EN-US', 'PT': 'PT-BR'}.get(target_lang, target_lang)
        payload = {'text': text, 'target_lang': target_lang}
        if source_lang: payload['source_lang'] = source_lang
        res = requests.post(url, headers={'Authorization': f'DeepL-Auth-Key {api_key}', 'Content-Type': 'application/x-www-form-urlencoded'}, data=payload, timeout=30)
        if res.status_code != 200: return jsonify({'error': f'DeepL: {res.text}'}), res.status_code
        result = res.json()
        return jsonify({'translation': result['translations'][0]['text'], 'source_lang': result['translations'][0].get('detected_source_language', ''), 'provider': 'deepl', 'local': False})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/local/status', methods=['GET'])
def local_status():
    status = {'argos': {'installed': False}, 'nllb': {'installed': False}, 'opus': {'installed': False}}
    try:
        import argostranslate.translate
        status['argos'] = {'installed': True, 'pairs': get_argos_installed_pairs()}
    except: pass
    try:
        from transformers import AutoModelForSeq2SeqLM
        status['nllb'] = {'installed': True}
        status['opus'] = {'installed': True, 'loaded_pairs': list(_local_models['opus_mt'].keys())}
    except: pass
    return jsonify(status)

@app.route('/health', methods=['GET'])
def health():
    try:
        import torch
        device = get_torch_device()
    except: device = "cpu"
    return jsonify({'status': 'ok', 'device': device, 'models_loaded': {
        'bertscore': _metric_models['bertscore'] is not None,
        'comet': _metric_models['comet'] is not None,
        'comet_qe': _metric_models['comet_qe'] is not None,
        'bleurt': _metric_models['bleurt'] is not None
    }})

@app.route('/<path:filename>')
def serve_static(filename):
    try: return send_from_directory(SCRIPT_DIR, filename)
    except: return jsonify({'error': 'File not found'}), 404

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"\n Translation Testing Suite - http://localhost:{port}\n")
    print(f" Device: {get_torch_device()}")
    if os.path.exists(os.path.join(SCRIPT_DIR, 'translator.html')): print(" translator.html found")
    if os.path.exists(os.path.join(SCRIPT_DIR, 'synonyms.js')): print(" synonyms.js found")
    print(f"\n Starting server... Press Ctrl+C to stop\n")
    app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)
