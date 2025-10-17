# OpenSVM Enterprise UI/UX API Documentation

## Overview

The OpenSVM Enterprise UI/UX system provides a comprehensive set of APIs and hooks for building accessible, performant, and internationalized applications. This documentation covers all major APIs, their usage patterns, and integration examples.

## Core APIs

### Design System API

#### Theme Provider
```typescript
import { useTheme } from '@/lib/design-system/theme-provider';

const MyComponent = () => {
  const { theme, setTheme, isDark, isHighContrast } = useTheme();
  
  return (
    <div className={theme.className}>
      <button onClick={() => setTheme({ mode: 'dark' })}>
        Switch to Dark Mode
      </button>
    </div>
  );
};
```

#### Responsive Hooks
```typescript
import { useResponsive } from '@/lib/design-system/responsive';

const MyComponent = () => {
  const { 
    breakpoint, 
    isMobile, 
    isTablet, 
    isDesktop,
    screenSize 
  } = useResponsive();
  
  return (
    <div>
      {isMobile ? <MobileLayout /> : <DesktopLayout />}
    </div>
  );
};
```

### Accessibility API

#### Accessibility Provider
```typescript
import { useAccessibility } from '@/lib/accessibility';

const MyComponent = () => {
  const { 
    preferences,
    announceToScreenReader,
    focusElement,
    trapFocus,
    releaseFocus 
  } = useAccessibility();
  
  const handleClick = () => {
    announceToScreenReader('Action completed successfully');
  };
  
  return (
    <button 
      onClick={handleClick}
      aria-describedby="instructions"
    >
      Submit
    </button>
  );
};
```

#### Focus Management
```typescript
import { useFocusManagement } from '@/lib/accessibility/focus';

const Modal = ({ isOpen, onClose, children }) => {
  const { trapFocus, releaseFocus } = useFocusManagement();
  
  useEffect(() => {
    if (isOpen) {
      trapFocus();
    } else {
      releaseFocus();
    }
  }, [isOpen]);
  
  return isOpen ? (
    <div className="modal">
      {children}
    </div>
  ) : null;
};
```

### Internationalization API

#### Translation Hooks
```typescript
import { useTranslation } from '@/lib/i18n';

const MyComponent = () => {
  const { t, locale, setLocale, isRTL } = useTranslation();
  
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <h1>{t('welcome.title')}</h1>
      <p>{t('welcome.description', { name: 'User' })}</p>
      
      <select 
        value={locale} 
        onChange={(e) => setLocale(e.target.value)}
      >
        <option value="en">English</option>
        <option value="es">Español</option>
        <option value="ar">العربية</option>
      </select>
    </div>
  );
};
```

#### Pluralization
```typescript
const MyComponent = ({ count }) => {
  const { t, formatPlural } = useTranslation();
  
  return (
    <p>
      {formatPlural(count, {
        zero: t('items.zero'),
        one: t('items.one'),
        other: t('items.other', { count })
      })}
    </p>
  );
};
```

### Voice Navigation API

#### Voice Provider
```typescript
import { useVoice } from '@/lib/voice';

const MyComponent = () => {
  const {
    isListening,
    startListening,
    stopListening,
    speak,
    registerCommand,
    announceElement
  } = useVoice();
  
  useEffect(() => {
    registerCommand('my-action', {
      patterns: ['execute action', 'do something'],
      description: 'Execute custom action',
      category: 'Custom',
      action: () => {
        // Custom action logic
        speak('Action executed successfully');
      }
    });
  }, [registerCommand, speak]);
  
  return (
    <button onClick={() => announceElement('Button clicked')}>
      {isListening ? 'Listening...' : 'Start Voice Control'}
    </button>
  );
};
```

#### Voice Commands
```typescript
import { useVoiceCommands } from '@/lib/voice/commands';

const NavigationComponent = () => {
  // Automatically registers navigation voice commands
  useVoiceCommands();
  
  return <nav>/* Navigation content */</nav>;
};
```

### Caching API

#### Cache Provider
```typescript
import { useCachedQuery, useCachedMutation } from '@/lib/caching/hooks';

const MyComponent = () => {
  const { 
    data, 
    isLoading, 
    error, 
    refetch 
  } = useCachedQuery({
    key: ['user-data', userId],
    fetcher: () => fetchUserData(userId),
    options: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    }
  });
  
  const updateUser = useCachedMutation({
    mutationFn: updateUserData,
    onSuccess: () => {
      // Invalidate related cache entries
      invalidateQueries(['user-data']);
    }
  });
  
  return (
    <div>
      {isLoading ? <LoadingSkeleton /> : <UserProfile data={data} />}
    </div>
  );
};
```

