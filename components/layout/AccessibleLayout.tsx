'use client';

import React, { useEffect, useRef } from 'react';
import { useVoice } from '@/lib/voice';
import { useVoiceCommands } from '@/lib/voice/commands';
import { VoiceToggleButton, VoiceStatusIndicator } from '@/components/voice/VoiceControl';
import { useAccessibility } from '@/lib/accessibility';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

interface AccessibleLayoutProps {
  children: React.ReactNode;
  showVoiceControls?: boolean;
  announcePageChanges?: boolean;
  className?: string;
}

export function AccessibleLayout({ 
  children, 
  showVoiceControls = true,
  announcePageChanges = true,
  className = '' 
}: AccessibleLayoutProps) {
  const { announceNavigation, announceElement } = useVoice();
  const { preferences } = useAccessibility();
  const mainRef = useRef<HTMLElement>(null);
  const skipLinkRef = useRef<HTMLAnchorElement>(null);
  
  // Initialize voice commands
  useVoiceCommands();

  // Announce page changes
  useEffect(() => {
    if (announcePageChanges) {
      const title = document.title;
      if (title) {
        announceNavigation(title);
      }
    }
  }, [announceNavigation, announcePageChanges]);

  // Focus management for skip links
  const handleSkipToMain = (e: React.MouseEvent) => {
    e.preventDefault();
    if (mainRef.current) {
      mainRef.current.focus();
      announceElement('Main content');
    }
  };

  // Enhanced keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + M for main content
      if (e.altKey && e.key === 'm') {
        e.preventDefault();
        if (mainRef.current) {
          mainRef.current.focus();
          announceElement('Main content focused');
        }
      }
      
      // Alt + N for navigation
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        const nav = document.querySelector('nav') || document.querySelector('[role="navigation"]');
        if (nav && nav instanceof HTMLElement) {
          nav.focus();
          announceElement('Navigation focused');
        }
      }
      
      // Alt + S for search
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        const search = document.querySelector('input[type="search"]') || 
                      document.querySelector('[role="searchbox"]');
        if (search && search instanceof HTMLElement) {
          search.focus();
          announceElement('Search focused');
        }
      }

      // Alt + V for voice controls
      if (e.altKey && e.key === 'v') {
        e.preventDefault();
        const voiceButton = document.querySelector('[data-voice-toggle]');
        if (voiceButton && voiceButton instanceof HTMLElement) {
          voiceButton.click();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [announceElement]);

  // Landmark navigation with arrow keys
  useEffect(() => {
    if (!preferences.keyboardNavigation) return;

    const handleLandmarkNavigation = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey) {
        const landmarks = document.querySelectorAll(
          '[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], [role="form"], [role="search"], main, nav, header, footer, aside'
        );
        
        if (landmarks.length === 0) return;

        const activeElement = document.activeElement;
        let currentIndex = -1;
        
        // Find current landmark
        for (let i = 0; i < landmarks.length; i++) {
          if (landmarks[i] === activeElement || landmarks[i].contains(activeElement)) {
            currentIndex = i;
            break;
          }
        }

        let nextIndex = -1;
        
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          nextIndex = currentIndex < landmarks.length - 1 ? currentIndex + 1 : 0;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          nextIndex = currentIndex > 0 ? currentIndex - 1 : landmarks.length - 1;
        }

        if (nextIndex >= 0) {
          const nextLandmark = landmarks[nextIndex] as HTMLElement;
          if (nextLandmark) {
            nextLandmark.focus();
            announceElement(nextLandmark);
          }
        }
      }
    };

    document.addEventListener('keydown', handleLandmarkNavigation);
    return () => document.removeEventListener('keydown', handleLandmarkNavigation);
  }, [preferences.keyboardNavigation, announceElement]);

  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      {/* Skip Links */}
      <div className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 z-50">
        <a
          ref={skipLinkRef}
          href="#main-content"
          onClick={handleSkipToMain}
          className="skip-link bg-primary text-primary-foreground px-4 py-2 rounded-br focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>
        <a
          href="#navigation"
          className="skip-link bg-primary text-primary-foreground px-4 py-2 ml-2 rounded-br focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to navigation
        </a>
      </div>

      {/* Voice Controls Header */}
      {showVoiceControls && (
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <VoiceStatusIndicator />
                <span className="text-sm text-muted-foreground">
                  Voice navigation available
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <VoiceToggleButton data-voice-toggle />
                <div className="text-xs text-muted-foreground">
                  Alt + V
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      <nav 
        aria-label="Breadcrumb" 
        className="container mx-auto px-4 py-2 border-b"
        role="navigation"
      >
        <ol className="flex items-center space-x-2 text-sm">
          <li>
            <Button variant="link" className="p-0 h-auto text-muted-foreground hover:text-foreground">
              Home
            </Button>
          </li>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <li aria-current="page" className="text-foreground">
            Current Page
          </li>
        </ol>
      </nav>

      {/* Main Content */}
      <main
        ref={mainRef}
        id="main-content"
        role="main"
        tabIndex={-1}
        className="flex-1 outline-none focus:outline-2 focus:outline-primary focus:outline-offset-2"
        aria-label="Main content"
      >
        {children}
      </main>

      {/* Keyboard Shortcuts Help */}
      <div className="sr-only" aria-live="polite" id="keyboard-shortcuts">
        Available keyboard shortcuts: Alt + M for main content, Alt + N for navigation, 
        Alt + S for search, Alt + V for voice controls. 
        Use Ctrl + Shift + Arrow keys to navigate between landmarks.
      </div>

      {/* Screen Reader Announcements */}
      <div 
        aria-live="assertive" 
        aria-atomic="true" 
        className="sr-only" 
        id="sr-announcements"
      />
      
      <div 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only" 
        id="sr-status"
      />
    </div>
  );
}

// Higher-order component for adding voice announcements to page transitions
export function withVoiceAnnouncements<T extends {}>(
  Component: React.ComponentType<T>
) {
  return function VoiceAnnouncedComponent(props: T) {
    const { announceNavigation } = useVoice();
    
    useEffect(() => {
      const title = document.title || 'Page loaded';
      announceNavigation(title);
    }, [announceNavigation]);

    return <Component {...props} />;
  };
}

// Hook for announcing element interactions
export function useElementAnnouncements() {
  const { announceElement, announceAction } = useVoice();

  const announceButtonClick = (label: string) => {
    announceAction(`${label} button activated`);
  };

  const announceLinkFollow = (label: string) => {
    announceAction(`Following link to ${label}`);
  };

  const announceFormSubmit = (formName?: string) => {
    announceAction(`${formName || 'Form'} submitted`);
  };

  const announceTabChange = (tabName: string) => {
    announceAction(`Switched to ${tabName} tab`);
  };

  const announceModalOpen = (modalName?: string) => {
    announceAction(`${modalName || 'Dialog'} opened`);
  };

  const announceModalClose = (modalName?: string) => {
    announceAction(`${modalName || 'Dialog'} closed`);
  };

  const announceMenuOpen = (menuName?: string) => {
    announceAction(`${menuName || 'Menu'} opened`);
  };

  const announceError = (error: string) => {
    announceAction(`Error: ${error}`);
  };

  const announceSuccess = (message: string) => {
    announceAction(`Success: ${message}`);
  };

  return {
    announceElement,
    announceButtonClick,
    announceLinkFollow,
    announceFormSubmit,
    announceTabChange,
    announceModalOpen,
    announceModalClose,
    announceMenuOpen,
    announceError,
    announceSuccess,
  };
}

export default AccessibleLayout;