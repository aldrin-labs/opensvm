'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useVoice } from './index';
import { useTheme } from 'next-themes';

// Navigation commands hook
export function useVoiceNavigation() {
  const { registerCommand, unregisterCommand, announceNavigation } = useVoice();
  const router = useRouter();

  useEffect(() => {
    // Navigation commands
    const navigationCommands = {
      'nav-home': {
        patterns: [
          'go home',
          'navigate home',
          'home page',
          'take me home'
        ],
        description: 'Navigate to home page',
        category: 'Navigation',
        action: () => {
          router.push('/');
          announceNavigation('Home page');
        }
      },
      'nav-dashboard': {
        patterns: [
          'go to dashboard',
          'open dashboard',
          'show dashboard',
          'dashboard page'
        ],
        description: 'Navigate to dashboard',
        category: 'Navigation',
        action: () => {
          router.push('/dashboard');
          announceNavigation('Dashboard');
        }
      },
      'nav-analytics': {
        patterns: [
          'go to analytics',
          'open analytics',
          'show analytics',
          'analytics page'
        ],
        description: 'Navigate to analytics',
        category: 'Navigation',
        action: () => {
          router.push('/analytics');
          announceNavigation('Analytics page');
        }
      },
      'nav-settings': {
        patterns: [
          'go to settings',
          'open settings',
          'show settings',
          'settings page'
        ],
        description: 'Navigate to settings',
        category: 'Navigation',
        action: () => {
          router.push('/settings');
          announceNavigation('Settings page');
        }
      },
      'nav-help': {
        patterns: [
          'go to help',
          'open help',
          'show help',
          'help page',
          'need help'
        ],
        description: 'Navigate to help page',
        category: 'Navigation',
        action: () => {
          router.push('/help');
          announceNavigation('Help page');
        }
      },
      'nav-back': {
        patterns: [
          'go back',
          'back page',
          'previous page',
          'navigate back'
        ],
        description: 'Go back to previous page',
        category: 'Navigation',
        action: () => {
          router.back();
          announceNavigation('Previous page');
        }
      },
      'nav-forward': {
        patterns: [
          'go forward',
          'next page',
          'forward page',
          'navigate forward'
        ],
        description: 'Go forward to next page',
        category: 'Navigation',
        action: () => {
          router.forward();
          announceNavigation('Next page');
        }
      }
    };

    // Register all commands
    Object.entries(navigationCommands).forEach(([id, command]) => {
      registerCommand(id, command);
    });

    return () => {
      // Cleanup commands
      Object.keys(navigationCommands).forEach(id => {
        unregisterCommand(id);
      });
    };
  }, [registerCommand, unregisterCommand, router, announceNavigation]);
}

// Theme commands hook
export function useVoiceTheme() {
  const { registerCommand, unregisterCommand, announceAction } = useVoice();
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    const themeCommands = {
      'theme-dark': {
        patterns: [
          'switch to dark mode',
          'enable dark theme',
          'dark mode on',
          'use dark theme'
        ],
        description: 'Switch to dark theme',
        category: 'Theme',
        action: () => {
          setTheme('dark');
          announceAction('Switched to dark theme');
        }
      },
      'theme-light': {
        patterns: [
          'switch to light mode',
          'enable light theme',
          'light mode on',
          'use light theme'
        ],
        description: 'Switch to light theme',
        category: 'Theme',
        action: () => {
          setTheme('light');
          announceAction('Switched to light theme');
        }
      },
      'theme-toggle': {
        patterns: [
          'toggle theme',
          'switch theme',
          'change theme',
          'toggle dark mode'
        ],
        description: 'Toggle between light and dark theme',
        category: 'Theme',
        action: () => {
          const newTheme = theme === 'dark' ? 'light' : 'dark';
          setTheme(newTheme);
          announceAction(`Switched to ${newTheme} theme`);
        }
      }
    };

    Object.entries(themeCommands).forEach(([id, command]) => {
      registerCommand(id, command);
    });

    return () => {
      Object.keys(themeCommands).forEach(id => {
        unregisterCommand(id);
      });
    };
  }, [registerCommand, unregisterCommand, setTheme, theme, announceAction]);
}

// Focus management commands
export function useVoiceFocus() {
  const { registerCommand, unregisterCommand, announceElement, announceAction } = useVoice();

  useEffect(() => {
    const focusCommands = {
      'focus-main': {
        patterns: [
          'focus main content',
          'go to main',
          'main content',
          'focus content'
        ],
        description: 'Focus main content area',
        category: 'Focus',
        action: () => {
          const main = document.querySelector('main') || document.querySelector('[role="main"]');
          if (main && main instanceof HTMLElement) {
            main.focus();
            announceElement(main);
          } else {
            announceAction('Main content not found');
          }
        }
      },
      'focus-navigation': {
        patterns: [
          'focus navigation',
          'go to navigation',
          'focus nav',
          'navigation menu'
        ],
        description: 'Focus navigation menu',
        category: 'Focus',
        action: () => {
          const nav = document.querySelector('nav') || document.querySelector('[role="navigation"]');
          if (nav && nav instanceof HTMLElement) {
            nav.focus();
            announceElement('Navigation menu');
          } else {
            announceAction('Navigation not found');
          }
        }
      },
      'focus-search': {
        patterns: [
          'focus search',
          'go to search',
          'search box',
          'find search'
        ],
        description: 'Focus search input',
        category: 'Focus',
        action: () => {
          const search = document.querySelector('input[type="search"]') || 
                       document.querySelector('[role="searchbox"]') ||
                       document.querySelector('input[placeholder*="search" i]');
          if (search && search instanceof HTMLElement) {
            search.focus();
            announceElement(search);
          } else {
            announceAction('Search input not found');
          }
        }
      },
      'focus-skip': {
        patterns: [
          'skip to content',
          'skip links',
          'skip navigation'
        ],
        description: 'Activate skip links',
        category: 'Focus',
        action: () => {
          const skipLink = document.querySelector('.skip-link') || 
                          document.querySelector('[href="#main-content"]');
          if (skipLink && skipLink instanceof HTMLElement) {
            skipLink.click();
            announceAction('Skipped to main content');
          } else {
            const main = document.querySelector('main') || document.querySelector('[role="main"]');
            if (main && main instanceof HTMLElement) {
              main.focus();
              announceAction('Focused main content');
            }
          }
        }
      },
      'next-landmark': {
        patterns: [
          'next landmark',
          'next region',
          'next section'
        ],
        description: 'Move to next landmark',
        category: 'Focus',
        action: () => {
          const landmarks = document.querySelectorAll('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], [role="form"], [role="search"]');
          const currentFocus = document.activeElement;
          let nextIndex = 0;
          
          for (let i = 0; i < landmarks.length; i++) {
            if (landmarks[i] === currentFocus) {
              nextIndex = (i + 1) % landmarks.length;
              break;
            }
          }
          
          const nextLandmark = landmarks[nextIndex] as HTMLElement;
          if (nextLandmark) {
            nextLandmark.focus();
            announceElement(nextLandmark);
          }
        }
      },
      'previous-landmark': {
        patterns: [
          'previous landmark',
          'previous region',
          'previous section'
        ],
        description: 'Move to previous landmark',
        category: 'Focus',
        action: () => {
          const landmarks = document.querySelectorAll('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], [role="form"], [role="search"]');
          const currentFocus = document.activeElement;
          let prevIndex = landmarks.length - 1;
          
          for (let i = 0; i < landmarks.length; i++) {
            if (landmarks[i] === currentFocus) {
              prevIndex = i === 0 ? landmarks.length - 1 : i - 1;
              break;
            }
          }
          
          const prevLandmark = landmarks[prevIndex] as HTMLElement;
          if (prevLandmark) {
            prevLandmark.focus();
            announceElement(prevLandmark);
          }
        }
      }
    };

    Object.entries(focusCommands).forEach(([id, command]) => {
      registerCommand(id, command);
    });

    return () => {
      Object.keys(focusCommands).forEach(id => {
        unregisterCommand(id);
      });
    };
  }, [registerCommand, unregisterCommand, announceElement, announceAction]);
}

