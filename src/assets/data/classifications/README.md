# Variable Classifications
JSON files defining data ranges and colors for each climate variable.

Example file (maximum_temp.json):
```json
{
  "variable": "maximum_temp",
  "unit": "°C", 
  "ranges": [
    { "min": -10, "max": 0, "color": "#1a1a1a", "label": "Very Cold" },
    { "min": 0, "max": 10, "color": "#3b82f6", "label": "Cold" },
    { "min": 10, "max": 20, "color": "#10b981", "label": "Moderate" },
    { "min": 20, "max": 30, "color": "#f59e0b", "label": "Warm" },
    { "min": 30, "max": 50, "color": "#dc2626", "label": "Hot" }
  ]
}
```