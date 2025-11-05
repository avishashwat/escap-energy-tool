-- Initialize the PostGIS database for UN ESCAP

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Create the main spatial metadata table
CREATE TABLE IF NOT EXISTS spatial_metadata (
    id SERIAL PRIMARY KEY,
    country VARCHAR(50) NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    layer_name VARCHAR(255) NOT NULL UNIQUE,
    file_path TEXT,
    geoserver_layer VARCHAR(255),
    metadata JSONB,
    bounds GEOMETRY(POLYGON, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial index on bounds
CREATE INDEX IF NOT EXISTS idx_spatial_metadata_bounds ON spatial_metadata USING GIST(bounds);

-- Create regular indexes
CREATE INDEX IF NOT EXISTS idx_spatial_metadata_country ON spatial_metadata(country);
CREATE INDEX IF NOT EXISTS idx_spatial_metadata_type ON spatial_metadata(data_type);
CREATE INDEX IF NOT EXISTS idx_spatial_metadata_layer ON spatial_metadata(layer_name);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_spatial_metadata_modtime ON spatial_metadata;
CREATE TRIGGER update_spatial_metadata_modtime
    BEFORE UPDATE ON spatial_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Insert initial country boundaries (placeholder for actual data)
-- These will be populated by the application
INSERT INTO spatial_metadata (country, data_type, layer_name, metadata) VALUES
('bhutan', 'boundary', 'bhutan_admin_boundary', '{"description": "Administrative boundaries of Bhutan"}'),
('mongolia', 'boundary', 'mongolia_admin_boundary', '{"description": "Administrative boundaries of Mongolia"}'),
('laos', 'boundary', 'laos_admin_boundary', '{"description": "Administrative boundaries of Laos"}')
ON CONFLICT (layer_name) DO NOTHING;