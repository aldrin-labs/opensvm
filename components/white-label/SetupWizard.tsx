'use client';

import React, { useState, useCallback } from 'react';
import { 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Upload, 
  Palette, 
  Type, 
  Settings,
  Sparkles
} from 'lucide-react';
import { useWhiteLabel, BrandingConfig, CustomizationConfig } from '@/lib/white-label';
import { useI18n } from '@/lib/i18n';
import { useAccessibility } from '@/lib/accessibility';
import { ThemePreview } from './ThemePreview';

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const wizardSteps: WizardStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Set up your brand identity',
    icon: <Sparkles className="w-6 h-6" />
  },
  {
    id: 'branding',
    title: 'Company Branding',
    description: 'Add your logo and company name',
    icon: <Upload className="w-6 h-6" />
  },
  {
    id: 'colors',
    title: 'Color Scheme',
    description: 'Choose your brand colors',
    icon: <Palette className="w-6 h-6" />
  },
  {
    id: 'typography',
    title: 'Typography',
    description: 'Select fonts and sizes',
    icon: <Type className="w-6 h-6" />
  },
  {
    id: 'preview',
    title: 'Preview',
    description: 'Review your customizations',
    icon: <Settings className="w-6 h-6" />
  }
];

interface SetupWizardProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export function SetupWizard({ onComplete, onSkip }: SetupWizardProps) {
  const { config, updateConfig, enablePreview, disablePreview } = useWhiteLabel();
  const { t } = useI18n();
  const { announceToScreenReader } = useAccessibility();

  const [currentStep, setCurrentStep] = useState(0);
  const [tempConfig, setTempConfig] = useState<CustomizationConfig>(config);
  const [isCompleting, setIsCompleting] = useState(false);

  const updateTempBranding = useCallback((updates: Partial<BrandingConfig>) => {
    const newConfig = {
      ...tempConfig,
      branding: {
        ...tempConfig.branding,
        ...updates,
      },
    };
    setTempConfig(newConfig);
    enablePreview(newConfig);
  }, [tempConfig, enablePreview]);

  const updateTempConfig = useCallback((updates: Partial<CustomizationConfig>) => {
    const newConfig = {
      ...tempConfig,
      ...updates,
    };
    setTempConfig(newConfig);
    enablePreview(newConfig);
  }, [tempConfig, enablePreview]);

  const nextStep = useCallback(() => {
    if (currentStep < wizardSteps.length - 1) {
      const newStep = currentStep + 1;
      setCurrentStep(newStep);
      announceToScreenReader(`Step ${newStep + 1}: ${wizardSteps[newStep].title}`, 'polite');
    }
  }, [currentStep, announceToScreenReader]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
      announceToScreenReader(`Step ${newStep + 1}: ${wizardSteps[newStep].title}`, 'polite');
    }
  }, [currentStep, announceToScreenReader]);

  const handleComplete = useCallback(async () => {
    setIsCompleting(true);
    try {
      await updateConfig(tempConfig);
      disablePreview();
      announceToScreenReader('White-label setup completed successfully', 'polite');
      onComplete?.();
    } catch (error) {
      console.error('Failed to complete setup:', error);
      announceToScreenReader('Failed to complete setup', 'assertive');
    } finally {
      setIsCompleting(false);
    }
  }, [tempConfig, updateConfig, disablePreview, onComplete, announceToScreenReader]);

  const handleSkip = useCallback(() => {
    disablePreview();
    onSkip?.();
  }, [disablePreview, onSkip]);

  const handleImageUpload = useCallback(async (file: File, field: 'companyLogo' | 'favicon') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        updateTempBranding({ [field]: e.target.result as string });
      }
    };
    reader.readAsDataURL(file);
  }, [updateTempBranding]);

  const renderStepContent = () => {
    const step = wizardSteps[currentStep];

    switch (step.id) {
      case 'welcome':
        return (
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Welcome to White-Label Setup
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Let's customize OpenSVM with your brand identity. This process will take just a few minutes
                and you can always change these settings later.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-sm text-muted-foreground">
                <strong>What you'll customize:</strong>
              </p>
              <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                <li>• Company logo and branding</li>
                <li>• Color scheme and theme</li>
                <li>• Typography and fonts</li>
                <li>• Content and messaging</li>
              </ul>
            </div>
          </div>
        );

      case 'branding':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                Company Branding
              </h2>
              <p className="text-muted-foreground">
                Add your company name and logo to personalize the interface.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Company Name
                </label>
                <input
                  type="text"
                  value={tempConfig.branding.companyName}
                  onChange={(e) => updateTempBranding({ companyName: e.target.value })}
                  placeholder="Enter your company name"
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Company Logo
                </label>
                <div className="flex items-center space-x-4">
                  {tempConfig.branding.companyLogo && (
                    <div className="w-16 h-16 border border-border rounded-lg overflow-hidden bg-muted">
                      <img 
                        src={tempConfig.branding.companyLogo}
                        alt="Logo preview"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, 'companyLogo');
                      }}
                      className="hidden"
                      id="logo-upload"
                    />
                    <label
                      htmlFor="logo-upload"
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 cursor-pointer transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload Logo</span>
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Recommended: PNG or SVG, max 2MB
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'colors':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                Color Scheme
              </h2>
              <p className="text-muted-foreground">
                Choose colors that match your brand identity.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Primary Color
                </label>
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-8 h-8 rounded-md border border-border cursor-pointer"
                    style={{ backgroundColor: tempConfig.branding.primaryColor }}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'color';
                      input.value = tempConfig.branding.primaryColor;
                      input.onchange = (e) => 
                        updateTempBranding({ primaryColor: (e.target as HTMLInputElement).value });
                      input.click();
                    }}
                  />
                  <input
                    type="text"
                    value={tempConfig.branding.primaryColor}
                    onChange={(e) => updateTempBranding({ primaryColor: e.target.value })}
                    className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Secondary Color
                </label>
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-8 h-8 rounded-md border border-border cursor-pointer"
                    style={{ backgroundColor: tempConfig.branding.secondaryColor }}
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'color';
                      input.value = tempConfig.branding.secondaryColor;
                      input.onchange = (e) => 
                        updateTempBranding({ secondaryColor: (e.target as HTMLInputElement).value });
                      input.click();
                    }}
                  />
                  <input
                    type="text"
                    value={tempConfig.branding.secondaryColor}
                    onChange={(e) => updateTempBranding({ secondaryColor: e.target.value })}
                    className="flex-1 px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-medium text-foreground mb-2">Color Presets</h3>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { primary: '#3b82f6', secondary: '#e5e7eb', name: 'Blue' },
                  { primary: '#10b981', secondary: '#f3f4f6', name: 'Green' },
                  { primary: '#8b5cf6', secondary: '#f9fafb', name: 'Purple' },
                  { primary: '#f59e0b', secondary: '#f1f5f9', name: 'Orange' },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => updateTempBranding({
                      primaryColor: preset.primary,
                      secondaryColor: preset.secondary,
                    })}
                    className="p-2 rounded-md border border-border hover:bg-muted/50 transition-colors"
                    title={preset.name}
                  >
                    <div className="flex space-x-1">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: preset.primary }}
                      />
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: preset.secondary }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 'typography':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                Typography
              </h2>
              <p className="text-muted-foreground">
                Select fonts that represent your brand.
              </p>
            </div>

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
                  <option value="Inter, system-ui, -apple-system, sans-serif">Inter (Recommended)</option>
                  <option value="system-ui, -apple-system, sans-serif">System Default</option>
                  <option value="'Helvetica Neue', Helvetica, Arial, sans-serif">Helvetica</option>
                  <option value="Georgia, 'Times New Roman', Times, serif">Georgia</option>
                  <option value="'SF Pro Display', -apple-system, sans-serif">SF Pro Display</option>
                </select>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <h3 className="font-medium text-foreground mb-3">Font Preview</h3>
                <div className="space-y-2" style={{ fontFamily: tempConfig.branding.fontFamily }}>
                  <h1 className="text-2xl font-bold">The quick brown fox</h1>
                  <h2 className="text-xl font-semibold">jumps over the lazy dog</h2>
                  <p className="text-base">This is how your content will look with the selected font.</p>
                  <p className="text-sm text-muted-foreground">
                    1234567890 !@#$%^&*()
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 'preview':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                Preview Your Customization
              </h2>
              <p className="text-muted-foreground">
                Here's how your customized OpenSVM will look.
              </p>
            </div>

            <ThemePreview />

            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-medium text-foreground mb-2">
                Configuration Summary
              </h3>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Company Name:</dt>
                  <dd className="text-foreground font-medium">{tempConfig.branding.companyName}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Primary Color:</dt>
                  <dd className="flex items-center space-x-2">
                    <div 
                      className="w-4 h-4 rounded border"
                      style={{ backgroundColor: tempConfig.branding.primaryColor }}
                    />
                    <span className="text-foreground font-mono">{tempConfig.branding.primaryColor}</span>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Font Family:</dt>
                  <dd className="text-foreground font-medium">
                    {tempConfig.branding.fontFamily.split(',')[0].replace(/['"]/g, '')}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">
            Step {currentStep + 1} of {wizardSteps.length}
          </span>
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip setup
          </button>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / wizardSteps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        {wizardSteps.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
              index === currentStep
                ? 'bg-primary text-primary-foreground'
                : index < currentStep
                ? 'bg-green-500 text-white'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {index < currentStep ? (
              <Check className="w-4 h-4" />
            ) : (
              <div className="w-4 h-4">{step.icon}</div>
            )}
            <span className="text-sm font-medium hidden sm:block">
              {step.title}
            </span>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-card border border-border rounded-lg p-8 mb-6 min-h-96">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Previous</span>
        </button>

        <div className="flex items-center space-x-3">
          {currentStep === wizardSteps.length - 1 ? (
            <button
              onClick={handleComplete}
              disabled={isCompleting}
              className="inline-flex items-center space-x-2 px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>{isCompleting ? 'Completing...' : 'Complete Setup'}</span>
            </button>
          ) : (
            <button
              onClick={nextStep}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default SetupWizard;