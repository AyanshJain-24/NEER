import os
import sys
sys.path.append(os.path.dirname(__file__))

import torch
import numpy as np
from model import MonsoonDownscaler

def run_backtest_sample(sample_index=10500):
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Loading checkpoint and running hindcast on sample index: {sample_index}")

    # 1. Load trained model
    weights_path = os.path.join(os.path.dirname(__file__), '../models/monsoon_downscaler.pth')
    model = MonsoonDownscaler(in_channels=8, hidden_channels=48, out_channels=1).to(device)
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.eval()

    # 2. Load dataset
    dataset_path = os.path.join(os.path.dirname(__file__), '../data/processed/monsoon_dataset.pt')
    data = torch.load(dataset_path)
    X = data['X']  # Inputs
    Y = data['Y']  # Ground truth targets

    # Scale target to sqrt domain matching model training
    Y_sqrt = torch.sqrt(torch.clamp(Y * 1000.0, min=0.0))
    Y_true_grid = torch.nn.functional.interpolate(Y_sqrt, size=(14, 18), mode='bilinear', align_corners=False)

    sample_x = X[sample_index : sample_index + 1].to(device)
    target_actual = (Y_true_grid[sample_index].squeeze().numpy()) ** 2

    # 3. Model Prediction
    with torch.no_grad():
        pred_sqrt = model(sample_x).cpu().numpy().squeeze()
        pred_actual = (np.maximum(0.0, pred_sqrt)) ** 2

    # 4. Compare Prediction vs Reality
    mae = np.mean(np.abs(pred_actual - target_actual))
    corr = np.corrcoef(pred_actual.flatten(), target_actual.flatten())[0, 1]

    print("\n" + "=" * 55)
    print(f"       HISTORICAL HINDCAST VERIFICATION RESULTS       ")
    print("=" * 55)
    print(f"Target Ground Truth (Actual Rainfall) : Mean = {np.mean(target_actual):.2f} mm | Max = {np.max(target_actual):.2f} mm")
    print(f"ConvLSTM Prediction (Model Output)    : Mean = {np.mean(pred_actual):.2f} mm | Max = {np.max(pred_actual):.2f} mm")
    print("-" * 55)
    print(f"Grid-level Mean Absolute Error (MAE)  : {mae:.2f} mm")
    print(f"Spatial Pattern Correlation (R)       : {corr:.4f}")
    print("=" * 55)

    if corr >= 0.70:
        print("Verdict: HIGH CONGRUENCE. The predicted spatial rainfall distribution closely matches recorded ground reality.")
    else:
        print("Verdict: MODERATE CONGRUENCE.")

if __name__ == '__main__':
    run_backtest_sample(sample_index=10500)