#### Cache Management
```typescript
import { useCache } from '@/lib/caching';

const AdminPanel = () => {
  const { 
    getCacheStats, 
    clearCache, 
    optimizeCache 
  } = useCache();
  
  const handleClearCache = async () => {
    await clearCache();
    announceToScreenReader('Cache cleared successfully');
  };
  
  return (
    <div>
      <CacheStatsDisplay stats={getCacheStats()} />
      <button onClick={handleClearCache}>Clear Cache</button>
    </div>
  );
};
```

### Performance API

#### Performance Monitoring
```typescript
import { usePerformance } from '@/lib/performance';

const PerformanceDashboard = () => {
  const {
    metrics,
    isCollecting,
    startCollection,
    generateReport,
    getOptimizationSuggestions
  } = usePerformance();
  
  const handleStartMonitoring = () => {
    startCollection();
    announceToScreenReader('Performance monitoring started');
  };
  
  return (
    <div>
      <button onClick={handleStartMonitoring}>
        Start Monitoring
      </button>
      {metrics && (
        <MetricsDisplay 
          metrics={metrics}
          suggestions={getOptimizationSuggestions()}
        />
      )}
    </div>
  );
};
```

#### Performance Testing
```typescript
import { usePerformanceTesting, createCoreWebVitalsTestSuite } from '@/lib/performance/testing';

const TestRunner = () => {
  const { runTestSuite, results, isRunning } = usePerformanceTesting();
  
  const runTests = async () => {
    const testSuite = createCoreWebVitalsTestSuite();
    const result = await runTestSuite(testSuite);
    console.log('Test results:', result);
  };
  
  return (
    <button onClick={runTests} disabled={isRunning}>
      {isRunning ? 'Running Tests...' : 'Run Performance Tests'}
    </button>
  );
};
```

### Dashboard API

#### Dashboard Provider
```typescript
import { useDashboard } from '@/lib/dashboard';

const DashboardApp = () => {
  const {
    dashboards,
    currentDashboard,
    createDashboard,
    addWidget,
    updateWidget,
    exportDashboard
  } = useDashboard();
  
  const handleAddWidget = () => {
    addWidget(currentDashboard.id, {
      type: 'metrics-card',
      title: 'New Metric',
      position: { x: 0, y: 0, w: 2, h: 2 },
      config: { /* widget config */ }
    });
  };
  
  return (
    <div>
      <button onClick={handleAddWidget}>Add Widget</button>
      <DashboardGrid dashboard={currentDashboard} />
    </div>
  );
};
```

#### Widget Development
```typescript
import { WidgetProps } from '@/lib/dashboard/types';

interface MyWidgetProps extends WidgetProps {
  config: {
    title: string;
    dataSource: any[];
    customOption: boolean;
  };
}

const MyCustomWidget: React.FC<MyWidgetProps> = ({ config, size, data }) => {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{config.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Widget content based on config and size */}
      </CardContent>
    </Card>
  );
};

// Register the widget
export const myWidgetTemplate = {
  type: 'my-widget',
  name: 'My Custom Widget',
  description: 'A custom widget for specific use case',
  component: MyCustomWidget,
  defaultConfig: {
    title: 'Custom Widget',
    dataSource: [],
    customOption: false,
  },
  category: 'Custom',
  defaultSize: { w: 3, h: 2 },
};
```

### Authentication & Authorization API

#### RBAC Provider
```typescript
import { useRBAC } from '@/lib/rbac';

const ProtectedComponent = () => {
  const {
    user,
    permissions,
    hasPermission,
    hasRole,
    switchOrganization
  } = useRBAC();
  
  if (!hasPermission('dashboard.read')) {
    return <AccessDenied />;
  }
  
  return (
    <div>
      {hasRole('admin') && <AdminPanel />}
      {hasPermission('dashboard.write') && <EditControls />}
    </div>
  );
};
```

#### SSO Integration
```typescript
import { useSSO } from '@/lib/sso';

const LoginComponent = () => {
  const {
    loginWithSAML,
    loginWithOAuth,
    loginWithAzureAD,
    logout,
    isAuthenticated,
    user
  } = useSSO();
  
  const handleSSOLogin = (provider: string) => {
    switch (provider) {
      case 'saml':
        loginWithSAML();
        break;
      case 'oauth':
        loginWithOAuth();
        break;
      case 'azure':
        loginWithAzureAD();
        break;
    }
  };
  
  return (
    <div>
      {!isAuthenticated ? (
        <div>
          <button onClick={() => handleSSOLogin('saml')}>
            Login with SAML
          </button>
          <button onClick={() => handleSSOLogin('oauth')}>
            Login with OAuth
          </button>
        </div>
      ) : (
        <div>
          Welcome, {user.name}!
          <button onClick={logout}>Logout</button>
        </div>
      )}
    </div>
  );
};
```

### Export API

