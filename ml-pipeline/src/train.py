import os
import torch
import torch.nn as nn
from torch.utils.data import TensorDataset, DataLoader
from model import MonsoonDownscaler

class CorrelationMSELoss(nn.Module):
    def __init__(self):
        super().__init__()
        self.mse = nn.MSELoss()

    def forward(self, pred, target):
        p_flat = pred.view(pred.size(0), -1)
        t_flat = target.view(target.size(0), -1)

        p_centered = p_flat - torch.mean(p_flat, dim=1, keepdim=True)
        t_centered = t_flat - torch.mean(t_flat, dim=1, keepdim=True)

        num = torch.sum(p_centered * t_centered, dim=1)
        den = torch.sqrt(torch.sum(p_centered ** 2, dim=1) * torch.sum(t_centered ** 2, dim=1) + 1e-8)
        pearson_r = num / den

        return self.mse(pred, target) + 0.3 * torch.mean(1.0 - pearson_r)

def train():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Training on: {device}")

    dataset_path = os.path.join(os.path.dirname(__file__), '../data/processed/monsoon_dataset.pt')
    data = torch.load(dataset_path)
    X = data['X']  # (N, 7, 8, 7, 9)
    Y = data['Y']  # (N, 1, 7, 9)

    # Ingest or synthesize normalized teleconnection vectors: [ENSO, MJO_amp, MJO_phase/8.0]
    tele_data = data.get('teleconnections', None)
    if tele_data is None:
        # Fallback tensor if not cached in dataset
        tele_data = torch.zeros((len(X), 3), dtype=torch.float32)
        tele_data[:, 0] = -0.4  # Neutral/Weak La Nina baseline
        tele_data[:, 1] = 1.2   # Active MJO amplitude
        tele_data[:, 2] = 4.0 / 8.0  # Phase 4

    Y_sqrt = torch.sqrt(torch.clamp(Y * 1000.0, min=0.0))
    Y_upsampled = nn.functional.interpolate(Y_sqrt, size=(14, 18), mode='bilinear', align_corners=False)

    # STRICT CHRONOLOGICAL TIME-SERIES SPLIT (NO RANDOM SHUFFLE)
    n_total = len(X)
    train_end = int(0.70 * n_total)
    val_end = int(0.85 * n_total)

    train_set = TensorDataset(X[:train_end], Y_upsampled[:train_end], tele_data[:train_end])
    val_set = TensorDataset(X[train_end:val_end], Y_upsampled[train_end:val_end], tele_data[train_end:val_end])

    train_loader = DataLoader(train_set, batch_size=64, shuffle=True)
    val_loader = DataLoader(val_set, batch_size=64, shuffle=False)

    model = MonsoonDownscaler(in_channels=8, hidden_channels=48, tele_dim=3, out_channels=1).to(device)
    criterion = CorrelationMSELoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=0.0015, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=15)

    epochs = 15
    best_loss = float('inf')
    best_path = os.path.join(os.path.dirname(__file__), '../models/monsoon_downscaler.pth')

    print(f"Chronological split: {train_end} train windows, {val_end - train_end} val windows.")

    for epoch in range(1, epochs + 1):
        model.train()
        train_loss = 0.0
        for bx, by, bt in train_loader:
            bx, by, bt = bx.to(device), by.to(device), bt.to(device)
            optimizer.zero_grad()
            out = model(bx, bt)
            loss = criterion(out, by)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            train_loss += loss.item() * bx.size(0)

        train_loss /= len(train_loader.dataset)

        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for bx, by, bt in val_loader:
                bx, by, bt = bx.to(device), by.to(device), bt.to(device)
                out = model(bx, bt)
                val_loss += criterion(out, by).item() * bx.size(0)

        val_loss /= len(val_loader.dataset)
        scheduler.step()

        print(f"Epoch [{epoch:02d}/{epochs:02d}] - Train: {train_loss:.4f} | Val: {val_loss:.4f}")
        if val_loss < best_loss:
            best_loss = val_loss
            torch.save(model.state_dict(), best_path)

if __name__ == '__main__':
    train()