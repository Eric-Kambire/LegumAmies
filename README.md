# Legum'Amies - HackTheFork

> **AI & ML for the French Food Industry: Alternative Proteins & Protein Sovereignty**

## 🌾 Project Overview
**Legum'Amies** is an AI/ML-driven initiative developed for the **HackTheFork** hackathon, targeting food resilience, alternative proteins (legumes, pulses, lupin, faba beans, peas, lentils), and protein sovereignty in France and Europe.

### Core Focus Areas
- **Protein Sovereignty (Souveraineté Protéique)**: Reducing reliance on imported soy and animal protein by valorizing French legume production.
- **Formulation & Nutritional AI**: Machine learning models to balance amino acid profiles, texture, digestability, and organoleptic properties.
- **Supply Chain & Eco-Score Optimization**: Evaluating carbon footprint, water impact, and local sourcing criteria (Open Food Facts / Agribalyse integration).

---

## 📁 Repository Structure
```
HackTheFork/
└── LegumAmies/
    ├── data/
    │   ├── raw/            # Unprocessed datasets (Open Food Facts, Agribalyse, CIQUAL, etc.)
    │   └── processed/      # Cleaned and feature-engineered datasets
    ├── notebooks/          # Exploratory Data Analysis (EDA) and prototyping
    ├── src/                # Modular Python source code (data pipeline, models, API)
    ├── models/             # Exported model weights and artifacts
    ├── requirements.txt    # Project dependencies
    └── README.md
```

---

## 🚀 Quickstart

### 1. Set up a Virtual Environment
```bash
python -m venv .venv
# Windows (PowerShell)
.\.venv\Scripts\Activate.ps1
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```
