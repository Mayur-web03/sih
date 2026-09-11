# CryptoTrace Backend

## SIH 2026 — Cyber Crime Crypto Investigation Platform

CryptoTrace is a backend platform for cyber-crime investigators to analyze suspicious cryptocurrency transactions, trace fund movements across wallets, assess risk, correlate investigation data, and generate investigation outputs.

The backend is built with FastAPI and integrates with Supabase/PostgreSQL and Ethereum transaction data.

---

## 🚀 Features

- REST API built with FastAPI
- Ethereum transaction tracing
- Multi-hop wallet investigation
- Transaction history analysis
- Case management
- Risk scoring and classification
- VASP attribution support
- Investigation timeline data
- Evidence and chain-of-custody data
- Investigation report generation
- Freeze request workflow
- Freeze request audit trail
- Supabase/PostgreSQL database integration
- CORS support for frontend applications

---

## 🏗️ Architecture

```text
React + TypeScript Frontend
            │
            ▼
       FastAPI Backend
            │
     ┌──────┴──────┐
     ▼             ▼
Supabase /      Ethereum
PostgreSQL      Blockchain
     │             │
     └──────┬──────┘
            ▼
   Investigation Engine
            │
     ┌──────┼──────┐
     ▼      ▼      ▼
   Risk   Reports  Evidence
  Engine           & Freeze
```

---

## 🛠️ Tech Stack

| Technology    | Purpose                         |
| ------------- | -------------------------------- |
| Python        | Backend development             |
| FastAPI       | REST API framework              |
| Uvicorn       | Production ASGI server          |
| Supabase      | Database and backend services   |
| PostgreSQL    | Persistent data storage         |
| psycopg2      | PostgreSQL connectivity         |
| Pandas        | Transaction/data processing     |
| ReportLab     | PDF report generation           |
| Ethereum      | Blockchain transaction analysis |
| Python-dotenv | Environment configuration       |

---

## 📁 Project Structure

```text
backend/
│
├── api/
│   ├── __init__.py
│   ├── cases.py
│   ├── freeze_requests.py
│   ├── reports.py
│   ├── routes.py
│   └── schemas.py
│
├── etherTransaction/
│   ├── __init__.py
│   ├── supa.py
│   └── transaction.py
│
├── data/
│   └── transaction datasets
│
├── visuals/
│   └── transaction visualizations
│
├── db.py
├── main.py
├── requirements.txt
├── pyproject.toml
├── uv.lock
├── .python-version
├── .gitignore
└── README.md
```

---

## ⚙️ Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/Mayur-web03/sih-backend.git
cd sih-backend
```

### 2. Create a virtual environment

```bash
python -m venv .venv
```

Activate it on Windows:

```bash
.venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a `.env` file in the backend root:

```env
SUPABASE_DB_URL=your_supabase_database_url
```

Add any other environment variables required by the application.

> Never commit `.env` or database credentials to GitHub.

### 5. Start the development server

```bash
uvicorn main:app --reload
```

The API will be available at:

```text
http://127.0.0.1:8000
```

Interactive API documentation:

```text
http://127.0.0.1:8000/docs
```

---

## 🌐 Production Deployment

The backend is designed to run as a FastAPI Web Service on Render.

### Build Command

```bash
pip install -r requirements.txt
```

### Start Command

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

Production environment variables should be configured through the hosting provider rather than committed to the repository.

---

## 🔐 Environment & Security

The following files and directories are intentionally excluded from Git:

```text
.env
.env.*
.venv/
venv/
__pycache__/
*.pyc
.pytest_cache/
.mypy_cache/
```

Never expose:

- Supabase database credentials
- API keys
- Private keys
- Authentication secrets
- Production database URLs

---

## 🔌 API Modules

### Cases

Case management and investigation-related endpoints.

### Transactions

Retrieve and analyze blockchain transactions associated with investigation cases.

### Freeze Requests

Manage preservation/freeze request workflows and their status.

### Reports

Generate investigation and evidence reports.

### Investigation

Trace cryptocurrency movement across wallets and transactions.

---

## 🔎 Investigation Workflow

```text
Complaint Received
        ↓
Create Investigation
        ↓
Wallet / Transaction Identification
        ↓
Blockchain Transaction Tracing
        ↓
Multi-Hop Fund Flow Analysis
        ↓
Risk Assessment
        ↓
VASP Attribution
        ↓
Cross-Case Correlation
        ↓
Evidence Collection
        ↓
Investigation Report
        ↓
Freeze Request
```

---

## 📊 Risk Analysis

CryptoTrace uses transaction and wallet behaviour to calculate an explainable risk score.

Potential risk indicators include:

- Transaction velocity
- Fan-in / fan-out behaviour
- Number of hops
- Transaction errors
- Fund movement volume
- Suspicious transaction patterns

Risk results are intended to assist investigators and should be interpreted together with supporting evidence.

---

## 🧾 Evidence & Reports

The backend supports investigation reporting and evidence-oriented outputs including:

- Transaction records
- Wallet information
- Investigation timeline
- Risk analysis
- VASP attribution information
- Chain-of-custody records
- Freeze request documentation

---

## ⚠️ VASP Attribution

VASP identification is treated as an attribution/analysis result rather than automatic confirmation.

The system uses terminology such as:

- Potential VASP
- Likely VASP
- Attribution Candidate

A VASP should not be represented as confirmed without appropriate supporting evidence or external verification.

---

## 🛡️ Freeze Request Workflow

Freeze requests follow an investigation workflow rather than directly freezing blockchain assets.

```text
Pending
   ↓
Under Review
   ↓
Approved / Rejected
   ↓
Executed
```

The generated freeze request serves as an official investigation/preservation document.

Actual asset freezing requires appropriate action or integration with the relevant VASP, exchange, authority, or financial institution.

---

## 🧪 Development

Run the backend locally:

```bash
uvicorn main:app --reload
```

For production:

```bash
uvicorn main:app --host 0.0.0.0 --port $PORT
```

---

## 🎯 SIH 2026

CryptoTrace is designed as a cyber-crime cryptocurrency investigation platform for demonstrating:

- Cryptocurrency fund-flow tracing
- Multi-hop transaction analysis
- Risk intelligence
- VASP attribution
- Cross-case correlation
- Evidence management
- Investigation reporting
- Freeze request preparation

---

## 👨‍💻 Project

**CryptoTrace — SIH 2026**

Cyber Crime Crypto Investigation & Intelligence Platform.
