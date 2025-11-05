#!/usr/bin/env python3
"""
Process Excel classification files to generate color schemes for raster data.
"""

import pandas as pd
import json
import sys
from pathlib import Path

def process_classification_excel(excel_path, output_dir):
    """Process Excel file containing classification and color information."""
    
    try:
        # Read Excel file
        # Expecting columns: 'min_value', 'max_value', 'class_name', 'color_hex'
        df = pd.read_excel(excel_path)
        
        # Validate required columns
        required_columns = ['min_value', 'max_value', 'class_name', 'color_hex']
        missing_columns = [col for col in required_columns if col not in df.columns]
        
        if missing_columns:
            print(f"✗ Missing required columns in {excel_path.name}: {missing_columns}")
            return None
        
        # Create classification object
        classification = {
            "type": "classified",
            "classes": []
        }
        
        for _, row in df.iterrows():
            class_info = {
                "min": float(row['min_value']),
                "max": float(row['max_value']),
                "label": str(row['class_name']),
                "color": str(row['color_hex']).upper()
            }
            
            # Ensure color has # prefix
            if not class_info["color"].startswith('#'):
                class_info["color"] = '#' + class_info["color"]
            
            classification["classes"].append(class_info)
        
        # Sort classes by min value
        classification["classes"].sort(key=lambda x: x["min"])
        
        # Create output directory
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Save classification
        filename = excel_path.stem
        json_path = output_path / f"{filename}.json"
        
        with open(json_path, 'w') as f:
            json.dump(classification, f, indent=2)
        
        print(f"✓ Processed {filename}:")
        print(f"  - Classes: {len(classification['classes'])}")
        print(f"  - Range: {classification['classes'][0]['min']} - {classification['classes'][-1]['max']}")
        print(f"  - Output: {json_path}")
        
        return classification
        
    except Exception as e:
        print(f"✗ Error processing {excel_path}: {e}")
        return None

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python process_classifications.py <excel_file_or_directory> <output_directory>")
        sys.exit(1)
    
    input_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    
    if input_path.is_file() and input_path.suffix in ['.xlsx', '.xls']:
        # Process single file
        process_classification_excel(input_path, output_dir)
    elif input_path.is_dir():
        # Process all Excel files in directory
        excel_files = list(input_path.glob('*.xlsx')) + list(input_path.glob('*.xls'))
        
        for excel_file in excel_files:
            process_classification_excel(excel_file, output_dir)
    else:
        print("Error: Input must be an Excel file or directory containing Excel files")