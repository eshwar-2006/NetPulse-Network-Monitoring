# NetPulse — Real-Time Network Performance Monitoring, Anomaly Detection & Predictive Maintenance System

NetPulse is an enterprise-grade Network Operations Center (NOC) performance monitoring and predictive maintenance system. It combines real ICMP subprocess pings, HTTP/HTTPS application checks, local interface delta counter throughput telemetry, non-parametric statistical anomaly detection (Rolling Median Absolute Deviation & Modified Z-scores), Ordinary Least Squares (OLS) time-series forecasting, and an operational incident & Kanban task dispatch workflow.

---

## 1. System Architecture

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, Recharts, React Router, Lucide Icons.
- **Backend (Standalone Python)**: Python 3.10+, Flask REST API, SQLite with SQLAlchemy, NumPy, pandas, psutil, requests.
- **Full-Stack Runtime (AI Studio / Docker)**: Node.js Express server (`server.ts`) hosting the identical versioned REST API (`/api/v1/*`) on WebAssembly SQLite (`sql.js`) with live ICMP socket ping probes and Vite SPA middleware.
- **Database**: SQLite (`netpulse.sqlite`) with persistent table schema for targets, metrics, anomalies, forecasts, incidents, audit logs, tasks, and settings.

---

## 2. Windows 10/11 & PowerShell Installation Guide

Follow these exact commands in **Windows PowerShell (Run as Administrator or standard user)**.

### Step 1: Prerequisites Verification
Ensure Python 3.10+, Node.js 18+, and git are installed:
```powershell
python --version
node -v
npm -v
```
*(If Python is not recognized, install it from python.org and check "Add Python to PATH" during installation).*

---

### Step 2: Clone / Open Repository in VS Code
```powershell
cd C:\Projects
git clone <repository-url> NetPulse
cd NetPulse
code .
```

---

### Step 3: Python Backend Setup & Virtual Environment
Open a PowerShell terminal in VS Code:
```powershell
# Navigate to the backend directory
cd backend

# Create Python virtual environment
python -m venv venv

# Activate virtual environment in PowerShell
.\venv\Scripts\Activate.ps1
# (If script execution is blocked on Windows, run: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser)

# Upgrade pip and install all backend requirements
python -m pip install --upgrade pip
pip install -r requirements.txt
```

---

### Step 4: Configure Environment Variables
Create a `.env` file in the project root:
```powershell
# Copy the example environment template
Copy-Item ..\.env.example ..\.env
```
Inside `.env` you can optionally customize:
```ini
SECRET_KEY=netpulse-secure-college-secret-key-2026
DATABASE_URL=sqlite:///netpulse.sqlite
DEFAULT_MONITOR_INTERVAL=15
DEFAULT_TIMEOUT=3
LATENCY_WARNING_MS=150.0
LATENCY_CRITICAL_MS=300.0
```

---

### Step 5: Initialize the Database & Seed Baseline Data
Run the seeding script to create tables and realistic initial targets:
```powershell
python scripts/seed_data.py
```
This automatically provisions:
- Administrator Account: `admin` (password: `AdminPass123!`)
- Technician Account: `technician` (password: `TechPass123!`)
- 4 Monitored Targets: Cloudflare Public DNS (`1.1.1.1`), Google DNS (`8.8.8.8`), Quad9 (`9.9.9.9`), GitHub API (`api.github.com`)
- 25 baseline historical latency samples per target

---

### Step 6: Create or Reset Administrator Account (CLI)
You can create custom administrator credentials anytime via the CLI:
```powershell
python scripts/create_admin.py myadmin myadmin@netpulse.local SecretPass123!
```

---

### Step 7: Start the Flask Backend
```powershell
python app.py
```
The Flask REST API will start on **`http://127.0.0.1:5000`**. The background polling worker will automatically begin probing targets in 15-second cycles.

---

### Step 8: Start the React Vite Frontend
Open a **second PowerShell terminal** in VS Code at the project root:
```powershell
npm install
npm run dev
```
The frontend will open on **`http://127.0.0.1:5173`** (or `http://localhost:3000` in AI Studio).

---

### Step 9: Running Automated Tests
Run the comprehensive pytest test suite to verify auth, ICMP parsing, MAD anomaly detection, forecasting, and CSV exports:
```powershell
# In backend virtual environment
pytest tests/ -v
```

---

## 3. Implemented REST API Documentation (`/api/v1`)