#### Export Provider
```typescript
import { useExport } from '@/lib/export';

const ExportComponent = () => {
  const {
    exportToPDF,
    exportToCSV,
    exportToExcel,
    isExporting,
    progress
  } = useExport();
  
  const handleExport = async (format: string) => {
    const data = /* your data */;
    const options = {
      filename: `export-${Date.now()}`,
      includeHeaders: true,
      customStyles: { /* custom styling */ }
    };
    
    switch (format) {
      case 'pdf':
        await exportToPDF(data, options);
        break;
      case 'csv':
        await exportToCSV(data, options);
        break;
      case 'excel':
        await exportToExcel(data, options);
        break;
    }
  };
  
  return (
    <div>
      {isExporting && <ProgressBar progress={progress} />}
      <button onClick={() => handleExport('pdf')}>Export PDF</button>
      <button onClick={() => handleExport('csv')}>Export CSV</button>
    </div>
  );
};
```

### Error Handling API

#### Error Provider
```typescript
import { useErrorHandling } from '@/lib/error-handling';

const MyComponent = () => {
  const {
    reportError,
    clearErrors,
    retryLastAction,
    showUserFriendlyError
  } = useErrorHandling();
  
  const handleAsyncAction = async () => {
    try {
      await riskyOperation();
    } catch (error) {
      reportError(error, {
        context: 'user-action',
        severity: 'medium',
        recoverable: true
      });
      
      showUserFriendlyError(
        'Something went wrong, but we\'ve saved your progress.',
        {
          action: 'Retry',
          onAction: retryLastAction
        }
      );
    }
  };
  
  return (
    <button onClick={handleAsyncAction}>
      Perform Action
    </button>
  );
};
```

### Animation API

#### Animation Provider
```typescript
import { useAnimations, AnimatedBox } from '@/lib/animations';

const MyComponent = () => {
  const {
    prefersReducedMotion,
    animateElement,
    createStaggeredAnimation
  } = useAnimations();
  
  const items = ['Item 1', 'Item 2', 'Item 3'];
  
  return (
    <div>
      <AnimatedBox
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
      >
        Content with animation
      </AnimatedBox>
      
      {items.map((item, index) => (
        <AnimatedBox
          key={index}
          {...createStaggeredAnimation(index, 0.1)}
        >
          {item}
        </AnimatedBox>
      ))}
    </div>
  );
};
```

## Advanced Usage Patterns

### Compound Components

```typescript
// Dashboard compound component pattern
const Dashboard = ({ children }) => {
  return (
    <DashboardProvider>
      <div className="dashboard">
        {children}
      </div>
    </DashboardProvider>
  );
};

const DashboardHeader = ({ children }) => {
  const { currentDashboard } = useDashboard();
  return <header>{children}</header>;
};

const DashboardGrid = () => {
  const { currentDashboard } = useDashboard();
  return <GridLayout dashboard={currentDashboard} />;
};

Dashboard.Header = DashboardHeader;
Dashboard.Grid = DashboardGrid;

// Usage
<Dashboard>
  <Dashboard.Header>
    <h1>My Dashboard</h1>
  </Dashboard.Header>
  <Dashboard.Grid />
</Dashboard>
```

### Higher-Order Components

```typescript
// HOC for adding voice announcements
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

// HOC for adding accessibility features
export function withAccessibility<T extends {}>(
  Component: React.ComponentType<T>
) {
  return function AccessibleComponent(props: T) {
    const { trapFocus, releaseFocus } = useAccessibility();
    
    // Add accessibility enhancements
    return <Component {...props} />;
  };
}

// Usage
const MyPageWithVoice = withVoiceAnnouncements(MyPage);
const AccessibleModal = withAccessibility(Modal);
```

### Custom Hooks

```typescript
// Custom hook combining multiple features
export function useEnterpriseFeatures() {
  const { user, hasPermission } = useRBAC();
  const { speak } = useVoice();
  const { reportError } = useErrorHandling();
  const { exportToPDF } = useExport();
  
  const performSecureAction = useCallback(async (action: () => Promise<void>) => {
    if (!hasPermission('advanced.actions')) {
      speak('Access denied. Insufficient permissions.');
      return;
    }
    
    try {
      await action();
      speak('Action completed successfully');
    } catch (error) {
      reportError(error);
      speak('Action failed. Please try again.');
    }
  }, [hasPermission, speak, reportError]);
  
  return {
    user,
    performSecureAction,
    exportToPDF,
  };
}
```

### Context Composition

```typescript
// Composing multiple contexts
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <I18nProvider>
          <AccessibilityProvider>
            <VoiceProvider>
              <CacheProvider>
                <RBACProvider>
                  <PerformanceProvider>
                    {children}
                  </PerformanceProvider>
                </RBACProvider>
              </CacheProvider>
            </VoiceProvider>
          </AccessibilityProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
```

