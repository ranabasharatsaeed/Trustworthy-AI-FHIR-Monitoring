// src/components/PatientCard.jsx
import React from "react";

const PatientCard = ({ patient }) => {
  if (!patient) return null;

  return (
    <div style={{ 
      border: "1px solid #e0e0e0", 
      padding: "20px", 
      borderRadius: "12px", 
      maxWidth: "300px",
      background: "white",
      boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
    }}>
      <h3 style={{ 
        margin: "0 0 15px 0", 
        color: "#1890ff",
        display: "flex",
        alignItems: "center",
        gap: "8px"
      }}>
        {patient.name === "N/A" ? "🔍 " : "👤 "}
        Patient Information
      </h3>
      
      <div style={{ 
        display: "grid", 
        gap: "12px",
        fontSize: "14px"
      }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <strong style={{ color: "#666" }}>Name:</strong>
          <span style={{ 
            color: patient.name === "N/A" ? "#ff9800" : "#333",
            fontWeight: patient.name === "N/A" ? "normal" : "bold"
          }}>
            {patient.name}
            {patient.name === "N/A" && (
              <span style={{ 
                fontSize: "11px", 
                color: "#ff9800", 
                marginLeft: "8px",
                background: "#fff3e0",
                padding: "2px 6px",
                borderRadius: "4px"
              }}>
                Name not in FHIR record
              </span>
            )}
          </span>
        </div>
        
        <div style={{ 
          height: "1px", 
          background: "#e0e0e0", 
          margin: "5px 0" 
        }}></div>
        
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <strong style={{ color: "#666" }}>Age:</strong>
          <span>{patient.age}</span>
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <strong style={{ color: "#666" }}>Gender:</strong>
          <span style={{ 
            textTransform: "capitalize",
            color: patient.gender === "male" ? "#1890ff" : 
                   patient.gender === "female" ? "#ff4d94" : "#666"
          }}>
            {patient.gender}
          </span>
        </div>
        
        <div style={{ 
          height: "1px", 
          background: "#e0e0e0", 
          margin: "5px 0" 
        }}></div>
        
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <strong style={{ color: "#666" }}>Patient ID:</strong>
          <span style={{ 
            fontSize: "12px", 
            background: "#e3f2fd", 
            padding: "4px 8px", 
            borderRadius: "4px",
            fontFamily: "monospace"
          }}>
            {patient.id || "N/A"}
          </span>
        </div>
        
        {/* Debug button for name issues */}
        {patient.name === "N/A" && (
          <button
            onClick={() => debugPatientName(patient.id)}
            style={{
              marginTop: "10px",
              padding: "8px 12px",
              background: "#fff3e0",
              color: "#ff9800",
              border: "1px solid #ffcc80",
              borderRadius: "6px",
              fontSize: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px"
            }}
          >
            🔍 Debug Name Extraction
          </button>
        )}
      </div>
    </div>
  );
};

export default PatientCard;