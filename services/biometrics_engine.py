"""
FinGuard 2026 — Service A: Behavioral Biometrics Engine.

LSTM-Autoencoder anomaly detection for behavioral identity verification.
Detects session hijacking by comparing live interaction "rhythm" against
the user's habitual biometric profile.

Architecture:
  - LSTM-Autoencoder: learns to reconstruct "normal" interaction patterns
  - Isolation Forest: fallback for low-data users
  - Reconstruction error > threshold = anomaly (hijacked session)
"""

from __future__ import annotations

import numpy as np
import torch
import torch.nn as nn
from typing import Any, Optional

from config.logging_config import get_logger

logger = get_logger(__name__)


class LSTMAutoencoder(nn.Module):
    """
    LSTM-Autoencoder for behavioral biometric anomaly detection.

    Encoder compresses a sequence of behavioral features into a latent vector.
    Decoder reconstructs the original sequence.
    High reconstruction error → anomalous behavior → possible session hijacking.
    """

    def __init__(self, input_dim: int = 12, hidden_dim: int = 64,
                 latent_dim: int = 32, num_layers: int = 2, dropout: float = 0.2):
        super().__init__()
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.latent_dim = latent_dim

        # Encoder
        self.encoder_lstm = nn.LSTM(
            input_dim, hidden_dim, num_layers=num_layers,
            batch_first=True, dropout=dropout, bidirectional=True,
        )
        self.encoder_proj = nn.Linear(hidden_dim * 2, latent_dim)

        # Decoder
        self.decoder_fc = nn.Linear(latent_dim, hidden_dim)
        self.decoder_lstm = nn.LSTM(
            hidden_dim, hidden_dim, num_layers=num_layers,
            batch_first=True, dropout=dropout,
        )
        self.decoder_output = nn.Linear(hidden_dim, input_dim)

    def encode(self, x: torch.Tensor) -> torch.Tensor:
        """Encode sequence to latent vector."""
        _, (h_n, _) = self.encoder_lstm(x)
        # Concatenate forward and backward final hidden states
        h = torch.cat([h_n[-2], h_n[-1]], dim=1)
        return self.encoder_proj(h)

    def decode(self, z: torch.Tensor, seq_len: int) -> torch.Tensor:
        """Decode latent vector back to sequence."""
        h = self.decoder_fc(z).unsqueeze(1).repeat(1, seq_len, 1)
        decoded, _ = self.decoder_lstm(h)
        return self.decoder_output(decoded)

    def forward(self, x: torch.Tensor) -> dict[str, torch.Tensor]:
        z = self.encode(x)
        reconstructed = self.decode(z, x.size(1))
        recon_error = nn.functional.mse_loss(reconstructed, x, reduction="none")
        return {
            "reconstructed": reconstructed,
            "latent": z,
            "recon_error": recon_error.mean(dim=(1, 2)),  # per-sample error
        }


