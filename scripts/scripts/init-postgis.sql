-- Initialize PostGIS database with optimized spatial indexes
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS postgis_sfcgal;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Create schemas for organized data management
CREATE SCHEMA IF NOT EXISTS boundaries;
CREATE SCHEMA IF NOT EXISTS climate;
CREATE SCHEMA IF NOT EXISTS energy;
CREATE SCHEMA IF NOT EXISTS metadata;

-- Country boundaries table with optimized spatial indexing
CREATE TABLE boundaries.countries (
    id SERIAL PRIMARY KEY,
    country_code VARCHAR(3) UNIQUE NOT NULL,
    country_name VARCHAR(100) NOT NULL,
    admin_level INTEGER DEFAULT 0,
    geom GEOMETRY(MULTIPOLYGON, 4326),
    properties JSONB,
    bbox GEOMETRY(POLYGON, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Administrative boundaries (provinces/states)
CREATE TABLE boundaries.admin_boundaries (
    id SERIAL PRIMARY KEY,
    country_code VARCHAR(3) NOT NULL,
    admin_level INTEGER NOT NULL,
    admin_name VARCHAR(200) NOT NULL,
    admin_code VARCHAR(50),
    parent_id INTEGER REFERENCES boundaries.admin_boundaries(id),
    geom GEOMETRY(MULTIPOLYGON, 4326),
    properties JSONB,
    bbox GEOMETRY(POLYGON, 4326),
    area_km2 DECIMAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Climate data metadata
CREATE TABLE climate.datasets (
    id SERIAL PRIMARY KEY,
    country_code VARCHAR(3) NOT NULL,
    variable_name VARCHAR(100) NOT NULL,
    scenario VARCHAR(50),
    time_period VARCHAR(50),
    season VARCHAR(50),
    file_path TEXT NOT NULL,
    file_type VARCHAR(20) DEFAULT 'COG',
    bbox GEOMETRY(POLYGON, 4326),
    resolution_m DECIMAL,
    min_value DECIMAL,
    max_value DECIMAL,
    mean_value DECIMAL,
    classification JSONB,
    style_info JSONB,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Energy infrastructure points
CREATE TABLE energy.infrastructure (
    id SERIAL PRIMARY KEY,
    country_code VARCHAR(3) NOT NULL,
    infrastructure_type VARCHAR(50) NOT NULL,
    name VARCHAR(200),
    design_capacity DECIMAL,
    capacity_unit VARCHAR(20),
    geom GEOMETRY(POINT, 4326),
    properties JSONB,
    icon_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Processing jobs tracking
CREATE TABLE metadata.processing_jobs (
    id SERIAL PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT,
    status VARCHAR(20) DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    error_message TEXT,
    result_data JSONB,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Collaboration sessions
CREATE TABLE metadata.collaboration_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    created_by VARCHAR(100),
    participants JSONB DEFAULT '[]',
    map_state JSONB,
    active_layers JSONB DEFAULT '{}',
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create optimized spatial indexes
CREATE INDEX idx_countries_geom ON boundaries.countries USING GIST (geom);
CREATE INDEX idx_countries_bbox ON boundaries.countries USING GIST (bbox);
CREATE INDEX idx_countries_code ON boundaries.countries (country_code);

CREATE INDEX idx_admin_geom ON boundaries.admin_boundaries USING GIST (geom);
CREATE INDEX idx_admin_bbox ON boundaries.admin_boundaries USING GIST (bbox);
CREATE INDEX idx_admin_country ON boundaries.admin_boundaries (country_code);
CREATE INDEX idx_admin_level ON boundaries.admin_boundaries (country_code, admin_level);
CREATE INDEX idx_admin_name ON boundaries.admin_boundaries (admin_name);
CREATE INDEX idx_admin_parent ON boundaries.admin_boundaries (parent_id);

CREATE INDEX idx_climate_country ON climate.datasets (country_code);
CREATE INDEX idx_climate_variable ON climate.datasets (variable_name);
CREATE INDEX idx_climate_scenario ON climate.datasets (country_code, variable_name, scenario);
CREATE INDEX idx_climate_bbox ON climate.datasets USING GIST (bbox);

CREATE INDEX idx_energy_geom ON energy.infrastructure USING GIST (geom);
CREATE INDEX idx_energy_country ON energy.infrastructure (country_code);
CREATE INDEX idx_energy_type ON energy.infrastructure (infrastructure_type);
CREATE INDEX idx_energy_capacity ON energy.infrastructure (design_capacity);

CREATE INDEX idx_jobs_status ON metadata.processing_jobs (status);
CREATE INDEX idx_jobs_type ON metadata.processing_jobs (job_type);
CREATE INDEX idx_jobs_created ON metadata.processing_jobs (created_at);

CREATE INDEX idx_sessions_id ON metadata.collaboration_sessions (session_id);
CREATE INDEX idx_sessions_activity ON metadata.collaboration_sessions (last_activity);

-- Create update triggers for timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_countries_updated_at 
    BEFORE UPDATE ON boundaries.countries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_updated_at 
    BEFORE UPDATE ON boundaries.admin_boundaries 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_energy_updated_at 
    BEFORE UPDATE ON energy.infrastructure 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Spatial analysis functions
CREATE OR REPLACE FUNCTION boundaries.get_country_extent(country_code TEXT)
RETURNS GEOMETRY AS $$
BEGIN
    RETURN (
        SELECT ST_Envelope(geom) 
        FROM boundaries.countries 
        WHERE boundaries.countries.country_code = $1
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION boundaries.get_admin_by_point(lon DECIMAL, lat DECIMAL)
RETURNS TABLE(country_code VARCHAR, admin_name VARCHAR, admin_level INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ab.country_code,
        ab.admin_name,
        ab.admin_level
    FROM boundaries.admin_boundaries ab
    WHERE ST_Contains(ab.geom, ST_SetSRID(ST_MakePoint(lon, lat), 4326))
    ORDER BY ab.admin_level DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Vacuum and analyze for performance
VACUUM ANALYZE;