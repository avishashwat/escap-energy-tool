// Chat Interface - Individual message component with evidence display
// Created: 2025-10-10 1:00 PM
// Purpose: Display chat messages with evidence validation
// Status: NEW FILE - SAFE TO CREATE

import React, { useState } from 'react';
import { Check, AlertTriangle, Info, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  evidence?: any[];
  confidence?: 'high' | 'medium' | 'low';
}

interface ChatInterfaceProps {
  message: Message;
  isLoading?: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ message, isLoading }) => {
  const [showEvidence, setShowEvidence] = useState(false);

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getConfidenceColor = (confidence?: string) => {
    switch (confidence) {
      case 'high':
        return 'text-green-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getConfidenceIcon = (confidence?: string) => {
    switch (confidence) {
      case 'high':
        return <Check size={14} className="text-green-600" />;
      case 'medium':
        return <Info size={14} className="text-yellow-600" />;
      case 'low':
        return <AlertTriangle size={14} className="text-red-600" />;
      default:
        return null;
    }
  };

  const formatMessageContent = (content: string) => {
    // Add basic formatting for better readability
    const lines = content.split('\n');
    
    return lines.map((line, index) => {
      // Handle bullet points
      if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
        return (
          <div key={index} className="flex items-start gap-2 my-1">
            <span className="text-blue-500 mt-1">•</span>
            <span>{line.replace(/^[•-]\s*/, '')}</span>
          </div>
        );
      }
      
      // Handle numbered lists
      if (line.trim().match(/^\d+\./)) {
        return (
          <div key={index} className="my-1 ml-2">
            {line}
          </div>
        );
      }
      
      // Handle headers (lines that end with colon)
      if (line.trim().endsWith(':') && line.length < 100) {
        return (
          <div key={index} className="font-semibold mt-3 mb-1 text-gray-800">
            {line}
          </div>
        );
      }
      
      // Regular lines
      return line.trim() ? (
        <div key={index} className="my-1">
          {line}
        </div>
      ) : (
        <div key={index} className="h-2" />
      );
    });
  };

  return (
    <div className={`message ${message.type}`}>
      {/* User Message */}
      {message.type === 'user' && (
        <div className="message-bubble user-message">
          <div className="message-content">{message.content}</div>
          <div className="message-time">{formatTimestamp(message.timestamp)}</div>
        </div>
      )}

      {/* Assistant Message */}
      {message.type === 'assistant' && (
        <div className="message-bubble assistant-message">
          {/* Message Content */}
          <div className="message-content">
            {formatMessageContent(message.content)}
          </div>

          {/* Message Footer */}
          <div className="message-footer">
            <div className="message-meta">
              <span className="message-time">
                {formatTimestamp(message.timestamp)}
              </span>
              
              {/* Confidence Indicator */}
              {message.confidence && (
                <div className={`confidence-indicator ${getConfidenceColor(message.confidence)}`}>
                  {getConfidenceIcon(message.confidence)}
                  <span className="capitalize">{message.confidence} confidence</span>
                </div>
              )}
            </div>

            {/* Evidence Toggle */}
            {message.evidence && message.evidence.length > 0 && (
              <button
                onClick={() => setShowEvidence(!showEvidence)}
                className="evidence-toggle"
                aria-label={showEvidence ? 'Hide evidence' : 'Show evidence sources'}
              >
                <span>Evidence ({message.evidence.length})</span>
                {showEvidence ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>

          {/* Evidence Panel */}
          {showEvidence && message.evidence && message.evidence.length > 0 && (
            <div className="evidence-panel">
              <div className="evidence-header">
                <Info size={16} />
                <span>Data Sources Used</span>
              </div>
              
              <div className="evidence-list">
                {message.evidence.map((evidence, index) => (
                  <div key={index} className="evidence-item">
                    <div className="evidence-type">
                      <span className="evidence-label">
                        {evidence.type === 'climate_data' && 'Climate Data'}
                        {evidence.type === 'giri_data' && 'Land Use Data'}
                        {evidence.type === 'regional_stats' && 'Regional Statistics'}
                        {evidence.type === 'calculated_metrics' && 'Calculated Metrics'}
                      </span>
                      <span className={`confidence-badge ${evidence.confidence || 'medium'}`}>
                        {evidence.confidence || 'medium'}
                      </span>
                    </div>
                    
                    {/* Data Points Summary */}
                    {evidence.data_points && (
                      <div className="evidence-details">
                        {Array.isArray(evidence.data_points) ? (
                          <div className="data-summary">
                            {evidence.data_points.length} data points analyzed
                            {evidence.data_points[0]?.variable && (
                              <span> • {evidence.data_points[0].variable}</span>
                            )}
                            {evidence.data_points[0]?.season && (
                              <span> • {evidence.data_points[0].season}</span>
                            )}
                          </div>
                        ) : (
                          <div className="data-summary">
                            Data source validated
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Evidence Quality Notice */}
              <div className="evidence-notice">
                <Info size={14} />
                <span>
                  All responses are generated using validated data sources from the application's 
                  climate and land use datasets.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatInterface;