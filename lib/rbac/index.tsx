'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { useAccessibility } from '@/lib/accessibility';

// Core RBAC types
export type Permission = 
  | 'read:transactions'
  | 'read:accounts'
  | 'read:programs'
  | 'read:analytics'
  | 'write:analytics'
  | 'admin:users'
  | 'admin:roles'
  | 'admin:organization'
  | 'admin:billing'
  | 'admin:audit'
  | 'api:access'
  | 'api:write'
  | 'export:data'
  | 'export:reports'
  | 'customize:dashboard'
  | 'customize:branding'
  | 'integrate:sso'
  | 'integrate:webhooks';

export type Role = 'viewer' | 'analyst' | 'developer' | 'admin' | 'owner';

export type TenantPlan = 'free' | 'pro' | 'enterprise' | 'custom';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: Role;
  permissions: Permission[];
  tenantId: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface Tenant {
  id: string;
  name: string;
  domain?: string;
  plan: TenantPlan;
  logo?: string;
  primaryColor?: string;
  customDomain?: string;
  settings: TenantSettings;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface TenantSettings {
  branding: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    brandName?: string;
    favicon?: string;
  };
  features: {
    analytics: boolean;
    apiAccess: boolean;
    customDashboards: boolean;
    dataExport: boolean;
    ssoIntegration: boolean;
    whiteLabel: boolean;
    auditLogs: boolean;
  };
  limits: {
    maxUsers: number;
    maxApiCalls: number;
    dataRetention: number; // days
    customDashboards: number;
  };
  security: {
    enforceSSO: boolean;
    requireMFA: boolean;
    ipWhitelist?: string[];
    sessionTimeout: number; // minutes
    passwordPolicy: {
      minLength: number;
      requireSpecialChars: boolean;
      requireNumbers: boolean;
      requireUppercase: boolean;
    };
  };
}

export interface RoleDefinition {
  role: Role;
  name: string;
  description: string;
  permissions: Permission[];
  hierarchy: number; // 0 = highest (owner), 4 = lowest (viewer)
}

// RBAC Context
interface RBACContextType {
  // Current user and tenant
  currentUser: User | null;
  currentTenant: Tenant | null;
  
  // Permission checking
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: Role) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  
  // Role hierarchy
  canManageRole: (targetRole: Role) => boolean;
  canManageUser: (targetUserId: string) => boolean;
  
  // Tenant management
  switchTenant: (tenantId: string) => Promise<boolean>;
  updateTenantSettings: (settings: Partial<TenantSettings>) => Promise<boolean>;
  
  // User management
  inviteUser: (email: string, role: Role) => Promise<boolean>;
  updateUserRole: (userId: string, role: Role) => Promise<boolean>;
  deactivateUser: (userId: string) => Promise<boolean>;
  
  // Audit logging
  logAction: (action: string, details?: Record<string, any>) => void;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
}

const RBACContext = createContext<RBACContextType | undefined>(undefined);

// Role definitions with permissions
const roleDefinitions: RoleDefinition[] = [
  {
    role: 'owner',
    name: 'Owner',
    description: 'Full access to all features and administrative functions',
    hierarchy: 0,
    permissions: [
      'read:transactions', 'read:accounts', 'read:programs', 'read:analytics',
      'write:analytics', 'admin:users', 'admin:roles', 'admin:organization',
      'admin:billing', 'admin:audit', 'api:access', 'api:write',
      'export:data', 'export:reports', 'customize:dashboard',
      'customize:branding', 'integrate:sso', 'integrate:webhooks'
    ],
  },
  {
    role: 'admin',
    name: 'Administrator',
    description: 'Manage users, roles, and organization settings',
    hierarchy: 1,
    permissions: [
      'read:transactions', 'read:accounts', 'read:programs', 'read:analytics',
      'write:analytics', 'admin:users', 'admin:roles', 'api:access',
      'export:data', 'export:reports', 'customize:dashboard'
    ],
  },
  {
    role: 'developer',
    name: 'Developer',
    description: 'Access to API and development tools',
    hierarchy: 2,
    permissions: [
      'read:transactions', 'read:accounts', 'read:programs', 'read:analytics',
      'api:access', 'api:write', 'export:data', 'customize:dashboard'
    ],
  },
  {
    role: 'analyst',
    name: 'Analyst',
    description: 'Read access with analytics and export capabilities',
    hierarchy: 3,
    permissions: [
      'read:transactions', 'read:accounts', 'read:programs', 'read:analytics',
      'write:analytics', 'export:data', 'export:reports', 'customize:dashboard'
    ],
  },
  {
    role: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to basic features',
    hierarchy: 4,
    permissions: [
      'read:transactions', 'read:accounts', 'read:programs', 'read:analytics'
    ],
  },
];

