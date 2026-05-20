"""
FinGuard 2026 — Biometric Sensor Data Schema.

Captures device sensor data (gyroscope, accelerometer, keystroke dynamics)
for behavioral identity verification via the BiometricHead model.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class SensorReading(BaseModel):
    """Single timestep of 3-axis sensor data."""

    x: float
    y: float
    z: float
    timestamp_ms: float = Field(..., description="Milliseconds since session start")


class BiometricSample(BaseModel):
    """
    Complete biometric sample from a single user session.

    Captures multi-modal behavioral signals:
    - Gyroscope: device orientation/rotation (phone hold angle)
    - Accelerometer: movement patterns (walking, stationary)
    - Keystroke dynamics: typing rhythm (inter-key intervals)
    - Touch pressure: screen interaction force
    """

    session_id: str = Field(..., description="Unique session identifier")
    user_id: str = Field(..., description="Anonymized user identifier")
    timestamp: datetime = Field(..., description="Session start timestamp (UTC)")

    # Sensor data as lists of [x, y, z] readings over time
    gyroscope: list[list[float]] = Field(
        ...,
        description="Gyroscope readings [time_steps x 3] (x, y, z in rad/s)",
    )
    accelerometer: list[list[float]] = Field(
        ...,
        description="Accelerometer readings [time_steps x 3] (x, y, z in m/s²)",
    )

    # Keystroke behavioral signals
    keystroke_intervals: list[float] = Field(
        default_factory=list,
        description="Inter-key intervals in milliseconds",
    )
    key_hold_durations: list[float] = Field(
        default_factory=list,
        description="Key hold durations in milliseconds",
    )

    # Touch interaction
    screen_touch_pressure: list[float] = Field(
        default_factory=list,
        description="Normalized touch pressure values [0.0, 1.0]",
    )
    screen_touch_area: list[float] = Field(
        default_factory=list,
        description="Touch contact area in normalized units",
    )

    # Navigation behavior
    scroll_velocity: Optional[list[float]] = Field(
        default=None, description="Scroll velocities in px/ms"
    )
    screen_transitions: Optional[int] = Field(
        default=None,
        description="Number of screen transitions (teleporting detection)",
    )
    session_duration_ms: Optional[float] = Field(
        default=None, description="Total session duration in ms"
    )

    # Label
    is_genuine: Optional[bool] = Field(
        default=None,
        description="True if session belongs to the actual account holder",
    )

    @field_validator("gyroscope", "accelerometer")
    @classmethod
    def validate_sensor_shape(cls, v: list[list[float]]) -> list[list[float]]:
        """Ensure each sensor reading has exactly 3 axes."""
        for i, reading in enumerate(v):
            if len(reading) != 3:
                raise ValueError(
                    f"Sensor reading at index {i} has {len(reading)} values, expected 3"
                )
        return v

    @property
    def num_timesteps(self) -> int:
        """Number of sensor timesteps captured."""
        return len(self.gyroscope)

    @property
    def sensor_channels(self) -> int:
        """Total sensor channels (gyroscope 3 + accelerometer 3 = 6)."""
        return 6
