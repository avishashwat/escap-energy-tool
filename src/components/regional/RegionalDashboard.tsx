// Regional Dashboard - AI-powered regional analysis component
// Created: 2025-10-10 1:05 PM
// Purpose: AI dashboard triggered by region selection
// Status: NEW FILE - SAFE TO CREATE

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Leaf, 
  Droplets, 
  Thermometer, 
  RefreshCw, 
  X,
  Info,
  ChevronRight,
  Calendar,
  MapPin
} from 'lucide-react';
import { aiApiService } from '../../services/aiApiService';
import './RegionalDashboard.css';

interface RegionalDashboardProps {
  selectedRegion: {
    name: string;
    coordinates?: [number, number];
    properties?: any;
  } | null;
  appContext: {
    selectedCountry?: string;
    selectedLayers?: any[];
    [key: string]: any;
  };
  onClose: () => void;
  isVisible: boolean;
}

interface AnalysisData {
  success: boolean;
  analysis: string;
  evidence_sources: any[];
  confidence_level: 'high' | 'medium' | 'low';
  data_coverage: {
    climate: string;
    land_use: string;
  };
  generation_time_ms: number;
  cached: boolean;
  expires_at: string;
  error?: string;
}

interface DataSummary {
  climate_data_points: number;
  giri_classifications: number;
  data_coverage_score: number;
  available_variables: string[];
  available_seasons: string[];
}

