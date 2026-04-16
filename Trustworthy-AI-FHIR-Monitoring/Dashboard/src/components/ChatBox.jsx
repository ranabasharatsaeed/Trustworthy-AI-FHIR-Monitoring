import React, { useState, useRef, useEffect } from "react";

const ChatBox = ({ patient, vitalsData, patientId }) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: `Hello! I'm your Medical MCP Assistant for patient ${patient.name}. I can analyze any medical data from the FHIR server. Ask me anything about heart rate, blood pressure, oxygen levels, trends, or overall health assessment.`,
      sender: "ai",
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [patientStats, setPatientStats] = useState(null);
  const [showStatsInfo, setShowStatsInfo] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch patient stats when component mounts
  useEffect(() => {
    const fetchPatientStats = async () => {
      try {
        // Test the server connection first
        const healthResponse = await fetch("http://localhost:5001/health");
        if (!healthResponse.ok) {
          throw new Error("Server is not running");
        }
        
        // Get patient info from our server
        const response = await fetch(`http://localhost:5001/patient/${patientId}`);
        const data = await response.json();
        
        if (data.success) {
          setPatientStats({
            patientName: data.data.name,
            patientId: patientId,
            age: data.data.age,
            gender: data.data.gender
          });
        }
      } catch (err) {
        console.log("Server not available or patient not found:", err.message);
        // Use fallback stats
        setPatientStats({
          patientName: patient.name,
          patientId: patientId,
          age: "Unknown",
          gender: "Unknown"
        });
      }
    };
    
    fetchPatientStats();
  }, [patientId, patient.name]);

  // Send message to AI server
  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: inputMessage,
      sender: "user",
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);
    setError(null);

    try {
      console.log("🤖 Sending message to server for patient:", patientId);
      
      // Use the CORRECT endpoint: /chat/universal
      const response = await fetch("http://localhost:5001/chat/universal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: inputMessage,
          patient_id: patientId,
          patient_name: patient.name
        }),
      });

      console.log("📡 Server response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Server error response:", errorText);
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log("✅ Server response received:", data);

      const aiMessage = {
        id: Date.now() + 1,
        text: data.response || "I received your message but got an empty response.",
        sender: "ai",
        timestamp: new Date(),
        patientInfo: {
          exists: data.patient_exists,
          name: data.patient_name,
          observationCount: data.observations_count,
          dataAvailable: data.data_available,
          foundVitals: data.found_vitals || data.available_vitals || []
        }
      };

      setMessages(prev => [...prev, aiMessage]);
      
    } catch (err) {
      console.error("❌ Chat error:", err);
      
      let errorMessage = "Failed to get response. ";
      
      if (err.message.includes("Failed to fetch")) {
        errorMessage = "I'm having trouble connecting to the Medical MCP system. Please check if the server is running on http://localhost:5001";
      } else {
        errorMessage += err.message;
      }
      
      setError(errorMessage);
      
      // Fallback message
      const errorFallbackMessage = {
        id: Date.now() + 1,
        text: "I'm having trouble connecting to the Medical MCP system. Please check if the server is running on http://localhost:5001",
        sender: "ai",
        timestamp: new Date(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorFallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle direct data query (without AI)
  const handleDirectData = async (queryType = "heart rate") => {
    try {
      setIsLoading(true);
      setError(null);
      
      const userMessage = {
        id: Date.now(),
        text: `Show me ${queryType} data`,
        sender: "user",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      
      // Use the direct data endpoint
      const response = await fetch("http://localhost:5001/direct/data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: queryType,
          patient_id: patientId,
          patient_name: patient.name
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      const aiMessage = {
        id: Date.now() + 1,
        text: data.response || "Received data but response was empty.",
        sender: "ai",
        timestamp: new Date(),
        isDirectData: true,
        patientInfo: {
          dataAvailable: data.data_available
        }
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error("❌ Direct data error:", err);
      setError("Failed to fetch data. " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle test query (quick check)
  const handleTestQuery = async (query = "heart rate") => {
    try {
      setIsLoading(true);
      setError(null);
      
      const userMessage = {
        id: Date.now(),
        text: `Test: ${query}`,
        sender: "user",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      
      // Use the test endpoint
      const response = await fetch("http://localhost:5001/test/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: query,
          patient_id: patientId,
          patient_name: patient.name
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Format the response
      let responseText = `**Test Results for "${query}":**\n\n`;
      responseText += `Patient: ${data.patient}\n`;
      responseText += `Found: ${data.vitals_found.join(", ") || "None"}\n`;
      responseText += `Total readings: ${data.total_readings}\n\n`;
      
      if (data.data_preview) {
        responseText += "**Data Preview:**\n";
        Object.entries(data.data_preview).forEach(([type, info]) => {
          responseText += `• ${info.display}: ${info.latest} ${info.unit} (${info.count} readings)\n`;
        });
      }

      const aiMessage = {
        id: Date.now() + 1,
        text: responseText,
        sender: "ai",
        timestamp: new Date(),
        isTestResult: true
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error("❌ Test query error:", err);
      setError("Test failed. " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Get suggested questions based on available endpoints
  const getSuggestedQuestions = () => {
    return [
      "Analyze blood pressure patterns",
      "Show oxygen saturation trends",
      "What is the heart rate history?",
      "Give me overall health assessment",
      "Check all vital signs",
      "Is oxygen level normal?",
      "Show last 10 heart readings",
      "Analyze BP fluctuations"
    ];
  };

  // Handle quick analysis button
  const handleQuickAnalysis = async () => {
    const analysisMessage = `Analyze ${patient.name}'s current health status based on all available vital signs.`;
    setInputMessage(analysisMessage);
    
    setTimeout(() => {
      if (inputMessage === analysisMessage) {
        sendMessage();
      }
    }, 100);
  };

  // Toggle stats information panel
  const toggleStatsInfo = () => {
    setShowStatsInfo(!showStatsInfo);
  };

  // Check server health
  const checkServerHealth = async () => {
    try {
      const response = await fetch("http://localhost:5001/health");
      if (response.ok) {
        return { healthy: true };
      }
      return { healthy: false };
    } catch (err) {
      return { healthy: false, error: err.message };
    }
  };

  // Handle server connection check
  const handleCheckServer = async () => {
    setIsLoading(true);
    const health = await checkServerHealth();
    
    if (health.healthy) {
      const message = {
        id: Date.now(),
        text: "✅ Server is running and healthy! You can now ask medical questions.",
        sender: "ai",
        timestamp: new Date(),
        isSystem: true
      };
      setMessages(prev => [...prev, message]);
      setError(null);
    } else {
      setError("⚠️ Server is not responding. Please make sure the server is running on http://localhost:5001");
    }
    setIsLoading(false);
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "500px",
      background: "white",
      borderRadius: "12px",
      border: "1px solid #e0e0e0",
      position: "relative"
    }}>
      {/* Stats Info Panel */}
      {showStatsInfo && patientStats && (
        <div style={{
          position: "absolute",
          top: "60px",
          right: "20px",
          width: "300px",
          background: "white",
          borderRadius: "8px",
          border: "1px solid #e0e0e0",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          zIndex: 100,
          padding: "15px",
          fontSize: "12px"
        }}>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            marginBottom: "10px"
          }}>
            <strong>📋 Patient Information</strong>
            <button 
              onClick={toggleStatsInfo}
              style={{ 
                background: "none", 
                border: "none", 
                cursor: "pointer",
                fontSize: "16px"
              }}
            >
              ✕
            </button>
          </div>
          
          <div style={{ marginBottom: "10px" }}>
            <div><strong>Name:</strong> {patientStats.patientName}</div>
            <div><strong>ID:</strong> {patientStats.patientId}</div>
            <div><strong>Age:</strong> {patientStats.age}</div>
            <div><strong>Gender:</strong> {patientStats.gender}</div>
          </div>
          
          <div style={{ 
            padding: "8px", 
            background: "#f8f9fa", 
            borderRadius: "4px",
            marginBottom: "10px"
          }}>
            <strong>Available Endpoints:</strong>
            <div style={{ fontSize: "11px", marginTop: "4px" }}>
              • POST /chat/universal<br/>
              • POST /direct/data<br/>
              • POST /test/query<br/>
              • GET /patient/{patientId}<br/>
              • GET /health
            </div>
          </div>
          
          <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #e0e0e0" }}>
            <button
              onClick={handleCheckServer}
              style={{
                width: "100%",
                padding: "6px",
                background: "#00b894",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "11px"
              }}
            >
              Test Server Connection
            </button>
          </div>
        </div>
      )}

      {/* Chat Header with Patient Info */}
      <div style={{
        padding: "15px",
        borderBottom: "1px solid #e0e0e0",
        background: "#f8f9fa",
        borderTopLeftRadius: "12px",
        borderTopRightRadius: "12px"
      }}>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between"
        }}>
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "10px",
            fontWeight: "bold",
            color: "#2d3436"
          }}>
            <div style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#2ed573",
              animation: "pulse 2s infinite"
            }}></div>
            🏥 Medical MCP Assistant - {patient.name}
            {patientStats && (
              <button
                onClick={toggleStatsInfo}
                style={{
                  marginLeft: "10px",
                  padding: "2px 8px",
                  background: "#6c5ce7",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "10px",
                  cursor: "pointer"
                }}
              >
                Info
              </button>
            )}
          </div>
          
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => handleDirectData("heart rate")}
              disabled={isLoading}
              style={{
                padding: "6px 12px",
                background: "#00b894",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              ❤️ Heart Data
            </button>
            <button
              onClick={() => handleTestQuery("oxygen level")}
              disabled={isLoading}
              style={{
                padding: "6px 12px",
                background: "#6c5ce7",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              💨 Oxygen Test
            </button>
            <button
              onClick={handleQuickAnalysis}
              disabled={isLoading}
              style={{
                padding: "6px 12px",
                background: "#1890ff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "11px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              📊 Quick Analysis
            </button>
          </div>
        </div>
        <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
          Patient ID: {patientId} | Server: http://localhost:5001
          <button
            onClick={handleCheckServer}
            style={{
              marginLeft: "10px",
              padding: "2px 6px",
              background: "#dfe6e9",
              border: "none",
              borderRadius: "4px",
              fontSize: "10px",
              cursor: "pointer"
            }}
          >
            Test Connection
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div style={{
        flex: 1,
        padding: "15px",
        overflowY: "auto",
        background: "#fafafa"
      }}>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              display: "flex",
              justifyContent: message.sender === "user" ? "flex-end" : "flex-start",
              marginBottom: "15px"
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                padding: "12px 16px",
                borderRadius: "18px",
                background: message.sender === "user" ? "#1890ff" : 
                           message.isError ? "#ffeaa7" : 
                           message.isSystem ? "#d1f7c4" :
                           message.isTestResult ? "#f0e6ff" : 
                           message.isDirectData ? "#e8f4fd" : "#e3f2fd",
                color: message.sender === "user" ? "white" : 
                       message.isError ? "#d63031" : 
                       message.isSystem ? "#2e7d32" :
                       message.isTestResult ? "#6c5ce7" :
                       message.isDirectData ? "#0984e3" : "#2d3436",
                border: message.isError ? "1px solid #ffa502" : 
                        message.isSystem ? "1px solid #81c784" :
                        message.isTestResult ? "1px solid #a29bfe" :
                        message.isDirectData ? "1px solid #74b9ff" : "none",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
                fontSize: "14px",
                lineHeight: "1.4"
              }}
            >
              {message.text}
              {message.patientInfo && (
                <div style={{
                  fontSize: "10px",
                  color: message.isError ? "#d63031" : "#666",
                  marginTop: "5px",
                  paddingTop: "5px",
                  borderTop: "1px dashed rgba(0,0,0,0.1)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  {message.patientInfo.dataAvailable && (
                    <span>✅ Data available</span>
                  )}
                  {message.patientInfo.observationCount > 0 && (
                    <span>📊 {message.patientInfo.observationCount} records</span>
                  )}
                  {message.patientInfo.foundVitals && message.patientInfo.foundVitals.length > 0 && (
                    <span>📈 Found: {message.patientInfo.foundVitals.join(", ")}</span>
                  )}
                </div>
              )}
              <div style={{
                fontSize: "10px",
                opacity: 0.7,
                marginTop: "5px",
                textAlign: "right",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "4px"
              }}>
                {message.timestamp.toLocaleTimeString([], { 
                  hour: '2-digit', minute: '2-digit' 
                })}
                {message.isSystem && " 🔧"}
                {message.isTestResult && " 🧪"}
                {message.isDirectData && " 📋"}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "15px" }}>
            <div style={{
              padding: "12px 16px",
              borderRadius: "18px",
              background: "#e3f2fd",
              color: "#2d3436",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              <div style={{ 
                width: "12px",
                height: "12px",
                border: "2px solid #1890ff",
                borderTop: "2px solid transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite"
              }}></div>
              Querying MCP server...
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      {messages.length <= 2 && (
        <div style={{
          padding: "15px",
          borderTop: "1px solid #e0e0e0",
          background: "#f8f9fa"
        }}>
          <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
            💡 Try asking:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {getSuggestedQuestions().map((question, index) => (
              <button
                key={index}
                onClick={() => setInputMessage(question)}
                style={{
                  padding: "6px 12px",
                  background: "white",
                  border: "1px solid #e0e0e0",
                  borderRadius: "16px",
                  fontSize: "11px",
                  color: "#2d3436",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseOver={(e) => {
                  e.target.style.background = "#1890ff";
                  e.target.style.color = "white";
                }}
                onMouseOut={(e) => {
                  e.target.style.background = "white";
                  e.target.style.color = "#2d3436";
                }}
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div style={{
          padding: "10px 15px",
          background: "#ffeaa7",
          border: "1px solid #ffa502",
          color: "#d63031",
          fontSize: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div>⚠️</div>
            <div>{error}</div>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <button
              onClick={() => window.open('http://localhost:5001', '_blank')}
              style={{
                background: "#d63031",
                color: "white",
                border: "none",
                borderRadius: "4px",
                padding: "2px 8px",
                fontSize: "10px",
                cursor: "pointer"
              }}
            >
              Open Server
            </button>
            <button
              onClick={handleCheckServer}
              style={{
                background: "#00b894",
                color: "white",
                border: "none",
                borderRadius: "4px",
                padding: "2px 8px",
                fontSize: "10px",
                cursor: "pointer"
              }}
            >
              Test Again
            </button>
            <button
              onClick={() => setError(null)}
              style={{
                background: "none",
                border: "none",
                color: "#d63031",
                cursor: "pointer",
                fontSize: "14px",
                padding: "0 4px"
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div style={{
        padding: "15px",
        borderTop: "1px solid #e0e0e0",
        background: "white",
        borderBottomLeftRadius: "12px",
        borderBottomRightRadius: "12px"
      }}>
        <div style={{ display: "flex", gap: "10px" }}>
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Ask about ${patient.name}'s medical data (heart rate, blood pressure, oxygen)...`}
            style={{
              flex: 1,
              padding: "12px",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              resize: "none",
              fontSize: "14px",
              fontFamily: "inherit",
              minHeight: "50px",
              maxHeight: "100px"
            }}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !inputMessage.trim()}
            style={{
              padding: "12px 20px",
              background: isLoading ? "#ccc" : "#1890ff",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontWeight: "bold",
              alignSelf: "flex-end",
              display: "flex",
              alignItems: "center",
              gap: "5px"
            }}
          >
            {isLoading ? (
              <>
                <div style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid white",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite"
                }}></div>
                Processing...
              </>
            ) : (
              "📤 Send"
            )}
          </button>
        </div>
        <div style={{ 
          fontSize: "11px", 
          color: "#666", 
          marginTop: "8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span>Press Enter to send, Shift+Enter for new line</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <a 
              href="http://localhost:5001"
              target="_blank"
              rel="noopener noreferrer"
              style={{ 
                fontSize: "10px", 
                color: "#1890ff", 
                textDecoration: "none" 
              }}
            >
              Server Dashboard
            </a>
            <span style={{ 
              fontSize: "10px", 
              padding: "2px 6px", 
              background: "#f0f0f0", 
              borderRadius: "4px"
            }}>
              Patient: {patientId}
            </span>
          </div>
        </div>
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
};

export default ChatBox;