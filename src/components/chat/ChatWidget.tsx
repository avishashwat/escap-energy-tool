// Chat Widget - Main floating chatbot component
// Created: 2025-10-10 1:00 PM
// Purpose: Floating chatbot widget with smart positioning
// Status: NEW FILE - SAFE TO CREATE

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Minimize2, Maximize2 } from 'lucide-react';
import ChatInterface from './ChatInterface';
import { aiApiService, type ChatMessage } from '../../services/aiApiService';
import './ChatWidget.css';

interface ChatWidgetProps {
  showDashboard: boolean;
  showSidebar: boolean;
  currentContext: {
    selectedCountry?: string;
    selectedLayers?: any[];
    mapView?: any;
    [key: string]: any;
  };
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  evidence?: any[];
  confidence?: 'high' | 'medium' | 'low';
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ 
  showDashboard, 
  showSidebar, 
  currentContext 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const widgetRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Smart positioning based on dashboard/sidebar state
  const getWidgetPosition = () => {
    return {
      bottom: '24px',
      right: showDashboard ? '432px' : '24px', // Account for dashboard width
      zIndex: 1000,
      transition: 'right 0.3s ease-in-out'
    };
  };

  // Initialize chat session
  useEffect(() => {
    initializeSession();
  }, []);

  // Update context when app state changes
  useEffect(() => {
    if (sessionId && isOpen) {
      // Context will be sent with each message
    }
  }, [currentContext, sessionId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeSession = async () => {
    try {
      const session = await aiApiService.createChatSession(currentContext);
      
      if (session) {
        setSessionId(session.id);
        
        // Add welcome message
        setMessages([{
          id: 'welcome',
          type: 'assistant',
          content: `Hello! I'm your climate data assistant. I can help you understand the climate trends, land use patterns, and agricultural implications for your selected regions. 

What would you like to know about ${currentContext.selectedCountry || 'the current data'}?`,
          timestamp: new Date(),
          confidence: 'high'
        }]);
      }
    } catch (error) {
      console.error('Failed to initialize chat session:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const result = await aiApiService.sendMessage(userMessage.content, currentContext);

      if (result.success && result.response) {
        const assistantMessage: Message = {
          id: result.response.message_id || Date.now().toString(),
          type: 'assistant',
          content: result.response.response,
          timestamp: new Date(),
          evidence: result.response.evidence_sources,
          confidence: result.response.confidence_level
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Update unread count if widget is closed
        if (!isOpen) {
          setUnreadCount(prev => prev + 1);
        }
      } else {
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      const errorMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again in a moment.',
        timestamp: new Date(),
        confidence: 'low'
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleWidget = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setUnreadCount(0); // Clear unread count when opening
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getSuggestedQuestions = () => {
    const suggestions = [
      "What are the climate trends for this region?",
      "How is land use changing in this area?",
      "What are the agricultural implications?",
      "What adaptation strategies are recommended?"
    ];

    // Customize based on context
    if (currentContext.selectedCountry) {
      suggestions.unshift(`Tell me about climate risks in ${currentContext.selectedCountry}`);
    }

    return suggestions;
  };

  return (
    <div 
      ref={widgetRef}
      className="chat-widget-container"
      style={getWidgetPosition()}
    >
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={toggleWidget}
          className="chat-trigger-button"
          aria-label="Open climate data assistant"
        >
          <MessageCircle size={24} />
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount}</span>
          )}
        </button>
      )}

      {/* Expanded Chat Interface */}
      {isOpen && (
        <div className={`chat-interface ${isMinimized ? 'minimized' : ''}`}>
          {/* Header */}
          <div className="chat-header">
            <div className="chat-title">
              <MessageCircle size={20} />
              <span>Climate Assistant</span>
              {currentContext.selectedCountry && (
                <span className="context-indicator">
                  • {currentContext.selectedCountry}
                </span>
              )}
            </div>
            <div className="chat-controls">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="control-button"
                aria-label={isMinimized ? 'Expand chat' : 'Minimize chat'}
              >
                {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </button>
              <button
                onClick={toggleWidget}
                className="control-button"
                aria-label="Close chat"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages Area */}
              <div className="chat-messages">
                {messages.length === 0 && (
                  <div className="welcome-state">
                    <MessageCircle size={48} className="welcome-icon" />
                    <h3>Climate Data Assistant</h3>
                    <p>Ask me about climate trends, land use patterns, or agricultural implications for your selected region.</p>
                  </div>
                )}

                {messages.map((message) => (
                  <ChatInterface
                    key={message.id}
                    message={message}
                    isLoading={isLoading && message === messages[messages.length - 1]}
                  />
                ))}

                {/* Typing indicator */}
                {isLoading && (
                  <div className="message assistant">
                    <div className="message-content">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Suggested Questions (shown when no messages) */}
              {messages.length <= 1 && !isLoading && (
                <div className="suggested-questions">
                  <p className="suggestions-title">Try asking:</p>
                  {getSuggestedQuestions().slice(0, 3).map((question, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setInputValue(question);
                        setTimeout(() => sendMessage(), 100);
                      }}
                      className="suggestion-button"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Area */}
              <div className="chat-input-area">
                <div className="input-container">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask about climate trends, land use, or agricultural impacts..."
                    className="chat-input"
                    rows={1}
                    disabled={isLoading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    className="send-button"
                    aria-label="Send message"
                  >
                    <Send size={18} />
                  </button>
                </div>
                <div className="input-footer">
                  <span className="evidence-notice">
                    All responses are based on available climate and land use data
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatWidget;