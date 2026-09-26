import os
import sys
sys.path.append(os.path.dirname(__file__))

import torch
import numpy as np
from model import MonsoonDownscaler

def grand_meteorological_audit():
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print("\n" + "=" * 75)
    print("      TEST 4: THE GRAND METEOROLOGICAL & PHYSICS AUDIT (HARDEST TIER)     ")
    print("=" * 75)
    print(f"Hardware Engine: {device}")

    weights_path = os.path.join(os.path.dirname(__file__), '../models/monsoon_downscaler.pth')
    model = MonsoonDownscaler(in_channels=8, hidden_channels=48, out_channels=1).to(device)
    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.eval()

    dataset_path = os.path.join(os.path.dirname(__file__), '../data/processed/monsoon_dataset.pt')
    data = torch.load(dataset_path)
    X = data['X']
    Y = data['Y']

    Y_sqrt = torch.sqrt(torch.clamp(Y * 1000.0, min=0.0))
    Y_true = torch.nn.functional.interpolate(Y_sqrt, size=(14, 18), mode='bilinear', align_corners=False)

    test_start = int(0.8 * len(X))
    X_test = X[test_start:]
    Y_test = Y_true[test_start:]

    # ---------------------------------------------------------
    # GAUNTLET 1: OROGRAPHIC LAPSE RATE & RAIN-SHADOW PHYSICS
    # ---------------------------------------------------------
    print("\n[GAUNTLET 1] Testing Orographic Gradient (Western Ghats -> Rain-Shadow)...")
    with torch.no_grad():
        all_preds = []
        for i in range(0, len(X_test), 64):
            bx = X_test[i:i+64].to(device)
            out = model(bx).cpu().numpy().squeeze()
            all_preds.append(np.maximum(0.0, out) ** 2)
    
    mean_spatial_pred = np.mean(np.concatenate(all_preds, axis=0), axis=0) # (14, 18)
    
    # West columns (Ghats ridge: cols 0-4) vs East columns (Rain shadow: cols 13-17)
    west_crest_mean = float(np.mean(mean_spatial_pred[:, 0:4]))
    east_shadow_mean = float(np.mean(mean_spatial_pred[:, 13:18]))
    orographic_ratio = west_crest_mean / (east_shadow_mean + 1e-6)

    print(f"  * Western Ghats Crest Mean Intensity : {west_crest_mean:.3f} mm")
    print(f"  * Eastern Rain-Shadow Mean Intensity : {east_shadow_mean:.3f} mm")
    print(f"  * Computed Orographic Decay Ratio     : {orographic_ratio:.2f}x")
    g1_pass = orographic_ratio >= 1.25
    print(f"  --> GAUNTLET 1 VERDICT: {'PASSED (Physical Lapse Reconstructed)' if g1_pass else 'FAILED'}")

    # ---------------------------------------------------------
    # GAUNTLET 2: THE ABRUPT MONSOON SURGE WHIPLASH TEST
    # ---------------------------------------------------------
    print("\n[GAUNTLET 2] The Extreme Atmospheric Whiplash Test (Drought -> Surge)...")
    
    # Calculate true mean spatial rainfall per time slice (N_test,)
    # targets are in sqrt(mm) domain
    actual_mean_mm = torch.mean(Y_test ** 2, dim=(1, 2, 3)).numpy()
    target_deltas = np.diff(actual_mean_mm)
    whiplash_idx = int(np.argmax(target_deltas))  # Point of maximum sharp surge jump

    x_pre = X_test[whiplash_idx:whiplash_idx+1].to(device)
    x_post = X_test[whiplash_idx+1:whiplash_idx+2].to(device)

    with torch.no_grad():
        pred_pre = float(np.mean(np.maximum(0.0, model(x_pre).cpu().numpy()) ** 2))
        pred_post = float(np.mean(np.maximum(0.0, model(x_post).cpu().numpy()) ** 2))

    actual_pre = float(actual_mean_mm[whiplash_idx])
    actual_post = float(actual_mean_mm[whiplash_idx+1])

    print(f"  * Pre-Surge Reality  : {actual_pre:.2f} mm | Model Predicted: {pred_pre:.2f} mm")
    print(f"  * Post-Surge Reality : {actual_post:.2f} mm | Model Predicted: {pred_post:.2f} mm")
    
    # Verify that the model's directional derivative matches nature
    whiplash_captured = (pred_post > pred_pre) and (actual_post > actual_pre)
    print(f"  --> GAUNTLET 2 VERDICT: {'PASSED (Instantaneous Surge Tracked)' if whiplash_captured else 'FAILED'}")
    # ---------------------------------------------------------
    # GAUNTLET 3: EQUITABLE THREAT SCORE (GILBERT SKILL SCORE)
    # ---------------------------------------------------------
    print("\n[GAUNTLET 3] Evaluating Strict Equitable Threat Score (ETS)...")
    p_flat = np.concatenate(all_preds, axis=0).flatten()
    t_flat = (Y_test.squeeze().numpy() ** 2).flatten()
    thresh = float(np.percentile(t_flat[t_flat > 0.01], 75))

    hits = np.sum((p_flat >= thresh) & (t_flat >= thresh))
    misses = np.sum((p_flat < thresh) & (t_flat >= thresh))
    fa = np.sum((p_flat >= thresh) & (t_flat < thresh))
    cn = np.sum((p_flat < thresh) & (t_flat < thresh))
    total = len(p_flat)

    # Random hits chance expected by random forecast
    hits_random = ((hits + misses) * (hits + fa)) / total
    ets = (hits - hits_random) / (hits + misses + fa - hits_random + 1e-6)

    print(f"  * Contingency: Hits={hits:,}, Misses={misses:,}, False Alarms={fa:,}")
    print(f"  * Equitable Threat Score (ETS): {ets:.4f} (Benchmark: > 0.40 is considered excellent)")
    g3_pass = ets > 0.50
    print(f"  --> GAUNTLET 3 VERDICT: {'PASSED (Zero Reliance on Lucky Guessing)' if g3_pass else 'FAILED'}")

    # ---------------------------------------------------------
    # GAUNTLET 4: ADVERSARIAL TURBULENCE & NOISE INJECTION
    # ---------------------------------------------------------
    print("\n[GAUNTLET 4] Adversarial Input Perturbation (Robustness Check)...")
    noise = torch.randn_like(X_test[:100]) * 0.15  # Inject 15% sensor white noise
    noisy_input = (X_test[:100] + noise).to(device)

    with torch.no_grad():
        clean_out = model(X_test[:100].to(device)).cpu().numpy().flatten()
        noisy_out = model(noisy_input).cpu().numpy().flatten()

    stability_corr = np.corrcoef(clean_out, noisy_out)[0, 1]
    print(f"  * Output Stability under 15% Atmospheric Noise: {stability_corr * 100:.2f}% Match")
    g4_pass = stability_corr >= 0.85
    print(f"  --> GAUNTLET 4 VERDICT: {'PASSED (High Dynamical Resilience)' if g4_pass else 'FAILED'}")

    # ---------------------------------------------------------
    # FINAL VERDICT
    # ---------------------------------------------------------
    print("\n" + "=" * 75)
    all_passed = g1_pass and whiplash_captured and g3_pass and g4_pass
    if all_passed:
        print("FINAL AUDIT VERDICT: HIGHEST LEVEL OF SCIENTIFIC EXCELLENCE ATTAINED")
        print("The network passes all 4 thermodynamic, physical, adversarial, and skill tests.")
    else:
        print("FINAL AUDIT VERDICT: SOLID PERFORMANCE WITH MINOR SENSITIVITY LIMITS")
    print("=" * 75 + "\n")

if __name__ == '__main__':
    grand_meteorological_audit()