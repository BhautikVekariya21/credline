"""
FinGuard 2026 — BiometricHead Model.

1D-CNN + LSTM for behavioral identity verification from device sensor data.
Processes gyroscope, accelerometer, keystroke dynamics to detect whether the
person holding the device is the genuine account owner or an impersonator/bot.
"""

from __future__ import annotations
import torch
import torch.nn as nn


class ConvBlock1D(nn.Module):
    """1D convolution block with BatchNorm and ReLU."""

    def __init__(self, in_ch: int, out_ch: int, kernel_size: int = 3, stride: int = 1):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv1d(in_ch, out_ch, kernel_size, stride=stride, padding=kernel_size // 2),
            nn.BatchNorm1d(out_ch),
            nn.ReLU(inplace=True),
            nn.MaxPool1d(kernel_size=2, stride=2),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.block(x)


class BiometricHead(nn.Module):
    """
    1D-CNN + LSTM for behavioral biometric verification.

    Processes two data streams:
    1. Sensor stream: gyroscope + accelerometer [batch, 6, time_steps]
       → 3 Conv blocks → Bidirectional LSTM → 64-dim embedding
    2. Keystroke stream: inter-key intervals [batch, keystroke_dim]
       → MLP → 32-dim embedding

    Final output: 64-dim behavioral identity embedding (concatenated & projected).

    Args:
        sensor_channels: Input channels for sensor data (default: 6 = gyro 3 + accel 3).
        keystroke_dim: Dimensionality of keystroke features (default: 32).
        cnn_filters: List of filter counts for Conv blocks (default: [32, 64, 128]).
        lstm_hidden: LSTM hidden size (default: 64).
        output_dim: Final embedding dimension (default: 64).
    """

    def __init__(self, sensor_channels: int = 6, keystroke_dim: int = 32,
                 cnn_filters: list[int] | None = None, lstm_hidden: int = 64,
                 output_dim: int = 64):
        super().__init__()
        if cnn_filters is None:
            cnn_filters = [32, 64, 128]

        self.sensor_channels = sensor_channels
        self.keystroke_dim = keystroke_dim
        self.output_dim = output_dim

        # ─── Sensor CNN ─────────────────────────────────────────────────
        layers = []
        in_ch = sensor_channels
        for out_ch in cnn_filters:
            layers.append(ConvBlock1D(in_ch, out_ch))
            in_ch = out_ch
        self.sensor_cnn = nn.Sequential(*layers)

        # ─── Bidirectional LSTM ──────────────────────────────────────────
        self.sensor_lstm = nn.LSTM(
            input_size=cnn_filters[-1],
            hidden_size=lstm_hidden,
            num_layers=2,
            batch_first=True,
            bidirectional=True,
            dropout=0.2,
        )

        # ─── Keystroke MLP ───────────────────────────────────────────────
        self.keystroke_mlp = nn.Sequential(
            nn.Linear(keystroke_dim, 64),
            nn.ReLU(inplace=True),
            nn.Dropout(0.2),
            nn.Linear(64, 32),
            nn.ReLU(inplace=True),
        )

        # ─── Fusion Projection ──────────────────────────────────────────
        # BiLSTM hidden * 2 (bidirectional) + keystroke 32
        fusion_dim = lstm_hidden * 2 + 32
        self.fusion = nn.Sequential(
            nn.Linear(fusion_dim, output_dim),
            nn.LayerNorm(output_dim),
            nn.ReLU(inplace=True),
            nn.Dropout(0.2),
        )

        # Optional classification head
        self.classifier = nn.Linear(output_dim, 1)
        self._init_weights()

    def _init_weights(self) -> None:
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)
            elif isinstance(m, nn.Conv1d):
                nn.init.kaiming_normal_(m.weight, mode="fan_out", nonlinearity="relu")

    def forward(self, sensor_data: torch.Tensor, keystroke_data: torch.Tensor,
                return_embedding: bool = True) -> dict[str, torch.Tensor]:
        """
        Args:
            sensor_data: [batch, sensor_channels, time_steps] (gyro+accel)
            keystroke_data: [batch, keystroke_dim] (inter-key intervals)
            return_embedding: If True, return embeddings. If False, return logits.

        Returns:
            Dict with 'embedding' and optionally 'logits', 'probability'.
        """
        # CNN feature extraction
        cnn_out = self.sensor_cnn(sensor_data)  # [batch, 128, reduced_time]

        # Reshape for LSTM: [batch, time, features]
        lstm_in = cnn_out.permute(0, 2, 1)

        # LSTM sequence processing
        lstm_out, (h_n, _) = self.sensor_lstm(lstm_in)

        # Use final hidden states from both directions
        h_forward = h_n[-2]  # [batch, lstm_hidden]
        h_backward = h_n[-1]  # [batch, lstm_hidden]
        sensor_embed = torch.cat([h_forward, h_backward], dim=1)

        # Keystroke processing
        keystroke_embed = self.keystroke_mlp(keystroke_data)

        # Fusion
        combined = torch.cat([sensor_embed, keystroke_embed], dim=1)
        embedding = self.fusion(combined)

        result: dict[str, torch.Tensor] = {"embedding": embedding}

        if not return_embedding:
            logits = self.classifier(embedding)
            result["logits"] = logits
            result["probability"] = torch.sigmoid(logits)

        return result

    def get_embedding(self, sensor_data: torch.Tensor,
                      keystroke_data: torch.Tensor) -> torch.Tensor:
        return self.forward(sensor_data, keystroke_data)["embedding"]

    def smoke_test(self, batch_size: int = 4, time_steps: int = 100) -> None:
        self.eval()
        with torch.no_grad():
            sensor = torch.randn(batch_size, self.sensor_channels, time_steps)
            keys = torch.randn(batch_size, self.keystroke_dim)
            out = self.forward(sensor, keys, return_embedding=False)
            assert out["embedding"].shape == (batch_size, self.output_dim)
            assert out["logits"].shape == (batch_size, 1)
        print(f"✅ BiometricHead smoke test passed: embedding={out['embedding'].shape}")
