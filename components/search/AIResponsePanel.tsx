// AI-enhanced search response component
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import openrouter from '@/lib/openrouter-api';
import moralis from '@/lib/moralis-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { Copy, Info, ExternalLink, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react';

interface AIResponsePanelProps {
  query: string;
  onClose: () => void;
}

interface Source {
  title: string;
  url: string;
}

// Data type for blockchain information
type BlockchainDataType = 'token' | 'nft' | 'account' | 'transaction' | 'unknown' | 'error';

const AIResponsePanel: React.FC<AIResponsePanelProps> = ({ query, onClose }) => {
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [isAiStreaming, setIsAiStreaming] = useState<boolean>(false);
  const [aiStreamComplete, setAiStreamComplete] = useState<boolean>(false);
  const [aiSources, setAiSources] = useState<Source[]>([]);
  const [blockchainData, setBlockchainData] = useState<any>(null);
  const [blockchainDataType, setBlockchainDataType] = useState<BlockchainDataType>('unknown');
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [_activeTab, _setActiveTab] = useState<string>('ai');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null);

  // Function to copy AI response to clipboard
  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(aiResponse);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }, [aiResponse]);

  // Function to handle user feedback
  const handleFeedback = useCallback((type: 'up' | 'down') => {
    setFeedbackGiven(type);
    // Here you could also send the feedback to a backend API
    console.log(`User gave ${type === 'up' ? 'positive' : 'negative'} feedback for query: ${query}`);
  }, [query]);

  // Main function to generate AI response
  const generateAIResponse = useCallback(async (searchQuery: string) => {
    if (!searchQuery) return;
    
    // Reset AI states
    setAiResponse('');
    setAiSources([]);
    setAiStreamComplete(false);
    setBlockchainData(null);
    setBlockchainDataType('unknown');
    setError(null);
    setFeedbackGiven(null);
    
    // Start AI thinking state
    setIsAiThinking(true);
    
    try {
      // Fetch blockchain data using enhanced Moralis API
      const data = await moralis.getComprehensiveBlockchainData(searchQuery);
      setBlockchainData(data);
      
      if (data) {
        setBlockchainDataType(data.type as BlockchainDataType);
      }
      
      // Select the best model based on the data
      const modelToUse = openrouter.selectBestModelForData(data);
      setSelectedModel(modelToUse);
      
      // Create prompt with blockchain data
      const prompt = openrouter.createBlockchainSearchPrompt(searchQuery, data);
      
      // Switch to streaming mode
      setIsAiThinking(false);
      setIsAiStreaming(true);
      
      // Use streaming response
      await openrouter.generateStreamingAIResponse(
        prompt,
        (chunk: string) => {
          setAiResponse(prev => prev + chunk);
        },
        () => {
          setIsAiStreaming(false);
          setAiStreamComplete(true);
          setIsRefreshing(false);
          
          // Extract sources from blockchain data
          const sources = openrouter.extractSourcesFromBlockchainData(data);
          setAiSources(sources);
        },
        {
          model: modelToUse,
          temperature: 0.7,
          max_tokens: 1500
        }
      );
    } catch (err) {
      console.error('Error generating AI response:', err);
      setError('Failed to generate AI response. Please try again later.');
      setIsAiThinking(false);
      setIsAiStreaming(false);
      setIsRefreshing(false);
    }
  }, []);

  // Function to refresh the AI response
  const refreshResponse = useCallback(() => {
    setIsRefreshing(true);
    generateAIResponse(query);
  }, [query, generateAIResponse]);
  
  // Initialize AI response when query changes
  useEffect(() => {
    if (!query) return;
    generateAIResponse(query);
  }, [query, generateAIResponse]);
  
  // Format the AI response with proper styling
  const formattedResponse = useCallback(() => {
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
  }, [aiResponse, aiStreamComplete]);
  
  // Get a badge color based on blockchain data type
  const getDataTypeBadge = useCallback(() => {
    switch (blockchainDataType) {
      case 'token':
        return <Badge className="bg-green-500">Token</Badge>;
      case 'nft':
        return <Badge className="bg-purple-500">NFT</Badge>;
      case 'account':
        return <Badge className="bg-blue-500">Account</Badge>;
      case 'transaction':
        return <Badge className="bg-orange-500">Transaction</Badge>;
      case 'error':
        return <Badge className="bg-red-500">Error</Badge>;
      default:
        return <Badge className="bg-gray-500">Unknown</Badge>;
    }
  }, [blockchainDataType]);
  
  // Get model information
  const getModelInfo = useCallback(() => {
    const modelName = selectedModel.split('/').pop() || 'AI Model';
    return modelName.replace(/-/g, ' ').replace(/:beta/g, '');
  }, [selectedModel]);
  
  return (
    <Card className="mb-6 overflow-hidden animate-in fade-in-0 slide-in-from-top-2 shadow-lg">
      <CardHeader className="bg-primary/5 border-b">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">AI-Enhanced Results</h3>
            {blockchainDataType !== 'unknown' && getDataTypeBadge()}
            {selectedModel && (
              <Tooltip content={`Using ${getModelInfo()} for this analysis`}>
                <div className="flex items-center text-xs text-muted-foreground">
                  <Info className="h-3 w-3 mr-1" />
                  {getModelInfo()}
                </div>
              </Tooltip>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {aiStreamComplete && (
              <>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={copyToClipboard}
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  {copySuccess ? 'Copied!' : 'Copy'}
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={refreshResponse}
                  disabled={isRefreshing}
                  className="h-8 px-2 text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </>
            )}
            
            <button 
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </CardHeader>
      
      <Tabs defaultValue="ai" className="w-full">
        <TabsList className="grid grid-cols-2 mx-4 mt-2">
          <TabsTrigger value="ai">AI Analysis</TabsTrigger>
          <TabsTrigger value="data">Blockchain Data</TabsTrigger>
        </TabsList>
        
        <TabsContent value="ai" className="p-0">
          <CardContent className="p-4">
            {error ? (
              <div className="text-red-500 p-4 rounded-md bg-red-50 dark:bg-red-900/20">
                <p>{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={refreshResponse}
                  className="mt-2"
                >
                  Try Again
                </Button>
              </div>
            ) : isAiThinking ? (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '300ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '600ms' }}></div>
                  </div>
                  <p className="text-sm text-muted-foreground">Analyzing blockchain data for "{query}"...</p>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[90%]" />
                <Skeleton className="h-4 w-[80%]" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-[85%]" />
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
          
          {aiStreamComplete && aiSources.length > 0 && (
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
        </TabsContent>
        
        <TabsContent value="data" className="p-0">
          <CardContent className="p-4">
            {!blockchainData ? (
              <div className="text-center p-4">
                <p className="text-muted-foreground">No blockchain data available for this query.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Raw Blockchain Data</h3>
                  <Badge variant="outline">{blockchainDataType}</Badge>
                </div>
                
                {/* Data visualization based on type */}
                {blockchainDataType === 'token' && blockchainData.data.metadata && (
                  <div className="bg-muted/30 p-3 rounded-md">
                    <h4 className="font-medium mb-2">Token Information</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Name:</p>
                        <p className="font-medium">{blockchainData.data.metadata.name || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Symbol:</p>
                        <p className="font-medium">{blockchainData.data.metadata.symbol || 'Unknown'}</p>
                      </div>
                      {blockchainData.data.price && (
                        <>
                          <div>
                            <p className="text-muted-foreground">Price:</p>
                            <p className="font-medium">${blockchainData.data.price.usdPrice?.toFixed(6) || 'Unknown'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">24h Change:</p>
                            <p className={`font-medium ${(blockchainData.data.price["24hrChange"] || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {blockchainData.data.price["24hrChange"]?.toFixed(2) || 0}%
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
                
                {blockchainDataType === 'nft' && blockchainData.data.metadata && (
                  <div className="bg-muted/30 p-3 rounded-md">
                    <h4 className="font-medium mb-2">NFT Information</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Name:</p>
                        <p className="font-medium">{blockchainData.data.metadata.name || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Collection:</p>
                        <p className="font-medium">{blockchainData.data.metadata.collection || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Mint Address:</p>
                        <p className="font-medium truncate">{blockchainData.data.mintAddress || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Owner:</p>
                        <p className="font-medium truncate">{blockchainData.data.owner || 'Unknown'}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {blockchainDataType === 'account' && blockchainData.data && (
                  <div className="bg-muted/30 p-3 rounded-md">
                    <h4 className="font-medium mb-2">Account Information</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Address:</p>
                        <p className="font-medium truncate">{blockchainData.data.address || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">SOL Balance:</p>
                        <p className="font-medium">{blockchainData.data.solBalance?.toFixed(6) || '0'} SOL</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Token Count:</p>
                        <p className="font-medium">{blockchainData.data.tokens?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">NFT Count:</p>
                        <p className="font-medium">{blockchainData.data.nfts?.length || 0}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {blockchainDataType === 'transaction' && blockchainData.data && (
                  <div className="bg-muted/30 p-3 rounded-md">
                    <h4 className="font-medium mb-2">Transaction Information</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Signature:</p>
                        <p className="font-medium truncate">{blockchainData.data.signature || 'Unknown'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Status:</p>
                        <p className={`font-medium ${blockchainData.data.status === 'confirmed' ? 'text-green-500' : 'text-red-500'}`}>
                          {blockchainData.data.status || 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Block Time:</p>
                        <p className="font-medium">
                          {blockchainData.data.blockTime ? new Date(blockchainData.data.blockTime * 1000).toLocaleString() : 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Fee:</p>
                        <p className="font-medium">{blockchainData.data.fee ? (blockchainData.data.fee / 1000000000).toFixed(6) : '0'} SOL</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Raw data display */}
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Raw Data</h4>
                  <pre className="bg-muted p-3 rounded-md text-xs overflow-auto max-h-60">
                    {JSON.stringify(blockchainData, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </CardContent>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default AIResponsePanel;
