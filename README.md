# 🏥 Trustworthy AI Agent & FHIR Connectivity for Smart Hospital Monitoring Systems

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-green.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org)
[![FHIR](https://img.shields.io/badge/FHIR-R4-orange.svg)](https://hl7.org/fhir)

An intelligent healthcare monitoring system that combines **FHIR interoperability**, **MCP (Model Context Protocol)**, **LLM-powered insights**, and **ML-based risk prediction** for real-time patient monitoring.

## 📋 Table of Contents
- [Features](#-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Installation Guide](#-installation-guide)
- [Configuration](#-configuration)
- [Running the Application](#-running-the-application)
- [API Endpoints](#-api-endpoints)
- [Test Patients](#-test-patients)
- [ML Model Details](#-ml-model-details)
- [Project Structure](#-project-structure)
- [Troubleshooting](#-troubleshooting)
- [Security Features](#-security-features)
- [License](#-license)

## 🎯 Features

### Core Features
- **🔐 Secure FHIR Integration** - Connect to any FHIR R4 compliant server (PDex, HAPI, etc.)
- **🧠 MCP-Powered Data Fetching** - Natural language to FHIR code mapping for intelligent queries
- **🤖 LLM Clinical Insights** - AI-powered patient analysis using Mistral/Mixtral models
- **📊 ML Risk Prediction** - Random Forest model for patient risk assessment (High/Moderate/Low)
- **💬 Medical Chat Assistant** - Conversational AI for clinical queries with context awareness
- **📈 Real-time Monitoring** - Live vital signs with trend visualization
- **🔒 Two-Factor Authentication** - Patient ID + Name verification against FHIR records

### Advanced Capabilities
- **MCP Context Management** - Maintains conversation context across multiple interactions
- **Batch Predictions** - Process multiple patients simultaneously for population health
- **Vital Signs Analysis** - Heart rate, SpO2, Blood Pressure monitoring with thresholds
- **Risk Factor Identification** - Automatic detection of clinical risk factors
- **Trend Analysis** - Historical data visualization with 60-second auto-refresh

## 🏗️ System Architecture

<img width="737" height="955" alt="image" src="https://github.com/user-attachments/assets/59b70e49-1bad-498c-abf5-0fe313d9d82c" />


## 🛠️ Technology Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.9+ | Core programming language |
| FastAPI | 0.115.0 | REST API framework |
| Uvicorn | 0.30.0 | ASGI server |
| scikit-learn | 1.5.0 | ML model (Random Forest) |
| Pandas | 2.2.0 | Data manipulation |
| NumPy | 1.26.0 | Numerical computations |
| Joblib | 1.4.0 | Model serialization |

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI framework |
| Vite | Latest | Build tool |
| React Router | 6.x | Navigation |
| Recharts | Latest | Data visualization |

### AI/ML Components
- **LLM**: Mistral AI models via RagaRenn API
- **MCP**: Custom query-to-FHIR mapper with natural language understanding
- **ML Model**: Random Forest Classifier (13 features, 3 risk categories)

## 📥 Installation Guide

### Prerequisites
- **Python 3.9 or higher** - [Download Python](https://www.python.org/downloads/)
- **Node.js 18 or higher** - [Download Node.js](https://nodejs.org/)
- **npm** (comes with Node.js) or **yarn**

### Step 1: Extract the Project
Extract the project ZIP file to a folder on your computer.

### Step 2: Backend Setup (Python Servers)

#### Create Virtual Environment

##Windows:##
bash
python -m venv venv
venv\Scripts\activate

python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt
cd Dashboard
npm install



### LLM API Configuration (Optional - without it, system uses fallback responses)
RAGARENN_API_KEY=your_api_key_here

# FHIR Server URL (Default: PDex Server)
FHIR_BASE_URL=https://pdex-server.davinci.hl7.org/fhir


## Access the Application
Open your browser and navigate to: http://localhost:5173

 Configuration
FHIR Server Options
Change FHIR_BASE_URL in .env file:

FHIR Server	URL
PDex (Default)	https://pdex-server.davinci.hl7.org/fhir
HAPI Public	https://hapi.fhir.org/baseR4
Fire.ly	https://server.fire.ly/r4
Update Interval
Edit Dashboard/src/pages/Dashboard.jsx (line 12)

javascript
const UPDATE_INTERVAL = 60000; // Change to 30000 for 30 seconds
📡 API Endpoints
FHIR + MCP + LLM Server (Port 5001)
Endpoint	Method	Description
/chat/universal	POST	AI chat with MCP context
/health	GET	Health check
/	GET	Server info
ML Risk Prediction Server (Port 5002)
Endpoint	Method	Description
/predict	POST	Single patient risk prediction
/batch_predict	POST	Batch predictions
/health	GET	Health check
/model_info	GET	Model information

## 🧪 Test Patients
Patient ID	Name	Gender
ff325f93-dbba-413e-8e27-d334f6eb20f3	Ali1 Unknown	-
2002	William John Smith	Male
1-2	Johnny Appleseed	Male
1	Johnny Appleseed	Male
1001	Patricia Ann Person	Female
Patient1	Johnny Example1	Male
Login Instructions:

Enter Patient ID (e.g., 2002)

Enter Patient Name exactly (e.g., William John Smith)

Click Login

## 🤖 ML Model Details
Input Features (13 features)
Feature	Normal Range
Heart Rate	60-100 bpm
Oxygen Saturation	95-100%
Systolic BP	90-120 mmHg
Diastolic BP	60-80 mmHg
Age	-
MAP	70-100 mmHg
Pulse Pressure	30-50 mmHg
Risk Categories
Category	Action Required
Low Risk	Routine monitoring
Moderate Risk	Increased monitoring, follow-up
High Risk	Immediate attention required

## 📁 Project Structure
text
Trustworthy-AI-FHIR-Monitoring/
│
├── FHIR Server.py                      # Main FHIR + MCP + LLM server
├── requirements.txt                    # Python dependencies
├── .env                                # Environment variables
│
├── Dashboard/                          # React frontend
│   ├── package.json
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   └── Login.jsx
│   │   ├── components/
│   │   │   ├── ChatBox.jsx
│   │   │   ├── PatientCard.jsx
│   │   │   └── Charts/
│   │   │       └── LineChart.jsx
│   │   └── hooks/
│   │       └── useMCPClient.js
│   └── public/
│
└── Machine Learning Server/            # ML models
    ├── ml_server.py
    ├── risk_prediction_model.pkl
    ├── scaler.pkl
    ├── risk_label_encoder.pkl
    ├── gender_encoder.pkl
    └── feature_names.json

## 🐛 Troubleshooting
Common Issues and Solutions
1. ModuleNotFoundError
bash
pip install -r requirements.txt
2. Port already in use
Windows:

bash
netstat -ano | findstr :5001
taskkill /PID <PID> /F
Mac/Linux:

bash
lsof -i :5001
kill -9 <PID>
3. ML Model files not found
ML server will auto-create mock models. No action needed.

4. React build errors
bash
cd Dashboard
rm -rf node_modules package-lock.json
npm install
npm run dev
5. FHIR Connection Failed
Check internet connection

Verify FHIR server URL

Test in browser: https://pdex-server.davinci.hl7.org/fhir/Patient/2002

6. LLM API Not Working
Without API key, system uses fallback responses. Add valid API key to .env for AI features.

Quick Health Checks
bash
# Check AI Server
curl http://localhost:5001/health

# Check ML Server
curl http://localhost:5002/health

# Check Frontend
# Open http://localhost:5173 in browser
🔐 Security Features
Two-Factor Authentication: Patient ID + Name verification

No Hardcoded Credentials: All API keys in .env file

CORS Protection: Configurable CORS policies

Input Validation: All API inputs validated

Error Handling: No sensitive data in error messages

📊 Performance
FHIR Query Response: < 2 seconds

ML Prediction Time: < 100ms per patient

LLM Response Time: 3-5 seconds

Dashboard Refresh: Every 60 seconds

🙏 Acknowledgments
HL7 FHIR - Healthcare interoperability standards

PDex Server - Test FHIR data

scikit-learn - ML model implementation

FastAPI - Python web framework

📄 License
MIT License - See LICENSE file for details
