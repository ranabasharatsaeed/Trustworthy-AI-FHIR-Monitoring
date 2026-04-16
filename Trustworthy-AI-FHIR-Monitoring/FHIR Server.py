#!/usr/bin/env python3
"""
Unified HAPI FHIR Server with MCP (Model Context Protocol) - FIXED VERSION

This application serves as a bridge between:
1. FHIR Servers (medical data)
2. MCP (Model Context Protocol) for structuring context
3. LLM (Large Language Model) for generating insights

FLOW: User Query → MCP Fetcher → FHIR Server → Data Processor → LLM → Response
"""

import os
import re
import requests
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
from collections import defaultdict

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# -----------------------------
# Configuration Section
# -----------------------------
RAGARENN_API_URL = "https://ragarenn.eskemm-numerique.fr/sso/ch@t/api/chat/completions"
RAGARENN_API_KEY = os.getenv("RAGARENN_API_KEY")  # LLM API Key
#FHIR_BASE_URL = "https://hapi.fhir.org/baseR4"
# FHIR Server URL
# In your FastAPI server code, change:
FHIR_BASE_URL = "https://pdex-server.davinci.hl7.org/fhir"
#FHIR_BASE_URL = "https://server.fire.ly/r4
#FHIR_BASE_URL = "https://fhir.dicom.tw/fhir"
#FHIR_BASE_URL = "http://hapi.fhir.org/baseR4"
# -----------------------------
# MCP (Model Context Protocol) FHIR Fetcher
# -----------------------------
# MCP PURPOSE: Acts as an intelligent data fetcher that:
# 1. Understands natural language queries
# 2. Maps them to specific FHIR resources/codes
# 3. Structures the data for LLM consumption

