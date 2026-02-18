# Translation Testing Suite — Installation Guide

## Requirements

- **Python 3.10–3.12**
- **Miniconda** or Anaconda

---

## Step 1: Install Miniconda

> Skip this step if `conda --version` already works in your terminal.

1. Download the installer from [https://docs.anaconda.com/miniconda/](https://docs.anaconda.com/miniconda/) (~80 MB).
2. Run the installer:
   - **Windows**: enable **"Add Miniconda to PATH"** during setup.
   - **macOS/Linux**: follow the terminal prompts, then restart the shell.
3. **Restart the terminal** (Command Prompt, PowerShell, or your shell).
4. Verify:

```bash
conda --version
```

### Alternative: without Conda

If you prefer not to install Conda, download Python 3.10 directly from [python.org](https://www.python.org/downloads/release/python-31011/) and create a virtual environment:

```bash
C:\Python310\python.exe -m venv venv
venv\Scripts\activate

```

Then continue from **Step 3** below.

---

## Step 2: Create Conda Environment

```bash
conda create -n translate python=3.10 -y
conda activate translate
```



---

## Step 3: Install Core Dependencies

These are required for the server to start:

```bash
pip install flask flask-cors requests
```

---

## Step 4: Install PyTorch

Choose **one** option depending on your hardware:

```bash
# GPU — NVIDIA with CUDA 11.8
pip install torch --index-url https://download.pytorch.org/whl/cu118

# GPU — NVIDIA with CUDA 12.1
pip install torch --index-url https://download.pytorch.org/whl/cu121

# CPU only (no GPU)
pip install torch --index-url https://download.pytorch.org/whl/cpu
```

> For other configurations, see [https://pytorch.org/get-started/locally/](https://pytorch.org/get-started/locally/)

---

## Step 5: Install Neural Metrics 

Required for BERTScore, COMET, BLEURT, and COMET-QE evaluation:

```bash
pip install bert-score unbabel-comet bleurt-pytorch
```

> **Note**: `unbabel-comet` installs `numpy<2.0` automatically. If you encounter build errors, ensure you are using Python 3.10–3.12 (not 3.13+).

> **Note**: COMET-QE uses the `Unbabel/wmt22-cometkiwi-da` model, which requires accepting a license at [https://huggingface.co/Unbabel/wmt22-cometkiwi-da](https://huggingface.co/Unbabel/wmt22-cometkiwi-da). If unavailable, the system falls back to `Unbabel/wmt20-comet-qe-da`.

---

## Step 6: Install Local Translation Models 

Required for offline translation without API keys:

```bash
pip install transformers sentencepiece  # For NLLB-200 and OPUS-MT
pip install argostranslate              # For Argos Translate
```

Models are downloaded automatically on first use and cached in the `hf_cache/` directory.

| Model | Size | Languages |
|-------|------|-----------|
| Argos Translate | ~77 MB per pair | Auto-installs needed language pairs |
| NLLB-200 (Meta) | ~600 MB | 200+ languages |
| OPUS-MT (Helsinki-NLP) | ~74 MB per pair | Depends on available pair |

---

## Step 7: Configure API Keys 

For cloud-based translation models, create an `api_keys.json` file in the project root:

```json
{
  "anthropic": "sk-ant-api03-...",
  "openai": "sk-...",
  "deepseek": "sk-...",
  "deepl": "...",
  "google": "AIza..."
}
```

Keys are loaded automatically at startup. You can also enter them manually in the web interface. Only add keys for providers you intend to use — all fields are optional.

The LLM evaluator (used in reference-free evaluation mode) selects a key in priority order: DeepSeek → Anthropic → OpenAI.

---

## Step 8: Start the Server

```bash
python server.py
```

Or on Windows, double-click `start.bat` (activates the Conda environment automatically).

Open in your browser: **[http://localhost:5000](http://localhost:5000)**

The server will display:
- Detected compute device (CUDA / MPS / CPU)
- Loaded models status
- Port number

---


## Quick Reference: All Dependencies

```bash
# Full install (everything):
conda create -n translate python=3.10 -y
conda activate translate
pip install flask flask-cors requests
pip install torch --index-url https://download.pytorch.org/whl/cu118
pip install bert-score unbabel-comet bleurt-pytorch
pip install transformers sentencepiece argostranslate
python server.py
```
