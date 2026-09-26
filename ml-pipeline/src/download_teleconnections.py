import os
import pandas as pd
import requests

def download_indices():
    output_dir = os.path.join(os.path.dirname(__file__), '../data/raw/indices')
    os.makedirs(output_dir, exist_ok=True)

    # 1. ENSO (Niño 3.4 SST Index from NOAA CPC)
    nino_url = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
    print("Downloading NOAA ENSO ONI index...")
    r = requests.get(nino_url)
    with open(os.path.join(output_dir, "enso_oni.txt"), "w") as f:
        f.write(r.text)

    # 2. IOD (Dipole Mode Index from NOAA PSL)
    iod_url = "https://psl.noaa.gov/gcos_wgsp/Timeseries/Data/dmi.long.data"
    print("Downloading IOD Dipole Mode Index...")
    r = requests.get(iod_url)
    with open(os.path.join(output_dir, "iod_dmi.txt"), "w") as f:
        f.write(r.text)

    # 3. MJO (Madden-Julian Oscillation Wheeler-Hendon Index from BOM)
    mjo_url = "http://www.bom.gov.au/climate/mjo/graphics/rmm.74toRealtime.txt"
    print("Downloading BOM Real-time Multivariate MJO Index...")
    r = requests.get(mjo_url)
    with open(os.path.join(output_dir, "mjo_rmm.txt"), "w") as f:
        f.write(r.text)

    print(f"All teleconnection indices saved successfully to: {output_dir}")

if __name__ == '__main__':
    download_indices()