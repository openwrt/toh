import csv
import json
from io import BytesIO, TextIOWrapper
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile

# Path to the output files
output_dir = Path().cwd()
json_dir = output_dir / "static/devices"
page_dir = output_dir / "content/devices"

# Create the output directory if it doesn't exist
json_dir.mkdir(exist_ok=True, parents=True)
page_dir.mkdir(exist_ok=True, parents=True)

# URL to the CSV file
toh_csv_url = "https://openwrt.org/_media/toh_dump_tab_separated.zip"


def parse_csv():
    # Download the CSV file and parse it
    print("Downloading CSV file...")
    with ZipFile(BytesIO(urlopen(toh_csv_url).read())) as zf:
        csv_filename = zf.namelist()[0]
        with zf.open(csv_filename, "r") as infile:
            reader = csv.DictReader(
                TextIOWrapper(infile, "utf-8", errors="ignore"), delimiter="\t"
            )
            for device in reader:
                # Remove empty keys and replace them with None
                for key, value in device.items():
                    if value == "NULL" or value == "":
                        device[key] = None
                
                # Generate ID based on the page value
                device["id"] = device["page"].split(":")[-1]
                print(device["id"])

                # Generate JSON and Markdown files
                json_file = json_dir / f"{device['id']}.json"
                json_file.write_text(json.dumps(device, indent=4, sort_keys=True))

                page_file = page_dir / f"{device['id']}.md"
                page_file.write_text(
                    f"""+++
title = "{device["brand"]} {device["model"]} {device.get('version', '')}"
date = 2019-11-28

[extra]
device_id = "{device['id']}"
+++"""
                )


parse_csv()
