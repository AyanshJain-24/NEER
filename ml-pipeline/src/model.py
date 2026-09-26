import torch
import torch.nn as nn

class ConvLSTMCell(nn.Module):
    def __init__(self, in_channels, hidden_channels, kernel_size=3):
        super(ConvLSTMCell, self).__init__()
        self.in_channels = in_channels
        self.hidden_channels = hidden_channels
        padding = kernel_size // 2

        self.conv = nn.Conv2d(
            in_channels=in_channels + hidden_channels,
            out_channels=4 * hidden_channels,
            kernel_size=kernel_size,
            padding=padding
        )

    def forward(self, x, hidden):
        h, c = hidden
        combined = torch.cat([x, h], dim=1)
        gates = self.conv(combined)
        cc_i, cc_f, cc_o, cc_g = torch.split(gates, self.hidden_channels, dim=1)

        i = torch.sigmoid(cc_i)
        f = torch.sigmoid(cc_f)
        o = torch.sigmoid(cc_o)
        g = torch.tanh(cc_g)

        c_next = f * c + i * g
        h_next = o * torch.tanh(c_next)
        return h_next, c_next


class MonsoonDownscaler(nn.Module):
    def __init__(self, in_channels=8, hidden_channels=48, tele_dim=3, out_channels=1):
        super(MonsoonDownscaler, self).__init__()
        self.hidden_channels = hidden_channels
        self.cell = ConvLSTMCell(in_channels, hidden_channels)

        # Teleconnection conditioning network (ENSO, MJO amplitude, MJO phase)
        self.tele_projector = nn.Sequential(
            nn.Linear(tele_dim, 32),
            nn.GELU(),
            nn.Linear(32, hidden_channels),
            nn.Sigmoid()
        )

        # Residual skip connection from the latest atmospheric state
        self.input_skip = nn.Conv2d(in_channels, hidden_channels, kernel_size=1)

        # High-resolution spatial decoder (7x9 -> 14x18)
        self.decoder = nn.Sequential(
            nn.ConvTranspose2d(hidden_channels, 32, kernel_size=3, stride=2, padding=1, output_padding=1),
            nn.BatchNorm2d(32),
            nn.GELU(),
            nn.Conv2d(32, 16, kernel_size=3, padding=1),
            nn.BatchNorm2d(16),
            nn.GELU(),
            nn.Conv2d(16, out_channels, kernel_size=1),
            nn.ReLU()
        )

    def forward(self, x, teleconnections=None):
        # x: (Batch, Seq_Len, Channels, H, W)
        # teleconnections: (Batch, 3) -> [ENSO_anom, MJO_amp, MJO_phase]
        b, seq_len, _, h, w = x.size()
        h_t = torch.zeros(b, self.hidden_channels, h, w, device=x.device)
        c_t = torch.zeros(b, self.hidden_channels, h, w, device=x.device)

        for t in range(seq_len):
            h_t, c_t = self.cell(x[:, t], (h_t, c_t))

        # Modulate hidden state with planetary teleconnections if provided
        if teleconnections is not None:
            tele_weights = self.tele_projector(teleconnections).unsqueeze(-1).unsqueeze(-1)
            h_t = h_t * tele_weights

        residual = self.input_skip(x[:, -1])
        h_fused = h_t + residual

        return self.decoder(h_fused)