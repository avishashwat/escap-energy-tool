-- Initialize PostGIS database for ESCAP Climate data
-- This script runs automatically when the PostGIS container starts

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Create schemas for organizing data
CREATE SCHEMA IF NOT EXISTS climate;
CREATE SCHEMA IF NOT EXISTS giri;
CREATE SCHEMA IF NOT EXISTS energy;
CREATE SCHEMA IF NOT EXISTS boundaries;

-- Set proper permissions
GRANT ALL PRIVILEGES ON SCHEMA climate TO escap_user;
GRANT ALL PRIVILEGES ON SCHEMA giri TO escap_user;
GRANT ALL PRIVILEGES ON SCHEMA energy TO escap_user;
GRANT ALL PRIVILEGES ON SCHEMA boundaries TO escap_user;

-- Climate data tables
CREATE TABLE IF NOT EXISTS climate.raster_data (
    id SERIAL PRIMARY KEY,
    country VARCHAR(50) NOT NULL,
    variable VARCHAR(100) NOT NULL,
    scenario VARCHAR(50),
    year_range VARCHAR(20),
    season VARCHAR(50),
    file_path TEXT NOT NULL,
    min_value DOUBLE PRECISION,
    max_value DOUBLE PRECISION,
    mean_value DOUBLE PRECISION,
    classification JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(country, variable, scenario, year_range, season)
);

-- GIRI hazard data tables
CREATE TABLE IF NOT EXISTS giri.raster_data (
    id SERIAL PRIMARY KEY,
    country VARCHAR(50) NOT NULL,
    variable VARCHAR(100) NOT NULL,
    scenario VARCHAR(50),
    file_path TEXT NOT NULL,
    min_value DOUBLE PRECISION,
    max_value DOUBLE PRECISION,
    mean_value DOUBLE PRECISION,
    classification JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(country, variable, scenario)
);

-- Energy infrastructure tables
CREATE TABLE IF NOT EXISTS energy.point_data (
    id SERIAL PRIMARY KEY,
    country VARCHAR(50) NOT NULL,
    infrastructure_type VARCHAR(100) NOT NULL,
    file_path TEXT NOT NULL,
    capacity_attribute VARCHAR(100),
    icon_path TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    geom GEOMETRY(POINT, 4326),
    attributes JSONB,
    UNIQUE(country, infrastructure_type)
);

-- Country boundaries tables
CREATE TABLE IF NOT EXISTS boundaries.country_data (
    id SERIAL PRIMARY KEY,
    country VARCHAR(50) NOT NULL UNIQUE,
    file_path TEXT NOT NULL,
    hover_attribute VARCHAR(100),
    feature_count INTEGER,
    bounds JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    geom GEOMETRY(MULTIPOLYGON, 4326)
);

-- Create spatial indexes for better performance
CREATE INDEX IF NOT EXISTS idx_energy_geom ON energy.point_data USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_boundaries_geom ON boundaries.country_data USING GIST(geom);

-- Create indexes on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_climate_country ON climate.raster_data(country);
CREATE INDEX IF NOT EXISTS idx_climate_variable ON climate.raster_data(variable);
CREATE INDEX IF NOT EXISTS idx_giri_country ON giri.raster_data(country);
CREATE INDEX IF NOT EXISTS idx_energy_country ON energy.point_data(country);
CREATE INDEX IF NOT EXISTS idx_boundaries_country ON boundaries.country_data(country);

-- Grant permissions on tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA climate TO escap_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA giri TO escap_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA energy TO escap_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA boundaries TO escap_user;

-- Grant permissions on sequences
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA climate TO escap_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA giri TO escap_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA energy TO escap_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA boundaries TO escap_user;

-- Create function for updating timestamps
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at columns to tables
ALTER TABLE climate.raster_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE giri.raster_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE energy.point_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE boundaries.country_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_climate_modtime ON climate.raster_data;
CREATE TRIGGER update_climate_modtime BEFORE UPDATE ON climate.raster_data FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_giri_modtime ON giri.raster_data;
CREATE TRIGGER update_giri_modtime BEFORE UPDATE ON giri.raster_data FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_energy_modtime ON energy.point_data;
CREATE TRIGGER update_energy_modtime BEFORE UPDATE ON energy.point_data FOR EACH ROW EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS update_boundaries_modtime ON boundaries.country_data;
CREATE TRIGGER update_boundaries_modtime BEFORE UPDATE ON boundaries.country_data FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- Create materialized views for faster queries
CREATE MATERIALIZED VIEW IF NOT EXISTS climate.data_summary AS
SELECT 
    country,
    variable,
    COUNT(*) as file_count,
    MIN(min_value) as overall_min,
    MAX(max_value) as overall_max,
    AVG(mean_value) as overall_mean
FROM climate.raster_data
GROUP BY country, variable;

CREATE MATERIALIZED VIEW IF NOT EXISTS energy.infrastructure_summary AS
SELECT 
    country,
    infrastructure_type,
    COUNT(*) as point_count,
    ST_Extent(geom) as bbox
FROM energy.point_data
GROUP BY country, infrastructure_type;

-- Create indexes on materialized views
CREATE UNIQUE INDEX IF NOT EXISTS idx_climate_summary ON climate.data_summary(country, variable);
CREATE UNIQUE INDEX IF NOT EXISTS idx_energy_summary ON energy.infrastructure_summary(country, infrastructure_type);

-- Grant permissions on materialized views
GRANT ALL PRIVILEGES ON climate.data_summary TO escap_user;
GRANT ALL PRIVILEGES ON energy.infrastructure_summary TO escap_user;

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY climate.data_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY energy.infrastructure_summary;
END;
$$ LANGUAGE plpgsql;

-- Log initialization completion
INSERT INTO climate.raster_data (country, variable, scenario, year_range, season, file_path, min_value, max_value, mean_value, classification)
VALUES ('system', 'initialization', 'complete', '2024', 'all', '/dev/null', 0, 0, 0, '{"status": "initialized"}')
ON CONFLICT (country, variable, scenario, year_range, season) DO NOTHING;