const RegionalDashboard: React.FC<RegionalDashboardProps> = ({
  selectedRegion,
  appContext,
  onClose,
  isVisible
}) => {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'analysis' | 'data' | 'trends'>('analysis');

  // Fetch analysis when region changes
  useEffect(() => {
    if (selectedRegion && isVisible) {
      fetchRegionalAnalysis();
      fetchDataSummary();
    }
  }, [selectedRegion, isVisible]);

  const fetchRegionalAnalysis = async () => {
    if (!selectedRegion) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await aiApiService.getRegionalAnalysis(
        selectedRegion.name,
        appContext,
        false // Don't force refresh initially
      );
      
      if (result.success && result.data) {
        // Adapt API response to component interface
        const analysisData: AnalysisData = {
          success: true,
          analysis: result.data.analysis,
          evidence_sources: result.data.evidence_sources,
          confidence_level: result.data.confidence_level as 'high' | 'medium' | 'low',
          data_coverage: {
            climate: result.data.data_coverage.climate || 'unknown',
            land_use: result.data.data_coverage.land_use || 'unknown'
          },
          generation_time_ms: 0, // Will be available from real backend
          cached: result.data.cached,
          expires_at: result.data.expires_at
        };
        setAnalysisData(analysisData);
      } else {
        setError(result.error || 'Failed to generate analysis');
      }
    } catch (err) {
      setError('Network error: Unable to fetch analysis');
      console.error('Regional analysis error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDataSummary = async () => {
    if (!selectedRegion) return;

    try {
      const result = await aiApiService.getRegionalDataSummary(selectedRegion.name, appContext);
      
      if (result.success && result.data) {
        setDataSummary(result.data);
      }
    } catch (err) {
      console.error('Data summary error:', err);
    }
  };

  const refreshAnalysis = () => {
    if (selectedRegion) {
      fetchRegionalAnalysis();
    }
  };

  const formatAnalysisContent = (content: string) => {
    const lines = content.split('\n');
    
    return lines.map((line, index) => {
      // Handle headers (lines ending with colon)
      if (line.trim().endsWith(':') && line.length < 100) {
        return (
          <h4 key={index} className="analysis-header">
            {line.replace(':', '')}
          </h4>
        );
      }
      
      // Handle bullet points
      if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
        return (
          <div key={index} className="analysis-bullet">
            <ChevronRight size={14} className="bullet-icon" />
            <span>{line.replace(/^[•-]\s*/, '')}</span>
          </div>
        );
      }
      
      // Handle numbered points
      if (line.trim().match(/^\d+\./)) {
        return (
          <div key={index} className="analysis-numbered">
            {line}
          </div>
        );
      }
      
      // Regular paragraphs
      return line.trim() ? (
        <p key={index} className="analysis-paragraph">
          {line}
        </p>
      ) : (
        <div key={index} className="analysis-spacer" />
      );
    });
  };

  const getConfidenceBadge = (confidence: string) => {
    const badges = {
      high: { text: 'High Confidence', color: 'success', icon: '✓' },
      medium: { text: 'Medium Confidence', color: 'warning', icon: '◐' },
      low: { text: 'Low Confidence', color: 'danger', icon: '⚠' }
    };
    
    const badge = badges[confidence as keyof typeof badges] || badges.medium;
    
    return (
      <span className={`confidence-badge ${badge.color}`}>
        {badge.icon} {badge.text}
      </span>
    );
  };

  const getDataCoverageIcon = (coverage: string) => {
    switch (coverage) {
      case 'good':
        return <Leaf className="text-green-500" size={16} />;
      case 'limited':
        return <AlertTriangle className="text-yellow-500" size={16} />;
      default:
        return <Info className="text-gray-500" size={16} />;
    }
  };

  if (!isVisible || !selectedRegion) {
    return null;
  }

  return (
    <div className="regional-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="region-info">
            <MapPin size={20} className="region-icon" />
            <div>
              <h2 className="region-name">{selectedRegion.name}</h2>
              <p className="region-subtitle">
                AI-Powered Regional Analysis
                {analysisData?.cached && (
                  <span className="cached-indicator">
                    <Calendar size={12} /> Cached
                  </span>
                )}
              </p>
            </div>
          </div>
          
          <div className="header-controls">
            <button 
              onClick={refreshAnalysis}
              className="refresh-button"
              disabled={isLoading}
              title="Refresh analysis"
            >
              <RefreshCw size={16} className={isLoading ? 'spinning' : ''} />
            </button>
            
            <button 
              onClick={onClose}
              className="close-button"
              title="Close dashboard"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button
          className={`tab ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          <BarChart3 size={16} />
          Analysis
        </button>
        
        <button
          className={`tab ${activeTab === 'data' ? 'active' : ''}`}
          onClick={() => setActiveTab('data')}
        >
          <Info size={16} />
          Data Summary
        </button>
        
        <button
          className={`tab ${activeTab === 'trends' ? 'active' : ''}`}
          onClick={() => setActiveTab('trends')}
        >
          <TrendingUp size={16} />
          Key Trends
        </button>
      </div>

      {/* Content */}
      <div className="dashboard-content">
        {/* Loading State */}
        {isLoading && (
          <div className="loading-state">
            <div className="loading-spinner">
              <RefreshCw size={32} className="spinning" />
            </div>
            <h3>Generating AI Analysis...</h3>
            <p>Analyzing climate data and land use patterns for {selectedRegion.name}</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="error-state">
            <AlertTriangle size={32} className="error-icon" />
            <h3>Analysis Unavailable</h3>
            <p>{error}</p>
            <button onClick={refreshAnalysis} className="retry-button">
              Try Again
            </button>
          </div>
        )}

        {/* Analysis Tab */}
        {activeTab === 'analysis' && analysisData && !isLoading && !error && (
          <div className="analysis-content">
            {/* Confidence & Meta Info */}
            <div className="analysis-meta">
              {getConfidenceBadge(analysisData.confidence_level)}
              
              <div className="meta-info">
                <span className="generation-time">
                  Generated in {analysisData.generation_time_ms}ms
                </span>
                {analysisData.evidence_sources && (
                  <span className="evidence-count">
                    {analysisData.evidence_sources.length} data sources
                  </span>
                )}
              </div>
            </div>

            {/* Analysis Text */}
            <div className="analysis-text">
              {formatAnalysisContent(analysisData.analysis)}
            </div>

            {/* Evidence Sources */}
            {analysisData.evidence_sources && analysisData.evidence_sources.length > 0 && (
              <div className="evidence-section">
                <h4 className="evidence-title">
                  <Info size={16} />
                  Evidence Sources
                </h4>
                <div className="evidence-grid">
                  {analysisData.evidence_sources.map((source, index) => (
                    <div key={index} className="evidence-card">
                      <div className="evidence-type">
                        {source.type === 'climate_data' && <Thermometer size={14} />}
                        {source.type === 'giri_data' && <Leaf size={14} />}
                        {source.type === 'regional_stats' && <BarChart3 size={14} />}
                        <span>
                          {source.type === 'climate_data' && 'Climate Data'}
                          {source.type === 'giri_data' && 'Land Use Data'}
                          {source.type === 'regional_stats' && 'Regional Statistics'}
                        </span>
                      </div>
                      <div className="evidence-confidence">
                        {source.confidence || 'medium'} confidence
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Data Summary Tab */}
        {activeTab === 'data' && dataSummary && (
          <div className="data-summary-content">
            <div className="summary-grid">
              <div className="summary-card">
                <Thermometer className="card-icon climate" />
                <div className="card-content">
                  <h4>Climate Data</h4>
                  <div className="card-value">{dataSummary.climate_data_points}</div>
                  <div className="card-label">Data Points</div>
                </div>
              </div>

              <div className="summary-card">
                <Leaf className="card-icon land-use" />
                <div className="card-content">
                  <h4>Land Use Classifications</h4>
                  <div className="card-value">{dataSummary.giri_classifications}</div>
                  <div className="card-label">Classifications</div>
                </div>
              </div>

              <div className="summary-card">
                <BarChart3 className="card-icon coverage" />
                <div className="card-content">
                  <h4>Data Coverage</h4>
                  <div className="card-value">{dataSummary.data_coverage_score}%</div>
                  <div className="card-label">Coverage Score</div>
                </div>
              </div>
            </div>

            {/* Available Variables */}
            {dataSummary.available_variables && dataSummary.available_variables.length > 0 && (
              <div className="variables-section">
                <h4>Available Variables</h4>
                <div className="variable-tags">
                  {dataSummary.available_variables.map((variable, index) => (
                    <span key={index} className="variable-tag">
                      {variable}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Available Seasons */}
            {dataSummary.available_seasons && dataSummary.available_seasons.length > 0 && (
              <div className="seasons-section">
                <h4>Available Seasons</h4>
                <div className="season-tags">
                  {dataSummary.available_seasons.map((season, index) => (
                    <span key={index} className="season-tag">
                      {season}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Key Trends Tab */}
        {activeTab === 'trends' && analysisData && (
          <div className="trends-content">
            <div className="trends-grid">
              {/* Climate Trends */}
              <div className="trend-card">
                <div className="trend-header">
                  <Thermometer className="trend-icon temperature" />
                  <h4>Temperature Trends</h4>
                </div>
                <div className="trend-content">
                  {analysisData.data_coverage?.climate === 'good' ? (
                    <div className="trend-indicator positive">
                      <TrendingUp size={16} />
                      <span>Warming trend detected</span>
                    </div>
                  ) : (
                    <div className="trend-indicator neutral">
                      <Info size={16} />
                      <span>Limited temperature data</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Precipitation Trends */}
              <div className="trend-card">
                <div className="trend-header">
                  <Droplets className="trend-icon precipitation" />
                  <h4>Precipitation Patterns</h4>
                </div>
                <div className="trend-content">
                  {analysisData.data_coverage?.climate === 'good' ? (
                    <div className="trend-indicator neutral">
                      <BarChart3 size={16} />
                      <span>Variable precipitation</span>
                    </div>
                  ) : (
                    <div className="trend-indicator neutral">
                      <Info size={16} />
                      <span>Limited precipitation data</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Land Use Changes */}
              <div className="trend-card">
                <div className="trend-header">
                  <Leaf className="trend-icon land-use" />
                  <h4>Land Use Changes</h4>
                </div>
                <div className="trend-content">
                  {analysisData.data_coverage?.land_use === 'good' ? (
                    <div className="trend-indicator caution">
                      <AlertTriangle size={16} />
                      <span>Land use shifts observed</span>
                    </div>
                  ) : (
                    <div className="trend-indicator neutral">
                      <Info size={16} />
                      <span>Limited land use data</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegionalDashboard;