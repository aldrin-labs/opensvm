'use client';

import React, { useState, useCallback } from 'react';
import { 
  Palette, 
  Type, 
  Image, 
  Layout, 
  Eye, 
  EyeOff, 
  Save, 
  RotateCcw, 
  Upload, 
  Download,
  Settings,
  Brush,
  Layers
} from 'lucide-react';
import { useWhiteLabel, BrandingConfig, CustomizationConfig } from '@/lib/white-label';
import { useI18n } from '@/lib/i18n';
import { useRBAC } from '@/lib/rbac';
import { useAccessibility } from '@/lib/accessibility';

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

function ColorPicker({ label, value, onChange, className = '' }: ColorPickerProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="flex items-center space-x-2">
        <div 
          className="w-8 h-8 rounded-md border border-border cursor-pointer"
          style={{ backgroundColor: value }}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'color';
            input.value = value;
            input.onchange = (e) => onChange((e.target as HTMLInputElement).value);
            input.click();
          }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

interface ImageUploadProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  accept?: string;
  className?: string;
}

function ImageUpload({ label, value, onChange, accept = "image/*", className = '' }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      // In a real app, you'd upload to your storage service
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          onChange(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Failed to upload image:', error);
    } finally {
      setIsUploading(false);
    }
  }, [onChange]);

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-foreground">
        {label}
      </label>
      
      <div className="flex items-center space-x-4">
        {value && (
          <div className="w-16 h-16 rounded-lg border border-border overflow-hidden bg-muted">
            <img 
              src={value} 
              alt={`${label} preview`}
              className="w-full h-full object-contain"
            />
          </div>
        )}
        
        <div className="flex-1">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Enter image URL or upload"
          />
          
          <div className="mt-2">
            <input
              type="file"
              accept={accept}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className="hidden"
              id={`upload-${label.toLowerCase().replace(/\s/g, '-')}`}
            />
            <label
              htmlFor={`upload-${label.toLowerCase().replace(/\s/g, '-')}`}
              className="inline-flex items-center space-x-2 px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 cursor-pointer transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>{isUploading ? 'Uploading...' : 'Upload'}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function CustomizationPanel() {
  const {
    config,
    updateBranding,
    updateConfig,
    resetToDefaults,
    previewMode,
    enablePreview,
    disablePreview,
    exportConfig,
    importConfig
  } = useWhiteLabel();
  const { t } = useI18n();
  const { hasPermission } = useRBAC();
  const { announceToScreenReader } = useAccessibility();

  const [activeTab, setActiveTab] = useState<'branding' | 'colors' | 'typography' | 'layout' | 'content'>('branding');
  const [tempConfig, setTempConfig] = useState<CustomizationConfig>(config);
  const [isModified, setIsModified] = useState(false);

  // All hooks must be called before any conditional logic
  const updateTempBranding = useCallback((updates: Partial<BrandingConfig>) => {
    const newConfig = {
      ...tempConfig,
      branding: {
        ...tempConfig.branding,
        ...updates,
      },
    };
    setTempConfig(newConfig);
    setIsModified(true);
    
    // Enable preview with temp config
    enablePreview(newConfig);
  }, [tempConfig, enablePreview]);

  const updateTempConfig = useCallback((updates: Partial<CustomizationConfig>) => {
    const newConfig = {
      ...tempConfig,
      ...updates,
    };
    setTempConfig(newConfig);
    setIsModified(true);
    
    // Enable preview with temp config
    enablePreview(newConfig);
  }, [tempConfig, enablePreview]);

  const saveChanges = useCallback(async () => {
    try {
      await updateConfig(tempConfig);
      setIsModified(false);
      disablePreview();
      announceToScreenReader('Customization saved successfully', 'polite');
    } catch (error) {
      console.error('Failed to save customization:', error);
      announceToScreenReader('Failed to save customization', 'assertive');
    }
  }, [tempConfig, updateConfig, disablePreview, announceToScreenReader]);

  const discardChanges = useCallback(() => {
    setTempConfig(config);
    setIsModified(false);
    disablePreview();
    announceToScreenReader('Changes discarded', 'polite');
  }, [config, disablePreview, announceToScreenReader]);

  const handleReset = useCallback(async () => {
    if (confirm('Are you sure you want to reset to default settings? This cannot be undone.')) {
      try {
        await resetToDefaults();
        setTempConfig(config);
        setIsModified(false);
        disablePreview();
        announceToScreenReader('Settings reset to defaults', 'polite');
      } catch (error) {
        console.error('Failed to reset settings:', error);
      }
    }
  }, [resetToDefaults, config, disablePreview, announceToScreenReader]);

  const handleExport = useCallback(() => {
    const configJson = exportConfig();
    const blob = new Blob([configJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `opensvm-branding-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportConfig]);

  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const content = await file.text();
          await importConfig(content);
          announceToScreenReader('Configuration imported successfully', 'polite');
        } catch (error) {
          console.error('Failed to import configuration:', error);
          announceToScreenReader('Failed to import configuration', 'assertive');
        }
      }
    };
    input.click();
  }, [importConfig, announceToScreenReader]);

  // Check permissions after all hooks
  const canEdit = hasPermission('white_label', 'write') || hasPermission('admin', 'write');

  if (!canEdit) {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
          <Settings className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {t('rbac.accessDenied', 'Access Denied')}
        </h3>
        <p className="text-muted-foreground">
          {t('rbac.insufficientPermissions', "You don't have sufficient permissions to customize branding.")}
        </p>
      </div>
    );
  }

  const tabs = [
    { id: 'branding' as const, label: 'Branding', icon: <Image className="w-4 h-4" aria-label="Branding icon" /> },
    { id: 'colors' as const, label: 'Colors', icon: <Palette className="w-4 h-4" aria-label="Colors icon" /> },
    { id: 'typography' as const, label: 'Typography', icon: <Type className="w-4 h-4" aria-label="Typography icon" /> },
    { id: 'layout' as const, label: 'Layout', icon: <Layout className="w-4 h-4" aria-label="Layout icon" /> },
    { id: 'content' as const, label: 'Content', icon: <Brush className="w-4 h-4" aria-label="Content icon" /> },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {t('whiteLabel.customization', 'Brand Customization')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('whiteLabel.customizationDescription', 'Customize the appearance and branding of your OpenSVM instance')}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={previewMode ? disablePreview : () => enablePreview(tempConfig)}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          >
            {previewMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{previewMode ? 'Exit Preview' : 'Preview'}</span>
          </button>
          
          <button
            onClick={handleExport}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
          
          <button
            onClick={handleImport}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Import</span>
          </button>
        </div>
      </div>

      {/* Preview Banner */}
      {previewMode && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="text-blue-800 dark:text-blue-200 font-medium">
              Preview Mode Active
            </span>
            <span className="text-blue-600 dark:text-blue-400">
              - Changes are temporary until saved
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-2">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              icon={tab.icon}
              label={tab.label}
            />
          ))}
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-card border border-border rounded-lg p-6 space-y-6">
            {/* Branding Tab */}
            {activeTab === 'branding' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-4">
                    Company Information
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={tempConfig.branding.companyName}
                        onChange={(e) => updateTempBranding({ companyName: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>

                    <ImageUpload
                      label="Company Logo"
                      value={tempConfig.branding.companyLogo}
                      onChange={(value) => updateTempBranding({ companyLogo: value })}
                    />

                    <ImageUpload
                      label="Favicon"
                      value={tempConfig.branding.favicon}
                      onChange={(value) => updateTempBranding({ favicon: value })}
                      accept="image/x-icon,image/png"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Colors Tab */}
            {activeTab === 'colors' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-4">
                    Color Scheme
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ColorPicker
                      label="Primary Color"
                      value={tempConfig.branding.primaryColor}
                      onChange={(value) => updateTempBranding({ primaryColor: value })}
                    />
                    
                    <ColorPicker
                      label="Secondary Color"
                      value={tempConfig.branding.secondaryColor}
                      onChange={(value) => updateTempBranding({ secondaryColor: value })}
                    />
                    
                    <ColorPicker
                      label="Accent Color"
                      value={tempConfig.branding.accentColor}
                      onChange={(value) => updateTempBranding({ accentColor: value })}
                    />
                    
                    <ColorPicker
                      label="Background Color"
                      value={tempConfig.branding.backgroundColor}
                      onChange={(value) => updateTempBranding({ backgroundColor: value })}
                    />
                    
                    <ColorPicker
                      label="Text Color"
                      value={tempConfig.branding.textColor}
                      onChange={(value) => updateTempBranding({ textColor: value })}
                    />
                    
                    <ColorPicker
                      label="Border Color"
                      value={tempConfig.branding.borderColor}
                      onChange={(value) => updateTempBranding({ borderColor: value })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Typography Tab */}
            {activeTab === 'typography' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-4">
                    Typography Settings
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Font Family
                      </label>
                      <select
                        value={tempConfig.branding.fontFamily}
                        onChange={(e) => updateTempBranding({ fontFamily: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                      >
                        <option value="Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">Inter (Default)</option>
                        <option value="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">System Default</option>
                        <option value="'Helvetica Neue', Helvetica, Arial, sans-serif">Helvetica</option>
                        <option value="Georgia, 'Times New Roman', Times, serif">Georgia</option>
                        <option value="'Courier New', Courier, monospace">Courier New</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Heading Font Family (Optional)
                      </label>
                      <input
                        type="text"
                        value={tempConfig.branding.headingFontFamily || ''}
                        onChange={(e) => updateTempBranding({ headingFontFamily: e.target.value })}
                        placeholder="Same as font family if empty"
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Small Text
                        </label>
                        <input
                          type="text"
                          value={tempConfig.branding.fontSize.sm}
                          onChange={(e) => updateTempBranding({ 
                            fontSize: { ...tempConfig.branding.fontSize, sm: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Base Text
                        </label>
                        <input
                          type="text"
                          value={tempConfig.branding.fontSize.base}
                          onChange={(e) => updateTempBranding({ 
                            fontSize: { ...tempConfig.branding.fontSize, base: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Large Text
                        </label>
                        <input
                          type="text"
                          value={tempConfig.branding.fontSize.lg}
                          onChange={(e) => updateTempBranding({ 
                            fontSize: { ...tempConfig.branding.fontSize, lg: e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Heading Text
                        </label>
                        <input
                          type="text"
                          value={tempConfig.branding.fontSize['2xl']}
                          onChange={(e) => updateTempBranding({ 
                            fontSize: { ...tempConfig.branding.fontSize, '2xl': e.target.value }
                          })}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Layout Tab */}
            {activeTab === 'layout' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-4">
                    Layout Settings
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Border Radius
                      </label>
                      <input
                        type="text"
                        value={tempConfig.branding.borderRadius}
                        onChange={(e) => updateTempBranding({ borderRadius: e.target.value })}
                        placeholder="e.g., 0.5rem, 8px"
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>

                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-3">Spacing</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries(tempConfig.branding.spacing).map(([key, value]) => (
                          <div key={key}>
                            <label className="block text-sm font-medium text-foreground mb-2 capitalize">
                              {key}
                            </label>
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => updateTempBranding({
                                spacing: { ...tempConfig.branding.spacing, [key]: e.target.value }
                              })}
                              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-3">Shadows</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(tempConfig.branding.shadows).map(([key, value]) => (
                          <div key={key}>
                            <label className="block text-sm font-medium text-foreground mb-2 capitalize">
                              {key} Shadow
                            </label>
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => updateTempBranding({
                                shadows: { ...tempConfig.branding.shadows, [key]: e.target.value }
                              })}
                              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Content Tab */}
            {activeTab === 'content' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-4">
                    Content Customization
                  </h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Welcome Message
                      </label>
                      <input
                        type="text"
                        value={tempConfig.content.welcomeMessage || ''}
                        onChange={(e) => updateTempConfig({
                          content: { ...tempConfig.content, welcomeMessage: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Footer Text
                      </label>
                      <input
                        type="text"
                        value={tempConfig.content.footerText || ''}
                        onChange={(e) => updateTempConfig({
                          content: { ...tempConfig.content, footerText: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Copyright Text
                      </label>
                      <input
                        type="text"
                        value={tempConfig.content.copyrightText || ''}
                        onChange={(e) => updateTempConfig({
                          content: { ...tempConfig.content, copyrightText: e.target.value }
                        })}
                        className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Support URL
                        </label>
                        <input
                          type="url"
                          value={tempConfig.content.customSupportUrl || ''}
                          onChange={(e) => updateTempConfig({
                            content: { ...tempConfig.content, customSupportUrl: e.target.value }
                          })}
                          placeholder="https://support.yourcompany.com"
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Documentation URL
                        </label>
                        <input
                          type="url"
                          value={tempConfig.content.customDocumentationUrl || ''}
                          onChange={(e) => updateTempConfig({
                            content: { ...tempConfig.content, customDocumentationUrl: e.target.value }
                          })}
                          placeholder="https://docs.yourcompany.com"
                          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-lg font-medium text-foreground">Feature Toggles</h3>
                      
                      {Object.entries(tempConfig.features).map(([key, value]) => (
                        <label key={key} className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={value}
                            onChange={(e) => updateTempConfig({
                              features: { ...tempConfig.features, [key]: e.target.checked }
                            })}
                            className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary"
                          />
                          <span className="text-sm text-foreground capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-border">
              <button
                onClick={handleReset}
                className="inline-flex items-center space-x-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset to Defaults</span>
              </button>

              <div className="flex items-center space-x-3">
                {isModified && (
                  <button
                    onClick={discardChanges}
                    className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                  >
                    Discard Changes
                  </button>
                )}

                <button
                  onClick={saveChanges}
                  disabled={!isModified}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomizationPanel;
