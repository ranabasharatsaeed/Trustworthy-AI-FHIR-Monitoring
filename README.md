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

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate

python3 -m venv venv
source venv/bin/activate

pip install -r requirements.txt
cd Dashboard
npm install


# LLM API Configuration (Optional - without it, system uses fallback responses)
RAGARENN_API_KEY=your_api_key_here

# FHIR Server URL (Default: PDex Server)
FHIR_BASE_URL=https://pdex-server.davinci.hl7.org/fhir
