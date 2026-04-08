import os
import requests
import math
import time
import time

def deg2num(lat_deg, lon_deg, zoom):
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return xtile, ytile

def download_tiles(zoom_start, zoom_end, lat_min, lat_max, lon_min, lon_max, output_dir):
    os.makedirs(output_dir, exist_ok=True)

    headers = {
        "User-Agent": "OfflineMapDownloader/1.0 (contact: your_email@example.com)"
    }

    for zoom in range(zoom_start, zoom_end + 1):
        x_min, y_min = deg2num(lat_max, lon_min, zoom)
        x_max, y_max = deg2num(lat_min, lon_max, zoom)

        max_tile = (2 ** zoom) - 1
        x_start, x_end = max(0, min(x_min, x_max)), min(max_tile, max(x_min, x_max))
        y_start, y_end = max(0, min(y_min, y_max)), min(max_tile, max(y_min, y_max))

        print(f"Zoom {zoom}: x[{x_start}-{x_end}] y[{y_start}-{y_end}]")

        for x in range(x_start, x_end + 1):
            for y in range(y_start, y_end + 1):
                tile_dir = os.path.join(output_dir, str(zoom), str(x))
                os.makedirs(tile_dir, exist_ok=True)

                tile_path = os.path.join(tile_dir, f"{y}.png")
                if os.path.exists(tile_path):
                    continue

                url = f"https://tile.openstreetmap.org/{zoom}/{x}/{y}.png"
                
                # Retry logic
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        response = requests.get(url, headers=headers, timeout=10)
                        if response.status_code == 200:
                            with open(tile_path, 'wb') as f:
                                f.write(response.content)
                            break # Success, move to next tile
                        elif response.status_code == 429:
                            # Rate limited, wait longer
                            print(f"Rate limited on {url}, waiting 5s...")
                            time.sleep(5)
                        else:
                            print(f"Failed to download {url}: {response.status_code} (Attempt {attempt+1}/{max_retries})")
                    except Exception as e:
                        print(f"Error downloading {url}: {e} (Attempt {attempt+1}/{max_retries})")
                        time.sleep(1) # Small wait on error
                    
                    if attempt < max_retries - 1:
                        time.sleep(1) # Wait between retries

# GLOBAL (Zoom 1–8)
print("Downloading global tiles (Zoom 1–8)")
download_tiles(1, 8, -85, 85, -180, 180, "map_data/tiles")

# HYDERABAD (Zoom 9–13)
LAT_MIN, LAT_MAX = 17.3, 17.6
LON_MIN, LON_MAX = 78.3, 78.6

print("Downloading Hyderabad tiles (Zoom 9–13)")
download_tiles(9, 13, LAT_MIN, LAT_MAX, LON_MIN, LON_MAX, "map_data/tiles")
