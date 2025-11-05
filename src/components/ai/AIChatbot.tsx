import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { X, MessageCircle, Bot, User, Lightbulb, BarChart3, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatMessage {
  id: string
  type: 'user' | 'bot'
  content: string
  timestamp: Date
  category?: string
}

interface CountryQA {
  question: string
  answer: string
  category: 'demographics' | 'energy' | 'climate' | 'economy' | 'geography'
  confidence: 'high' | 'medium' | 'low'
  sources: string[]
}

interface AIChatbotProps {
  selectedCountry: string
  isVisible?: boolean
  onToggle?: () => void
}

export function AIChatbot({ selectedCountry, isVisible = false, onToggle }: AIChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [countryData, setCountryData] = useState<CountryQA[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const categories = [
    { id: 'demographics', label: 'Demographics', icon: User, color: 'bg-blue-100 text-blue-700' },
    { id: 'energy', label: 'Energy Infrastructure', icon: BarChart3, color: 'bg-green-100 text-green-700' },
    { id: 'climate', label: 'Climate & Environment', icon: Lightbulb, color: 'bg-orange-100 text-orange-700' },
    { id: 'geography', label: 'Geography & Regions', icon: MapPin, color: 'bg-purple-100 text-purple-700' }
  ]

  // Load country-specific Q&A data
  useEffect(() => {
    loadCountryData()
  }, [selectedCountry])

  // Auto-scroll to bottom of messages
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadCountryData = async () => {
    try {
      setLoading(true)
      // Try to load country-specific data
      const response = await fetch(`/data/ai/chatbot/${selectedCountry.toLowerCase()}_qa.json`)
      if (response.ok) {
        const data = await response.json()
        setCountryData(data.questions)
      } else {
        // Fallback to default data
        loadDefaultData()
      }
    } catch (error) {
      console.warn(`No AI data found for ${selectedCountry}, using defaults`)
      loadDefaultData()
    } finally {
      setLoading(false)
    }
  }

  const loadDefaultData = () => {
    // Default questions for demonstration
    const defaultQuestions: CountryQA[] = [
      {
        question: `What is the population and demographic profile of ${selectedCountry}?`,
        answer: `${selectedCountry} has a diverse demographic profile with varying population density across regions. The country shows typical regional patterns with urban centers having higher population density while rural areas maintain traditional community structures. Key demographic indicators include age distribution, urbanization trends, and regional population variations that influence infrastructure planning and resource allocation.`,
        category: 'demographics',
        confidence: 'high',
        sources: ['National Statistical Office', 'World Bank Demographics Data', 'UN Population Division']
      },
      {
        question: `What are the main energy infrastructure assets in ${selectedCountry}?`,
        answer: `${selectedCountry}'s energy infrastructure includes a mix of renewable and conventional power generation facilities. Hydropower represents a significant portion of the energy mix, with several large and small-scale installations. The country also has solar, wind, and biomass potential that is being developed. Grid infrastructure connects major population centers with ongoing expansion to rural areas.`,
        category: 'energy',
        confidence: 'high',
        sources: ['National Energy Authority', 'International Energy Agency', 'Regional Power Studies']
      },
      {
        question: `How does climate change affect ${selectedCountry}?`,
        answer: `${selectedCountry} faces various climate change impacts including changing precipitation patterns, temperature variations, and extreme weather events. These changes affect water resources, agricultural productivity, and energy security. Adaptation strategies focus on building resilience in key sectors while developing sustainable development pathways.`,
        category: 'climate',
        confidence: 'medium',
        sources: ['IPCC Regional Reports', 'National Climate Assessment', 'Regional Climate Studies']
      },
      {
        question: `What are the major geographical regions in ${selectedCountry}?`,
        answer: `${selectedCountry} is divided into distinct geographical regions, each with unique characteristics in terms of topography, climate, and development patterns. These regional differences influence infrastructure development, economic activities, and environmental management strategies. Understanding regional variations is crucial for effective planning and resource allocation.`,
        category: 'geography',
        confidence: 'high',
        sources: ['National Geographic Survey', 'Regional Development Plans', 'Administrative Records']
      }
    ]
    setCountryData(defaultQuestions)
  }

  const addWelcomeMessage = () => {
    const welcomeMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'bot',
      content: `Hello! I'm your AI assistant for ${selectedCountry}. I can help you with information about demographics, energy infrastructure, climate, and geography. Select a category below or ask me a question!`,
      timestamp: new Date()
    }
    setMessages([welcomeMessage])
  }

  const handleQuestionSelect = (qa: CountryQA) => {
    // Add user question
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: qa.question,
      timestamp: new Date()
    }

    // Add bot response
    const botMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'bot',
      content: qa.answer,
      timestamp: new Date(),
      category: qa.category
    }

    setMessages(prev => [...prev, userMessage, botMessage])
    setSelectedCategory(null)
  }

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(selectedCategory === categoryId ? null : categoryId)
  }

  const clearChat = () => {
    setMessages([])
    addWelcomeMessage()
  }

  // Initialize welcome message when component becomes visible
  useEffect(() => {
    if (isVisible && messages.length === 0) {
      addWelcomeMessage()
    }
  }, [isVisible])

  const filteredQuestions = selectedCategory 
    ? countryData.filter(qa => qa.category === selectedCategory)
    : countryData

  if (!isVisible) {
    return (
      <Button
        onClick={onToggle}
        className="fixed bottom-4 right-8 h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 z-50"
        size="icon"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    )
  }

  return (
    <div className="fixed bottom-32 right-6 w-96 h-[600px] z-50 flex flex-col">
      <Card className="flex-1 flex flex-col shadow-2xl border-0 bg-white">
        {/* Header */}
        <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <CardTitle className="text-lg">AI Assistant</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="text-white hover:bg-white/20 h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-sm opacity-90">
            Insights for {selectedCountry}
          </div>
        </CardHeader>

        {/* Messages */}
        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-[300px] p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-2",
                    message.type === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.type === 'bot' && (
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-blue-600" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] p-3 rounded-lg text-sm",
                      message.type === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-gray-100 text-gray-900 rounded-bl-none'
                    )}
                  >
                    {message.content}
                  </div>
                  {message.type === 'user' && (
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="h-4 w-4 text-gray-600" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Categories */}
          <div className="p-4 border-t bg-gray-50">
            <div className="text-xs font-medium text-gray-500 mb-2">Select a topic:</div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {categories.map((category) => {
                const Icon = category.icon
                return (
                  <Button
                    key={category.id}
                    variant={selectedCategory === category.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleCategorySelect(category.id)}
                    className={cn(
                      "justify-start text-xs h-8",
                      selectedCategory === category.id && category.color
                    )}
                  >
                    <Icon className="h-3 w-3 mr-1" />
                    {category.label}
                  </Button>
                )
              })}
            </div>

            {/* Questions */}
            {selectedCategory && (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                <div className="text-xs text-gray-500 mb-1">Ask about:</div>
                {filteredQuestions.map((qa, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuestionSelect(qa)}
                    className="w-full text-left p-2 text-xs bg-white border rounded hover:bg-gray-50 transition-colors"
                  >
                    {qa.question}
                    <div className="flex gap-1 mt-1">
                      <Badge variant="secondary" className="text-xs h-4">
                        {qa.confidence}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={clearChat}
                className="flex-1 text-xs h-8"
              >
                Clear Chat
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}