// Mock tenant service (in real app, this would be an API)
class TenantService {
  private static mockTenants: Tenant[] = [
    {
      id: 'tenant-1',
      name: 'Acme Corp',
      domain: 'acme',
      plan: 'enterprise',
      settings: {
        branding: {
          logo: '/logos/acme.svg',
          primaryColor: '#6366f1',
          brandName: 'Acme Analytics',
        },
        features: {
          analytics: true,
          apiAccess: true,
          customDashboards: true,
          dataExport: true,
          ssoIntegration: true,
          whiteLabel: true,
          auditLogs: true,
        },
        limits: {
          maxUsers: 100,
          maxApiCalls: 1000000,
          dataRetention: 365,
          customDashboards: 50,
        },
        security: {
          enforceSSO: true,
          requireMFA: true,
          sessionTimeout: 480,
          passwordPolicy: {
            minLength: 12,
            requireSpecialChars: true,
            requireNumbers: true,
            requireUppercase: true,
          },
        },
      },
      isActive: true,
      createdAt: new Date('2023-01-15'),
      updatedAt: new Date(),
    }
  ];

  private static mockUsers: User[] = [
    {
      id: 'user-1',
      email: 'admin@acme.com',
      name: 'John Admin',
      role: 'owner',
      permissions: roleDefinitions.find(r => r.role === 'owner')?.permissions || [],
      tenantId: 'tenant-1',
      isActive: true,
      createdAt: new Date('2023-01-15'),
      updatedAt: new Date(),
    }
  ];

  static async getCurrentUser(): Promise<User | null> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // In real app, this would validate JWT token
    return this.mockUsers[0] || null;
  }

  static async getCurrentTenant(tenantId: string): Promise<Tenant | null> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return this.mockTenants.find(t => t.id === tenantId) || null;
  }

  static async updateTenantSettings(
    tenantId: string, 
    settings: Partial<TenantSettings>
  ): Promise<boolean> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const tenant = this.mockTenants.find(t => t.id === tenantId);
    if (tenant) {
      tenant.settings = { ...tenant.settings, ...settings };
      tenant.updatedAt = new Date();
      return true;
    }
    return false;
  }

  static async inviteUser(
    tenantId: string,
    email: string,
    role: Role
  ): Promise<boolean> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const roleDefinition = roleDefinitions.find(r => r.role === role);
    if (!roleDefinition) return false;

    const newUser: User = {
      id: `user-${Date.now()}`,
      email,
      name: email.split('@')[0],
      role,
      permissions: roleDefinition.permissions,
      tenantId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.mockUsers.push(newUser);
    return true;
  }

  static async updateUserRole(
    userId: string,
    role: Role
  ): Promise<boolean> {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 600));
    
    const user = this.mockUsers.find(u => u.id === userId);
    const roleDefinition = roleDefinitions.find(r => r.role === role);
    
    if (user && roleDefinition) {
      user.role = role;
      user.permissions = roleDefinition.permissions;
      user.updatedAt = new Date();
      return true;
    }
    return false;
  }

  static async logAuditAction(
    userId: string,
    tenantId: string,
    action: string,
    details?: Record<string, any>
  ): Promise<void> {
    // Simulate API call to audit service
    console.log('[Audit Log]', {
      userId,
      tenantId,
      action,
      details,
      timestamp: new Date().toISOString(),
    });
  }
}

