# UN ESCAP Climate & Energy Risk Admin Panel

## Overview
This admin panel provides a comprehensive interface for managing geospatial data layers, uploading files, and configuring visualizations for the UN ESCAP Climate and Energy Risk platform.

## Features

### 🔐 Authentication & Security
- GitHub-based authentication using spark.user()
- Owner-only access control for admin functions
- Secure file validation and processing

### 📁 File Upload & Management
- **Raster Data**: TIF/TIFF climate and GIRI hazard data
- **Shapefile Data**: Point shapefiles for energy infrastructure
- **Drag & Drop Interface**: Intuitive file upload experience
- **Batch Processing**: Upload multiple files simultaneously
- **File Validation**: Automatic format and integrity checking

### 🎨 Data Classification & Visualization
- **Raster Classification**: 5-class data ranges with custom colors
- **Automatic Statistics**: Min, max, mean, and standard deviation analysis
- **Color Schemes**: Customizable color palettes for each data type
- **Shapefile Configuration**: Attribute selection and point symbolization
- **Icon Management**: Built-in icons or custom PNG uploads

### 📋 Template System
- **Reusable Templates**: Save configurations for future use
- **Classification Templates**: Complete schemes with ranges and colors
- **Color Templates**: Consistent color palettes across datasets
- **Shapefile Templates**: Icon and attribute configurations
- **Template Sharing**: Apply successful configurations to new datasets

### 🗂️ Layer Management
- **Comprehensive Dashboard**: View all uploaded layers
- **Search & Filter**: Find layers by name, type, or country
- **Status Management**: Activate/deactivate layers
- **Metadata Display**: File details and configuration info
- **Bulk Operations**: Manage multiple layers efficiently

## Technical Architecture

### Frontend Components
```
src/components/admin/
├── AdminPanel.tsx          # Main admin interface
├── AdminApp.tsx           # Authentication wrapper
├── DataUpload.tsx         # File upload workflow
├── RasterClassificationConfig.tsx  # Raster data configuration
├── ShapefileConfig.tsx    # Shapefile data configuration
├── LayerManagement.tsx    # Layer CRUD operations
├── TemplateManagement.tsx # Template system
└── TemplateSelector.tsx   # Template application
```

### Data Storage
- **Persistent Storage**: Uses spark.kv for configuration persistence
- **File Organization**: Automatic directory structure creation
- **Metadata Management**: Layer configurations and template storage
- **Backup Support**: Configuration export/import capabilities

### Supported Data Types

#### Climate Variables
- Maximum Temperature
- Minimum Temperature  
- Mean Temperature
- Precipitation
- Solar Radiation
- Cooling Degree Days
- Heating Degree Days

#### GIRI Variables
- Flood Risk
- Drought Risk

#### Energy Infrastructure
- Hydro Power Plants
- Solar Power Plants
- Wind Power Plants

## Getting Started

### Accessing the Admin Panel
Add `?admin=true` to your application URL:
```
https://your-app.com/?admin=true
```

### Upload Workflow

1. **File Selection**
   - Select country (Bhutan, Mongolia, Laos)
   - Choose data category
   - Upload TIF files or shapefile bundles

2. **Configuration**
   - **Raster**: Set classification ranges and colors
   - **Shapefile**: Select capacity attribute and icon
   - Apply existing templates (optional)

3. **Review & Deploy**
   - Validate configuration
   - Deploy to live system

### File Preparation

#### Raster Files (Recommended: COG Format)
```bash
# Convert TIF to COG for optimal performance
gdal_translate -of COG -co COMPRESS=DEFLATE input.tif output_cog.tif
```

#### Shapefile Bundles
Required files:
- `.shp` - geometry data
- `.shx` - shape index
- `.dbf` - attribute data
- `.prj` - projection info (recommended)

### Directory Structure
```
data/
├── bhutan/
│   ├── climate/
│   │   ├── max-temp/
│   │   │   ├── historical/annual/
│   │   │   ├── historical/seasonal/
│   │   │   ├── ssp1/2021-2040/annual/
│   │   │   └── ssp1/2021-2040/seasonal/
│   │   └── ...
│   ├── giri/
│   │   ├── flood/existing/
│   │   └── flood/ssp1/
│   └── energy/
│       ├── hydro-plants/
│       ├── solar-plants/
│       └── wind-plants/
├── mongolia/
└── laos/
```

## Configuration Examples

### Raster Classification
```javascript
{
  type: 'raster',
  category: 'max-temp',
  country: 'bhutan',
  classifications: [
    { min: -5, max: 10, color: '#2166ac', label: 'Very Cold' },
    { min: 10, max: 20, color: '#67a9cf', label: 'Cold' },
    { min: 20, max: 30, color: '#d1e5f0', label: 'Moderate' },
    { min: 30, max: 40, color: '#fdbf6f', label: 'Warm' },
    { min: 40, max: 45, color: '#d62728', label: 'Hot' }
  ]
}
```

### Shapefile Configuration
```javascript
{
  type: 'shapefile',
  category: 'hydro-plants',
  country: 'bhutan',
  capacityAttribute: 'designCapacity',
  icon: 'circle',
  sizeRanges: [
    { min: 0, max: 100, size: 8 },
    { min: 100, max: 500, size: 12 },
    { min: 500, max: 1000, size: 16 }
  ]
}
```

## Data Integration

### Climate Data Hierarchy
```
Climate Variable → Scenario → Year Range → Seasonality → Season
├── Historical → Annual/Seasonal → [Month Range]
└── SSP1/SSP2/SSP3/SSP5 → Year Range → Annual/Seasonal → [Month Range]
```

### GIRI Data Hierarchy
```
GIRI Variable → Scenario
├── Existing
├── SSP1
└── SSP5
```

### Energy Data Structure
```
Energy Type → Shapefile with Attributes
├── designCapacity (for sizing)
├── name (for labeling)
├── status (for filtering)
└── owner (for categorization)
```

## Performance Optimization

### File Format Recommendations
- **Raster**: COG format with compression and overviews
- **Shapefile**: Indexed with spatial indexing
- **Icons**: PNG format, optimized for web (< 1MB)

### Best Practices
- Use consistent naming conventions
- Validate data before upload
- Test with small datasets first
- Generate overviews for large rasters
- Compress files appropriately

## API Integration

### Data Access Patterns
```javascript
// Get layer configuration
const layerConfig = await spark.kv.get(`layer-${layerId}`)

// Store classification template
await spark.kv.set(`template-${templateId}`, templateData)

// List all layers for country
const layers = await spark.kv.get(`layers-${country}`)
```

### File Organization
- Automatic file naming based on metadata
- Hierarchical storage structure
- Metadata embedding in file headers
- Backup and versioning support

## Security & Compliance

### Access Control
- Admin privileges required
- User authentication via GitHub
- Action logging and audit trails
- File type validation

### Data Protection
- Secure file storage
- Backup and recovery procedures
- Data integrity validation
- Privacy compliance measures

## Troubleshooting

### Common Issues
1. **Upload Failures**: Check file size and format
2. **Classification Errors**: Verify range continuity
3. **Template Conflicts**: Check data compatibility
4. **Performance Issues**: Consider COG conversion

### Error Handling
- Comprehensive error messages
- Rollback capabilities
- Data validation at each step
- User-friendly error reporting

## Future Enhancements

### Planned Features
- Bulk template operations
- Advanced data visualization
- Integration with external data sources
- Enhanced metadata management
- Automated data processing pipelines

### Extensibility
- Plugin architecture for new data types
- Custom classification algorithms
- API extensions for external tools
- Integration with other UN systems