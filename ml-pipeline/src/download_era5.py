import os
import cdsapi
from dotenv import load_dotenv

# Load credentials from ml-pipeline/.env
dotenv_path = os.path.join(os.path.dirname(__file__), '../.env')
load_dotenv(dotenv_path)

def download_30yr_pune_data():
    cds_url = os.getenv('CDSAPI_URL')
    cds_key = os.getenv('CDSAPI_KEY')

    if not cds_url or not cds_key:
        print("ERROR: CDSAPI_URL or CDSAPI_KEY missing in ml-pipeline/.env")
        return

    print("Authenticating with Copernicus CDS...")
    client = cdsapi.Client(url=cds_url, key=cds_key)

    output_dir = os.path.join(os.path.dirname(__file__), '../data/raw')
    os.makedirs(output_dir, exist_ok=True)

    # 30-year span: 1995 to 2025 inclusive
    years = [str(y) for y in range(1995, 2026)]

    print(f"Target directory: {output_dir}")
    print(f"Preparing download for {len(years)} years: 1995 to 2025 (Kharif Monsoon: June to September)...")

    for year in years:
        target_file = os.path.join(output_dir, f'era5_pune_{year}.nc')

        # Skip if already downloaded (prevents re-downloading on script restart)
        if os.path.exists(target_file):
            print(f"[SKIP] {year} already downloaded: {target_file}")
            continue

        print(f"\n[REQUESTING] Year {year} for Pune bounding box...")

        request = {
            'product_type': 'reanalysis',
            'format': 'netcdf',
            'variable': [
                'geopotential',
                'specific_humidity',
                'u_component_of_wind',
                'v_component_of_wind',
            ],
            'pressure_level': ['500', '850'],  # Mid-troposphere & low-level Somali jet
            'year': year,
            'month': ['06', '07', '08', '09'], # Monsoon season (JJAS)
            'day': [f'{d:02d}' for d in range(1, 32)],
            'time': ['00:00', '12:00'],        # Twice-daily snapshots
            # Pune & surrounding Western Ghats rain shadow: [North, West, South, East]
            'area': [19.5, 73.0, 18.0, 75.0],
        }

        try:
            client.retrieve('reanalysis-era5-pressure-levels', request, target_file)
            print(f"[SUCCESS] Downloaded: {target_file}")
        except Exception as e:
            print(f"[ERROR] Failed to download year {year}: {e}")
            print("Stopping loop. Fix credentials/network and rerun; existing files will be preserved.")
            break

    print("\nBatch process finished. Check ml-pipeline/data/raw/ for downloaded NetCDF files.")

if __name__ == '__main__':
    download_30yr_pune_data()