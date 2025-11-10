'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GitBranch, TrendingUp, ArrowRight, Zap, DollarSign } from 'lucide-react';

interface Wallet {
  id: string;
  name: string;
  balance: number;
  tokens: Array<{ symbol: string; usdValue: number }>;
}

interface WalletFlowVisualizationProps {
  wallets: Wallet[];
}

export function WalletFlowVisualization({ wallets }: WalletFlowVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [hoveredWallet, setHoveredWallet] = useState<string | null>(null);
  
  // Calculate wallet positions in a circle
  const getWalletPositions = () => {
    const centerX = 300;
    const centerY = 250;
    const radius = 180;
    
    return wallets.map((wallet, index) => {
      const angle = (index / wallets.length) * 2 * Math.PI - Math.PI / 2;
      return {
        wallet,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.PI / 4 * Math.sin(angle),
        radius: 40 + (wallet.balance / 100) * 20, // Size based on balance
      };
    });
  };

  // Detect token overlaps (same token in multiple wallets)
  const getTokenFlows = () => {
    const flows: Array<{
      from: string;
      to: string;
      token: string;
      value: number;
    }> = [];
    
    const tokenMap = new Map<string, string[]>();
    
    wallets.forEach(wallet => {
      wallet.tokens.forEach(token => {
        if (!tokenMap.has(token.symbol)) {
          tokenMap.set(token.symbol, []);
        }
        tokenMap.get(token.symbol)!.push(wallet.id);
      });
    });
    
    // Create flows between wallets that share tokens
    tokenMap.forEach((walletIds, token) => {
      if (walletIds.length > 1) {
        for (let i = 0; i < walletIds.length - 1; i++) {
          const fromWallet = wallets.find(w => w.id === walletIds[i]);
          const toWallet = wallets.find(w => w.id === walletIds[i + 1]);
          
          if (fromWallet && toWallet) {
            const fromToken = fromWallet.tokens.find(t => t.symbol === token);
            const toToken = toWallet.tokens.find(t => t.symbol === token);
            
            if (fromToken && toToken) {
              flows.push({
                from: walletIds[i],
                to: walletIds[i + 1],
                token,
                value: Math.min(fromToken.usdValue, toToken.usdValue),
              });
            }
          }
        }
      }
    });
      
    return flows;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const positions = getWalletPositions();
    const flows = getTokenFlows();
    
    // Draw connections first (behind nodes)
    flows.forEach(flow => {
      const fromPos = positions.find(p => p.wallet.id === flow.from);
      const toPos = positions.find(p => p.wallet.id === flow.to);
      
      if (fromPos && toPos) {
        ctx.beginPath();
        ctx.strokeStyle = selectedWallet === flow.from || selectedWallet === flow.to
          ? 'rgba(99, 102, 241, 0.6)'
          : 'rgba(148, 163, 184, 0.3)';
        ctx.lineWidth = 2 + (flow.value / 100);
        ctx.setLineDash([5, 5]);
        ctx.moveTo(fromPos.x, fromPos.y);
        ctx.lineTo(toPos.x, toPos.y);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw arrow
        const angle = Math.atan2(toPos.y - fromPos.y, toPos.x - fromPos.x);
        const arrowX = toPos.x - toPos.radius * Math.cos(angle);
        const arrowY = toPos.y - toPos.radius * Math.sin(angle);
        
        ctx.beginPath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - 10 * Math.cos(angle - Math.PI / 6),
          arrowY - 10 * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          arrowX - 10 * Math.cos(angle + Math.PI / 6),
          arrowY - 10 * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }
    });
    
    // Draw wallet nodes
    positions.forEach(({ wallet, x, y, radius }) => {
      const isSelected = selectedWallet === wallet.id;
      const isHovered = hoveredWallet === wallet.id;
      
      // Outer glow for selected
      if (isSelected || isHovered) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 8, 0, 2 * Math.PI);
        const gradient = ctx.createRadialGradient(x, y, radius, x, y, radius + 8);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();
      }
      
      // Main circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      const gradient = ctx.createRadialGradient(x - radius/3, y - radius/3, 0, x, y, radius);
      gradient.addColorStop(0, '#818cf8');
      gradient.addColorStop(1, '#4f46e5');
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Border
      ctx.strokeStyle = isSelected || isHovered ? '#fff' : 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = isSelected || isHovered ? 3 : 2;
      ctx.stroke();
      
      // Wallet initial
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(wallet.name[0], x, y);
      
      // Value label
      ctx.font = '10px sans-serif';
      const value = wallet.balance + wallet.tokens.reduce((s, t) => s + t.usdValue, 0);
      ctx.fillText(`$${value.toFixed(0)}`, x, y + radius + 15);
    });
    
  }, [wallets, selectedWallet, hoveredWallet]);
  
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const positions = getWalletPositions();
    const clicked = positions.find(({ x: wx, y: wy, radius }) => {
      const distance = Math.sqrt((x - wx) ** 2 + (y - wy) ** 2);
      return distance <= radius;
    });
    
    setSelectedWallet(clicked ? clicked.wallet.id : null);
  };
  
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const positions = getWalletPositions();
    const hovered = positions.find(({ x: wx, y: wy, radius }) => {
      const distance = Math.sqrt((x - wx) ** 2 + (y - wy) ** 2);
      return distance <= radius;
    });
    
    setHoveredWallet(hovered ? hovered.wallet.id : null);
    canvas.style.cursor = hovered ? 'pointer' : 'default';
  };
  
  const flows = getTokenFlows();
  const selectedWalletData = wallets.find(w => w.id === selectedWallet);
  
  return (
    <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/5 border-indigo-500/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Wallet Flow Network
            </CardTitle>
            <CardDescription>
              Visual representation of asset distribution and wallet relationships
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            <Zap className="h-3 w-3" />
            {flows.length} Connections
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Canvas Visualization */}
          <div className="lg:col-span-2">
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={600}
                height={500}
                className="w-full h-auto rounded-lg bg-gradient-to-br from-slate-900/50 to-slate-800/50 border border-slate-700"
                onClick={handleCanvasClick}
                onMouseMove={handleCanvasMouseMove}
              />
              <div className="absolute top-4 left-4 text-xs text-slate-400 bg-slate-900/80 px-3 py-2 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600" />
                  <span>Wallet Size = Total Value</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3 text-indigo-400" />
                  <span>Lines = Shared Tokens</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Details Panel */}
          <div className="space-y-4">
            {selectedWalletData ? (
              <>
                <div className="p-4 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/10 border border-indigo-500/30">
                  <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                      {selectedWalletData.name[0]}
                    </div>
                    {selectedWalletData.name}
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">SOL Balance</span>
                      <span className="font-mono font-semibold">
                        {selectedWalletData.balance.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Token Types</span>
                      <Badge variant="secondary">{selectedWalletData.tokens.length}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Total Value</span>
                      <span className="font-semibold flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {(selectedWalletData.balance + selectedWalletData.tokens.reduce((s, t) => s + t.usdValue, 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-700">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Token Holdings
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedWalletData.tokens.map((token, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="font-medium">{token.symbol}</span>
                        <span className="text-muted-foreground">${token.usdValue.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 rounded-lg bg-slate-900/30 border border-dashed border-slate-700 text-center">
                <GitBranch className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Click on a wallet node to view details and connections
                </p>
              </div>
            )}
            
            {flows.length > 0 && (
              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <h4 className="font-semibold text-sm mb-2 text-amber-600 dark:text-amber-400">
                  Optimization Opportunity
                </h4>
                <p className="text-xs text-muted-foreground">
                  {flows.length} token{flows.length !== 1 ? 's are' : ' is'} duplicated across wallets. 
                  Consider consolidating for lower gas fees.
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
