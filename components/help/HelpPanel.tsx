'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  XIcon,
  SearchIcon,
  BookOpenIcon,
  PlayIcon,
  InfoIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ZapIcon,
  ExternalLinkIcon,
  SettingsIcon,
  HelpCircleIcon,
  ChevronRightIcon,
  ChevronDownIcon
} from 'lucide-react';
import { useHelp } from './HelpProvider';
import { useAccessibility, useKeyboardNavigation } from '@/lib/accessibility-utils';
import { useMobileDetection } from '@/lib/mobile-utils';
import { HelpContent } from './ContextualHelp';
import { TourConfig } from './GuidedTour';

interface HelpPanelProps {
  className?: string;
}

const HelpPanel: React.FC<HelpPanelProps> = ({ className = '' }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['tours', 'content']));
  const [selectedContent, setSelectedContent] = useState<HelpContent | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    searchHelpContent,
    availableTours,
    startTour,
    isHelpPanelOpen,
    closeHelpPanel,
    showHelpHints,
    setShowHelpHints,
    autoStartTours,
    setAutoStartTours,
    trackHelpInteraction
  } = useHelp();

  const { announceToScreenReader, isTouchDevice } = useAccessibility();

  // Use announceToScreenReader and isTouchDevice for accessibility enhancements
  React.useEffect(() => {
    if (isHelpPanelOpen) {
      announceToScreenReader('Help panel opened');
      console.log(`Help panel accessibility: touch device: ${isTouchDevice}`);
    }
  }, [isHelpPanelOpen, announceToScreenReader, isTouchDevice]);
  const { isMobile } = useMobileDetection();

  // Keyboard navigation
  useKeyboardNavigation(panelRef, {
    onEscape: closeHelpPanel,
    trapFocus: isHelpPanelOpen
  });

  // Search and filter help content
  const filteredContent = useMemo(() => {
    let content = searchQuery ? searchHelpContent(searchQuery) : [];

    if (selectedCategory !== 'all') {
      content = content.filter(item => item.type === selectedCategory);
    }

    return content;
  }, [searchQuery, selectedCategory, searchHelpContent]);

  const categories = [
    { id: 'all', label: 'All Topics', icon: BookOpenIcon },
    { id: 'concept', label: 'Concepts', icon: InfoIcon },
    { id: 'warning', label: 'Warnings', icon: AlertTriangleIcon },
    { id: 'tip', label: 'Tips', icon: CheckCircleIcon },
    { id: 'technical', label: 'Technical', icon: ZapIcon }
  ];

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const handleTourStart = (tour: TourConfig) => {
    startTour(tour.id);
    closeHelpPanel();
    trackHelpInteraction('tour_started_from_panel', tour.id);
  };

  const handleContentSelect = (content: HelpContent) => {
    setSelectedContent(content);
    trackHelpInteraction('help_content_viewed', content.id);
  };

  const getTypeIcon = (type: HelpContent['type']) => {
    switch (type) {
      case 'concept':
        return <InfoIcon className="w-4 h-4 text-blue-500" />;
      case 'warning':
        return <AlertTriangleIcon className="w-4 h-4 text-yellow-500" />;
      case 'tip':
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
      default:
        return <BookOpenIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  if (!isHelpPanelOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div
        ref={panelRef}
        className={`fixed right-0 top-0 h-full bg-background border-l border-border shadow-xl ${isMobile ? 'w-full' : 'w-96'
          } ${className}`}
        role="dialog"
        aria-labelledby="help-panel-title"
        aria-modal="true"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center space-x-2">
              <HelpCircleIcon className="w-5 h-5 text-primary" />
              <h2 id="help-panel-title" className="font-semibold text-foreground">
                Help & Documentation
              </h2>
            </div>
            <button
              onClick={closeHelpPanel}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="Close help panel"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {selectedContent ? (
              /* Detailed Content View */
              <div className="p-4">
                <button
                  onClick={() => setSelectedContent(null)}
                  className="flex items-center space-x-2 text-primary hover:text-primary/80 transition-colors mb-4"
                >
                  <ChevronRightIcon className="w-4 h-4 rotate-180" />
                  <span>Back to help topics</span>
                </button>

                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    {getTypeIcon(selectedContent.type)}
                    <div>
                      <h3 className="font-semibold text-foreground">{selectedContent.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{selectedContent.description}</p>
                    </div>
                  </div>

                  <div className="text-sm text-foreground">
                    {selectedContent.content}
                  </div>

                  {selectedContent.relatedTopics && selectedContent.relatedTopics.length > 0 && (
                    <div>
                      <h4 className="font-medium text-foreground mb-2">Related Topics</h4>
                      <div className="space-y-1">
                        {selectedContent.relatedTopics.map((topic, index) => (
                          <div key={index} className="text-sm text-muted-foreground">
                            • {topic}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedContent.externalLinks && selectedContent.externalLinks.length > 0 && (
                    <div>
                      <h4 className="font-medium text-foreground mb-2">Learn More</h4>
                      <div className="space-y-2">
                        {selectedContent.externalLinks.map((link, index) => (
                          <a
                            key={index}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center space-x-2 text-primary hover:text-primary/80 transition-colors text-sm"
                          >
                            <ExternalLinkIcon className="w-3 h-3" />
                            <span>{link.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Main Help View */
              <div className="p-4 space-y-6">
                {/* Search */}
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search help topics..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-border rounded-md text-sm bg-background"
                  />
                </div>

                {/* Category Filter */}
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => {
                    const Icon = category.icon;
                    return (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm transition-colors ${selectedCategory === category.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{category.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Tours Section */}
                <div>
                  <button
                    onClick={() => toggleSection('tours')}
                    className="flex items-center space-x-2 w-full text-left py-2 hover:bg-muted/50 rounded-md transition-colors"
                  >
                    {expandedSections.has('tours') ? (
                      <ChevronDownIcon className="w-4 h-4" />
                    ) : (
                      <ChevronRightIcon className="w-4 h-4" />
                    )}
                    <PlayIcon className="w-4 h-4 text-green-500" />
                    <span className="font-medium text-foreground">Interactive Tours</span>
                  </button>

                  {expandedSections.has('tours') && (
                    <div className="ml-6 mt-2 space-y-2">
                      {availableTours.map((tour) => (
                        <div key={tour.id} className="border border-border rounded-md p-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-foreground">{tour.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{tour.description}</p>
                              <div className="text-xs text-muted-foreground mt-2">
                                {tour.steps.length} steps • ~{Math.ceil(tour.steps.length * 0.5)} min
                              </div>
                            </div>
                            <button
                              onClick={() => handleTourStart(tour)}
                              className="ml-3 px-3 py-1 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 transition-colors"
                            >
                              Start
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Help Content Section */}
                <div>
                  <button
                    onClick={() => toggleSection('content')}
                    className="flex items-center space-x-2 w-full text-left py-2 hover:bg-muted/50 rounded-md transition-colors"
                  >
                    {expandedSections.has('content') ? (
                      <ChevronDownIcon className="w-4 h-4" />
                    ) : (
                      <ChevronRightIcon className="w-4 h-4" />
                    )}
                    <BookOpenIcon className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-foreground">Help Topics</span>
                  </button>

                  {expandedSections.has('content') && (
                    <div className="ml-6 mt-2 space-y-2">
                      {searchQuery && filteredContent.length === 0 && (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          No help topics found for "{searchQuery}"
                        </div>
                      )}

                      {filteredContent.map((content) => (
                        <button
                          key={content.id}
                          onClick={() => handleContentSelect(content)}
                          className="w-full text-left p-3 border border-border rounded-md hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start space-x-3">
                            {getTypeIcon(content.type)}
                            <div className="flex-1">
                              <h4 className="font-medium text-foreground">{content.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{content.description}</p>
                            </div>
                            <ChevronRightIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </button>
                      ))}

                      {!searchQuery && (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          Search for specific topics or browse by category above
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Settings Section */}
                <div>
                  <button
                    onClick={() => toggleSection('settings')}
                    className="flex items-center space-x-2 w-full text-left py-2 hover:bg-muted/50 rounded-md transition-colors"
                  >
                    {expandedSections.has('settings') ? (
                      <ChevronDownIcon className="w-4 h-4" />
                    ) : (
                      <ChevronRightIcon className="w-4 h-4" />
                    )}
                    <SettingsIcon className="w-4 h-4 text-gray-500" />
                    <span className="font-medium text-foreground">Help Settings</span>
                  </button>

                  {expandedSections.has('settings') && (
                    <div className="ml-6 mt-2 space-y-3">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showHelpHints}
                          onChange={(e) => setShowHelpHints(e.target.checked)}
                          className="rounded border-border"
                        />
                        <div>
                          <span className="text-sm font-medium text-foreground">Show Help Hints</span>
                          <p className="text-xs text-muted-foreground">Display contextual help icons throughout the interface</p>
                        </div>
                      </label>

                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoStartTours}
                          onChange={(e) => setAutoStartTours(e.target.checked)}
                          className="rounded border-border"
                        />
                        <div>
                          <span className="text-sm font-medium text-foreground">Auto-start Tours</span>
                          <p className="text-xs text-muted-foreground">Automatically start tours for new features</p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPanel;