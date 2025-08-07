'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Download,
  FileText,
  Image,
  Table,
  Settings,
  X,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Eye,
  Save,
  Trash2,
  Copy
} from 'lucide-react';
import { useExport, ExportConfig, ExportData, ExportFormat, ExportJob } from '@/lib/export';
import { useI18n } from '@/lib/i18n';
import { useRBAC } from '@/lib/rbac';
import { useAccessibility } from '@/lib/accessibility';

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: ExportData;
  title?: string;
  defaultFormat?: ExportFormat;
  onExportComplete?: (jobId: string) => void;
}

export function ExportDialog({
  isOpen,
  onClose,
  data,
  title = 'Export Data',
  defaultFormat = 'csv',
  onExportComplete
}: ExportDialogProps) {
  const { 
    exportData, 
    getTemplates, 
    saveTemplate, 
    validateConfig, 
    estimateFileSize, 
    getSupportedFormats,
    getFormatInfo 
  } = useExport();
  const { t } = useI18n();
  const { hasPermission } = useRBAC();
  const { announceToScreenReader } = useAccessibility();

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(defaultFormat);
  const [config, setConfig] = useState<Partial<ExportConfig>>({
    format: defaultFormat,
    filename: '',
    timestamp: true,
  });
  const [isExporting, setIsExporting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [estimatedSize, setEstimatedSize] = useState<number>(0);
  const [showTemplates, setShowTemplates] = useState(false);

  const supportedFormats = getSupportedFormats();
  const templates = getTemplates();
  const canExport = hasPermission('export', 'read') || hasPermission('data', 'read');

  // Update config when format changes
  useEffect(() => {
    const baseConfig: Partial<ExportConfig> = {
      format: selectedFormat,
      filename: config.filename || `export-${Date.now()}`,
      timestamp: config.timestamp ?? true,
    };

    // Add format-specific defaults
    switch (selectedFormat) {
      case 'csv':
        setConfig({
          ...baseConfig,
          delimiter: ',',
          includeHeaders: true,
          encoding: 'utf-8',
        });
        break;
      case 'pdf':
        setConfig({
          ...baseConfig,
          orientation: 'portrait',
          pageSize: 'a4',
          includeCharts: true,
          includeImages: true,
        });
        break;
      case 'json':
        setConfig({
          ...baseConfig,
          pretty: true,
          includeMetadata: true,
          dateFormat: 'iso',
        });
        break;
      case 'xlsx':
        setConfig({
          ...baseConfig,
          sheetName: 'Data',
          includeHeaders: true,
          autoFitColumns: true,
        });
        break;
      default:
        setConfig(baseConfig);
    }
  }, [selectedFormat, config.filename, config.timestamp]);

  // Validate config and estimate size
  useEffect(() => {
    const errors = validateConfig(config as ExportConfig);
    setValidationErrors(errors);
    setEstimatedSize(estimateFileSize(data, selectedFormat));
  }, [config, data, selectedFormat, validateConfig, estimateFileSize]);

  const handleExport = useCallback(async () => {
    if (!canExport) {
      announceToScreenReader('Export permission denied', 'assertive');
      return;
    }

    if (validationErrors.length > 0) {
      announceToScreenReader('Please fix validation errors before exporting', 'assertive');
      return;
    }

    setIsExporting(true);
    try {
      const jobId = await exportData(data, config as ExportConfig, title);
      announceToScreenReader('Export started successfully', 'polite');
      onExportComplete?.(jobId);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      announceToScreenReader('Export failed', 'assertive');
    } finally {
      setIsExporting(false);
    }
  }, [canExport, validationErrors, data, config, title, exportData, onExportComplete, onClose, announceToScreenReader]);

  const handleSaveTemplate = useCallback(async () => {
    const templateName = prompt('Enter template name:');
    if (templateName) {
      try {
        await saveTemplate(templateName, config as ExportConfig);
        announceToScreenReader('Template saved successfully', 'polite');
      } catch (error) {
        console.error('Failed to save template:', error);
        announceToScreenReader('Failed to save template', 'assertive');
      }
    }
  }, [config, saveTemplate, announceToScreenReader]);

  const updateConfig = useCallback((updates: Partial<ExportConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderFormatSpecificOptions = () => {
    switch (selectedFormat) {
      case 'csv':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Delimiter
                </label>
                <select
                  value={(config as any).delimiter || ','}
                  onChange={(e) => updateConfig({ delimiter: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value=",">Comma (,)</option>
                  <option value=";">Semicolon (;)</option>
                  <option value="\t">Tab</option>
                  <option value="|">Pipe (|)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Encoding
                </label>
                <select
                  value={(config as any).encoding || 'utf-8'}
                  onChange={(e) => updateConfig({ encoding: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="utf-8">UTF-8</option>
                  <option value="latin1">Latin-1</option>
                  <option value="ascii">ASCII</option>
                </select>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={(config as any).includeHeaders ?? true}
                  onChange={(e) => updateConfig({ includeHeaders: e.target.checked })}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-foreground">Include headers</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={(config as any).quoteStrings ?? true}
                  onChange={(e) => updateConfig({ quoteStrings: e.target.checked })}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-foreground">Quote strings</span>
              </label>
            </div>
          </div>
        );

      case 'pdf':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Orientation
                </label>
                <select
                  value={(config as any).orientation || 'portrait'}
                  onChange={(e) => updateConfig({ orientation: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Page Size
                </label>
                <select
                  value={(config as any).pageSize || 'a4'}
                  onChange={(e) => updateConfig({ pageSize: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="a4">A4</option>
                  <option value="a3">A3</option>
                  <option value="letter">Letter</option>
                  <option value="legal">Legal</option>
                </select>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={(config as any).includeCharts ?? true}
                  onChange={(e) => updateConfig({ includeCharts: e.target.checked })}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-foreground">Include charts</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={(config as any).includeImages ?? true}
                  onChange={(e) => updateConfig({ includeImages: e.target.checked })}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-foreground">Include images</span>
              </label>
            </div>
          </div>
        );

      case 'json':
        return (
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={(config as any).pretty ?? true}
                  onChange={(e) => updateConfig({ pretty: e.target.checked })}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-foreground">Pretty format</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={(config as any).includeMetadata ?? true}
                  onChange={(e) => updateConfig({ includeMetadata: e.target.checked })}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-foreground">Include metadata</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Date Format
              </label>
              <select
                value={(config as any).dateFormat || 'iso'}
                onChange={(e) => updateConfig({ dateFormat: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="iso">ISO 8601</option>
                <option value="timestamp">Unix Timestamp</option>
                <option value="custom">Custom Format</option>
              </select>
            </div>
          </div>
        );

      case 'xlsx':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Sheet Name
              </label>
              <input
                type="text"
                value={(config as any).sheetName || 'Data'}
                onChange={(e) => updateConfig({ sheetName: e.target.value })}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={(config as any).includeHeaders ?? true}
                  onChange={(e) => updateConfig({ includeHeaders: e.target.checked })}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-foreground">Include headers</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={(config as any).autoFitColumns ?? true}
                  onChange={(e) => updateConfig({ autoFitColumns: e.target.checked })}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary"
                />
                <span className="text-sm text-foreground">Auto-fit columns</span>
              </label>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative bg-background border border-border rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Export {data.rows.length} rows to your preferred format
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-muted transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-96">
          <div className="space-y-6">
            {/* Format Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                Export Format
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {supportedFormats.map((format) => {
                  const formatInfo = getFormatInfo(format);
                  const Icon = format === 'pdf' ? FileText : 
                              format.includes('csv') || format.includes('xlsx') ? Table : 
                              format.includes('png') || format.includes('svg') ? Image : 
                              FileText;
                  
                  return (
                    <button
                      key={format}
                      onClick={() => setSelectedFormat(format)}
                      className={`p-3 border rounded-lg text-left transition-colors ${
                        selectedFormat === format
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      <Icon className="w-5 h-5 mb-2 text-muted-foreground" />
                      <div className="text-sm font-medium text-foreground">
                        {formatInfo.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatInfo.extension}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Basic Options */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Filename
                </label>
                <input
                  type="text"
                  value={config.filename || ''}
                  onChange={(e) => updateConfig({ filename: e.target.value })}
                  placeholder={`export-${Date.now()}`}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="timestamp"
                  checked={config.timestamp ?? true}
                  onChange={(e) => updateConfig({ timestamp: e.target.checked })}
                  className="w-4 h-4 text-primary border-border rounded focus:ring-2 focus:ring-primary"
                />
                <label htmlFor="timestamp" className="text-sm text-foreground">
                  Add timestamp to filename
                </label>
              </div>
            </div>

            {/* Format-specific Options */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-foreground">
                  Format Options
                </label>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs text-primary hover:text-primary/80"
                >
                  {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
                </button>
              </div>
              
              {renderFormatSpecificOptions()}
            </div>

            {/* File Info */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-foreground mb-2">Export Information</h3>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Rows:</dt>
                  <dd className="text-foreground">{data.rows.length.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Columns:</dt>
                  <dd className="text-foreground">{data.headers?.length || 0}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Estimated Size:</dt>
                  <dd className="text-foreground">{formatBytes(estimatedSize)}</dd>
                </div>
              </dl>
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-medium text-destructive">
                    Configuration Issues
                  </span>
                </div>
                <ul className="text-sm text-destructive space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-6 border-t border-border bg-muted/50">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSaveTemplate}
              className="inline-flex items-center space-x-2 px-3 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
              title="Save as template"
            >
              <Save className="w-4 h-4" />
              <span>Save Template</span>
            </button>
            
            {templates.length > 0 && (
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="inline-flex items-center space-x-2 px-3 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
                title="Load template"
              >
                <Settings className="w-4 h-4" />
                <span>Templates</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
            
            <button
              onClick={handleExport}
              disabled={isExporting || validationErrors.length > 0 || !canExport}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExportDialog;