## Type Definitions

### Core Types

```typescript
// Theme types
interface Theme {
  mode: 'light' | 'dark' | 'system';
  variant: 'default' | 'blue' | 'green' | 'purple';
  fontSize: 'sm' | 'base' | 'lg';
  reducedMotion: boolean;
  highContrast: boolean;
}

// User types
interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization: Organization;
  preferences: UserPreferences;
}

// RBAC types
interface Permission {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete';
}

interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  hierarchy: number;
}

// Dashboard types
interface Widget {
  id: string;
  type: string;
  title: string;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, any>;
  locked: boolean;
  visible: boolean;
}

interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  settings: DashboardSettings;
  metadata: DashboardMetadata;
}

// Voice types
interface VoiceCommand {
  patterns: string[];
  description: string;
  category: string;
  action: (params?: any) => void | Promise<void>;
  requiresConfirmation?: boolean;
}

// Performance types
interface PerformanceMetrics {
  firstContentfulPaint: number | null;
  largestContentfulPaint: number | null;
  firstInputDelay: number | null;
  cumulativeLayoutShift: number | null;
  jsHeapSize: number;
  timestamp: number;
}
```

## Event System

### Custom Events

```typescript
// Performance events
document.addEventListener('performance:threshold-exceeded', (event) => {
  const { metric, value, threshold } = event.detail;
  console.log(`Performance alert: ${metric} exceeded threshold`);
});

// Voice events
document.addEventListener('voice:command-recognized', (event) => {
  const { command, confidence } = event.detail;
  console.log(`Voice command recognized: ${command}`);
});

// Cache events
document.addEventListener('cache:invalidated', (event) => {
  const { key, reason } = event.detail;
  console.log(`Cache invalidated: ${key} (${reason})`);
});
```

### Event Dispatchers

```typescript
// Custom event dispatching
export function dispatchPerformanceEvent(type: string, detail: any) {
  const event = new CustomEvent(`performance:${type}`, { detail });
  document.dispatchEvent(event);
}

export function dispatchVoiceEvent(type: string, detail: any) {
  const event = new CustomEvent(`voice:${type}`, { detail });
  document.dispatchEvent(event);
}
```

## Best Practices

### Performance

1. **Lazy Loading**: Use dynamic imports for heavy components
2. **Memoization**: Wrap expensive computations with `useMemo`
3. **Virtualization**: Use virtual scrolling for large lists
4. **Code Splitting**: Split routes and features into separate bundles
5. **Image Optimization**: Use Next.js Image component with proper sizing

### Accessibility

1. **Semantic HTML**: Use proper HTML elements for content structure
2. **ARIA Labels**: Provide descriptive labels for interactive elements
3. **Focus Management**: Implement proper focus trapping in modals
4. **Color Contrast**: Ensure sufficient contrast for all text
5. **Keyboard Navigation**: Support all interactions via keyboard

### Internationalization

1. **String Externalization**: Never hardcode user-facing strings
2. **Pluralization**: Use proper plural forms for different languages
3. **Date/Number Formatting**: Use locale-aware formatting
4. **RTL Support**: Test and support right-to-left languages
5. **Cultural Sensitivity**: Consider cultural differences in UX

### Voice Interface

1. **Clear Commands**: Use simple, memorable voice patterns
2. **Confirmation**: Confirm destructive actions verbally
3. **Error Handling**: Provide helpful error messages for unrecognized commands
4. **Accessibility**: Ensure voice features don't interfere with screen readers
5. **Privacy**: Respect user privacy regarding voice data

## Migration Guide

### Upgrading from Legacy Systems

```typescript
// Before (legacy)
const theme = localStorage.getItem('theme');
document.body.className = theme === 'dark' ? 'dark' : 'light';

// After (enterprise system)
const { theme, setTheme } = useTheme();
// Theme is automatically applied and persisted
```

```typescript
// Before (basic i18n)
const messages = {
  en: { welcome: 'Welcome' },
  es: { welcome: 'Bienvenido' }
};

// After (enterprise i18n)
const { t } = useTranslation();
return <h1>{t('welcome.title')}</h1>;
```

### Integration Checklist

- [ ] Wrap app in `AppProviders`
- [ ] Update theme usage to use `useTheme()`
- [ ] Replace hardcoded strings with `t()` calls
- [ ] Add accessibility attributes to interactive elements
- [ ] Register voice commands for key actions
- [ ] Implement error boundaries and error handling
- [ ] Add performance monitoring to critical paths
- [ ] Update authentication to use RBAC system
- [ ] Convert static content to dashboard widgets

---

This API documentation provides comprehensive coverage of all major APIs and integration patterns in the OpenSVM Enterprise UI/UX system. For specific implementation details, refer to the source code and TypeScript definitions.