'use client';

import React, { Suspense } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { PerformanceProvider } from '@/contexts/PerformanceContext';
import { EnhancedThemeProvider } from '@/lib/design-system/theme-provider';
import { ResponsiveProvider } from '@/lib/design-system/responsive';
import { AccessibilityProvider } from '@/lib/accessibility';
/* i18n removed */
import { ErrorHandlingProvider, EnhancedErrorBoundary } from '@/lib/error-handling';
import { OnboardingProvider } from '@/components/onboarding/OnboardingSystem';
import { UserExpertiseProvider } from '@/lib/user-expertise';
import { RBACProvider } from '@/lib/rbac';
import { WhiteLabelProvider } from '@/lib/white-label';
import { SSOProvider } from '@/lib/sso';
import { ExportProvider } from '@/lib/export';
import { OptimisticUIProvider } from '@/lib/optimistic-ui';
import { AnimationProvider } from '@/lib/animations';
import { CacheProvider } from '@/lib/caching';
import { VoiceProvider } from '@/lib/voice';
import { WalletProvider } from '@/app/providers/WalletProvider';
import { SettingsProvider } from '@/app/providers/SettingsProvider';
import { AuthProvider } from '@/contexts/AuthContext';
import logger from '@/lib/logging/logger';

// Enhanced error boundary for the entire app
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Application Error Boundary triggered', {
      component: 'AppErrorBoundary',
      metadata: {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorBoundary: 'root'
      }
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-4">
              We're sorry, but something unexpected happened. Please refresh the page to try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
            >
              Refresh Page
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm font-medium text-gray-700">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <EnhancedErrorBoundary>
      <ResponsiveProvider>
        <EnhancedThemeProvider
          defaultConfig={{
            mode: 'system',
            variant: 'default',
            fontSize: 'base',
            reducedMotion: false,
            highContrast: false,
            focusVisible: true,
          }}
          enableTransitions={true}
        >
          <AccessibilityProvider>
            <ErrorHandlingProvider>
              <SettingsProvider>
                <WalletProvider>
                  <AuthProvider>
                    <RBACProvider>
                      <WhiteLabelProvider>
                        <SSOProvider>
                          <ExportProvider>
                            <OptimisticUIProvider>
                              <AnimationProvider>
                                <CacheProvider>
                                  <VoiceProvider>
                                    <UserExpertiseProvider>
                                      <OnboardingProvider>
                                        <NextThemesProvider
                                          attribute="class"
                                          defaultTheme="dark"
                                          enableSystem
                                          disableTransitionOnChange
                                        >
                                          <PerformanceProvider
                                            config={{
                                              enabled: true,
                                              collectInterval: 2000, // Collect metrics every 2 seconds
                                              reportInterval: 30000,  // Report every 30 seconds
                                              debugMode: process.env.NODE_ENV === 'development',
                                              thresholds: {
                                                fps: { warning: 30, critical: 15 },
                                                memoryUsage: { warning: 0.75, critical: 0.9 },
                                                apiResponseTime: { warning: 1000, critical: 2500 },
                                                loadTime: { warning: 3000, critical: 5000 },
                                                firstContentfulPaint: { warning: 2000, critical: 4000 },
                                                largestContentfulPaint: { warning: 2500, critical: 4000 },
                                                cumulativeLayoutShift: { warning: 0.1, critical: 0.25 },
                                                timeToInteractive: { warning: 3500, critical: 5000 }
                                              }
                                            }}
                                            autoStart={true}
                                          >
                                            <Suspense
                                              fallback={
                                                <div className="min-h-screen bg-background flex items-center justify-center">
                                                  <div className="text-center">
                                                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                                                    <p className="text-muted-foreground">Loading OpenSVM...</p>
                                                  </div>
                                                </div>
                                              }
                                            >
                                              {children}
                                            </Suspense>
                                          </PerformanceProvider>
                                        </NextThemesProvider>
                                      </OnboardingProvider>
                                    </UserExpertiseProvider>
                                  </VoiceProvider>
                                </CacheProvider>
                              </AnimationProvider>
                            </OptimisticUIProvider>
                          </ExportProvider>
                        </SSOProvider>
                      </WhiteLabelProvider>
                    </RBACProvider>
                  </AuthProvider>
                </WalletProvider>
              </SettingsProvider>
            </ErrorHandlingProvider>
          </AccessibilityProvider>
        </EnhancedThemeProvider>
      </ResponsiveProvider>
    </EnhancedErrorBoundary>
  );
}
