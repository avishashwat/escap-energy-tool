#!/bin/bash

# Create data directories
mkdir -p /app/data/{bhutan,mongolia,laos}/{boundaries,climate,giri,energy}
mkdir -p /app/uploads /app/processed /app/temp

# Start the GDAL processing service
python3 main.py