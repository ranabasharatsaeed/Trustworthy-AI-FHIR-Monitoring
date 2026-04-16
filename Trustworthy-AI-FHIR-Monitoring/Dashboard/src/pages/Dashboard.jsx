import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PatientCard from "../components/PatientCard";
import VitalsLineChart from "../components/Charts/LineChart";
import ChatBox from "../components/ChatBox";

// FHIR and AI Server Configuration
const FHIR_BASE_URL = "https://pdex-server.davinci.hl7.org/fhir";
const AI_SERVER_URL = "http://localhost:5001"; // AI Server (LLM + Chat)
const ML_SERVER_URL = "http://localhost:5002"; // ML Server (Risk Prediction)

// Update interval in milliseconds (60 seconds)
const UPDATE_INTERVAL = 60000; // 60,000 ms = 1 minute

const Dashboard = () => {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const storedPatientId = patientId || localStorage.getItem("patientId");
  
  const [patient, setPatient] = useState({
    name: "Loading...",
    age: "Loading...",
    gender: "unknown",
    heartRate: 0,
    spo2: 0,
    systolicBP: 0,
    diastolicBP: 0
  });

  const [vitalsData, setVitalsData] = useState({
    heartRate: [],
    spo2: [],
    bloodPressure: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  // AI Analysis State
  const [aiAnalysis, setAiAnalysis] = useState({
    loading: false,
    status: "analyzing",
    summary: "Initializing AI analysis...",
    recommendations: [],
    insights: "",
    lastAnalyzed: null
  });

  // ML Risk Prediction State
  const [mlPrediction, setMlPrediction] = useState(null);
  const [mlLoading, setMlLoading] = useState(false);
  const [mlServerStatus, setMlServerStatus] = useState('checking'); // 'checking', 'online', 'offline'

  // Check ML Server Health on Mount (every 60 seconds instead of 30)
  useEffect(() => {
    const checkMLServer = async () => {
      try {
        const response = await fetch(`${ML_SERVER_URL}/health`);
        if (response.ok) {
          const data = await response.json();
          console.log("✅ ML Server is online:", data);
          setMlServerStatus('online');
        } else {
          console.log("❌ ML Server responded with error:", response.status);
          setMlServerStatus('offline');
        }
      } catch (error) {
        console.error("❌ ML Server is offline:", error);
        setMlServerStatus('offline');
      }
    };
    
    checkMLServer();
    // Check every 60 seconds (same as main update interval)
    const interval = setInterval(checkMLServer, UPDATE_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // REMOVED the problematic useEffect that only ran once
  // The ML prediction will now be called directly in fetchVitals() every time

  // Fetch ML Risk Prediction - UPDATED to run every time
  const fetchMLPrediction = async () => {
    console.log("🔍 fetchMLPrediction called at", new Date().toISOString());
    console.log("📊 Current patient data:", {
      heartRate: patient.heartRate,
      spo2: patient.spo2,
      systolicBP: patient.systolicBP,
      diastolicBP: patient.diastolicBP,
      age: patient.age,
      gender: patient.gender
    });
    
    // Don't run if no heart rate data
    if (!patient.heartRate || patient.heartRate === 0) {
      console.log("⚠️ No heart rate data, skipping ML prediction");
      return;
    }
    
    // Don't run if ML server is offline
    if (mlServerStatus === 'offline') {
      console.log("⚠️ ML Server offline, skipping prediction");
      setMlPrediction({
        risk_category: "Unavailable",
        confidence_percentage: "0%",
        error: "ML server is offline",
        requires_attention: false,
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    setMlLoading(true);
    try {
      const requestBody = {
        patient_id: storedPatientId,
        patient_name: patient.name,
        heart_rate: patient.heartRate,
        oxygen_saturation: patient.spo2,
        systolic_bp: patient.systolicBP,
        diastolic_bp: patient.diastolicBP,
        age: parseInt(patient.age) || 50,
        gender: patient.gender || "Male",
        respiratory_rate: 16,
        body_temperature: 36.8
      };
      
      console.log("📤 Sending POST request to:", `${ML_SERVER_URL}/predict`);
      console.log("📤 Request body:", requestBody);
      
      const response = await fetch(`${ML_SERVER_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log("📥 Response status:", response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Error response body:", errorText);
        throw new Error(`ML server error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      // Add timestamp to track when prediction was made
      data.timestamp = new Date().toISOString();
      console.log("✅ ML Risk Prediction received:", data);
      setMlPrediction(data);
      setMlServerStatus('online');
    } catch (error) {
      console.error("❌ ML Prediction Error - Full details:", error);
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      
      setMlPrediction({
        risk_category: "Unavailable",
        confidence_percentage: "0%",
        error: error.message,
        requires_attention: false,
        timestamp: new Date().toISOString()
      });
    } finally {
      setMlLoading(false);
    }
  };

  // Real-time AI Analysis Function
  const fetchAIAnalysis = async (query) => {
    try {
      setAiAnalysis(prev => ({ ...prev, loading: true }));
      
      const response = await fetch(`${AI_SERVER_URL}/chat/universal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patient_id: storedPatientId,
          message: query
        })
      });
      
      if (!response.ok) {
        throw new Error(`AI server error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("🤖 AI Analysis received at", new Date().toISOString());
      
      const analysis = parseAIAnalysis(data.response);
      
      setAiAnalysis({
        loading: false,
        status: data.health_status || analysis.status,
        summary: data.health_summary || analysis.summary,
        recommendations: analysis.recommendations,
        insights: data.response,
        lastAnalyzed: new Date(),
        vitalsCount: data.observations_count,
        foundVitals: data.found_vitals
      });
      
      return data;
    } catch (error) {
      console.error("❌ AI Analysis Error:", error);
      setAiAnalysis({
        loading: false,
        status: "error",
        summary: "AI analysis temporarily unavailable",
        recommendations: ["Check if AI server is running on port 5001"],
        insights: "Unable to connect to AI service",
        lastAnalyzed: new Date()
      });
      return null;
    }
  };

  // Parse AI response into structured format
  const parseAIAnalysis = (aiResponse) => {
    const response = aiResponse.toLowerCase();
    
    let status = "stable";
    let summary = "Patient condition is stable";
    let recommendations = [];
    
    if (response.includes("critical") || response.includes("urgent")) {
      status = "critical";
      summary = "Critical values detected - immediate attention required";
      recommendations = ["Contact healthcare provider immediately", "Review all vital signs", "Consider emergency assessment"];
    } else if (response.includes("attention") || response.includes("elevated") || response.includes("outside normal")) {
      status = "attention";
      summary = "Some vitals require monitoring";
      recommendations = ["Monitor vitals closely", "Schedule follow-up", "Review trends"];
    } else if (response.includes("stable") || response.includes("normal")) {
      status = "stable";
      summary = "All vitals within normal ranges";
      recommendations = ["Continue regular monitoring", "Maintain healthy lifestyle"];
    }
    
    if (response.includes("monitor")) recommendations.push("Continue monitoring vitals");
    if (response.includes("blood pressure") && response.includes("elevated")) recommendations.push("Check blood pressure again in 15 minutes");
    if (response.includes("heart rate") && response.includes("high")) recommendations.push("Rest and recheck heart rate");
    if (response.includes("oxygen") && response.includes("low")) recommendations.push("Ensure proper oxygen levels");
    
    return { status, summary, recommendations };
  };

  const getAIStatusUpdate = async () => {
    return await fetchAIAnalysis("how is the patient doing overall? Based on latest vitals, provide brief status and recommendations");
  };

  // Fetch patient data from FHIR
  const fetchPatientData = async () => {
    try {
      if (!storedPatientId) {
        navigate("/login");
        return;
      }

      const res = await fetch(`${FHIR_BASE_URL}/Patient/${storedPatientId}?_format=json`);
      
      if (!res.ok) {
        if (res.status === 404) {
          localStorage.removeItem("patientId");
          localStorage.removeItem("patientName");
          navigate("/login");
          return;
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const patientResource = await res.json();
      console.log("✅ Patient Data from PDex Server:", patientResource);
      
      const patientName = extractPatientName(patientResource);
      
      let age = "N/A";
      if (patientResource.birthDate) {
        const birthDate = new Date(patientResource.birthDate);
        const today = new Date();
        const ageDiff = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        age = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
          ? ageDiff - 1 
          : ageDiff;
      }
      
      setPatient((prev) => ({
        ...prev,
        name: patientName,
        age: age,
        gender: patientResource.gender || "unknown",
        id: storedPatientId
      }));
      
      if (patientName !== "N/A") {
        localStorage.setItem("patientName", patientName);
      }
      
    } catch (err) {
      console.error("❌ Error fetching patient:", err);
      setError("Failed to load patient data");
    }
  };

  const extractPatientName = (patientResource) => {
    if (!patientResource || !patientResource.name || patientResource.name.length === 0) {
      return "N/A";
    }
    
    const nameEntry = patientResource.name[0];
    
    if (nameEntry.text) return nameEntry.text;
    
    if (nameEntry.use === 'official' && (nameEntry.given || nameEntry.family)) {
      const givenNames = nameEntry.given ? nameEntry.given.join(" ") : "";
      const familyName = nameEntry.family || "";
      return `${givenNames} ${familyName}`.trim();
    }
    
    if (nameEntry.given || nameEntry.family) {
      const givenNames = nameEntry.given ? nameEntry.given.join(" ") : "";
      const familyName = nameEntry.family || "";
      const name = `${givenNames} ${familyName}`.trim();
      if (name) return name;
    }
    
    return localStorage.getItem("patientName") || "N/A";
  };

  // Fetch vitals from FHIR
  const fetchVitals = async () => {
    try {
      if (!storedPatientId) return;

      const hrRes = await fetch(`${FHIR_BASE_URL}/Observation?patient=${storedPatientId}&code=8867-4&_sort=-date&_count=20`);
      const spo2Res = await fetch(`${FHIR_BASE_URL}/Observation?patient=${storedPatientId}&code=2708-6&_sort=-date&_count=20`);
      const bpRes = await fetch(`${FHIR_BASE_URL}/Observation?patient=${storedPatientId}&code=85354-9&_sort=-date&_count=20`);

      const [hrData, spo2Data, bpData] = await Promise.all([
        hrRes.ok ? hrRes.json() : { entry: [] },
        spo2Res.ok ? spo2Res.json() : { entry: [] },
        bpRes.ok ? bpRes.json() : { entry: [] }
      ]);

      const heartRateArr = hrData.entry?.map((entry) => {
        const obs = entry.resource;
        const value = obs.valueQuantity?.value;
        const timestamp = obs.effectiveDateTime || new Date().toISOString();
        return {
          name: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          value: value,
          fullTime: timestamp,
          unit: obs.valueQuantity?.unit || "bpm"
        };
      }).filter(item => item.value !== undefined && item.value !== null) || [];

      const spo2Arr = spo2Data.entry?.map((entry) => {
        const obs = entry.resource;
        const value = obs.valueQuantity?.value;
        const timestamp = obs.effectiveDateTime || new Date().toISOString();
        return {
          name: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          value: value,
          fullTime: timestamp,
          unit: obs.valueQuantity?.unit || "%"
        };
      }).filter(item => item.value !== undefined && item.value !== null) || [];

      const bpArr = bpData.entry?.map((entry) => {
        const obs = entry.resource;
        const components = obs.component || [];
        const systolic = components.find(c => c.code?.coding?.[0]?.code === "8480-6")?.valueQuantity?.value;
        const diastolic = components.find(c => c.code?.coding?.[0]?.code === "8462-4")?.valueQuantity?.value;
        const timestamp = obs.effectiveDateTime || new Date().toISOString();
        return {
          name: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          systolic: systolic,
          diastolic: diastolic,
          fullTime: timestamp,
          display: systolic && diastolic ? `${systolic}/${diastolic} mmHg` : "No data"
        };
      }).filter(item => item.systolic !== undefined && item.diastolic !== undefined) || [];

      const latestHR = heartRateArr.length > 0 ? heartRateArr[0].value : 0;
      const latestSpO2 = spo2Arr.length > 0 ? spo2Arr[0].value : 0;
      const latestBP = bpArr.length > 0 ? bpArr[0] : { systolic: 0, diastolic: 0 };

      setPatient((prev) => ({
        ...prev,
        heartRate: latestHR,
        spo2: latestSpO2,
        systolicBP: latestBP.systolic,
        diastolicBP: latestBP.diastolic,
        bloodPressure: `${latestBP.systolic || 0}/${latestBP.diastolic || 0}`
      }));

      setVitalsData({
        heartRate: heartRateArr.slice(0, 20).reverse(),
        spo2: spo2Arr.slice(0, 20).reverse(),
        bloodPressure: bpArr.slice(0, 20).reverse()
      });

      setLastUpdate(new Date());
      setLoading(false);
      setError(null);
      
      // Get AI analysis and ML prediction in parallel (every time)
      console.log("🔄 Fetching AI and ML analysis at", new Date().toISOString());
      await Promise.all([
        getAIStatusUpdate(),
        fetchMLPrediction()  // This will now run every time
      ]);
      
    } catch (err) {
      console.error("❌ Error fetching vitals:", err);
      setError(`Failed to load vitals: ${err.message}`);
      setLoading(false);
    }
  };

  // ML Risk Card Component - UPDATED with timestamp display
  const MLRiskCard = ({ prediction, loading, serverStatus }) => {
    if (loading) {
      return (
        <div style={{
          background: "white",
          padding: "20px",
          borderRadius: "12px",
          marginBottom: "20px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "center" }}>
            <div style={{
              width: "20px",
              height: "20px",
              border: "2px solid #e0e0e0",
              borderTop: "2px solid #1890ff",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }}></div>
            <span>🧠 ML Model analyzing risk...</span>
          </div>
        </div>
      );
    }

    if (serverStatus === 'offline' || !prediction || prediction.risk_category === "Unavailable") {
      return (
        <div style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          padding: "20px",
          borderRadius: "12px",
          marginBottom: "20px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          textAlign: "center",
          color: "white"
        }}>
          <div style={{ fontSize: "48px", marginBottom: "10px" }}>🔧</div>
          <h3 style={{ margin: "0 0 10px 0", color: "white" }}>ML Risk Assessment</h3>
          <p style={{ margin: "10px 0", fontSize: "14px", opacity: 0.95 }}>
            {prediction?.error || "ML service is not available"}
          </p>
          <div style={{ 
            background: "rgba(255,255,255,0.2)", 
            padding: "10px", 
            borderRadius: "8px",
            fontSize: "12px",
            marginTop: "10px"
          }}>
            💡 Tip: Make sure ML server is running on port 5002
          </div>
          <button 
            onClick={fetchMLPrediction}
            style={{
              marginTop: "15px",
              padding: "8px 20px",
              background: "white",
              color: "#667eea",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "14px"
            }}
          >
            🔄 Retry Connection
          </button>
        </div>
      );
    }

    const getRiskColor = (risk) => {
      if (risk === 'High Risk') return { bg: '#ff4757', light: '#ffebee', text: '#c0392b' };
      if (risk === 'Moderate Risk') return { bg: '#ffa502', light: '#fff3e0', text: '#d35400' };
      return { bg: '#2ed573', light: '#e8f5e9', text: '#27ae60' };
    };

    const getRiskIcon = (risk) => {
      if (risk === 'High Risk') return '🚨';
      if (risk === 'Moderate Risk') return '⚠️';
      return '✅';
    };

    const colors = getRiskColor(prediction.risk_category);
    const requiresAttention = prediction.requires_attention || prediction.risk_category === 'Moderate Risk';

    return (
      <div style={{
        background: "white",
        padding: "20px",
        borderRadius: "12px",
        marginBottom: "20px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        borderLeft: `4px solid ${colors.bg}`,
        transition: "all 0.3s ease"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            🧠 ML Risk Assessment
          </h3>
          {requiresAttention && (
            <span style={{
              background: colors.light,
              color: colors.bg,
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "11px",
              fontWeight: "bold"
            }}>
              Requires Attention
            </span>
          )}
        </div>

        <div style={{
          background: colors.light,
          padding: "20px",
          borderRadius: "10px",
          marginBottom: "15px",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "48px", marginBottom: "5px" }}>
            {getRiskIcon(prediction.risk_category)}
          </div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: colors.text }}>
            {prediction.risk_category}
          </div>
          <div style={{ fontSize: "13px", color: "#666", marginTop: "8px" }}>
            Confidence: {prediction.confidence_percentage}
          </div>
        </div>

        {prediction.risk_factors && prediction.risk_factors.length > 0 && prediction.risk_factors[0] !== "No significant risk factors identified" && (
          <div style={{ marginBottom: "15px" }}>
            <strong style={{ fontSize: "13px", display: "block", marginBottom: "8px", color: "#2c3e50" }}>
              📋 Identified Risk Factors:
            </strong>
            <ul style={{ margin: 0, paddingLeft: "20px" }}>
              {prediction.risk_factors.map((factor, idx) => (
                <li key={idx} style={{ fontSize: "13px", marginBottom: "6px", color: "#555" }}>
                  {factor}
                </li>
              ))}
            </ul>
          </div>
        )}

        {prediction.probabilities && (
          <div>
            <strong style={{ fontSize: "12px", display: "block", marginBottom: "8px", color: "#2c3e50" }}>
              Probability Distribution:
            </strong>
            {Object.entries(prediction.probabilities).map(([category, prob]) => {
              const categoryColor = category === 'High Risk' ? '#ff4757' : category === 'Moderate Risk' ? '#ffa502' : '#2ed573';
              return (
                <div key={category} style={{ marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "4px" }}>
                    <span>{category}</span>
                    <span style={{ fontWeight: "bold", color: categoryColor }}>{(prob * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{
                    width: "100%",
                    height: "6px",
                    background: "#e0e0e0",
                    borderRadius: "3px",
                    overflow: "hidden"
                  }}>
                    <div style={{
                      width: `${(prob * 100).toFixed(1)}%`,
                      height: "100%",
                      background: categoryColor,
                      transition: "width 0.5s ease"
                    }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{
          marginTop: "15px",
          padding: "8px",
          background: "#f8f9fa",
          borderRadius: "6px",
          fontSize: "10px",
          color: "#666",
          textAlign: "center"
        }}>
          🤖 ML Model: Random Forest | Last updated: {prediction.timestamp ? new Date(prediction.timestamp).toLocaleTimeString() : 'Just now'}
        </div>
      </div>
    );
  };

  // AI-Powered Patient Status Component
  const AIPatientStatus = ({ aiAnalysis }) => {
    const getStatusColor = () => {
      switch(aiAnalysis.status) {
        case "critical": return "#ff4757";
        case "attention": return "#ffa502";
        case "stable": return "#2ed573";
        default: return "#1890ff";
      }
    };
    
    const getStatusIcon = () => {
      switch(aiAnalysis.status) {
        case "critical": return "🚨";
        case "attention": return "⚠️";
        case "stable": return "✅";
        default: return "🤖";
      }
    };
    
    return (
      <div style={{
        padding: "20px",
        background: getStatusColor(),
        color: "white",
        borderRadius: "12px",
        marginBottom: "20px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        transition: "all 0.3s ease"
      }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "15px"
        }}>
          <div style={{ fontSize: "24px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>{getStatusIcon()}</span>
            <span>
              {aiAnalysis.status === "critical" && "Critical Condition"}
              {aiAnalysis.status === "attention" && "Needs Attention"}
              {aiAnalysis.status === "stable" && "Stable"}
              {!aiAnalysis.status && "AI Analyzing..."}
            </span>
          </div>
          {aiAnalysis.loading && (
            <div style={{
              width: "20px",
              height: "20px",
              border: "2px solid white",
              borderTop: "2px solid transparent",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }}></div>
          )}
        </div>
        
        <div style={{ fontSize: "14px", marginBottom: "10px", opacity: 0.95 }}>
          {aiAnalysis.summary}
        </div>
        
        {aiAnalysis.recommendations && aiAnalysis.recommendations.length > 0 && (
          <div style={{ 
            marginTop: "12px", 
            padding: "10px", 
            background: "rgba(255,255,255,0.2)", 
            borderRadius: "8px",
            fontSize: "13px"
          }}>
            <strong>📋 AI Recommendations:</strong>
            <ul style={{ margin: "8px 0 0 20px", padding: 0 }}>
              {aiAnalysis.recommendations.slice(0, 3).map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
        
        {aiAnalysis.lastAnalyzed && (
          <div style={{ 
            marginTop: "10px", 
            fontSize: "11px", 
            opacity: 0.8,
            display: "flex",
            justifyContent: "space-between"
          }}>
            <span>🤖 AI Analysis</span>
            <span>Last analyzed: {aiAnalysis.lastAnalyzed.toLocaleTimeString()}</span>
          </div>
        )}
      </div>
    );
  };

  // AI Insights Card Component
  const AIInsightsCard = ({ aiAnalysis, onRefresh }) => {
    return (
      <div style={{
        background: "white",
        padding: "20px",
        borderRadius: "12px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        marginBottom: "20px"
      }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          marginBottom: "15px"
        }}>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            🧠 AI Clinical Insights
          </h3>
          <button
            onClick={onRefresh}
            disabled={aiAnalysis.loading}
            style={{
              padding: "6px 12px",
              background: "#1890ff",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}
          >
            {aiAnalysis.loading ? "⟳" : "🔄"} Refresh
          </button>
        </div>
        
        <div style={{
          background: "#f8f9fa",
          padding: "15px",
          borderRadius: "8px",
          fontSize: "14px",
          lineHeight: "1.6",
          color: "#2d3436",
          maxHeight: "200px",
          overflowY: "auto"
        }}>
          {aiAnalysis.loading ? (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <div style={{
                width: "30px",
                height: "30px",
                border: "3px solid #e0e0e0",
                borderTop: "3px solid #1890ff",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto 10px"
              }}></div>
              <p>AI is analyzing patient data...</p>
            </div>
          ) : aiAnalysis.insights ? (
            <div>
              {aiAnalysis.insights.split('\n').map((paragraph, idx) => (
                <p key={idx} style={{ margin: "0 0 10px 0" }}>{paragraph}</p>
              ))}
              {aiAnalysis.vitalsCount && (
                <div style={{ 
                  marginTop: "10px", 
                  fontSize: "12px", 
                  color: "#666",
                  borderTop: "1px solid #e0e0e0",
                  paddingTop: "10px"
                }}>
                  📊 Analyzed {aiAnalysis.vitalsCount} observations | 
                  Vitals: {aiAnalysis.foundVitals?.join(", ")}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: "center", color: "#666" }}>
              <p>🤖 Click refresh to get AI analysis</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Blood Pressure Chart Component
  const BloodPressureChart = ({ data }) => {
    if (!data || data.length === 0) {
      return (
        <div style={{ 
          textAlign: "center", 
          color: "#666", 
          padding: "20px",
          background: "#f8f9fa",
          borderRadius: "8px",
          height: "200px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center"
        }}>
          <div style={{ fontSize: "32px", marginBottom: "10px" }}>🩸</div>
          <p>No blood pressure data</p>
        </div>
      );
    }

    const maxValue = Math.max(...data.map(item => Math.max(item.systolic || 0, item.diastolic || 0)));
    const scaleFactor = 150 / (maxValue || 120);

    return (
      <div style={{ 
        position: "relative",
        height: "300px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        paddingBottom: "20px"
      }}>
        <div style={{ 
          display: "flex", 
          alignItems: "flex-end", 
          height: "140px",
          gap: "6px",
          padding: "0 5px"
        }}>
          {data.map((bp, index) => (
            <div key={index} style={{ 
              display: "flex", 
              flexDirection: "column", 
              alignItems: "center",
              flex: 1,
              height: "100%",
              position: "relative"
            }}>
              <div style={{
                position: "absolute",
                bottom: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: "14px",
                height: "200%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                alignItems: "center"
              }}>
                <div style={{ 
                  height: `${(bp.systolic || 0) * scaleFactor}px`,
                  width: "10px",
                  background: "#ff6b6b",
                  borderRadius: "3px 3px 0 0",
                  marginBottom: "1px",
                  transition: "height 0.3s ease"
                }}></div>
                <div style={{ 
                  height: `${(bp.diastolic || 0) * scaleFactor}px`,
                  width: "10px",
                  background: "#4ecdc4",
                  borderRadius: "0 0 3px 3px",
                  transition: "height 0.3s ease"
                }}></div>
              </div>
              <div style={{ 
                fontSize: "10px", 
                color: "#666",
                marginTop: "5px",
                textAlign: "center",
                transform: "rotate(-45deg)",
                transformOrigin: "top left",
                position: "absolute",
                bottom: "-25px",
                left: "50%",
                whiteSpace: "nowrap"
              }}>
                {bp.name}
              </div>
            </div>
          ))}
        </div>
        <div style={{ 
          display: "flex", 
          justifyContent: "center", 
          gap: "15px", 
          fontSize: "11px",
          color: "#666",
          marginTop: "30px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "10px", height: "10px", background: "#ff6b6b", borderRadius: "2px" }}></div>
            Systolic
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "10px", height: "10px", background: "#4ecdc4", borderRadius: "2px" }}></div>
            Diastolic
          </div>
        </div>
      </div>
    );
  };

  // Fetch data on component mount and periodically (UPDATED to 60 seconds)
  useEffect(() => {
    if (!storedPatientId) {
      navigate("/login");
      return;
    }

    const fetchData = async () => {
      try {
        await fetchPatientData();
        await fetchVitals();
      } catch (err) {
        console.error("Error in fetchData:", err);
      }
    };

    fetchData();
    // Changed from 15000 to UPDATE_INTERVAL (60000 ms = 1 minute)
    const interval = setInterval(fetchData, UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [storedPatientId]);

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("patientId");
    localStorage.removeItem("patientName");
    localStorage.removeItem("patientInfo");
    navigate("/login");
  };

  const handleRefreshAI = async () => {
    await getAIStatusUpdate();
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", fontFamily: "Arial, sans-serif" }}>
        <h2>🔄 Loading patient data...</h2>
        <p>Fetching from PDex FHIR server at {FHIR_BASE_URL}</p>
        <div style={{ marginTop: "20px", padding: "20px", background: "#f8f9fa", borderRadius: "8px", display: "inline-block" }}>
          <div style={{ 
            width: "40px", height: "40px", border: "4px solid #f3f3f3",
            borderTop: "4px solid #1890ff", borderRadius: "50%",
            animation: "spin 1s linear infinite", margin: "0 auto"
          }}></div>
          <p style={{ marginTop: "10px", fontSize: "14px" }}>Patient ID: {storedPatientId}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px", color: "#d63031", fontFamily: "Arial, sans-serif" }}>
        <h2>❌ Connection Error</h2>
        <p>{error}</p>
        <div style={{ background: "#ffeaa7", padding: "15px", borderRadius: "5px", marginTop: "15px", maxWidth: "600px" }}>
          <h4>🚨 Troubleshooting Steps</h4>
          <ul style={{ textAlign: "left" }}>
            <li>Patient ID <strong>{storedPatientId}</strong> might not exist on PDex server</li>
            <li>Check if patient exists: 
              <a href={`${FHIR_BASE_URL}/Patient/${storedPatientId}`} target="_blank" rel="noopener noreferrer" style={{ color: "#1976d2", marginLeft: "5px" }}>
                Verify Patient
              </a>
            </li>
            <li>Make sure AI server is running on port 5001</li>
            <li>Make sure ML server is running on port 5002</li>
          </ul>
          <button onClick={() => navigate("/login")} style={{ marginTop: "15px", padding: "10px 20px", background: "#1890ff", color: "white", border: "none", borderRadius: "5px", cursor: "pointer" }}>
            🔄 Try Different Patient
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", maxWidth: "1400px", margin: "0 auto", background: "#f8f9fa", minHeight: "100vh" }}>
      
      {/* Header */}
      <div style={{ background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h1 style={{ color: "#1890ff", margin: "0 0 10px 0", fontSize: "28px", display: "flex", alignItems: "center", gap: "10px" }}>
              🧠 AI + ML Powered PDex FHIR Dashboard
            </h1>
            <div style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap" }}>
              <div style={{ background: "#e3f2fd", padding: "6px 12px", borderRadius: "6px", fontSize: "14px", display: "flex", alignItems: "center", gap: "5px" }}>
                {patient.name === "N/A" ? "🔍" : "👤"}
                <strong>{patient.name === "N/A" ? "Name not found" : patient.name}</strong> | ID: {storedPatientId}
              </div>
              <div style={{ fontSize: "14px", color: "#666" }}>
                <strong>Gender:</strong> {patient.gender} | <strong>Age:</strong> {patient.age}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <div style={{ background: "#e3f2fd", padding: "8px 12px", borderRadius: "6px", fontSize: "12px", color: "#1976d2" }}>
              🕒 Last update: {lastUpdate.toLocaleTimeString()}
            </div>
            <button 
              onClick={fetchMLPrediction}
              style={{ 
                padding: "8px 16px", 
                background: "#ffa502", 
                color: "white", 
                border: "none", 
                borderRadius: "6px", 
                cursor: "pointer", 
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              🧪 Test ML
            </button>
            <button onClick={handleLogout} style={{ padding: "8px 16px", background: "#ff4757", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", gap: "5px" }}>
              🚪 Logout
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "20px", alignItems: "start" }}>
        
        {/* Left Column */}
        <div>
          <AIPatientStatus aiAnalysis={aiAnalysis} />
          
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "20px", marginBottom: "20px" }}>
            <PatientCard patient={patient} />
            
            <div style={{ background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
              <h3 style={{ margin: "0 0 15px 0", color: "#2d3436" }}>📈 Vital Statistics</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "15px" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>❤️ Heart Rate</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: patient.heartRate >= 60 && patient.heartRate <= 100 ? "#2ed573" : "#ff4757" }}>
                    {patient.heartRate} <span style={{ fontSize: "14px", color: "#666" }}>bpm</span>
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>💨 Oxygen Level</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: patient.spo2 >= 95 ? "#2ed573" : "#ffa502" }}>
                    {patient.spo2} <span style={{ fontSize: "14px", color: "#666" }}>%</span>
                  </div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "12px", color: "#666", marginBottom: "5px" }}>🩸 Blood Pressure</div>
                  <div style={{ fontSize: "24px", fontWeight: "bold", color: (patient.systolicBP >= 90 && patient.systolicBP <= 120 && patient.diastolicBP >= 60 && patient.diastolicBP <= 80) ? "#2ed573" : "#ff4757" }}>
                    {patient.systolicBP || 0}/{patient.diastolicBP || 0} <span style={{ fontSize: "14px", color: "#666" }}>mmHg</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div style={{ background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginBottom: "20px" }}>
            <h2 style={{ margin: "0 0 20px 0", color: "#2d3436" }}>📊 Real-time Vitals Monitoring</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
              <div>
                <h3 style={{ color: "#ff4d4f", marginBottom: "15px", fontSize: "16px" }}>❤️ Heart Rate</h3>
                <div style={{ height: "200px" }}>
                  {vitalsData.heartRate.length > 0 ? (
                    <VitalsLineChart data={vitalsData.heartRate} dataKey="value" color="#ff4d4f" label="Heart Rate (bpm)" />
                  ) : (
                    <div style={{ textAlign: "center", color: "#666", padding: "20px", background: "#f8f9fa", borderRadius: "8px" }}>
                      <p>No heart rate data</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <h3 style={{ color: "#1890ff", marginBottom: "15px", fontSize: "16px" }}>💨 SpO2</h3>
                <div style={{ height: "200px" }}>
                  {vitalsData.spo2.length > 0 ? (
                    <VitalsLineChart data={vitalsData.spo2} dataKey="value" color="#1890ff" label="Oxygen (%)" />
                  ) : (
                    <div style={{ textAlign: "center", color: "#666", padding: "20px", background: "#f8f9fa", borderRadius: "8px" }}>
                      <p>No SpO2 data</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <h3 style={{ color: "#52c41a", marginBottom: "15px", fontSize: "16px" }}>🩸 Blood Pressure</h3>
                <div style={{ height: "200px" }}>
                  <BloodPressureChart data={vitalsData.bloodPressure} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div>
          {/* ML Risk Card - Added key for force re-render */}
          <MLRiskCard 
            key={mlPrediction?.timestamp || Date.now()}
            prediction={mlPrediction} 
            loading={mlLoading} 
            serverStatus={mlServerStatus} 
          />
          
          {/* AI Insights Card */}
          <AIInsightsCard aiAnalysis={aiAnalysis} onRefresh={handleRefreshAI} />

          {/* Chat Box */}
          <div style={{ background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginBottom: "20px" }}>
            <h2 style={{ margin: "0 0 20px 0", color: "#2d3436", display: "flex", alignItems: "center", gap: "10px" }}>
              💬 Medical AI Assistant
            </h2>
            <p style={{ color: "#666", fontSize: "14px", marginBottom: "15px" }}>
              Ask questions about {patient.name === "N/A" ? "the patient's" : patient.name + "'s"} data, trends, or health status.
            </p>
            <ChatBox patient={patient} vitalsData={vitalsData} patientId={storedPatientId} />
          </div>

          {/* System Info - Updated to show 60 seconds */}
          <div style={{ background: "white", padding: "15px", borderRadius: "12px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", fontSize: "12px", color: "#666" }}>
            <h4 style={{ margin: "0 0 10px 0", color: "#2d3436" }}>System Information</h4>
            <div style={{ display: "grid", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>🔄 Update Frequency:</span>
                <span>Every 60 seconds</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>📡 FHIR Server:</span>
                <span style={{ color: "#2ed573" }}>PDex FHIR Server</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>🤖 AI Server:</span>
                <span style={{ color: "#2ed573" }}>Port 5001 ✅</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>🧠 ML Server:</span>
                <span style={{ color: mlServerStatus === 'online' ? "#2ed573" : "#ff4757" }}>
                  Port 5002 {mlServerStatus === 'online' ? '✅' : '❌'}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>📊 Data Points:</span>
                <span>{vitalsData.heartRate.length + vitalsData.spo2.length + vitalsData.bloodPressure.length} readings</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: "20px", fontSize: "12px", color: "#666", textAlign: "center", padding: "15px", background: "white", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
        <div>🧠 AI + ML Powered Healthcare Monitoring | Real-time analysis with LLM + Random Forest | Updates every 60 seconds</div>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default Dashboard;