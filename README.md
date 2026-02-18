

## Step 1: Install Python

Download and install Python 3.10+ from https://www.python.org/downloads/

**Important:** Check "Add Python to PATH" during installation.

Verify:
```bash
python --version
```

---

## Step 2: Create project folder

```bash
mkdir C:\TranslationSuite
cd C:\TranslationSuite
```

---

## Step 3: Copy files to folder

- `translator.html`
- `synonyms.js`
- `server.py`
- `requirements.txt`
- `start.bat`
- `api_keys.json` (optional)

---

## Step 4: Install dependencies

```bash
cd C:\TranslationSuite
pip install -r requirements.txt
```

---

## Step 5: Install neural metrics (optional, +5GB)

```bash
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install bert-score
pip install unbabel-comet
```

Download COMET models:
```bash
python -c "from comet import download_model; download_model('Unbabel/wmt22-comet-da')"
python -c "from comet import download_model; download_model('Unbabel/wmt20-comet-qe-da')"
```

---

## Step 6: Run

```bash
cd C:\TranslationSuite
python server.py
```

Then open `translator.html` in browser.

Or use `start.bat` to launch both automatically.

---

## Files

**requirements.txt:**
```
Flask==3.0.0
Flask-CORS==4.0.0
requests==2.31.0
gunicorn==21.2.0
```

**start.bat:**
```batch
@echo off
cd /d C:\TranslationSuite
start "" python server.py
timeout /t 2 >nul
start "" translator.html
```

**api_keys.json:**
```json
{
  "anthropic": "sk-ant-...",
  "openai": "sk-...",
  "deepseek": "sk-...",
  "deepl": "...",
  "google": "..."
}
```

---

## Quick test

1. Run `python server.py`
2. Open http://localhost:5001/health — should return `{"status":"ok"}`
3. Open `translator.html` in browser
4. Try translating text in Manual mode
