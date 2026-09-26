import os
import glob
import numpy as np
import pandas as pd
import xarray as xr
import torch

DATA_RAW_DIR = os.path.join(os.path.dirname(__file__), '../data/raw')
INDICES_DIR = os.path.join(DATA_RAW_DIR, 'indices')
PROCESSED_DIR = os.path.join(os.path.dirname(__file__), '../data/processed')
os.makedirs(PROCESSED_DIR, exist_ok=True)


def parse_mjo():
    """Parses BOM Wheeler-Hendon MJO index file into a daily DataFrame."""
    mjo_file = os.path.join(INDICES_DIR, 'mjo_rmm.txt')
    if not os.path.exists(mjo_file):
        return pd.DataFrame()

    rows = []
    with open(mjo_file, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            parts = line.strip().split()
            # BOM lines start with 4-digit year (e.g., 1974, 1995, 2024)
            if len(parts) >= 7 and parts[0].isdigit() and len(parts[0]) == 4:
                try:
                    yr, mo, da = int(parts[0]), int(parts[1]), int(parts[2])
                    rmm1, rmm2 = float(parts[3]), float(parts[4])
                    phase = int(parts[5])
                    amp = float(parts[6])
                    rows.append([pd.Timestamp(year=yr, month=mo, day=da), rmm1, rmm2, phase, amp])
                except (ValueError, IndexError):
                    continue

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows, columns=['date', 'rmm1', 'rmm2', 'mjo_phase', 'mjo_amplitude'])
    return df.drop_duplicates(subset=['date']).sort_values('date').set_index('date')


def parse_enso():
    """Parses NOAA ONI ENSO index into clean daily records without duplicate dates."""
    oni_file = os.path.join(INDICES_DIR, 'enso_oni.txt')
    if not os.path.exists(oni_file):
        return pd.DataFrame()

    center_month = {
        'DJF': 1,  'JFM': 2,  'FMA': 3,  'MAM': 4,
        'AMJ': 5,  'MJJ': 6,  'JJA': 7,  'JAS': 8,
        'ASO': 9,  'SON': 10, 'OND': 11, 'NDJ': 12
    }

    rows = []
    with open(oni_file, 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) >= 4 and parts[1].isdigit():
                seas = parts[0]
                if seas in center_month:
                    yr = int(parts[1])
                    anom = float(parts[3])
                    m = center_month[seas]
                    rows.append([pd.Timestamp(year=yr, month=m, day=1), anom])

    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows, columns=['date', 'enso_anom'])
    df = df.drop_duplicates(subset=['date']).sort_values('date')
    return df.set_index('date').resample('D').ffill()


def standardize_netcdf_coords(ds):
    """Renames valid_time to time and drops extraneous metadata coordinates."""
    # Standardize time dimension
    if 'valid_time' in ds.coords or 'valid_time' in ds.dims:
        ds = ds.rename({'valid_time': 'time'})

    # Drop metadata variables added by new ECMWF formats
    drop_candidates = ['expver', 'number']
    to_drop = [var for var in drop_candidates if var in ds.coords or var in ds.data_vars]
    if to_drop:
        ds = ds.drop_vars(to_drop, errors='ignore')

    return ds


