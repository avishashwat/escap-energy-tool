from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Text, UniqueConstraint
from sqlalchemy.sql import func
from database import Base

class ClimateData(Base):
    """Climate raster data model"""
    __tablename__ = "climate_data"
    __table_args__ = {'schema': 'climate'}
    
    id = Column(Integer, primary_key=True, index=True)
    country = Column(String(50), nullable=False, index=True)
    variable = Column(String(100), nullable=False, index=True)
    scenario = Column(String(50))
    year_range = Column(String(20))
    season = Column(String(50))
    file_path = Column(Text, nullable=False)
    min_value = Column(Float)
    max_value = Column(Float)
    mean_value = Column(Float)
    classification = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint('country', 'variable', 'scenario', 'year_range', 'season'),
        {'schema': 'climate'}
    )

class GiriData(Base):
    """GIRI hazard raster data model"""
    __tablename__ = "giri_data"
    __table_args__ = {'schema': 'giri'}
    
    id = Column(Integer, primary_key=True, index=True)
    country = Column(String(50), nullable=False, index=True)
    variable = Column(String(100), nullable=False)
    scenario = Column(String(50))
    file_path = Column(Text, nullable=False)
    min_value = Column(Float)
    max_value = Column(Float)
    mean_value = Column(Float)
    classification = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint('country', 'variable', 'scenario'),
        {'schema': 'giri'}
    )

class EnergyData(Base):
    """Energy infrastructure point data model"""
    __tablename__ = "energy_data"
    __table_args__ = {'schema': 'energy'}
    
    id = Column(Integer, primary_key=True, index=True)
    country = Column(String(50), nullable=False, index=True)
    infrastructure_type = Column(String(100), nullable=False)
    file_path = Column(Text, nullable=False)
    capacity_attribute = Column(String(100))
    icon_path = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    __table_args__ = (
        UniqueConstraint('country', 'infrastructure_type'),
        {'schema': 'energy'}
    )

class BoundaryData(Base):
    """Country boundary data model"""
    __tablename__ = "boundary_data"
    __table_args__ = {'schema': 'boundaries'}
    
    id = Column(Integer, primary_key=True, index=True)
    country = Column(String(50), nullable=False, unique=True, index=True)
    file_path = Column(Text, nullable=False)
    hover_attribute = Column(String(100))
    feature_count = Column(Integer)
    bounds = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())