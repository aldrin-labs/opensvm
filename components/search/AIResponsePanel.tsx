"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, ExternalLink, ThumbsUp, ThumbsDown } from 'lucide-react';

interface AIResponsePanelProps {
  query: string;
  onClose: () => void;
}

interface Source {
  title: string;
  url: string;
}

const AIResponsePanel: React.FC<AIResponsePanelProps> = ({ query, onClose }) => {
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [isAiStreaming, setIsAiStreaming] = useState<boolean>(false);
  const [aiStreamComplete, setAiStreamComplete] = useState<boolean>(false);
  const [aiSources, setAiSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyAvailable, setApiKeyAvailable] = useState<boolean>(false);
  const [promptButtons, setPromptButtons] = useState<string[]>([]);
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);

  // Check if API key is available
  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const response = await fetch('/api/check-ai-key');
        const data = await response.json();
        setApiKeyAvailable(data.available);
        
        if (!data.available) {
          setError('AI functionality is currently disabled. No API key is available.');
        }
      } catch (err) {
        console.error('Error checking API key:', err);
        setApiKeyAvailable(false);
        setError('Unable to verify AI functionality status.');
      }
    };
    
    checkApiKey();
  }, []);

  // Generate AI response when query changes and API key is available
  useEffect(() => {
    if (!query || !apiKeyAvailable) return;
    
    const generateResponse = async () => {
      // Reset states
      setAiResponse('');
      setAiSources([]);
      setAiStreamComplete(false);
      setError(null);
      setPromptButtons([]);
      setFeedbackGiven(null);
      
      // Start AI thinking state
      setIsAiThinking(true);
      
      try {
        // Call the AI API endpoint
        const response = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        // Switch to streaming mode
        setIsAiThinking(false);
        setIsAiStreaming(true);
        
        // Read the streaming response
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Response body is not readable');
        
        let decoder = new TextDecoder();
        let done = false;
        
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          
          if (value) {
            const chunk = decoder.decode(value, { stream: !done });
            setAiResponse(prev => prev + chunk);
          }
        }
        
        // Streaming complete
        setIsAiStreaming(false);
        setAiStreamComplete(true);
        
        // Generate follow-up prompt buttons
        generatePromptButtons(query);
        
        // Fetch sources
        const sourcesResponse = await fetch('/api/ai/sources', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query }),
        });
        
        if (sourcesResponse.ok) {
          const sourcesData = await sourcesResponse.json();
          setAiSources(sourcesData.sources);
        }
      } catch (err) {
        console.error('Error generating AI response:', err);
        setError('Failed to generate AI response. Please try again later.');
        setIsAiThinking(false);
        setIsAiStreaming(false);
      }
    };
    
    generateResponse();
  }, [query, apiKeyAvailable]);
  
  // Function to generate context-based prompt buttons
  const generatePromptButtons = async (query: string) => {
    if (!apiKeyAvailable) return;
    
    try {
      const response = await fetch('/api/ai/suggest-prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query,
          currentResponse: aiResponse 
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setPromptButtons(data.prompts || []);
      }
    } catch (err) {
      console.error('Error generating prompt buttons:', err);
    }
  };
  
  // Function to handle user feedback
  const handleFeedback = (type: 'up' | 'down') => {
    setFeedbackGiven(type);
    
    // Send feedback to backend
    fetch('/api/ai/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query,
        feedback: type,
        response: aiResponse
      }),
    }).catch(err => {
      console.error('Error sending feedback:', err);
    });
  };
  
  // Function to handle prompt button click
  const handlePromptClick = (promptText: string) => {
    // Treat the prompt as a user message
    window.dispatchEvent(new CustomEvent('ai-prompt-selected', { 
      detail: { prompt: promptText }
    }));
  };
  
  // Format the AI response with proper styling
  const formattedResponse = () => {
    if (!aiResponse) return null;
    
    // Split by paragraphs and format
    return aiResponse.split('\n\n').map((paragraph, index) => {
      // Check if paragraph is a heading
      if (paragraph.startsWith('# ')) {
        return <h2 key={index} className="text-xl font-bold mt-4 mb-2">{paragraph.substring(2)}</h2>;
      } else if (paragraph.startsWith('## ')) {
        return <h3 key={index} className="text-lg font-semibold mt-3 mb-2">{paragraph.substring(3)}</h3>;
      } else if (paragraph.startsWith('### ')) {
        return <h4 key={index} className="text-md font-semibold mt-2 mb-1">{paragraph.substring(4)}</h4>;
      }
      
      // Check if paragraph is a list
      if (paragraph.includes('\n- ')) {
        const listItems = paragraph.split('\n- ');
        const title = listItems.shift();
        return (
          <div key={index} className="my-2">
            {title && <p>{title}</p>}
            <ul className="list-disc pl-5 my-1">
              {listItems.map((item, i) => (
                <li key={i} className="my-1">{item}</li>
              ))}
            </ul>
          </div>
        );
      }
      
      // Regular paragraph
      return (
        <p key={index} className={`my-2 ${aiStreamComplete ? '' : 'border-r-2 border-primary animate-pulse'}`}>
          {paragraph}
        </p>
      );
    });
  };
  
  if (error) {
    return (
      <Card className="mb-6 overflow-hidden animate-in fade-in-0 slide-in-from-top-2 shadow-lg">
        <CardHeader className="bg-primary/5 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">AI-Enhanced Results</h3>
            <button 
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="text-red-500 p-4 rounded-md bg-red-50 dark:bg-red-900/20">
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="mb-6 overflow-hidden animate-in fade-in-0 slide-in-from-top-2 shadow-lg">
      <CardHeader className="bg-primary/5 border-b">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">AI-Enhanced Results</h3>
            {apiKeyAvailable && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Info className="h-3 w-3 mr-1" />
                      AI Enabled
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Using real AI data for this analysis</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          <button 
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        {isAiThinking ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '300ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '600ms' }}></div>
              </div>
              <p className="text-sm text-muted-foreground">Analyzing data for "{query}"...</p>
            </div>
          </div>
        ) : (
          <div className="prose dark:prose-invert max-w-none">
            {formattedResponse()}
            {!aiStreamComplete && isAiStreaming && (
              <span className="inline-block w-1 h-4 bg-primary animate-pulse"></span>
            )}
            
            {aiStreamComplete && (
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Was this analysis helpful?</span>
                <Button 
                  variant={feedbackGiven === 'up' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => handleFeedback('up')}
                  disabled={feedbackGiven !== null}
                  className="h-8 px-2"
                >
                  <ThumbsUp className="h-4 w-4" />
                </Button>
                <Button 
                  variant={feedbackGiven === 'down' ? 'default' : 'outline'} 
                  size="sm"
                  onClick={() => handleFeedback('down')}
                  disabled={feedbackGiven !== null}
                  className="h-8 px-2"
                >
                  <ThumbsDown className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
      
      {aiStreamComplete && (
        <>
          {/* Prompt buttons */}
          {promptButtons.length > 0 && (
            <div className="px-4 pb-2">
              <p className="text-sm font-medium mb-2">Related questions:</p>
              <div className="flex flex-wrap gap-2">
                {promptButtons.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePromptClick(prompt)}
                    className="text-xs"
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>
          )}
          
          {/* Sources */}
          {aiSources.length > 0 && (
            <CardFooter className="bg-muted/30 border-t p-4">
              <div className="w-full">
                <h4 className="text-sm font-medium mb-2">Sources:</h4>
                <div className="flex flex-wrap gap-2">
                  {aiSources.map((source, index) => (
                    <a 
                      key={index}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center text-xs px-2 py-1 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors duration-200"
                    >
                      {source.title}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  ))}
                </div>
              </div>
            </CardFooter>
          )}
        </>
      )}
    </Card>
  );
};

export default AIResponsePanel;
