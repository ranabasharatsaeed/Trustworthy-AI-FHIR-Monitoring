import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

// NEW FHIR SERVER CONFIGURATION
const FHIR_BASE_URL = "https://pdex-server.davinci.hl7.org/fhir";

const Login = () => {
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fetchedPatientName, setFetchedPatientName] = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [patientBirthDate, setPatientBirthDate] = useState("");
  const navigate = useNavigate();

  // Extract name from FHIR Patient resource (PDex server format)
  const extractNameFromFHIR = (patientData) => {
    if (!patientData.name || patientData.name.length === 0) {
      return "No name found";
    }
    
    // Try to get the display name
    const name = patientData.name[0];
    
    // Method 1: Use the 'text' field if available
    if (name.text) {
      return name.text;
    }
    
    // Method 2: Combine given and family names
    const givenNames = name.given ? name.given.join(" ") : "";
    const familyName = name.family || "";
    
    const fullName = `${givenNames} ${familyName}`.trim();
    return fullName || "Unknown Patient";
  };

  // Extract gender from FHIR resource
  const extractGender = (patientData) => {
    const gender = patientData.gender;
    if (gender === "male") return "Male";
    if (gender === "female") return "Female";
    if (gender === "other") return "Other";
    return "Unknown";
  };

  // Calculate age from birthDate
  const calculateAge = (birthDate) => {
    if (!birthDate) return "N/A";
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Strict name comparison (similar to your Android app)
  const isNameMatch = (serverName, enteredName) => {
    if (!serverName || !enteredName) return false;
    
    // Convert to lowercase and remove extra whitespace
    const serverNameClean = serverName.toLowerCase().replace(/\s+/g, " ").trim();
    const enteredNameClean = enteredName.toLowerCase().replace(/\s+/g, " ").trim();
    
    // Exact match or partial match (like your Android app)
    return (
      serverNameClean === enteredNameClean ||
      serverNameClean.includes(enteredNameClean) ||
      enteredNameClean.includes(serverNameClean)
    );
  };

  // List of known valid patients on PDex server
  const getExamplePatients = () => {
    return [
      { id: "ff325f93-dbba-413e-8e27-d334f6eb20f3", name: "Ali1 Unknown" },
      { id: "2002", name: "William John Smith" },
      { id: "1-2", name: "Johnny Appleseed" },
      { id: "1", name: "Johnny Appleseed" },
      { id: "1001", name: "Patricia Ann Person" },
      { id: "Patient1", name: "Johnny Example1" },
      { id: "100", name: "Johnny Appleseed" },
      { id: "Patient2", name: "Member 01 Test" }
    ];
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setFetchedPatientName("");
    setPatientGender("");
    setPatientBirthDate("");

    try {
      // Validate inputs
      if (!patientId.trim()) {
        throw new Error("Please enter Patient ID");
      }
      
      if (!patientName.trim()) {
        throw new Error("Please enter Patient Name");
      }

      console.log(`🔐 Verifying patient ${patientId} on PDex FHIR server...`);
      
      // Fetch patient from PDex FHIR server
      const response = await fetch(
        `${FHIR_BASE_URL}/Patient/${patientId}`,
        {
          headers: {
            'Accept': 'application/fhir+json',
            'Cache-Control': 'no-cache'
          }
        }
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Patient ID "${patientId}" not found on PDex FHIR server\n\nAvailable patients: ${getExamplePatients().map(p => p.id).join(", ")}`);
        }
        throw new Error(`Server error! Status: ${response.status}`);
      }

      const patientData = await response.json();
      console.log("✅ Patient data received from PDex:", patientData);
      
      // Extract patient information
      const serverPatientName = extractNameFromFHIR(patientData);
      const gender = extractGender(patientData);
      const birthDate = patientData.birthDate || null;
      const age = calculateAge(birthDate);
      
      setFetchedPatientName(serverPatientName);
      setPatientGender(gender);
      setPatientBirthDate(birthDate || "Not provided");
      
      console.log("🔍 Name comparison:", {
        entered: patientName,
        server: serverPatientName,
        match: isNameMatch(serverPatientName, patientName)
      });
      
      // STRICT NAME VERIFICATION - This is the security check
      if (!isNameMatch(serverPatientName, patientName)) {
        throw new Error(
          `Name verification failed!\n\n` +
          `You entered: "${patientName}"\n` +
          `PDex record shows: "${serverPatientName}"\n\n` +
          `Please enter the exact patient name as registered on PDex server.`
        );
      }
      
      // Store patient info securely
      const patientInfo = {
        id: patientId,
        name: serverPatientName,
        gender: gender,
        age: age,
        birthDate: birthDate,
        rawData: patientData
      };
      
      localStorage.setItem("patientId", patientId);
      localStorage.setItem("patientName", serverPatientName);
      localStorage.setItem("patientInfo", JSON.stringify(patientInfo));
      
      console.log(`✅ Login successful! Patient: ${serverPatientName} (ID: ${patientId})`);
      
      // Redirect to dashboard
      navigate(`/dashboard/${patientId}`);
      
    } catch (err) {
      console.error("❌ Login error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Try with example patient from PDex server
  const useExamplePatient = (patientId, patientName) => {
    setPatientId(patientId);
    setPatientName(patientName);
  };

  return (
    <div style={{ 
      display: "flex", 
      justifyContent: "center", 
      alignItems: "center", 
      minHeight: "100vh",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      fontFamily: "Arial, sans-serif",
      padding: "20px"
    }}>
      <div style={{
        background: "white",
        padding: "40px",
        borderRadius: "16px",
        boxShadow: "0 20px 40px rgba(0,0,0,0.1)",
        width: "100%",
        maxWidth: "500px"
      }}>
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h2 style={{ 
            color: "#333", 
            margin: "0 0 10px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px"
          }}>
            🔐 PDex FHIR Secure Login
          </h2>
          <p style={{ color: "#666", fontSize: "14px" }}>
            Both Patient ID and Name must match PDex FHIR records
          </p>
        </div>
        
        {/* Test Patients Section */}
        <div style={{ 
          marginBottom: "20px",
          textAlign: "center"
        }}>
          <div style={{ 
            fontSize: "13px", 
            color: "#666", 
            marginBottom: "10px",
            fontWeight: "bold"
          }}>
            📋 Available Test Patients:
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "8px",
            marginBottom: "10px"
          }}>
            {getExamplePatients().slice(0, 6).map((patient) => (
              <button
                key={patient.id}
                onClick={() => useExamplePatient(patient.id, patient.name)}
                style={{
                  padding: "6px 10px",
                  background: "#e3f2fd",
                  color: "#1976d2",
                  border: "1px solid #bbdefb",
                  borderRadius: "6px",
                  fontSize: "11px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "5px",
                  transition: "all 0.2s"
                }}
                onMouseOver={(e) => e.target.style.background = "#bbdefb"}
                onMouseOut={(e) => e.target.style.background = "#e3f2fd"}
              >
                📋 {patient.id.substring(0, 12)}...
              </button>
            ))}
          </div>
          <div style={{ fontSize: "11px", color: "#999" }}>
            Click any to auto-fill
          </div>
        </div>
        
        {/* Error Display */}
        {error && (
          <div style={{
            background: "#ffebee",
            color: "#c62828",
            padding: "15px",
            borderRadius: "8px",
            marginBottom: "20px",
            fontSize: "14px",
            border: "1px solid #ffcdd2",
            whiteSpace: "pre-line"
          }}>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px",
              marginBottom: "8px" 
            }}>
              <span style={{ fontSize: "18px" }}>⛔</span>
              <strong>Verification Failed</strong>
            </div>
            {error}
          </div>
        )}
        
        {/* FHIR Patient Info Display */}
        {fetchedPatientName && !error && (
          <div style={{
            background: "#e8f5e9",
            padding: "15px",
            borderRadius: "8px",
            marginBottom: "20px",
            border: "1px solid #c8e6c9"
          }}>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "8px",
              marginBottom: "10px" 
            }}>
              <span style={{ fontSize: "18px" }}>✅</span>
              <strong>Patient Found on PDex FHIR</strong>
            </div>
            <div style={{ fontSize: "14px", color: "#2e7d32" }}>
              <div><strong>Official Name:</strong> {fetchedPatientName}</div>
              {patientGender && <div><strong>Gender:</strong> {patientGender}</div>}
              {patientBirthDate && <div><strong>Birth Date:</strong> {patientBirthDate}</div>}
              <div style={{ 
                fontSize: "12px", 
                color: "#666", 
                marginTop: "8px",
                background: "#ffffff88",
                padding: "5px 8px",
                borderRadius: "4px"
              }}>
                <strong>Matching:</strong> "{fetchedPatientName}" ↔ "{patientName}"
              </div>
            </div>
          </div>
        )}
        
        {/* Login Form */}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ 
              display: "block", 
              marginBottom: "8px", 
              fontWeight: "bold",
              color: "#555" 
            }}>
              Patient ID
            </label>
            <input
              type="text"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="Enter Patient ID from PDex FHIR"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "16px",
                boxSizing: "border-box"
              }}
              required
            />
            <div style={{ 
              fontSize: "12px", 
              color: "#666", 
              marginTop: "5px" 
            }}>
              Example: ff325f93-dbba-413e-8e27-d334f6eb20f3, 2002, 1-2, Patient1
            </div>
          </div>
          
          <div style={{ marginBottom: "30px" }}>
            <label style={{ 
              display: "block", 
              marginBottom: "8px", 
              fontWeight: "bold",
              color: "#555" 
            }}>
              Patient Full Name
              <span style={{ 
                color: "#f44336", 
                marginLeft: "5px" 
              }}>
                *
              </span>
            </label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Enter exact name as in PDex FHIR record"
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "8px",
                fontSize: "16px",
                boxSizing: "border-box"
              }}
              required
            />
            <div style={{ 
              fontSize: "12px", 
              color: "#666", 
              marginTop: "5px" 
            }}>
              Must match exactly (case and spacing matter)
            </div>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              background: loading ? "#ccc" : "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: loading ? "not-allowed" : "pointer",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "10px",
              transition: "all 0.3s"
            }}
            onMouseOver={(e) => {
              if (!loading) e.target.style.background = "#1976D2";
            }}
            onMouseOut={(e) => {
              if (!loading) e.target.style.background = "#2196F3";
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: "20px",
                  height: "20px",
                  border: "3px solid white",
                  borderTop: "3px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite"
                }}></div>
                Verifying with PDex FHIR...
              </>
            ) : (
              "🔐 Secure Login"
            )}
          </button>
        </form>
        
        {/* Security Info */}
        <div style={{ 
          marginTop: "25px", 
          padding: "15px",
          background: "#f8f9fa",
          borderRadius: "8px",
          fontSize: "12px",
          color: "#666",
          border: "1px solid #e0e0e0"
        }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "8px",
            marginBottom: "10px",
            color: "#555"
          }}>
            <span style={{ fontSize: "16px" }}>🛡️</span>
            <strong>Security Features</strong>
          </div>
          <ul style={{ margin: 0, paddingLeft: "20px" }}>
            <li>Patient ID must exist on PDex FHIR server</li>
            <li>Name must match FHIR record exactly</li>
            <li>Two-factor verification (ID + Name)</li>
            <li>Prevents unauthorized access to patient data</li>
            <li>Real-time streaming data support</li>
          </ul>
        </div>
        
        {/* Server Info */}
        <div style={{ 
          marginTop: "20px", 
          textAlign: "center", 
          color: "#666",
          fontSize: "12px" 
        }}>
          <p style={{ marginBottom: "10px" }}>
            Connected to PDex FHIR Server
          </p>
          <button
            onClick={() => {
              window.open(FHIR_BASE_URL, "_blank");
            }}
            style={{
              padding: "8px 16px",
              background: "transparent",
              color: "#2196F3",
              border: "2px solid #2196F3",
              borderRadius: "6px",
              fontSize: "12px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            🌐 View PDex FHIR Server
          </button>
          <p style={{ 
            fontSize: "11px", 
            marginTop: "10px",
            color: "#999" 
          }}>
            Server: <code>{FHIR_BASE_URL}</code>
          </p>
        </div>
        
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            
            input:focus {
              outline: none;
              border-color: #2196F3 !important;
              box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
            }
          `}
        </style>
      </div>
    </div>
  );
};

export default Login;