| Group | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/auth/register` | Register new technician or admin user |
| **Auth** | `POST` | `/api/v1/auth/login` | Session login with secure cookie & token |
| **Auth** | `POST` | `/api/v1/auth/logout` | Invalidate session |
| **Auth** | `GET` | `/api/v1/auth/me` | Fetch authenticated user profile and role |
| **Dashboard** | `GET` | `/api/v1/dashboard/summary` | Aggregate fleet KPIs & local interface rate |
| **Dashboard** | `GET` | `/api/v1/dashboard/timeseries` | Multi-target series data for Recharts graphs |
| **Targets** | `GET` | `/api/v1/targets` | List all targets with last measured latency |
| **Targets** | `POST` | `/api/v1/targets` | Register a new monitored host or IP |
| **Targets** | `PATCH` | `/api/v1/targets/{id}` | Update thresholds or toggle active status |
| **Targets** | `DELETE` | `/api/v1/targets/{id}` | Permanently delete target (Admin only) |
| **Targets** | `POST` | `/api/v1/targets/{id}/check` | Immediate on-demand ICMP/HTTP probe |
| **Metrics** | `GET` | `/api/v1/metrics` | Retrieve filtered measurement timeseries |
| **Metrics** | `GET` | `/api/v1/metrics/export` | RFC 4180 compliant CSV export |
| **Metrics** | `GET` | `/api/v1/metrics/interfaces` | Real local interface counters (psutil) |
| **Anomalies** | `GET` | `/api/v1/anomalies` | Query detected statistical outliers |
| **Anomalies** | `POST` | `/api/v1/anomalies/{id}/acknowledge` | Mark anomaly as reviewed |
| **Anomalies** | `POST` | `/api/v1/anomalies/{id}/resolve` | Resolve anomaly with audit notes |
| **Forecast** | `POST` | `/api/v1/forecasts/generate` | Run OLS linear regression latency forecast |
| **Incidents** | `GET` | `/api/v1/incidents` | List incident tickets with search and filters |
| **Incidents** | `POST` | `/api/v1/incidents` | Create ticket manually or from anomaly |
| **Incidents** | `PATCH` | `/api/v1/incidents/{id}` | Update status, assign technician, append notes |
| **Incidents** | `GET` | `/api/v1/incidents/export` | Export incident tickets to CSV |
| **Operations** | `GET` | `/api/v1/tasks` | Query Kanban tasks |
| **Operations** | `GET` | `/api/v1/milestones` | Milestones with dynamic completion % |
| **Settings** | `GET` | `/api/v1/settings` | Global NOC threshold parameters |
| **Settings** | `PATCH` | `/api/v1/settings` | Update settings (Admin only) |

---

## 4. Statistical Anomaly Detection Methodology

NetPulse does not fabricate alerts or claim machine learning buzzwords. It executes transparent, non-parametric statistics:
1. **Rolling Median Absolute Deviation (MAD)**:
   $$\text{MAD} = \text{median}(|X_i - \tilde{X}|)$$
   $$\text{Modified Z-Score: } M_i = \frac{0.6745 \cdot (X_i - \tilde{X})}{\max(\text{MAD}, 1.0)}$$
   When $M_i \ge 3.5$, the observation is statistically classified as an outlier with an explainable derivation.
2. **Static Thresholds**: Immediate WARNING when exceeding `warning_threshold_ms` and CRITICAL when breaching `critical_threshold_ms`.
3. **Consecutive Probe Failures**: Host marked DOWN with CRITICAL alert if 3 successive probes fail.
4. **Duplicate Prevention**: If an active unacknowledged alert of the same type already exists for a target, duplicate creation is suppressed to prevent alert flooding.

---

## 5. Predictive Maintenance & Forecasting

- **Method**: Ordinary Least Squares (OLS) Linear Regression ($y = mx + c$) calculated dynamically from valid historical ping records in SQLite.
- **Correlation**: Calculates Pearson $R^2$ coefficient to evaluate fit quality.
- **Horizons**: 15m, 30m, 60m, 120m, 240m.
- **Degradation Detection**: Automatically flags HIGH RISK if the projected linear drift breaches critical threshold levels within the selected horizon.
- **Transparency**: Explicitly details sample sizes, timestamps, and model limitations (e.g. unpredicted upstream link outages or BGP flaps).

---

## 6. Understanding Local Network Monitoring Limitations

- **Local Interface Throughput**: Sourced via `psutil.net_io_counters()` (or `/proc/net/dev`). This represents bandwidth passing through the local host's physical network adapter (NIC), NOT the remote target's interface.
- **ICMP Blocking**: Firewalls may drop ICMP packets while HTTP/HTTPS remains healthy. NetPulse separates ICMP and HTTP evaluation; a ping failure does not imply an HTTP service outage.