// Application commands
export function useVoiceApplication() {
  const { registerCommand, unregisterCommand, announceAction, speak, getCommands } = useVoice();

  useEffect(() => {
    const appCommands = {
      'help-commands': {
        patterns: [
          'help',
          'what can I say',
          'available commands',
          'voice commands',
          'show commands'
        ],
        description: 'List available voice commands',
        category: 'Help',
        action: async () => {
          const commands = getCommands();
          const categories = [...new Set(commands.map(cmd => cmd.category))];
          
          let helpText = 'Available voice commands: ';
          
          for (const category of categories) {
            const categoryCommands = commands.filter(cmd => cmd.category === category);
            helpText += `${category}: `;
            helpText += categoryCommands.map(cmd => cmd.description).join(', ');
            helpText += '. ';
          }
          
          await speak(helpText);
        }
      },
      'page-info': {
        patterns: [
          'where am I',
          'what page',
          'current page',
          'page information'
        ],
        description: 'Announce current page information',
        category: 'Information',
        action: () => {
          const title = document.title || 'Untitled page';
          const url = window.location.pathname;
          const headings = document.querySelectorAll('h1, h2, h3');
          
          let announcement = `You are on ${title}`;
          if (url !== '/') {
            announcement += ` at ${url}`;
          }
          
          if (headings.length > 0) {
            const mainHeading = headings[0].textContent?.trim();
            if (mainHeading) {
              announcement += `. Main heading: ${mainHeading}`;
            }
          }
          
          announceAction(announcement);
        }
      },
      'read-page': {
        patterns: [
          'read page',
          'read content',
          'read main content',
          'what\'s on this page'
        ],
        description: 'Read main page content',
        category: 'Reading',
        action: async () => {
          const main = document.querySelector('main') || document.querySelector('[role="main"]');
          const content = main || document.body;
          
          // Get readable text content
          const textContent = content.textContent?.trim() || '';
          const cleanText = textContent.replace(/\s+/g, ' ').slice(0, 500);
          
          if (cleanText) {
            await speak(`Page content: ${cleanText}`);
          } else {
            announceAction('No readable content found on this page');
          }
        }
      },
      'time-date': {
        patterns: [
          'what time is it',
          'current time',
          'tell me the time',
          'what date is it',
          'current date'
        ],
        description: 'Announce current time and date',
        category: 'Information',
        action: () => {
          const now = new Date();
          const time = now.toLocaleTimeString();
          const date = now.toLocaleDateString();
          announceAction(`Current time is ${time}, date is ${date}`);
        }
      },
      'refresh-page': {
        patterns: [
          'refresh page',
          'reload page',
          'refresh',
          'reload'
        ],
        description: 'Refresh the current page',
        category: 'Action',
        requiresConfirmation: true,
        action: () => {
          window.location.reload();
        }
      },
      'scroll-top': {
        patterns: [
          'scroll to top',
          'go to top',
          'top of page'
        ],
        description: 'Scroll to top of page',
        category: 'Navigation',
        action: () => {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          announceAction('Scrolled to top of page');
        }
      },
      'scroll-bottom': {
        patterns: [
          'scroll to bottom',
          'go to bottom',
          'bottom of page'
        ],
        description: 'Scroll to bottom of page',
        category: 'Navigation',
        action: () => {
          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          announceAction('Scrolled to bottom of page');
        }
      }
    };

    Object.entries(appCommands).forEach(([id, command]) => {
      registerCommand(id, command);
    });

    return () => {
      Object.keys(appCommands).forEach(id => {
        unregisterCommand(id);
      });
    };
  }, [registerCommand, unregisterCommand, announceAction, speak, getCommands]);
}

// Dashboard-specific commands
export function useVoiceDashboard() {
  const { registerCommand, unregisterCommand, announceAction } = useVoice();

  useEffect(() => {
    const dashboardCommands = {
      'dashboard-add-widget': {
        patterns: [
          'add widget',
          'new widget',
          'create widget',
          'add new widget'
        ],
        description: 'Open add widget dialog',
        category: 'Dashboard',
        action: () => {
          const addButton = document.querySelector('[data-testid="add-widget-button"]') ||
                           document.querySelector('button[aria-label*="add" i][aria-label*="widget" i]') ||
                           document.querySelector('button:has(.lucide-plus)');
          
          if (addButton && addButton instanceof HTMLElement) {
            addButton.click();
            announceAction('Add widget dialog opened');
          } else {
            announceAction('Add widget button not found');
          }
        }
      },
      'dashboard-save': {
        patterns: [
          'save dashboard',
          'save layout',
          'save changes'
        ],
        description: 'Save dashboard changes',
        category: 'Dashboard',
        action: () => {
          const saveButton = document.querySelector('button[aria-label*="save" i]') ||
                            document.querySelector('[data-testid="save-dashboard"]');
          
          if (saveButton && saveButton instanceof HTMLElement) {
            saveButton.click();
            announceAction('Dashboard saved');
          } else {
            announceAction('Save button not found');
          }
        }
      },
      'dashboard-reset': {
        patterns: [
          'reset dashboard',
          'reset layout',
          'clear dashboard'
        ],
        description: 'Reset dashboard layout',
        category: 'Dashboard',
        requiresConfirmation: true,
        action: () => {
          const resetButton = document.querySelector('button[aria-label*="reset" i]') ||
                             document.querySelector('[data-testid="reset-dashboard"]');
          
          if (resetButton && resetButton instanceof HTMLElement) {
            resetButton.click();
            announceAction('Dashboard reset');
          } else {
            announceAction('Reset button not found');
          }
        }
      }
    };

    Object.entries(dashboardCommands).forEach(([id, command]) => {
      registerCommand(id, command);
    });

    return () => {
      Object.keys(dashboardCommands).forEach(id => {
        unregisterCommand(id);
      });
    };
  }, [registerCommand, unregisterCommand, announceAction]);
}

// Combined hook for all voice commands
export function useVoiceCommands() {
  useVoiceNavigation();
  useVoiceTheme();
  useVoiceFocus();
  useVoiceApplication();
  useVoiceDashboard();
}