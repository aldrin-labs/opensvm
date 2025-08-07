'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useElementAnnouncements } from '@/components/layout/AccessibleLayout';
import { VoiceControl } from './VoiceControl';
import { Mic, Volume2, Keyboard, Eye } from 'lucide-react';

/**
 * Example component demonstrating voice navigation integration
 * This shows how to use voice features throughout the application
 */
export function VoiceIntegrationExample() {
  const {
    announceButtonClick,
    announceSuccess,
    announceTabChange,
    announceModalOpen
  } = useElementAnnouncements();

  const handleButtonClick = (action: string) => {
    announceButtonClick(action);
    announceSuccess(`${action} completed successfully`);
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mic className="h-5 w-5" />
            <span>Voice Navigation Integration Example</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Voice Features Overview */}
            <Card className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Volume2 className="h-4 w-4 text-green-500" />
                <span className="font-medium text-sm">Audio Feedback</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Spoken confirmations for all user actions and navigation changes
              </p>
              <Badge variant="outline" className="mt-2 text-xs">
                WCAG 2.1 AA
              </Badge>
            </Card>

            <Card className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Mic className="h-4 w-4 text-blue-500" />
                <span className="font-medium text-sm">Voice Commands</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Natural language commands for navigation and control
              </p>
              <Badge variant="outline" className="mt-2 text-xs">
                50+ Commands
              </Badge>
            </Card>

            <Card className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Keyboard className="h-4 w-4 text-purple-500" />
                <span className="font-medium text-sm">Keyboard Shortcuts</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Alt+M (main), Alt+N (nav), Alt+V (voice), Alt+S (search)
              </p>
              <Badge variant="outline" className="mt-2 text-xs">
                Enhanced Navigation
              </Badge>
            </Card>

            <Card className="p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Eye className="h-4 w-4 text-orange-500" />
                <span className="font-medium text-sm">Screen Reader</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Full compatibility with assistive technologies
              </p>
              <Badge variant="outline" className="mt-2 text-xs">
                ARIA Compliant
              </Badge>
            </Card>
          </div>

          {/* Voice Control Demo */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Voice Control Interface</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Inline Control</h4>
                <VoiceControl variant="inline" showStatus showSettings />
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Compact Control</h4>
                <VoiceControl variant="compact" />
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Interactive Demo</h4>
                <div className="space-y-2">
                  <Button 
                    onClick={() => handleButtonClick('Analytics Dashboard')}
                    className="w-full"
                  >
                    Open Dashboard
                  </Button>
                  <Button 
                    onClick={() => {
                      announceTabChange('Settings');
                      announceModalOpen('Settings Dialog');
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Open Settings
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Example Voice Commands */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Try These Voice Commands</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <h4 className="font-medium mb-2">Navigation</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• "OpenSVM go home"</li>
                  <li>• "OpenSVM open dashboard"</li>
                  <li>• "OpenSVM show settings"</li>
                  <li>• "OpenSVM go back"</li>
                </ul>
              </Card>

              <Card className="p-4">
                <h4 className="font-medium mb-2">Theme Control</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• "OpenSVM switch to dark mode"</li>
                  <li>• "OpenSVM enable light theme"</li>
                  <li>• "OpenSVM toggle theme"</li>
                </ul>
              </Card>

              <Card className="p-4">
                <h4 className="font-medium mb-2">Focus Management</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• "OpenSVM focus main content"</li>
                  <li>• "OpenSVM go to navigation"</li>
                  <li>• "OpenSVM focus search"</li>
                  <li>• "OpenSVM skip to content"</li>
                </ul>
              </Card>

              <Card className="p-4">
                <h4 className="font-medium mb-2">Information</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• "OpenSVM help"</li>
                  <li>• "OpenSVM where am I"</li>
                  <li>• "OpenSVM read page"</li>
                  <li>• "OpenSVM what time is it"</li>
                </ul>
              </Card>
            </div>
          </div>

          {/* Accessibility Features */}
          <div className="bg-accent/50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-2">Accessibility Features</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">Voice Navigation</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>✓ Speech recognition with keyword activation</li>
                  <li>✓ Customizable voice settings and speeds</li>
                  <li>✓ Multi-language support</li>
                  <li>✓ Continuous or push-to-talk modes</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Audio Feedback</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>✓ Action confirmations and results</li>
                  <li>✓ Page navigation announcements</li>
                  <li>✓ Error and success notifications</li>
                  <li>✓ Element focus descriptions</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Keyboard Navigation</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>✓ Skip links for main content</li>
                  <li>✓ Landmark navigation shortcuts</li>
                  <li>✓ Focus management and indicators</li>
                  <li>✓ Keyboard-only operation support</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Screen Reader Support</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>✓ ARIA labels and descriptions</li>
                  <li>✓ Live region announcements</li>
                  <li>✓ Semantic HTML structure</li>
                  <li>✓ High contrast mode compatibility</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default VoiceIntegrationExample;