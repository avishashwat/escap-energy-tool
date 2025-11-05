# Data Upload Instructions

## Overview
This guide explains how to upload and manage geospatial data in the UN ESCAP Climate & Energy Risk platform admin panel.

## Accessing the Admin Panel
To access the admin panel, append `?admin=true` to your application URL:
```
https://your-app-url.com/?admin=true
```

## File Preparation

### Raster Files (TIF/TIFF)
For optimal performance, convert your TIF files to Cloud Optimized GeoTIFF (COG) format:

```bash
# Using GDAL (requires GDAL installation)
gdal_translate -of COG -co COMPRESS=DEFLATE -co BLOCKSIZE=512 input.tif output_cog.tif

# Additional optimization for web delivery
gdaladdo -r nearest output_cog.tif 2 4 8 16 32
```

**Benefits of COG format:**
- 50-100x faster loading than regular TIFFs
- Progressive loading (zoom-dependent detail)
- Efficient web streaming
- Better compression

### Shapefile Bundles
Ensure you have all required shapefile components:
- `.shp` - main file containing geometry
- `.shx` - shape index file
- `.dbf` - attribute database file  
- `.prj` - projection information (highly recommended)

### Directory Structure
The system automatically organizes files using this convention:

```
data/
├── {country}/
│   ├── climate/
│   │   ├── {variable}/
│   │   │   ├── historical/
│   │   │   │   ├── annual/
│   │   │   │   └── seasonal/
│   │   │   └── {scenario}/
│   │   │       ├── {year-range}/
│   │   │       │   ├── annual/
│   │   │       │   └── seasonal/
│   │   └── ...
│   ├── giri/
│   │   ├── {variable}/
│   │   │   ├── existing/
│   │   │   └── {scenario}/
│   │   └── ...
│   └── energy/
│       ├── hydro-plants/
│       ├── solar-plants/
│       └── wind-plants/
```

## Upload Process

### Step 1: File Upload
1. Navigate to the "Data Upload" tab
2. Drag and drop files or click to browse
3. Select target country and data category
4. Proceed to configuration

### Step 2: Configuration

#### For Raster Data (Climate/GIRI):
1. **Statistics Analysis**: System displays min, max, mean, and standard deviation
2. **Classification Setup**: Configure 5 data classes:
   - First class must start with minimum value
   - Last class must end with maximum value
   - No gaps or overlaps between classes
   - Assign colors and labels for each class
3. **Template Application**: Optionally apply existing classification templates

#### For Shapefile Data (Energy):
1. **Attribute Selection**: Choose which attribute represents design capacity
2. **Icon Configuration**: Select from built-in icons or upload custom PNG
3. **Size Preview**: See how points will be scaled based on capacity values

### Step 3: Review & Deploy
Review all configurations before final deployment to the live system.

## Template Management

### Creating Templates
Templates allow you to reuse configurations across similar datasets:

1. **Classification Templates**: Complete classification schemes with ranges and colors
2. **Color Templates**: Just the color palettes for consistent styling
3. **Shapefile Templates**: Icon and attribute configurations for point data

### Using Templates
When uploading new data, select from existing templates to:
- Speed up configuration process
- Ensure visual consistency
- Reduce configuration errors

## Best Practices

### File Naming
Use descriptive, consistent naming:
```
{country}_{variable}_{scenario}_{timeperiod}_{season}.tif
bhutan_max_temp_ssp1_2021-2040_annual.tif
mongolia_hydro_plants.shp
```

### Data Quality
- Ensure proper projection information (EPSG:4326 preferred)
- Validate attribute data types and ranges
- Test with small datasets first
- Keep original files as backup

### Performance Optimization
- Convert TIFFs to COG format
- Use appropriate compression
- Generate overviews for large datasets
- Consider data aggregation for very detailed datasets

## Troubleshooting

### Upload Issues
- **Large file timeout**: Break into smaller tiles or use COG format
- **Projection warnings**: Ensure files are in EPSG:4326 or provide .prj file
- **Attribute errors**: Verify shapefile database integrity

### Classification Problems
- **Range gaps**: Ensure continuous class ranges
- **Color visibility**: Test color combinations for accessibility
- **Template conflicts**: Verify template compatibility with your data ranges

### Performance Issues
- **Slow loading**: Convert to COG format and generate overviews
- **Memory errors**: Reduce file size or increase processing resources
- **Display problems**: Check projection compatibility and data ranges

## Technical Requirements

### Server Requirements
- GDAL library for raster processing
- OGR for shapefile handling
- Sufficient storage for original and processed files
- Memory for large raster processing

### Browser Support
- Modern browsers with File API support
- Minimum 4GB RAM for large file uploads
- Stable internet connection for uploads

### File Limits
- Maximum file size: 2GB per file
- Maximum upload batch: 50 files
- Supported formats: TIF, TIFF, SHP, SHX, DBF, PRJ
- Custom icons: PNG format, max 1MB

## Security Notes

- Admin access requires proper authentication
- Uploaded files are validated for type and safety
- All actions are logged for audit purposes
- Regular backups recommended for important datasets