class EnhancedMCPFetcher:
    def __init__(self):
        self.base_url = FHIR_BASE_URL
        self.headers = {"Accept": "application/fhir+json", "Content-Type": "application/fhir+json"}
        
        # MCP QUERY MAPPING: Natural language → FHIR LOINC codes
        # This is where MCP adds intelligence - it understands what the user means
        self.QUERY_MAP = {
            # Heart rate queries map to LOINC code 8867-4
            "heart rate": ["8867-4"], "hr": ["8867-4"], "heartrate": ["8867-4"], 
            "pulse": ["8867-4"], "bpm": ["8867-4"],
            
            # SpO2 queries map to oxygen saturation codes
            "oxygen": ["2708-6", "59408-5"], "spo2": ["2708-6", "59408-5"], 
            "o2": ["2708-6", "59408-5"], "saturation": ["2708-6", "59408-5"],
            
            # Blood pressure queries
            "blood pressure": ["85354-9"], "bp": ["85354-9"], 
            "systolic": ["8480-6"], "diastolic": ["8462-4"],
            
            # Comprehensive vital signs
            "vitals": ["8867-4", "2708-6", "85354-9"], "signs": ["8867-4", "2708-6", "85354-9"],
            "vital signs": ["8867-4", "2708-6", "85354-9"],
            
            # General patient status queries get all vitals
            "patient": ["8867-4", "2708-6", "85354-9"], "status": ["8867-4", "2708-6", "85354-9"],
            "health": ["8867-4", "2708-6", "85354-9"], "how is": ["8867-4", "2708-6", "85354-9"],
            "is patient": ["8867-4", "2708-6", "85354-9"]
        }
        
        # Code to type mapping for data normalization
        self.CODE_TYPE = {
            "8867-4": {"type": "heart_rate", "display": "Heart Rate", "unit": "bpm"},
            "2708-6": {"type": "spo2", "display": "Oxygen Saturation", "unit": "%"},
            "59408-5": {"type": "spo2", "display": "Oxygen Saturation", "unit": "%"},
            "85354-9": {"type": "blood_pressure", "display": "Blood Pressure", "unit": "mmHg"},
            "8480-6": {"type": "systolic_bp", "display": "Systolic BP", "unit": "mmHg"},
            "8462-4": {"type": "diastolic_bp", "display": "Diastolic BP", "unit": "mmHg"},
        }

    def fetch(self, path: str, params: Optional[dict] = None) -> Dict[str, Any]:
        """Generic FHIR API call"""
        url = f"{self.base_url}/{path}"
        try:
            resp = requests.get(url, headers=self.headers, params=params, timeout=30)
            return {"status": resp.status_code, "data": resp.json() if resp.content else {}}
        except Exception as e:
            return {"status": 500, "error": str(e), "data": {}}

    def get_patient(self, patient_id: str):
        """Fetch patient demographics from FHIR"""
        return self.fetch(f"Patient/{patient_id}")

    def get_codes_for_query(self, query: str) -> List[str]:
        """
        MCP INTELLIGENCE: Convert natural language to FHIR codes
        This is the core of MCP - understanding intent and mapping to data
        """
        query_lower = query.lower().strip()
        
        # Check for exact matches first
        for term, term_codes in self.QUERY_MAP.items():
            if query_lower == term:  # Exact match
                return term_codes
                
        # Then check for partial matches
        for term, term_codes in self.QUERY_MAP.items():
            # For short queries (1-2 words), require exact or close match
            if len(query_lower.split()) <= 2:
                if term in query_lower:
                    return term_codes
            else:
                # For longer queries, be more lenient
                if re.search(r'\b' + re.escape(term) + r'\b', query_lower):
                    return term_codes
        
        # Fallback logic based on keywords
        if "blood" in query_lower or "bp" in query_lower:
            return ["85354-9"]
        elif "heart" in query_lower or "pulse" in query_lower:
            return ["8867-4"]
        elif "oxygen" in query_lower or "spo2" in query_lower or "o2" in query_lower:
            return ["2708-6", "59408-5"]
        else:
            # Default: get all vitals for general queries
            return ["8867-4", "2708-6", "85354-9"]

    def fetch_observations(self, patient_id: str, query: str, max_count: int = 500) -> Dict[str, Any]:
        """
        MCP FETCHING: Get observations from FHIR based on query intent
        Steps:
        1. Convert query to FHIR codes (MCP mapping)
        2. Fetch data from FHIR server
        3. Return structured results
        """
        codes = self.get_codes_for_query(query)  # MCP translation happens here
        all_resources = []

        for code in codes:
            # FHIR API call with specific parameters
            params = {
                "subject": f"Patient/{patient_id}", 
                "code": code, 
                "_count": min(1000, max_count), 
                "_sort": "-date"  # Get most recent first
            }
            result = self.fetch("Observation", params)
            
            if result["status"] == 200:
                bundle = result.get("data", {})
                entries = bundle.get("entry", [])
                for entry in entries:
                    if "resource" in entry:
                        all_resources.append(entry["resource"])

        # Sort by timestamp descending
        all_resources.sort(key=lambda x: self._extract_timestamp(x), reverse=True)
        return {
            "status": 200, 
            "data": {"entry": [{"resource": r} for r in all_resources]}, 
            "codes_searched": codes,  # Show which FHIR codes were used
            "total_fetched": len(all_resources)
        }

    def parse_observation(self, resource: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Parse raw FHIR observation into structured format for LLM"""
        try:
            code_info = resource.get("code", {}).get("coding", [{}])[0]
            code = code_info.get("code")
            if not code or code not in self.CODE_TYPE:
                return None
            
            type_info = self.CODE_TYPE[code]
            timestamp = self._extract_timestamp(resource)
            
            # Special handling for blood pressure (panel observation)
            if code == "85354-9":
                systolic = diastolic = None
                for component in resource.get("component", []):
                    comp_code = component.get("code", {}).get("coding", [{}])[0].get("code")
                    if comp_code == "8480-6":
                        systolic = component.get("valueQuantity", {}).get("value")
                    elif comp_code == "8462-4":
                        diastolic = component.get("valueQuantity", {}).get("value")
                
                if systolic is not None and diastolic is not None:
                    return {
                        "id": resource.get("id"),
                        "type": "blood_pressure",
                        "display": "Blood Pressure",
                        "value": f"{systolic}/{diastolic}",
                        "unit": "mmHg",
                        "timestamp": timestamp,
                        "code": code,
                        "systolic": float(systolic),
                        "diastolic": float(diastolic)
                    }
                return None
            
            # Handle simple observations (heart rate, SpO2)
            elif "valueQuantity" in resource:
                value = resource["valueQuantity"].get("value")
                unit = resource["valueQuantity"].get("unit", type_info["unit"])
                
                if value is None:
                    return None
                    
                return {
                    "id": resource.get("id"),
                    "type": type_info["type"],
                    "display": type_info["display"],
                    "value": float(value),
                    "unit": unit,
                    "timestamp": timestamp,
                    "code": code
                }
            
            return None
        except Exception as e:
            print(f"Error parsing observation: {e}")
            return None

    def _extract_timestamp(self, resource: Dict[str, Any]) -> datetime:
        """Extract timestamp from FHIR resource"""
        ts = resource.get("effectiveDateTime") or resource.get("issued") or resource.get("meta", {}).get("lastUpdated")
        if ts:
            try: 
                return datetime.fromisoformat(ts.replace("Z", "+00:00"))
            except: 
                return datetime.now()
        return datetime.now()

# -----------------------------
# Data Processor - Connects MCP data to LLM
# -----------------------------
class EnhancedDataProcessor:
    def __init__(self, fetcher):
        self.fetcher = fetcher

    def process(self, patient_id: str, query: str) -> Dict[str, Any]:
        """
        Process workflow:
        1. Get patient info from FHIR
        2. Use MCP fetcher to get observations based on query
        3. Parse and organize data for LLM
        """
        # Step 1: Get patient demographics
        patient_result = self.fetcher.get_patient(patient_id)
        if patient_result["status"] != 200:
            return {"error": "Patient not found", "success": False}
        
        patient_data = patient_result["data"]
        patient_name = " ".join(patient_data.get("name", [{}])[0].get("given", [])) + " " + patient_data.get("name", [{}])[0].get("family", "")
        
        # Step 2: MCP fetches observations based on query intent
        obs_result = self.fetcher.fetch_observations(patient_id, query)
        resources = [entry["resource"] for entry in obs_result["data"].get("entry", [])]
        
        # Step 3: Parse raw FHIR data
        vitals = []
        for res in resources:
            parsed = self.fetcher.parse_observation(res)
            if parsed:
                vitals.append(parsed)
        
        # Organize by type for LLM context
        organized = defaultdict(list)
        for v in vitals: 
            organized[v["type"]].append(v)
        
        # Sort each type by timestamp
        for typ in organized: 
            organized[typ].sort(key=lambda x: x["timestamp"], reverse=True)
        
        # Generate preliminary health status
        health_status = self._generate_health_status(query, organized)
        
        return {
            "success": True, 
            "patient": {"id": patient_id, "name": patient_name}, 
            "data": organized,  # Structured data for LLM
            "vitals_found": list(organized.keys()), 
            "total_readings": len(vitals), 
            "num_requested": 20, 
            "health_status": health_status,
            "original_query": query,
            "codes_searched": obs_result.get("codes_searched", [])  # Which FHIR codes were used
        }
    
    def _generate_health_status(self, query: str, data: Dict) -> Dict[str, Any]:
        """Generate basic health status before LLM analysis"""
        query_lower = query.lower()
        
        # Analyze based on query focus
        if "blood pressure" in query_lower or "bp" in query_lower:
            if "blood_pressure" in data:
                bp_data = data["blood_pressure"]
                if bp_data:
                    # Simple blood pressure analysis
                    sys_values = [d.get("systolic", 0) for d in bp_data]
                    dia_values = [d.get("diastolic", 0) for d in bp_data]
                    
                    avg_sys = sum(sys_values) / len(sys_values) if sys_values else 0
                    avg_dia = sum(dia_values) / len(dia_values) if dia_values else 0
                    
                    if avg_sys >= 140 or avg_dia >= 90:
                        return {"status": "elevated", "summary": "Elevated blood pressure readings detected"}
                    elif avg_sys >= 130 or avg_dia >= 80:
                        return {"status": "monitor", "summary": "Borderline blood pressure, requires monitoring"}
                    else:
                        return {"status": "normal", "summary": "Blood pressure within normal range"}
            
        elif "heart" in query_lower or "hr" in query_lower or "pulse" in query_lower:
            if "heart_rate" in data:
                hr_data = data["heart_rate"]
                if hr_data:
                    hr_values = [d.get("value", 0) for d in hr_data]
                    avg_hr = sum(hr_values) / len(hr_values) if hr_values else 0
                    
                    if any(hr > 100 for hr in hr_values):
                        return {"status": "tachycardia", "summary": "Elevated heart rate detected"}
                    elif any(hr < 60 for hr in hr_values):
                        return {"status": "bradycardia", "summary": "Low heart rate detected"}
                    else:
                        return {"status": "normal", "summary": "Heart rate within normal range"}
        
        # Default comprehensive status
        statuses = []
        if "blood_pressure" in data:
            bp_items = data["blood_pressure"]
            if bp_items:
                sys_vals = [d.get("systolic", 0) for d in bp_items[:10]]
                dia_vals = [d.get("diastolic", 0) for d in bp_items[:10]]
                if sys_vals and dia_vals:
                    if any(s >= 140 for s in sys_vals) or any(d >= 90 for d in dia_vals):
                        statuses.append("Elevated BP")
        
        if "heart_rate" in data:
            hr_items = data["heart_rate"]
            if hr_items:
                hr_vals = [d.get("value", 0) for d in hr_items[:10]]
                if hr_vals:
                    if any(hr > 100 for hr in hr_vals):
                        statuses.append("Tachycardia")
                    elif any(hr < 60 for hr in hr_vals):
                        statuses.append("Bradycardia")
        
        if statuses:
            return {"status": "alert", "summary": f"Attention needed: {', '.join(statuses)}"}
        else:
            return {"status": "stable", "summary": "No critical concerns detected"}

# -----------------------------
# LLM Integration - Enhanced AI Generator
# -----------------------------
# LLM PURPOSE: Takes structured data from MCP and generates
# natural language insights, recommendations, and analysis

class EnhancedAIGenerator:
    def __init__(self):
        self.api_key = RAGARENN_API_KEY
        self.base_url = RAGARENN_API_URL
        self.headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"} if self.api_key else {}

    def generate(self, patient_info: Dict, query: str, data: Dict, health_status: Dict, original_query: str) -> str:
        """
        LLM WORKFLOW:
        1. Build context-aware prompt with MCP-structured data
        2. Send to LLM API
        3. Process and validate response
        """
        # Step 1: Build prompt with MCP data
        prompt = self._build_prompt(patient_info, query, data, health_status, original_query)
        
        # Fallback if no API key
        if not self.api_key: 
            return self._generate_fallback_response(patient_info, query, data, health_status, original_query)
        
        try:
            # Step 2: Call LLM API
            payload = {
                "model": "mistralai/Mistral-Small-3.2-24B-Instruct-2506",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,  # Low temperature for medical accuracy
                "max_tokens": 1000
            }

            resp = requests.post(self.base_url, headers=self.headers, json=payload, timeout=30)
            if resp.status_code == 200: 
                content = resp.json().get("choices",[{}])[0].get("message",{}).get("content","[No content]")
                # Step 3: Ensure response relevance
                return self._ensure_relevance(content, original_query)
            else:
                # Generate fallback response
                return self._generate_fallback_response(patient_info, query, data, health_status, original_query)
        except Exception as e: 
            return self._generate_fallback_response(patient_info, query, data, health_status, original_query)

    def _build_prompt(self, patient_info: Dict, query: str, data: Dict, health_status: Dict, original_query: str) -> str:
        """
        Build context-aware prompt for LLM
        This is where MCP data meets LLM instructions
        """
        
        # Determine focus based on original query
        focus = self._determine_focus(original_query)
        
        prompt_parts = [
            f"You are a medical assistant analyzing patient data. Provide a concise, relevant analysis.",
            f"Patient: {patient_info.get('name', 'Unknown')}",
            f"User Query: '{original_query}'",
            f"Health Status: {health_status.get('summary', 'Not specified')}",
            "",
            f"Focus your analysis on: {focus}",
            ""
        ]
        
        # Add relevant data sections based on query focus
        # MCP ensures we only include relevant data for the query
        if "blood pressure" in focus.lower() or "bp" in focus.lower() or original_query.lower() in ["bp", "blood pressure"]:
            if "blood_pressure" in data:
                prompt_parts.append("BLOOD PRESSURE DATA:")
                prompt_parts.extend(self._format_bp_data(data["blood_pressure"]))
        
        elif "heart" in focus.lower() or "hr" in focus.lower() or original_query.lower() in ["hr", "heart rate", "pulse"]:
            if "heart_rate" in data:
                prompt_parts.append("HEART RATE DATA:")
                prompt_parts.extend(self._format_hr_data(data["heart_rate"]))
        
        else:
            # Include all data for general queries
            if data:
                for vital_type, readings in data.items():
                    if readings:
                        if vital_type == "blood_pressure":
                            prompt_parts.append(f"BLOOD PRESSURE DATA:")
                            prompt_parts.extend(self._format_bp_data(readings))
                        elif vital_type == "heart_rate":
                            prompt_parts.append(f"HEART RATE DATA:")
                            prompt_parts.extend(self._format_hr_data(readings))
                        elif vital_type == "spo2":
                            prompt_parts.append(f"OXYGEN SATURATION DATA:")
                            prompt_parts.extend(self._format_spo2_data(readings))
        
        # LLM instructions
        prompt_parts.append("\nANALYSIS INSTRUCTIONS:")
        prompt_parts.append("1. Focus only on the data relevant to the user's query")
        prompt_parts.append("2. Provide specific analysis of the data shown")
        prompt_parts.append("3. Include summary, observations, and recommendations")
        prompt_parts.append("4. Keep the response concise and professional")
        prompt_parts.append("5. If no relevant data is available, state that clearly")
        
        return "\n".join(prompt_parts)

    def _determine_focus(self, query: str) -> str:
        """Determine what the user is asking for (used in prompt building)"""
        query_lower = query.lower().strip()
        
        if query_lower in ["bp", "blood pressure"]:
            return "Blood Pressure only"
        elif query_lower in ["hr", "heart rate", "pulse"]:
            return "Heart Rate only"
        elif query_lower in ["spo2", "oxygen", "o2"]:
            return "Oxygen Saturation only"
        elif "blood" in query_lower or "bp" in query_lower:
            return "Blood Pressure (primary), other vitals if relevant"
        elif "heart" in query_lower or "pulse" in query_lower:
            return "Heart Rate (primary), other vitals if relevant"
        else:
            return "All available vital signs"

    def _format_bp_data(self, readings: List[Dict]) -> List[str]:
        """Format blood pressure data for LLM prompt"""
        if not readings:
            return ["  No blood pressure data available"]
        
        lines = []
        lines.append(f"  Number of readings: {len(readings)}")
        
        # Show most recent readings
        recent = readings[:10]
        lines.append("  Most recent readings:")
        for reading in recent:
            ts = reading.get('timestamp', 'Unknown time')
            sys = reading.get('systolic', 'N/A')
            dia = reading.get('diastolic', 'N/A')
            lines.append(f"    {ts}: {sys}/{dia} mmHg")
        
        # Add statistics for LLM analysis
        sys_vals = [r.get('systolic', 0) for r in readings if r.get('systolic')]
        dia_vals = [r.get('diastolic', 0) for r in readings if r.get('diastolic')]
        
        if sys_vals and dia_vals:
            lines.append(f"  Systolic range: {min(sys_vals)}–{max(sys_vals)} mmHg")
            lines.append(f"  Diastolic range: {min(dia_vals)}–{max(dia_vals)} mmHg")
            lines.append(f"  Average: {sum(sys_vals)/len(sys_vals):.0f}/{sum(dia_vals)/len(dia_vals):.0f} mmHg")
        
        return lines

    def _format_hr_data(self, readings: List[Dict]) -> List[str]:
        """Format heart rate data for LLM prompt"""
        if not readings:
            return ["  No heart rate data available"]
        
        lines = []
        lines.append(f"  Number of readings: {len(readings)}")
        
        recent = readings[:10]
        lines.append("  Most recent readings:")
        for reading in recent:
            ts = reading.get('timestamp', 'Unknown time')
            value = reading.get('value', 'N/A')
            lines.append(f"    {ts}: {value} bpm")
        
        # Statistics for LLM
        values = [r.get('value', 0) for r in readings if r.get('value')]
        if values:
            lines.append(f"  Range: {min(values)}–{max(values)} bpm")
            lines.append(f"  Average: {sum(values)/len(values):.0f} bpm")
        
        return lines

    def _format_spo2_data(self, readings: List[Dict]) -> List[str]:
        """Format SpO2 data for LLM prompt"""
        if not readings:
            return ["  No oxygen saturation data available"]
        
        lines = []
        lines.append(f"  Number of readings: {len(readings)}")
        
        recent = readings[:10]
        lines.append("  Most recent readings:")
        for reading in recent:
            ts = reading.get('timestamp', 'Unknown time')
            value = reading.get('value', 'N/A')
            lines.append(f"    {ts}: {value}%")
        
        return lines

    def _ensure_relevance(self, response: str, original_query: str) -> str:
        """Ensure LLM response is relevant to the original query"""
        query_lower = original_query.lower().strip()
        
        # If query is specifically about BP, ensure BP is mentioned
        if query_lower in ["bp", "blood pressure"]:
            if "blood pressure" not in response.lower() and "bp" not in response.lower():
                return f"### Blood Pressure Analysis\n\n{response}\n\n[Analysis focused on blood pressure as requested]"
        
        # If query is specifically about HR, ensure HR is mentioned
        elif query_lower in ["hr", "heart rate", "pulse"]:
            if "heart rate" not in response.lower() and "pulse" not in response.lower():
                return f"### Heart Rate Analysis\n\n{response}\n\n[Analysis focused on heart rate as requested]"
        
        return response

    def _generate_fallback_response(self, patient_info: Dict, query: str, data: Dict, health_status: Dict, original_query: str) -> str:
        """Generate a fallback response when LLM is unavailable"""
        
        response_parts = []
        
        query_lower = original_query.lower().strip()
        
        # Generate structured response based on MCP data
        if query_lower in ["bp", "blood pressure"]:
            if "blood_pressure" in data:
                bp_data = data["blood_pressure"]
                if bp_data:
                    response_parts.append("### Blood Pressure Analysis")
                    response_parts.append(f"**Patient:** {patient_info.get('name', 'Unknown')}")
                    response_parts.append(f"**Status:** {health_status.get('summary', 'No status')}")
                    response_parts.append("")
                    response_parts.append("**Summary:**")
                    response_parts.extend(self._format_bp_data(bp_data))
                    response_parts.append("")
                    response_parts.append("**Recommendations:** Regular monitoring recommended. Consult healthcare provider if readings consistently exceed 140/90 mmHg.")
                else:
                    response_parts.append("No blood pressure data available for this patient.")
            else:
                response_parts.append("No blood pressure data available for this patient.")
        
        elif query_lower in ["hr", "heart rate", "pulse"]:
            if "heart_rate" in data:
                hr_data = data["heart_rate"]
                if hr_data:
                    response_parts.append("### Heart Rate Analysis")
                    response_parts.append(f"**Patient:** {patient_info.get('name', 'Unknown')}")
                    response_parts.append(f"**Status:** {health_status.get('summary', 'No status')}")
                    response_parts.append("")
                    response_parts.append("**Summary:**")
                    response_parts.extend(self._format_hr_data(hr_data))
                    response_parts.append("")
                    response_parts.append("**Recommendations:** Heart rate within normal range (60-100 bpm). Continue regular monitoring.")
                else:
                    response_parts.append("No heart rate data available for this patient.")
            else:
                response_parts.append("No heart rate data available for this patient.")
        
        else:
            # General response
            response_parts.append(f"### Patient Health Analysis")
            response_parts.append(f"**Patient:** {patient_info.get('name', 'Unknown')}")
            response_parts.append(f"**Status:** {health_status.get('summary', 'No status')}")
            response_parts.append("")
            
            if data:
                response_parts.append("**Available Data:**")
                for vital_type, readings in data.items():
                    if readings:
                        count = len(readings)
                        response_parts.append(f"- {vital_type.replace('_', ' ').title()}: {count} readings")
            else:
                response_parts.append("No vital sign data available.")
        
        return "\n".join(response_parts)

# -----------------------------
# MCP Context Management
# -----------------------------
# PURPOSE: Maintain conversation context across multiple interactions
# This helps the LLM understand the flow of conversation

class MCPContext:
    def __init__(self):
        self.context_store: Dict[str, Dict[str, Any]] = {}

    def get_context(self, patient_id: str) -> Dict[str, Any]:
        """Get or create context for a patient"""
        if patient_id not in self.context_store:
            self.context_store[patient_id] = {
                "last_observations": [],
                "last_ai_responses": [],
                "query_history": [],
                "summaries": {}
            }
        return self.context_store[patient_id]

    def update_context(self, patient_id: str, observations: List[Dict], ai_response: str, summary: Dict[str, Any], query: str):
        """Update context with new interaction"""
        ctx = self.get_context(patient_id)
        ctx["last_observations"].extend(observations)
        ctx["last_observations"] = ctx["last_observations"][-100:]  # Keep last 100
        ctx["last_ai_responses"].append(ai_response)
        ctx["last_ai_responses"] = ctx["last_ai_responses"][-20:]   # Keep last 20
        ctx["query_history"].append(query)
        ctx["query_history"] = ctx["query_history"][-50:]           # Keep last 50
        ctx["summaries"] = summary

    def build_context_prompt(self, patient_id: str) -> str:
        """Build context summary for LLM prompt"""
        ctx = self.get_context(patient_id)
        lines = []
        if ctx["last_observations"]:
            lines.append("Recent Observations:")
            for obs in ctx["last_observations"][-10:]:
                lines.append(f"- {obs.get('display','')} {obs.get('value','')} {obs.get('unit','')} at {obs.get('timestamp','')}")
        if ctx["last_ai_responses"]:
            lines.append("\nRecent AI Responses:")
            for resp in ctx["last_ai_responses"][-3:]:
                lines.append(f"- {resp[:100]}...")
        if ctx["query_history"]:
            lines.append("\nQuery History:")
            for q in ctx["query_history"][-5:]:
                lines.append(f"- {q}")
        return "\n".join(lines) if lines else "No previous context available."

# -----------------------------
# FastAPI Server - Main Application
# -----------------------------
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Initialize components
fetcher = EnhancedMCPFetcher()      # MCP: Understands queries, fetches FHIR data
processor = EnhancedDataProcessor(fetcher)  # Processes MCP data for LLM
ai_generator = EnhancedAIGenerator()        # LLM: Generates insights
mcp = MCPContext()                   # Context manager

class ChatRequest(BaseModel):
    patient_id: str
    message: str

@app.post("/chat/universal")
async def universal_chat(request: ChatRequest):
    """
    MAIN WORKFLOW ENDPOINT:
    1. Receive patient ID and query
    2. MCP fetches relevant FHIR data
    3. Process data for LLM
    4. LLM generates response
    5. Update MCP context
    6. Return response
    """
    # Input validation
    if not request.patient_id or not request.message:
        return {
            "response": "Error: Patient ID and message are required",
            "patient_exists": False,
            "data_available": False
        }
    
    request.patient_id = str(request.patient_id).strip()
    request.message = str(request.message).strip()
    
    # Step 1: MCP fetches and processes data
    result = processor.process(request.patient_id, request.message)
    if not result.get("success"):
        return {
            "response": result.get("error", "Error processing request"), 
            "patient_exists": False, 
            "data_available": False
        }

    # Step 2: Get conversation context
    context_prompt = mcp.build_context_prompt(request.patient_id)
    
    # Step 3: LLM generates response
    ai_response = ai_generator.generate(
        result["patient"], 
        context_prompt, 
        result["data"], 
        result["health_status"],
        request.message  # Original query
    )

    # Step 4: Prepare data for context update
    all_resources = []
    for typ, info_list in result["data"].items():
        for val in info_list[:5]:  # Limit to 5 most recent per type
            all_resources.append({
                "display": val["display"],
                "value": val["value"],
                "unit": val["unit"],
                "timestamp": val["timestamp"]
            })

    # Step 5: Update MCP context
    mcp.update_context(request.patient_id, all_resources, ai_response, result["data"], request.message)

    # Step 6: Return response
    return {
        "response": ai_response,
        "patient_id": request.patient_id,
        "patient_name": result["patient"]["name"],
        "patient_exists": True,
        "data_available": bool(result["data"]),
        "observations_count": result["total_readings"],
        "found_vitals": result["vitals_found"],
        "num_requested": result["num_requested"],
        "health_status": result["health_status"]["status"],
        "health_summary": result["health_status"]["summary"],
        "query_type": result.get("original_query", "unknown"),
        "mcp_context_snippet": context_prompt[:200]  # Debug info
    }

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "HAPI FHIR MCP Server",
        "endpoints": {
            "chat": "POST /chat/universal",
            "health": "GET /health"
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "fhir_server": FHIR_BASE_URL,
        "ai_service": "available" if RAGARENN_API_KEY else "disabled"
    }

# -----------------------------
# Run server
# -----------------------------
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5001)