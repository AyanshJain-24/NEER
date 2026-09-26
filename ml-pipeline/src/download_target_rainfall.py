import os
import cdsapi
from dotenv import load_dotenv

dotenv_path = os.path.join(os.path.dirname(__file__), '../.env')
load_dotenv(dotenv_path)

def download_rainfall_targets():
    cds_url = os.getenv('CDSAPI_URL')
    cds_key = os.getenv('CDSAPI_KEY')
    client = cdsapi.Client(url=cds_url, key=cds_key)

    output_dir = os.path.join(os.path.dirname(__file__), '../data/raw')
    os.makedirs(output_dir, exist_ok=True)

    years = [str(y) for y in range(1995, 2026)]

    for year in years:
        target_file = os.path.join(output_dir, f'precip_target_{year}.nc')
        if os.path.exists(target_file):
            print(f"[SKIP] Target rainfall {year} already exists.")
            continue

        print(f"[DOWNLOADING TARGET] Surface precipitation for year {year}...")
        request = {
            'product_type': 'reanalysis',
            'format': 'netcdf',
            'variable': 'total_precipitation',
            'year': year,
            'month': ['06', '07', '08', '09'],
            'day': [f'{d:02d}' for d in range(1, 32)],
            'time': ['06:00', '18:00'],
            'area': [19.5, 73.0, 18.0, 75.0],
        }
        try:
            client.retrieve('reanalysis-era5-single-levels', request, target_file)
            print(f"[DONE] {target_file}")
        except Exception as e:
            print(f"Error downloading {year}: {e}")
            break

if __name__ == '__main__':
    download_rainfall_targets()