// RBAC Provider
export function RBACProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { announceToScreenReader } = useAccessibility();

  // Initialize user and tenant data
  useEffect(() => {
    const initializeRBAC = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load current user
        const user = await TenantService.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          
          // Load tenant data
          const tenant = await TenantService.getCurrentTenant(user.tenantId);
          if (tenant) {
            setCurrentTenant(tenant);
          } else {
            throw new Error('Tenant not found');
          }
        } else {
          throw new Error('User not authenticated');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize RBAC';
        setError(errorMessage);
        console.error('RBAC initialization failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initializeRBAC();
  }, []);

  // Permission checking functions
  const hasPermission = useCallback((permission: Permission): boolean => {
    if (!currentUser) return false;
    return currentUser.permissions.includes(permission);
  }, [currentUser]);

  const hasRole = useCallback((role: Role): boolean => {
    if (!currentUser) return false;
    return currentUser.role === role;
  }, [currentUser]);

  const hasAnyPermission = useCallback((permissions: Permission[]): boolean => {
    if (!currentUser) return false;
    return permissions.some(permission => currentUser.permissions.includes(permission));
  }, [currentUser]);

  const hasAllPermissions = useCallback((permissions: Permission[]): boolean => {
    if (!currentUser) return false;
    return permissions.every(permission => currentUser.permissions.includes(permission));
  }, [currentUser]);

  // Role hierarchy checking
  const canManageRole = useCallback((targetRole: Role): boolean => {
    if (!currentUser) return false;
    
    const currentRoleDefinition = roleDefinitions.find(r => r.role === currentUser.role);
    const targetRoleDefinition = roleDefinitions.find(r => r.role === targetRole);
    
    if (!currentRoleDefinition || !targetRoleDefinition) return false;
    
    // Can manage roles with higher hierarchy number (lower privilege)
    return currentRoleDefinition.hierarchy < targetRoleDefinition.hierarchy;
  }, [currentUser]);

  const canManageUser = useCallback((targetUserId: string): boolean => {
    if (!currentUser) return false;
    
    // Can't manage yourself unless you're the owner
    if (targetUserId === currentUser.id) {
      return currentUser.role === 'owner';
    }
    
    // Must have admin permissions to manage other users
    return hasPermission('admin:users');
  }, [currentUser, hasPermission]);

  // Tenant management
  const switchTenant = useCallback(async (tenantId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const tenant = await TenantService.getCurrentTenant(tenantId);
      
      if (tenant) {
        setCurrentTenant(tenant);
        logAction('tenant:switch', { newTenantId: tenantId });
        announceToScreenReader(`Switched to ${tenant.name}`, 'assertive');
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to switch tenant:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [announceToScreenReader]);

  const updateTenantSettings = useCallback(async (
    settings: Partial<TenantSettings>
  ): Promise<boolean> => {
    if (!currentTenant || !hasPermission('admin:organization')) {
      return false;
    }

    try {
      setIsLoading(true);
      const success = await TenantService.updateTenantSettings(currentTenant.id, settings);
      
      if (success) {
        setCurrentTenant({
          ...currentTenant,
          settings: { ...currentTenant.settings, ...settings },
          updatedAt: new Date(),
        });
        
        logAction('tenant:settings:update', { changes: settings });
        announceToScreenReader('Tenant settings updated', 'polite');
      }
      
      return success;
    } catch (err) {
      console.error('Failed to update tenant settings:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant, hasPermission, announceToScreenReader]);

  // User management
  const inviteUser = useCallback(async (
    email: string,
    role: Role
  ): Promise<boolean> => {
    if (!currentTenant || !hasPermission('admin:users') || !canManageRole(role)) {
      return false;
    }

    try {
      setIsLoading(true);
      const success = await TenantService.inviteUser(currentTenant.id, email, role);
      
      if (success) {
        logAction('user:invite', { email, role });
        announceToScreenReader(`User ${email} invited with ${role} role`, 'polite');
      }
      
      return success;
    } catch (err) {
      console.error('Failed to invite user:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant, hasPermission, canManageRole, announceToScreenReader]);

  const updateUserRole = useCallback(async (
    userId: string,
    role: Role
  ): Promise<boolean> => {
    if (!hasPermission('admin:roles') || !canManageUser(userId) || !canManageRole(role)) {
      return false;
    }

    try {
      setIsLoading(true);
      const success = await TenantService.updateUserRole(userId, role);
      
      if (success) {
        logAction('user:role:update', { userId, newRole: role });
        announceToScreenReader(`User role updated to ${role}`, 'polite');
      }
      
      return success;
    } catch (err) {
      console.error('Failed to update user role:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [hasPermission, canManageUser, canManageRole, announceToScreenReader]);

  const deactivateUser = useCallback(async (userId: string): Promise<boolean> => {
    if (!hasPermission('admin:users') || !canManageUser(userId)) {
      return false;
    }

    try {
      setIsLoading(true);
      // In real implementation, this would call API
      logAction('user:deactivate', { userId });
      announceToScreenReader('User deactivated', 'polite');
      return true;
    } catch (err) {
      console.error('Failed to deactivate user:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [hasPermission, canManageUser, announceToScreenReader]);

  // Audit logging
  const logAction = useCallback((action: string, details?: Record<string, any>) => {
    if (currentUser && currentTenant) {
      TenantService.logAuditAction(currentUser.id, currentTenant.id, action, details);
    }
  }, [currentUser, currentTenant]);

  const contextValue: RBACContextType = {
    currentUser,
    currentTenant,
    hasPermission,
    hasRole,
    hasAnyPermission,
    hasAllPermissions,
    canManageRole,
    canManageUser,
    switchTenant,
    updateTenantSettings,
    inviteUser,
    updateUserRole,
    deactivateUser,
    logAction,
    isLoading,
    error,
  };

  return (
    <RBACContext.Provider value={contextValue}>
      {children}
    </RBACContext.Provider>
  );
}

export function useRBAC() {
  const context = useContext(RBACContext);
  if (context === undefined) {
    throw new Error('useRBAC must be used within an RBACProvider');
  }
  return context;
}

// Higher-order component for permission-based rendering
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredPermission: Permission | Permission[],
  fallback?: React.ComponentType<P>
) {
  return function PermissionGatedComponent(props: P) {
    const { hasPermission, hasAnyPermission } = useRBAC();
    
    const hasAccess = Array.isArray(requiredPermission) 
      ? hasAnyPermission(requiredPermission)
      : hasPermission(requiredPermission);
    
    if (hasAccess) {
      return <WrappedComponent {...props} />;
    }
    
    if (fallback) {
      const FallbackComponent = fallback;
      return <FallbackComponent {...props} />;
    }
    
    return null;
  };
}

// Permission guard component
export function PermissionGuard({
  permission,
  fallback,
  children,
}: {
  permission: Permission | Permission[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { hasPermission, hasAnyPermission } = useRBAC();
  
  const hasAccess = Array.isArray(permission) 
    ? hasAnyPermission(permission)
    : hasPermission(permission);
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  return <>{fallback || null}</>;
}

// Role guard component
export function RoleGuard({
  role,
  fallback,
  children,
}: {
  role: Role | Role[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { hasRole, currentUser } = useRBAC();
  
  const hasAccess = Array.isArray(role)
    ? role.includes(currentUser?.role || 'viewer')
    : hasRole(role);
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  return <>{fallback || null}</>;
}

// Utility functions
export function getRoleDefinition(role: Role): RoleDefinition | undefined {
  return roleDefinitions.find(r => r.role === role);
}

export function getAllRoleDefinitions(): RoleDefinition[] {
  return [...roleDefinitions];
}

export function getPermissionDescription(permission: Permission): string {
  const descriptions: Record<Permission, string> = {
    'read:transactions': 'View transaction data',
    'read:accounts': 'View account information',
    'read:programs': 'View program details',
    'read:analytics': 'View analytics and reports',
    'write:analytics': 'Create and modify analytics',
    'admin:users': 'Manage organization users',
    'admin:roles': 'Manage user roles and permissions',
    'admin:organization': 'Manage organization settings',
    'admin:billing': 'Manage billing and subscriptions',
    'admin:audit': 'Access audit logs and compliance features',
    'api:access': 'Access API endpoints',
    'api:write': 'Make API modifications',
    'export:data': 'Export data and analytics',
    'export:reports': 'Export reports and summaries',
    'customize:dashboard': 'Customize dashboard layouts',
    'customize:branding': 'Customize organization branding',
    'integrate:sso': 'Configure SSO integration',
    'integrate:webhooks': 'Configure webhook integrations',
  };
  
  return descriptions[permission] || permission;
}

export default RBACProvider;