def load_spatial_data():
    """Loads and concatenates multi-year ERA5 NetCDF atmospheric cubes and target rainfall."""
    era5_files = sorted(glob.glob(os.path.join(DATA_RAW_DIR, 'era5_pune_*.nc')))
    target_files = sorted(glob.glob(os.path.join(DATA_RAW_DIR, 'precip_target_*.nc')))

    if not era5_files or not target_files:
        print("Missing .nc files in data/raw. Generating simulated tensors for pipeline verification...")
        x_synthetic = np.random.randn(200, 7, 8, 7, 9).astype(np.float32)
        y_synthetic = np.random.randn(200, 1, 7, 9).astype(np.float32)
        return x_synthetic, y_synthetic

    print(f"Loading {len(era5_files)} atmospheric NetCDF files...")
    ds_atm = xr.open_mfdataset(
        era5_files,
        combine='by_coords',
        engine='netcdf4',
        preprocess=standardize_netcdf_coords
    )

    print(f"Loading {len(target_files)} target rainfall NetCDF files...")
    ds_tgt = xr.open_mfdataset(
        target_files,
        combine='by_coords',
        engine='netcdf4',
        preprocess=standardize_netcdf_coords
    )

    # Daily aggregation to sync time axes
    ds_atm_daily = ds_atm.resample(time='1D').mean()
    ds_tgt_daily = ds_tgt.resample(time='1D').sum()

    # Align overlapping dates between atmospheric drivers and precipitation targets
    common_times = np.intersect1d(ds_atm_daily.time.values, ds_tgt_daily.time.values)
    print(f"Found {len(common_times)} overlapping daily time steps.")

    ds_atm_daily = ds_atm_daily.sel(time=common_times)
    ds_tgt_daily = ds_tgt_daily.sel(time=common_times)

    # Feature Channels: q, z, u, v at [500, 850] hPa
    vars_list = ['q', 'z', 'u', 'v']
    channels = []

    level_coord = 'pressure_level' if 'pressure_level' in ds_atm_daily.coords else ('level' if 'level' in ds_atm_daily.coords else None)

    for v in vars_list:
        if v not in ds_atm_daily.data_vars:
            continue
        for p in [500, 850]:
            if level_coord:
                arr = ds_atm_daily[v].sel({level_coord: p}).values
            else:
                arr = ds_atm_daily[v].values

            # Standard z-score normalization
            std_val = np.nanstd(arr)
            arr_norm = (arr - np.nanmean(arr)) / (std_val if std_val > 1e-6 else 1.0)
            channels.append(np.nan_to_num(arr_norm))

    stacked_predictors = np.stack(channels, axis=1).astype(np.float32)

    # Target surface precipitation (tp)
    target_var = 'tp' if 'tp' in ds_tgt_daily.data_vars else list(ds_tgt_daily.data_vars.keys())[0]
    target_precip = ds_tgt_daily[target_var].values
    target_precip = np.nan_to_num(target_precip).astype(np.float32)

    if target_precip.ndim == 3:
        target_precip = np.expand_dims(target_precip, axis=1)

    return stacked_predictors, target_precip


def create_sliding_sequences(inputs, targets, seq_len=7, horizon=14):
    """
    Creates temporal sequence windows:
    inputs: seq_len (7 days of past weather)
    targets: future rainfall anomaly aggregated over horizon (14 days forward)
    """
    total_timesteps = len(inputs)
    x_seqs, y_seqs = [], []

    for i in range(total_timesteps - seq_len - horizon):
        x_window = inputs[i : i + seq_len]
        y_future = np.mean(targets[i + seq_len : i + seq_len + horizon], axis=0)
        x_seqs.append(x_window)
        y_seqs.append(y_future)

    return np.array(x_seqs, dtype=np.float32), np.array(y_seqs, dtype=np.float32)


def main():
    print("=== Step 1: Parsing Teleconnections ===")
    df_mjo = parse_mjo()
    df_enso = parse_enso()
    print(f"MJO daily records: {len(df_mjo)}, ENSO daily records: {len(df_enso)}")

    print("\n=== Step 2: Loading & Merging Spatial Datasets ===")
    inputs, targets = load_spatial_data()
    print(f"Predictors Shape: {inputs.shape}, Target Precip Shape: {targets.shape}")

    print("\n=== Step 3: Generating Sequence Windows (7-day lag -> 14-day forecast) ===")
    X, Y = create_sliding_sequences(inputs, targets, seq_len=7, horizon=14)
    print(f"Final Input Tensor:  X = {X.shape}  [Samples, Timesteps, Channels, Height, Width]")
    print(f"Final Target Tensor: Y = {Y.shape}  [Samples, Channels, Height, Width]")

    output_path = os.path.join(PROCESSED_DIR, 'monsoon_dataset.pt')
    torch.save({
        'X': torch.from_numpy(X),
        'Y': torch.from_numpy(Y)
    }, output_path)

    print(f"\nProcessing complete! Unified PyTorch tensor dataset saved at:\n{output_path}")


if __name__ == '__main__':
    main()