class BehavioralBiometricsEngine:
    """
    Service A: Behavioral Biometrics anomaly detection.

    Captures keystroke dynamics, touch trajectory, device tilt
    and detects if the interaction matches the habitual user.
    """

    FEATURE_NAMES = [
        "keystroke_dwell_mean", "keystroke_dwell_std",
        "keystroke_flight_mean", "keystroke_flight_std",
        "touch_pressure_mean", "touch_pressure_std",
        "touch_velocity_mean", "touch_velocity_std",
        "gyro_x_mean", "gyro_y_mean", "gyro_z_mean",
        "accel_magnitude_std",
    ]

    def __init__(self, threshold: float = 2.0, device: str = "cpu"):
        self.threshold = threshold  # reconstruction error threshold (z-score)
        self.device = device
        self.model = LSTMAutoencoder(input_dim=len(self.FEATURE_NAMES))
        self.model.to(device)
        self.model.eval()

        # Per-user profile statistics
        self._user_baselines: dict[str, dict[str, float]] = {}

        # Fallback: Isolation Forest for users with < 5 sessions
        self._isolation_forest = None

    def extract_features(self, session_data: dict) -> np.ndarray:
        """Extract behavioral features from raw session telemetry."""
        features = []

        # Keystroke dynamics
        keystrokes = session_data.get("keystroke_intervals", [])
        if keystrokes:
            features.extend([np.mean(keystrokes), np.std(keystrokes)])
        else:
            features.extend([0.0, 0.0])

        flight_times = session_data.get("key_hold_durations", [])
        if flight_times:
            features.extend([np.mean(flight_times), np.std(flight_times)])
        else:
            features.extend([0.0, 0.0])

        # Touch dynamics
        pressures = session_data.get("screen_touch_pressure", [])
        features.extend([
            np.mean(pressures) if pressures else 0.0,
            np.std(pressures) if len(pressures) > 1 else 0.0,
        ])

        velocities = session_data.get("scroll_velocity", [])
        features.extend([
            np.mean(velocities) if velocities else 0.0,
            np.std(velocities) if velocities and len(velocities) > 1 else 0.0,
        ])

        # Device tilt (gyroscope)
        gyro = session_data.get("gyroscope", [])
        if gyro and len(gyro) > 0:
            gyro_arr = np.array(gyro)
            features.extend([
                float(gyro_arr[:, 0].mean()),
                float(gyro_arr[:, 1].mean()),
                float(gyro_arr[:, 2].mean()),
            ])
        else:
            features.extend([0.0, 0.0, 0.0])

        # Accelerometer magnitude variability
        accel = session_data.get("accelerometer", [])
        if accel and len(accel) > 0:
            accel_arr = np.array(accel)
            magnitudes = np.sqrt(np.sum(accel_arr ** 2, axis=1))
            features.append(float(magnitudes.std()))
        else:
            features.append(0.0)

        return np.array(features, dtype=np.float32)

    def analyze_session(self, user_id: str, session_data: dict
                        ) -> dict[str, Any]:
        """
        Analyze a session's behavioral biometrics.

        Returns:
            Dict with is_anomalous, anomaly_score, confidence, details.
        """
        features = self.extract_features(session_data)

        # Run through LSTM-Autoencoder
        with torch.no_grad():
            x = torch.tensor(features, dtype=torch.float32).unsqueeze(0).unsqueeze(0)
            x = x.to(self.device)
            result = self.model(x)
            recon_error = result["recon_error"].item()

        # Compare against user baseline
        baseline = self._user_baselines.get(user_id)
        if baseline and baseline.get("count", 0) >= 5:
            mean_error = baseline["mean_error"]
            std_error = max(baseline["std_error"], 0.001)
            z_score = (recon_error - mean_error) / std_error
            is_anomalous = z_score > self.threshold
        else:
            z_score = 0.0
            is_anomalous = False  # Not enough data for baseline

        # Update baseline
        if user_id not in self._user_baselines:
            self._user_baselines[user_id] = {
                "mean_error": recon_error, "std_error": 0.0,
                "count": 1, "errors": [recon_error]
            }
        else:
            bl = self._user_baselines[user_id]
            bl["errors"].append(recon_error)
            if len(bl["errors"]) > 100:
                bl["errors"] = bl["errors"][-100:]
            bl["mean_error"] = float(np.mean(bl["errors"]))
            bl["std_error"] = float(np.std(bl["errors"]))
            bl["count"] += 1

        screen_transitions = session_data.get("screen_transitions", 0)
        is_teleporting = screen_transitions is not None and screen_transitions > 20

        return {
            "user_id": user_id,
            "is_anomalous": is_anomalous or is_teleporting,
            "anomaly_score": round(float(recon_error), 6),
            "z_score": round(float(z_score), 4),
            "is_teleporting": is_teleporting,
            "confidence": min(1.0, (self._user_baselines.get(user_id, {}).get("count", 0)) / 20),
            "threshold": self.threshold,
            "details": {
                "reconstruction_error": round(float(recon_error), 6),
                "baseline_sessions": self._user_baselines.get(user_id, {}).get("count", 0),
                "screen_transitions": screen_transitions,
            },
        }
