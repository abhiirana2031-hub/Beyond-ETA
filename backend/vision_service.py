import cv2
import mediapipe as mp
import numpy as np
import base64
import math
from typing import Dict, List, Tuple, Any
import logging

logger = logging.getLogger(__name__)

class VisionService:
    def __init__(self):
        try:
            self.mp_face_mesh = mp.solutions.face_mesh
            self.face_mesh = self.mp_face_mesh.FaceMesh(
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
            self.available = True
        except Exception as e:
            logger.warning(f"MediaPipe initialization failed: {e}. Fallback to mock data mode.")
            self.available = False
            self.face_mesh = None

        
        self.LEFT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398]
        self.RIGHT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
        self.LIPS = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]

    def _calculate_ear(self, eye_landmarks: List[Tuple[float, float]]) -> float:
        """Calculate Eye Aspect Ratio (EAR)"""
        # Vertical distances
        v1 = math.hypot(eye_landmarks[12][0] - eye_landmarks[4][0], eye_landmarks[12][1] - eye_landmarks[4][1])
        v2 = math.hypot(eye_landmarks[11][0] - eye_landmarks[5][0], eye_landmarks[11][1] - eye_landmarks[5][1])
        v3 = math.hypot(eye_landmarks[13][0] - eye_landmarks[3][0], eye_landmarks[13][1] - eye_landmarks[3][1])
        
        # Horizontal distance
        h = math.hypot(eye_landmarks[0][0] - eye_landmarks[8][0], eye_landmarks[0][1] - eye_landmarks[8][1])
        
        ear = (v1 + v2 + v3) / (3.0 * h) if h > 0 else 0
        return ear

    def _calculate_mar(self, mouth_landmarks: List[Tuple[float, float]]) -> float:
        """Calculate Mouth Aspect Ratio (MAR)"""
        # Vertical distance (center of lips)
        v = math.hypot(mouth_landmarks[16][0] - mouth_landmarks[5][0], mouth_landmarks[16][1] - mouth_landmarks[5][1])
        # Horizontal distance (corners of mouth)
        h = math.hypot(mouth_landmarks[0][0] - mouth_landmarks[10][0], mouth_landmarks[0][1] - mouth_landmarks[10][1])
        
        mar = v / h if h > 0 else 0
        return mar

    def process_frame(self, image_data: str) -> Dict[str, Any]:
        """Process a single base64 encoded frame and return drowsiness metrics"""
        try:
            # Decode base64 image
            header, encoded = image_data.split(",", 1)
            nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                return {"error": "Invalid image data"}

            # Flip the image horizontally for a later selfie-view display
            img = cv2.flip(img, 1)
            rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            results = self.face_mesh.process(rgb_img)
            
            h, w, _ = img.shape
            
            if not results.multi_face_landmarks:
                return {"detected": False}

            face_landmarks = results.multi_face_landmarks[0]
            landmarks = [(lm.x * w, lm.y * h) for lm in face_landmarks.landmark]

            # Extract specific regions
            left_eye_lms = [landmarks[i] for i in self.LEFT_EYE]
            right_eye_lms = [landmarks[i] for i in self.RIGHT_EYE]
            mouth_lms = [landmarks[i] for i in self.LIPS]

            left_ear = self._calculate_ear(left_eye_lms)
            right_ear = self._calculate_ear(right_eye_lms)
            avg_ear = (left_ear + right_ear) / 2.0
            mar = self._calculate_mar(mouth_lms)

            # Determine thresholds
            # Typically EAR < 0.2 is eyes closed
            eye_closure_rate = max(0, min(1, (0.28 - avg_ear) / 0.15))
            alertness = int((1 - eye_closure_rate) * 100)
            
            is_eyes_closed = avg_ear < 0.21
            is_yawning = mar > 0.5
            
            # Extract basic landmark points for frontend overlay
            overlay_points = {
                "left_eye": left_eye_lms,
                "right_eye": right_eye_lms,
                "mouth": [landmarks[13], landmarks[14], landmarks[17], landmarks[0], landmarks[10]] # Basic mouth shape
            }

            return {
                "detected": True,
                "alertness": alertness,
                "eye_closure": round(eye_closure_rate, 2),
                "avg_ear": round(avg_ear, 3),
                "mar": round(mar, 3),
                "is_eyes_closed": is_eyes_closed,
                "is_yawning": is_yawning,
                "landmarks": overlay_points
            }
            
        except Exception as e:
            return {"error": str(e)}

vision_service = VisionService()
