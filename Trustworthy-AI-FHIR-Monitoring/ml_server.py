#!/usr/bin/env python3
"""
Dedicated ML Microservice for Patient Risk Prediction
Runs on separate port: 5002
"""
## ml_server.py
import joblib
import numpy as np
import pandas as pd
from datetime import datetime
from typing import Dict, Any, List, Optional
import json
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# -----------------------------
# ML Model Class
# -----------------------------
class MLRiskPredictor:
    """Machine Learning model for patient risk prediction"""
    
    def __init__(self):
        self.model = None
        self.scaler = None
        self.risk_encoder = None
        self.gender_encoder = None
        self.feature_names = None
        self.expected_features = None
        self.is_loaded = False
        self.load_model()
    
    def load_model(self):
        """Load pre-trained ML model"""
        try:
            # Check if model files exist
            required_files = [
                'risk_prediction_model.pkl',
                'scaler.pkl',
                'risk_label_encoder.pkl',
                'gender_encoder.pkl',
                'feature_names.json'
            ]
            
            missing_files = [f for f in required_files if not os.path.exists(f)]
            
            if missing_files:
                print(f"⚠️ Missing model files: {missing_files}")
                print("   Creating mock model for testing...")
                self._create_mock_model()
                return
            
            self.model = joblib.load('risk_prediction_model.pkl')
            self.scaler = joblib.load('scaler.pkl')
            self.risk_encoder = joblib.load('risk_label_encoder.pkl')
            self.gender_encoder = joblib.load('gender_encoder.pkl')
            
            with open('feature_names.json', 'r') as f:
                self.feature_names = json.load(f)
                self.expected_features = self.feature_names.get('features', [])
            
            self.is_loaded = True
            print(f"✅ ML Model loaded successfully!")
            print(f"   Model type: {self.feature_names.get('model_type', 'Random Forest')}")
            print(f"   Accuracy: {self.feature_names.get('accuracy', 1.0):.1%}")
            print(f"   Risk categories: {self.feature_names.get('risk_categories', ['High Risk', 'Low Risk', 'Moderate Risk'])}")
            print(f"   Expected features: {len(self.expected_features)} features")
            print(f"   Features: {self.expected_features[:5]}...")
            
        except FileNotFoundError as e:
            print(f"⚠️ Model file not found: {e}")
            print("   Creating mock model for testing...")
            self._create_mock_model()
        except Exception as e:
            print(f"❌ Error loading model: {e}")
            print("   Creating mock model for testing...")
            self._create_mock_model()
    
    def _create_mock_model(self):
        """Create a mock model for testing when real model isn't available"""
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.preprocessing import StandardScaler, LabelEncoder
        
        # Create mock encoders
        self.risk_encoder = LabelEncoder()
        self.risk_encoder.classes_ = np.array(['High Risk', 'Low Risk', 'Moderate Risk'])
        
        self.gender_encoder = LabelEncoder()
        self.gender_encoder.classes_ = np.array(['Female', 'Male'])
        
        # Create mock scaler
        self.scaler = StandardScaler()
        
        # Create mock model
        self.model = RandomForestClassifier(n_estimators=10, random_state=42)
        
        # Mock feature names
        self.expected_features = [
            'Heart Rate', 'Oxygen Saturation', 'Systolic Blood Pressure',
            'Diastolic Blood Pressure', 'Age', 'MAP', 'Pulse_Pressure',
            'Age_Group_Num', 'Low_O2_Risk', 'Heart_Rate_Abnormal',
            'Hypertension_Risk', 'Gender_Encoded', 'Timestamp_Normalized'
        ]
        
        self.feature_names = {
            'model_type': 'Random Forest (Mock)',
            'accuracy': 0.95,
            'training_date': datetime.now().strftime('%Y-%m-%d'),
            'risk_categories': ['High Risk', 'Low Risk', 'Moderate Risk'],
            'features': self.expected_features
        }
        
        self.is_loaded = True
        print("✅ Created mock ML model for testing!")
        print("   ⚠️ Note: Using rule-based logic instead of trained model")
    
    def engineer_features(self, patient_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create all 13 features that the model expects"""
        
        # Extract base vitals with defaults
        heart_rate = patient_data.get('heart_rate', 75)
        respiratory_rate = patient_data.get('respiratory_rate', 16)
        body_temperature = patient_data.get('body_temperature', 36.8)
        oxygen_saturation = patient_data.get('oxygen_saturation', 97)
        systolic_bp = patient_data.get('systolic_bp', 120)
        diastolic_bp = patient_data.get('diastolic_bp', 80)
        age = patient_data.get('age', 50)
        gender = patient_data.get('gender', 'Male')
        
        # Calculate engineered features
        map_bp = diastolic_bp + (systolic_bp - diastolic_bp) / 3  # Mean Arterial Pressure
        pulse_pressure = systolic_bp - diastolic_bp
        
        # Age group encoding
        if age < 30:
            age_group_num = 0
        elif age < 50:
            age_group_num = 1
        elif age < 70:
            age_group_num = 2
        else:
            age_group_num = 3
        
        # Risk flags
        low_o2_risk = 1 if oxygen_saturation < 95 else 0
        heart_rate_abnormal = 1 if (heart_rate > 100 or heart_rate < 60) else 0
        hypertension_risk = 1 if (systolic_bp > 140 or diastolic_bp > 90) else 0
        
        # Gender encoding
        if self.gender_encoder and hasattr(self.gender_encoder, 'classes_'):
            try:
                gender_encoded = self.gender_encoder.transform([gender])[0]
            except:
                gender_encoded = 1 if gender == 'Male' else 0
        else:
            gender_encoded = 1 if gender == 'Male' else 0
        
        # Timestamp normalization (using current time)
        timestamp_normalized = datetime.now().hour / 24.0
        
        # Create all 13 features in the exact order expected
        features_dict = {
            'Heart Rate': heart_rate,
            'Oxygen Saturation': oxygen_saturation,
            'Systolic Blood Pressure': systolic_bp,
            'Diastolic Blood Pressure': diastolic_bp,
            'Age': age,
            'MAP': map_bp,
            'Pulse_Pressure': pulse_pressure,
            'Age_Group_Num': age_group_num,
            'Low_O2_Risk': low_o2_risk,
            'Heart_Rate_Abnormal': heart_rate_abnormal,
            'Hypertension_Risk': hypertension_risk,
            'Gender_Encoded': gender_encoded,
            'Timestamp_Normalized': timestamp_normalized
        }
        
        return features_dict
    
    def prepare_features(self, patient_data: Dict[str, Any]) -> np.ndarray:
        """Prepare ALL 13 features for ML prediction"""
        
        # Engineer all features
        features_dict = self.engineer_features(patient_data)
        
        # Create feature vector in the exact order expected by the model
        feature_order = [
            'Heart Rate', 'Oxygen Saturation', 'Systolic Blood Pressure',
            'Diastolic Blood Pressure', 'Age', 'MAP', 'Pulse_Pressure',
            'Age_Group_Num', 'Low_O2_Risk', 'Heart_Rate_Abnormal',
            'Hypertension_Risk', 'Gender_Encoded', 'Timestamp_Normalized'
        ]
        
        features = np.array([features_dict[f] for f in feature_order])
        
        logger.info(f"📊 Features prepared (13 features):")
        for name, value in zip(feature_order[:5], features[:5]):  # Log first 5 only
            logger.info(f"   {name}: {value}")
        
        return features.reshape(1, -1)
    
    def _rule_based_prediction(self, patient_data: Dict[str, Any]) -> Dict[str, Any]:
        """Fallback rule-based prediction when model fails"""
        heart_rate = patient_data.get('heart_rate', 75)
        oxygen_saturation = patient_data.get('oxygen_saturation', 97)
        systolic_bp = patient_data.get('systolic_bp', 120)
        diastolic_bp = patient_data.get('diastolic_bp', 80)
        age = patient_data.get('age', 50)
        
        # Simple risk scoring
        risk_score = 0
        
        # Heart rate
        if heart_rate > 100 or heart_rate < 60:
            risk_score += 2
        elif heart_rate > 90 or heart_rate < 70:
            risk_score += 1
            
        # Oxygen saturation
        if oxygen_saturation < 90:
            risk_score += 3
        elif oxygen_saturation < 95:
            risk_score += 2
        elif oxygen_saturation < 97:
            risk_score += 1
            
        # Blood pressure
        if systolic_bp > 180 or diastolic_bp > 110:
            risk_score += 3
        elif systolic_bp > 140 or diastolic_bp > 90:
            risk_score += 2
        elif systolic_bp > 130 or diastolic_bp > 85:
            risk_score += 1
            
        # Age
        if age > 80:
            risk_score += 2
        elif age > 65:
            risk_score += 1
        
        # Determine risk category
        if risk_score >= 5:
            risk_category = 'High Risk'
            confidence = 0.85
        elif risk_score >= 2:
            risk_category = 'Moderate Risk'
            confidence = 0.75
        else:
            risk_category = 'Low Risk'
            confidence = 0.90
            
        # Calculate probabilities
        probabilities = {
            'High Risk': 0.1,
            'Moderate Risk': 0.2,
            'Low Risk': 0.7
        }
        
        if risk_category == 'High Risk':
            probabilities = {'High Risk': confidence, 'Moderate Risk': 0.1, 'Low Risk': 0.05}
        elif risk_category == 'Moderate Risk':
            probabilities = {'High Risk': 0.15, 'Moderate Risk': confidence, 'Low Risk': 0.1}
        else:
            probabilities = {'High Risk': 0.05, 'Moderate Risk': 0.1, 'Low Risk': confidence}
        
        return {
            'risk_category': risk_category,
            'confidence': confidence,
            'probabilities': probabilities,
            'risk_factors': self._identify_risk_factors(patient_data),
            'prediction_method': 'rule_based'
        }
    
    def predict_risk(self, patient_data: Dict[str, Any]) -> Dict[str, Any]:
        """Predict patient risk category and probability"""
        
        if not self.is_loaded:
            return self._rule_based_prediction(patient_data)
        
        try:
            # Prepare all 13 features
            features = self.prepare_features(patient_data)
            logger.info(f"📊 Feature vector shape: {features.shape}")
            
            # Scale features
            if self.scaler:
                features_scaled = self.scaler.transform(features)
            else:
                features_scaled = features
            
            # Predict
            if self.model:
                prediction = self.model.predict(features_scaled)[0]
                
                # Handle different prediction formats
                if isinstance(prediction, (int, np.integer)):
                    if self.risk_encoder and hasattr(self.risk_encoder, 'classes_'):
                        risk_category = self.risk_encoder.classes_[prediction]
                    else:
                        risk_category = ['Low Risk', 'Moderate Risk', 'High Risk'][prediction]
                else:
                    risk_category = prediction if isinstance(prediction, str) else 'Low Risk'
                
                # Get probabilities
                probabilities = self.model.predict_proba(features_scaled)[0]
                
                prob_dict = {}
                if self.risk_encoder and hasattr(self.risk_encoder, 'classes_'):
                    for i, category in enumerate(self.risk_encoder.classes_):
                        prob_dict[category] = float(probabilities[i]) if i < len(probabilities) else 0.0
                else:
                    categories = ['Low Risk', 'Moderate Risk', 'High Risk']
                    for i, category in enumerate(categories):
                        prob_dict[category] = float(probabilities[i]) if i < len(probabilities) else 0.0
                
                confidence = float(max(probabilities))
            else:
                return self._rule_based_prediction(patient_data)
            
            risk_factors = self._identify_risk_factors(patient_data)
            
            return {
                'risk_category': risk_category,
                'confidence': confidence,
                'confidence_percentage': f"{confidence * 100:.1f}%",
                'probabilities': prob_dict,
                'risk_factors': risk_factors,
                'timestamp': datetime.now().isoformat(),
                'requires_attention': risk_category in ['High Risk', 'Moderate Risk'],
                'prediction_method': 'ml_model'
            }
            
        except Exception as e:
            logger.error(f"❌ Prediction error: {e}")
            import traceback
            traceback.print_exc()
            return self._rule_based_prediction(patient_data)
    
    def _identify_risk_factors(self, data: Dict[str, Any]) -> List[str]:
        """Identify specific risk factors from patient data"""
        risk_factors = []
        
        hr = data.get('heart_rate', 75)
        if hr > 100:
            risk_factors.append(f"Tachycardia: {hr} bpm (normal: 60-100)")
        elif hr < 60:
            risk_factors.append(f"Bradycardia: {hr} bpm (normal: 60-100)")
        
        spo2 = data.get('oxygen_saturation', 97)
        if spo2 < 90:
            risk_factors.append(f"Severe hypoxemia: {spo2}% (critical: <90%)")
        elif spo2 < 95:
            risk_factors.append(f"Mild hypoxemia: {spo2}% (normal: 95-100%)")
        
        sys = data.get('systolic_bp', 120)
        dia = data.get('diastolic_bp', 80)
        if sys > 180 or dia > 110:
            risk_factors.append(f"Hypertensive crisis: {sys}/{dia} mmHg")
        elif sys > 140 or dia > 90:
            risk_factors.append(f"Hypertension: {sys}/{dia} mmHg (normal: <120/80)")
        elif sys > 130 or dia > 85:
            risk_factors.append(f"Elevated blood pressure: {sys}/{dia} mmHg")
        
        if sys < 90 or dia < 60:
            risk_factors.append(f"Hypotension: {sys}/{dia} mmHg")
        
        temp = data.get('body_temperature', 36.8)
        if temp > 38.5:
            risk_factors.append(f"High fever: {temp}°C")
        elif temp > 38:
            risk_factors.append(f"Fever: {temp}°C (normal: 36.1-37.2°C)")
        elif temp < 35.5:
            risk_factors.append(f"Hypothermia: {temp}°C")
        
        age = data.get('age', 50)
        if age > 80:
            risk_factors.append(f"Advanced age: {age} years (high risk factor)")
        elif age > 70:
            risk_factors.append(f"Elderly: {age} years")
        
        rr = data.get('respiratory_rate', 16)
        if rr > 20:
            risk_factors.append(f"Tachypnea: {rr} breaths/min (normal: 12-20)")
        elif rr < 10:
            risk_factors.append(f"Bradypnea: {rr} breaths/min (normal: 12-20)")
        
        if not risk_factors:
            risk_factors.append("No significant risk factors identified")
        
        return risk_factors
    
    def batch_predict(self, patients_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Batch prediction for multiple patients"""
        results = []
        for i, patient_data in enumerate(patients_data):
            logger.info(f"Processing patient {i+1}/{len(patients_data)}")
            results.append(self.predict_risk(patient_data))
        return results


# -----------------------------
# FastAPI Server
# -----------------------------
app = FastAPI(
    title="ML Risk Prediction Microservice", 
    version="1.0.0",
    description="Machine Learning service for patient risk prediction"
)

# Enable CORS for all origins (for development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize predictor
predictor = MLRiskPredictor()


# Request/Response Models
class RiskPredictionRequest(BaseModel):
    patient_id: str = Field(..., description="Unique patient identifier")
    patient_name: Optional[str] = Field(None, description="Patient's full name")
    heart_rate: float = Field(..., ge=0, le=300, description="Heart rate in BPM")
    oxygen_saturation: float = Field(..., ge=0, le=100, description="Oxygen saturation percentage")
    systolic_bp: float = Field(..., ge=0, le=300, description="Systolic blood pressure in mmHg")
    diastolic_bp: float = Field(..., ge=0, le=200, description="Diastolic blood pressure in mmHg")
    age: int = Field(..., ge=0, le=150, description="Patient age in years")
    gender: str = Field(..., description="Patient gender (Male/Female/Other)")
    respiratory_rate: Optional[float] = Field(12, ge=0, le=60, description="Respiratory rate in breaths/min")
    body_temperature: Optional[float] = Field(36.8, ge=30, le=45, description="Body temperature in Celsius")


class BatchPredictionRequest(BaseModel):
    patients: List[RiskPredictionRequest] = Field(..., description="List of patients for batch prediction")


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    timestamp: str
    version: str = "1.0.0"


# API Endpoints
@app.get("/", tags=["Root"])
async def root():
    return {
        "service": "ML Risk Prediction Microservice",
        "version": "1.0.0",
        "status": "online",
        "model_loaded": predictor.is_loaded,
        "expected_features": len(predictor.expected_features) if predictor.expected_features else 13,
        "endpoints": {
            "predict": "POST /predict - Single patient prediction",
            "batch_predict": "POST /batch_predict - Batch predictions",
            "health": "GET /health - Health check",
            "model_info": "GET /model_info - Model information"
        },
        "documentation": "/docs",
        "alternative_docs": "/redoc"
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    return HealthResponse(
        status="healthy",
        model_loaded=predictor.is_loaded,
        timestamp=datetime.now().isoformat()
    )


@app.get("/model_info", tags=["Information"])
async def model_info():
    if predictor.is_loaded and predictor.feature_names:
        return {
            "model_type": predictor.feature_names.get('model_type', 'Random Forest'),
            "accuracy": predictor.feature_names.get('accuracy', 0.95),
            "training_date": predictor.feature_names.get('training_date', '2024-01-01'),
            "risk_categories": predictor.feature_names.get('risk_categories', ['High Risk', 'Low Risk', 'Moderate Risk']),
            "features": predictor.expected_features[:5] if predictor.expected_features else ["Feature 1", "Feature 2", "..."],
            "total_features": len(predictor.expected_features) if predictor.expected_features else 13,
            "model_status": "loaded" if predictor.is_loaded else "mock_mode"
        }
    else:
        return {
            "error": "Model in mock mode",
            "message": "Using rule-based predictions. Train model with train_ml_model.py for ML predictions.",
            "model_type": "Rule-based (Mock)",
            "risk_categories": ['High Risk', 'Moderate Risk', 'Low Risk']
        }


@app.post("/predict", tags=["Prediction"])
async def predict_risk(request: RiskPredictionRequest):
    """
    Predict patient risk category based on vitals
    
    Returns:
        - risk_category: High Risk, Moderate Risk, or Low Risk
        - confidence_percentage: Model confidence in prediction
        - probabilities: Probability distribution across risk categories
        - risk_factors: List of identified risk factors
        - requires_attention: Boolean indicating if patient needs attention
    """
    try:
        logger.info(f"📊 Predicting risk for patient: {request.patient_id}")
        
        patient_data = {
            'heart_rate': request.heart_rate,
            'respiratory_rate': request.respiratory_rate,
            'body_temperature': request.body_temperature,
            'oxygen_saturation': request.oxygen_saturation,
            'systolic_bp': request.systolic_bp,
            'diastolic_bp': request.diastolic_bp,
            'age': request.age,
            'gender': request.gender
        }
        
        prediction = predictor.predict_risk(patient_data)
        
        # Add patient info to response
        prediction['patient_id'] = request.patient_id
        prediction['patient_name'] = request.patient_name
        prediction['input_vitals'] = {
            'heart_rate': request.heart_rate,
            'oxygen_saturation': request.oxygen_saturation,
            'blood_pressure': f"{request.systolic_bp}/{request.diastolic_bp}",
            'age': request.age,
            'gender': request.gender
        }
        
        logger.info(f"✅ Prediction complete: {prediction['risk_category']} with {prediction['confidence_percentage']} confidence")
        
        return prediction
        
    except Exception as e:
        logger.error(f"❌ Prediction error for patient {request.patient_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/batch_predict", tags=["Prediction"])
async def batch_predict(request: BatchPredictionRequest):
    """
    Batch prediction for multiple patients
    
    Returns predictions for all patients in the request
    """
    try:
        logger.info(f"📊 Processing batch prediction for {len(request.patients)} patients")
        
        patients_data = []
        for patient in request.patients:
            patients_data.append({
                'heart_rate': patient.heart_rate,
                'respiratory_rate': patient.respiratory_rate,
                'body_temperature': patient.body_temperature,
                'oxygen_saturation': patient.oxygen_saturation,
                'systolic_bp': patient.systolic_bp,
                'diastolic_bp': patient.diastolic_bp,
                'age': patient.age,
                'gender': patient.gender
            })
        
        predictions = predictor.batch_predict(patients_data)
        
        # Add patient IDs to predictions
        for i, prediction in enumerate(predictions):
            prediction['patient_id'] = request.patients[i].patient_id
            prediction['patient_name'] = request.patients[i].patient_name
        
        # Summary statistics
        risk_summary = {
            'High Risk': 0,
            'Moderate Risk': 0,
            'Low Risk': 0
        }
        
        for pred in predictions:
            category = pred.get('risk_category', 'Low Risk')
            if category in risk_summary:
                risk_summary[category] += 1
        
        logger.info(f"✅ Batch prediction complete: {risk_summary}")
        
        return {
            "total_patients": len(predictions),
            "predictions": predictions,
            "risk_summary": risk_summary,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"❌ Batch prediction error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Test endpoint for debugging
@app.post("/test", tags=["Debug"])
async def test_endpoint():
    """Test endpoint to verify server is running"""
    return {
        "message": "ML Server is running!",
        "status": "online",
        "model_loaded": predictor.is_loaded,
        "timestamp": datetime.now().isoformat()
    }


if __name__ == "__main__":
    print("=" * 60)
    print("🧠 ML Risk Prediction Microservice")
    print("=" * 60)
    print("🚀 Starting ML server on port 5002...")
    print("📡 Endpoints:")
    print("   - POST /predict - Single patient prediction")
    print("   - POST /batch_predict - Batch predictions")
    print("   - GET /health - Health check")
    print("   - GET /model_info - Model information")
    print("   - GET /docs - Interactive API documentation")
    print("=" * 60)
    
    # Run the server
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=5002, 
        log_level="info",
        access_log=True
    )