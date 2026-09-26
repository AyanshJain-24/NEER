import os
import sys
sys.path.append(os.path.dirname(__file__))

import torch
import numpy as np
from model import MonsoonDownscaler

def run_season_stress_test():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print("=" * 65)
    print("     TEST 3: FULL-SEASON ROLLING BLIND STRESS TEST     ")
    print("=" * 65)
    print(f"Executing on hardware device: {device}")

    # 1. Load trained model
    weights_path = os.path.join(os.path.dirname(__file__), '../models/monsoon_downscaler.pth')
    model = MonsoonDownscaler(in_channels=8, hidden_channels=48, out_channels=1).to(device)
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.eval()

    # 2. Load dataset
    dataset_path = os.path.join(os.path.dirname(__file__), '../data/processed/monsoon_dataset.pt')
    data = torch.load(dataset_path)
    X = data['X']
    Y = data['Y']

    # Scale target to sqrt domain
    Y_sqrt = torch.sqrt(torch.clamp(Y * 1000.0, min=0.0))
    Y_true_grid = torch.nn.functional.interpolate(Y_sqrt, size=(14, 18), mode='bilinear', align_corners=False)

    # Use the entire held-out 20% test partition (2,212 continuous time steps)
    test_start = int(0.8 * len(X))
    X_test = X[test_start:]
    Y_test = Y_true_grid[test_start:]

    print(f"Total unseen consecutive evaluation windows: {len(X_test)}")

    all_preds_mm = []
    all_targets_mm = []

    # Run batched inference across all test windows
    batch_size = 64
    with torch.no_grad():
        for i in range(0, len(X_test), batch_size):
            bx = X_test[i:i+batch_size].to(device)
            out_sqrt = model(bx).cpu().numpy().squeeze()
            target_sqrt = Y_test[i:i+batch_size].squeeze().numpy()

            all_preds_mm.append((np.maximum(0.0, out_sqrt) ** 2))
            all_targets_mm.append((target_sqrt ** 2))

    preds = np.concatenate(all_preds_mm, axis=0)      # (N_test, 14, 18)
    targets = np.concatenate(all_targets_mm, axis=0)  # (N_test, 14, 18)

    # 1. Compute Continuous Metric Tracking
    p_flat = preds.flatten()
    t_flat = targets.flatten()

    mae = np.mean(np.abs(p_flat - t_flat))
    rmse = np.sqrt(np.mean((p_flat - t_flat) ** 2))
    overall_corr = np.corrcoef(p_flat, t_flat)[0, 1]

    # 2. Extreme Weather Contingency Table
    # Define an active precipitation event (Top 20% threshold of historical rainfall)
    rain_threshold = float(np.percentile(t_flat[t_flat > 0.05], 75)) if np.any(t_flat > 0.05) else 0.5
    print(f"Calculated Heavy Rain Detection Threshold: {rain_threshold:.2f} mm")

    hits = np.sum((p_flat >= rain_threshold) & (t_flat >= rain_threshold))
    misses = np.sum((p_flat < rain_threshold) & (t_flat >= rain_threshold))
    false_alarms = np.sum((p_flat >= rain_threshold) & (t_flat < rain_threshold))
    correct_negatives = np.sum((p_flat < rain_threshold) & (t_flat < rain_threshold))

    pod = hits / (hits + misses + 1e-6)
    far = false_alarms / (hits + false_alarms + 1e-6)  # False Alarm Ratio
    accuracy = (hits + correct_negatives) / (hits + misses + false_alarms + correct_negatives)
    hss_num = 2 * (hits * correct_negatives - misses * false_alarms)
    hss_den = (hits + misses) * (misses + correct_negatives) + (hits + false_alarms) * (false_alarms + correct_negatives)
    heidke_skill_score = hss_num / (hss_den + 1e-6)  # Standard WMO skill score (0 = chance, 1 = perfect)

    print("\n" + "=" * 65)
    print("           REAL-WORLD OPERATIONAL WEATHER METRICS             ")
    print("=" * 65)
    print(f"Overall Pearson Pattern Correlation (R) : {overall_corr:.4f}  (Ideal: > 0.70)")
    print(f"Probability of Detection (POD / Recall) : {pod * 100:.2f}%  (Ideal: > 80.0%)")
    print(f"False Alarm Ratio (FAR / Cry Wolf Score): {far * 100:.2f}%  (Ideal: < 25.0%)")
    print(f"Heidke Skill Score (HSS - WMO Standard) : {heidke_skill_score:.4f}  (Ideal: > 0.60)")
    print(f"Total True Negative Dry Detection       : {correct_negatives:,} grid blocks")
    print(f"Average Continuous Prediction Error     : {mae:.2f} mm")
    print("-" * 65)

    if overall_corr > 0.85 and far < 0.20 and pod > 0.80:
        print("VERDICT: PRODUCTION OPERATIONAL GRADE.")
        print("The system demonstrates elite robustness across multi-season conditions without excessive false alarms.")
    elif overall_corr > 0.70:
        print("VERDICT: HIGH COMMERCIAL VALUE.")
    else:
        print("VERDICT: SYSTEM DRIFT DETECTED.")
    print("=" * 65)

if __name__ == '__main__':
    run_season_stress_test()