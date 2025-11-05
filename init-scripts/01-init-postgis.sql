-- Initialize PostGIS extensions and create spatial tables
-- This script runs automatically when PostgreSQL container starts

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;
CREATE EXTENSION IF NOT EXISTS postgis_tiger_geocoder;

-- Create schema for boundary data
CREATE SCHEMA IF NOT EXISTS boundaries;

-- Create table for storing boundary metadata
CREATE TABLE IF NOT EXISTS boundaries.boundary_layers (
    id SERIAL PRIMARY KEY,
    layer_name VARCHAR(255) UNIQUE NOT NULL,
    country VARCHAR(100) NOT NULL,
    admin_level INTEGER NOT NULL,
    workspace VARCHAR(100) DEFAULT 'escap',
    feature_count INTEGER,
    bounding_box GEOMETRY(POLYGON, 4326),
    attributes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    file_path TEXT,
    processing_status VARCHAR(50) DEFAULT 'pending'
);

-- Create spatial index on bounding box
CREATE INDEX IF NOT EXISTS idx_boundary_layers_bbox ON boundaries.boundary_layers USING GIST(bounding_box);

-- Create index on country and admin level for fast queries
CREATE INDEX IF NOT EXISTS idx_boundary_layers_country_admin ON boundaries.boundary_layers(country, admin_level);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION boundaries.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_boundary_layers_updated_at 
    BEFORE UPDATE ON boundaries.boundary_layers 
    FOR EACH ROW EXECUTE FUNCTION boundaries.update_updated_at_column();

-- Create user for GeoServer connection with appropriate permissions
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'geoserver_user') THEN
        CREATE ROLE geoserver_user WITH LOGIN PASSWORD 'geoserver_pass_2024';
    END IF;
END
$$;

-- Grant permissions to geoserver user
GRANT USAGE ON SCHEMA boundaries TO geoserver_user;
GRANT CREATE ON SCHEMA boundaries TO geoserver_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA boundaries TO geoserver_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA boundaries TO geoserver_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA boundaries GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO geoserver_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA boundaries GRANT USAGE, SELECT ON SEQUENCES TO geoserver_user;

-- Create sample workspace and layer configuration
INSERT INTO boundaries.boundary_layers (
    layer_name, 
    country, 
    admin_level, 
    workspace, 
    feature_count, 
    attributes,
    processing_status
) VALUES (
    'sample_admin_0',
    'sample',
    0,
    'escap',
    1,
    '{"NAME": "Sample Country"}',
    'completed'
) ON CONFLICT (layer_name) DO NOTHING;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'PostGIS database initialized successfully for ESCAP Climate Tool';
    RAISE NOTICE 'Schema: boundaries';
    RAISE NOTICE 'User: geoserver_user created with appropriate permissions';
END
$$;