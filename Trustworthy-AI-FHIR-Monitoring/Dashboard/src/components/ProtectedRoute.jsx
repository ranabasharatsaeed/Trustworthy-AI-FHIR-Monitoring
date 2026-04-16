import React from "react";
import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ children }) => {
  const patientId = localStorage.getItem("patientId");
  
  if (!patientId) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

export default ProtectedRoute;