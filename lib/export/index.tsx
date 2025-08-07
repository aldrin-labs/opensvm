'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useRBAC } from '@/lib/rbac';
import { useI18n } from '@/lib/i18n';
import { useErrorHandling } from '@/lib/error-handling';

// Export format types
export type ExportFormat = 'pdf' | 'csv' | 'xlsx' | 'json' | 'xml' | 'html' | 'png' | 'svg';

export type ExportStatus = 'idle' | 'preparing' | 'exporting' | 'completed' | 'error';

// Export configuration interfaces
export interface BaseExportConfig {
  filename?: string;
  timestamp?: boolean;
  metadata?: Record<string, any>;
  compression?: boolean;
  encryption?: {
    enabled: boolean;
    password?: string;
    algorithm?: 'aes-256' | 'aes-128';
  };
}

export interface PDFExportConfig extends BaseExportConfig {
  format: 'pdf';
  orientation?: 'portrait' | 'landscape';
  pageSize?: 'a4' | 'a3' | 'letter' | 'legal';
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  headerFooter?: {
    header?: string;
    footer?: string;
    showPageNumbers?: boolean;
    showDate?: boolean;
  };
  styles?: {
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    backgroundColor?: string;
  };
  includeCharts?: boolean;
  includeImages?: boolean;
  quality?: 'low' | 'medium' | 'high';
}

export interface CSVExportConfig extends BaseExportConfig {
  format: 'csv';
  delimiter?: ',' | ';' | '\t' | '|';
  encoding?: 'utf-8' | 'latin1' | 'ascii';
  includeHeaders?: boolean;
  quoteStrings?: boolean;
  dateFormat?: string;
  numberFormat?: {
    decimalSeparator: string;
    thousandsSeparator: string;
    precision?: number;
  };
}

export interface XLSXExportConfig extends BaseExportConfig {
  format: 'xlsx';
  sheetName?: string;
  includeHeaders?: boolean;
  autoFitColumns?: boolean;
  freezeRows?: number;
  freezeColumns?: number;
  styles?: {
    headerStyle?: ExcelCellStyle;
    dataStyle?: ExcelCellStyle;
    alternatingRows?: boolean;
  };
  charts?: ExcelChart[];
  protection?: {
    password?: string;
    allowEditing?: boolean;
    allowFormatting?: boolean;
  };
}

export interface JSONExportConfig extends BaseExportConfig {
  format: 'json';
  pretty?: boolean;
  includeMetadata?: boolean;
  dateFormat?: 'iso' | 'timestamp' | 'custom';
  customDateFormat?: string;
  excludeFields?: string[];
  flatten?: boolean;
}

export interface ImageExportConfig extends BaseExportConfig {
  format: 'png' | 'svg';
  width?: number;
  height?: number;
  scale?: number;
  backgroundColor?: string;
  transparent?: boolean;
  quality?: number; // For PNG
}

export type ExportConfig = 
  | PDFExportConfig 
  | CSVExportConfig 
  | XLSXExportConfig 
  | JSONExportConfig 
  | ImageExportConfig;

// Excel-specific types
interface ExcelCellStyle {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  backgroundColor?: string;
  border?: boolean;
  alignment?: 'left' | 'center' | 'right';
}

interface ExcelChart {
  type: 'line' | 'bar' | 'pie' | 'scatter';
  title: string;
  dataRange: string;
  position: { x: number; y: number; width: number; height: number };
}

// Export data types
export interface ExportData {
  headers?: string[];
  rows: any[][];
  metadata?: Record<string, any>;
  charts?: ChartData[];
  images?: ImageData[];
}

interface ChartData {
  id: string;
  type: string;
  title: string;
  data: any;
  options?: any;
}

interface ImageData {
  id: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

// Export result
export interface ExportResult {
  success: boolean;
  url?: string;
  filename?: string;
  size?: number;
  format: ExportFormat;
  downloadUrl?: string;
  error?: string;
  metadata?: Record<string, any>;
}

// Export job
export interface ExportJob {
  id: string;
  name: string;
  format: ExportFormat;
  config: ExportConfig;
  data: ExportData;
  status: ExportStatus;
  progress?: number;
  result?: ExportResult;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdBy: string;
  tenantId?: string;
}

// Export context
interface ExportContextType {
  // State
  jobs: ExportJob[];
  activeJobs: ExportJob[];
  completedJobs: ExportJob[];
  
  // Export operations
  exportData: (data: ExportData, config: ExportConfig, name?: string) => Promise<string>;
  exportChart: (chartId: string, config: ImageExportConfig) => Promise<ExportResult>;
  exportTable: (selector: string, config: ExportConfig) => Promise<ExportResult>;
  exportPage: (config: PDFExportConfig | ImageExportConfig) => Promise<ExportResult>;
  
  // Job management
  getJob: (jobId: string) => ExportJob | undefined;
  cancelJob: (jobId: string) => Promise<void>;
  retryJob: (jobId: string) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  clearCompletedJobs: () => Promise<void>;
  
  // Templates
  saveTemplate: (name: string, config: ExportConfig) => Promise<void>;
  getTemplates: () => ExportTemplate[];
  deleteTemplate: (templateId: string) => Promise<void>;
  
  // Bulk operations
  exportMultiple: (exports: Array<{ data: ExportData; config: ExportConfig; name: string }>) => Promise<string[]>;
  createZipArchive: (jobIds: string[], archiveName?: string) => Promise<ExportResult>;
  
  // Utilities
  validateConfig: (config: ExportConfig) => string[];
  estimateFileSize: (data: ExportData, format: ExportFormat) => number;
  getSupportedFormats: () => ExportFormat[];
  getFormatInfo: (format: ExportFormat) => FormatInfo;
}

interface ExportTemplate {
  id: string;
  name: string;
  description?: string;
  format: ExportFormat;
  config: ExportConfig;
  createdAt: Date;
  createdBy: string;
  tenantId?: string;
  isPublic?: boolean;
}

interface FormatInfo {
  name: string;
  extension: string;
  mimeType: string;
  description: string;
  maxSize?: number;
  features: string[];
}

const ExportContext = createContext<ExportContextType | undefined>(undefined);

// Export service
class ExportService {
  private static jobs = new Map<string, ExportJob>();
  private static templates = new Map<string, ExportTemplate>();
  private static listeners = new Set<(jobs: ExportJob[]) => void>();

  // Job management
  static createJob(
    name: string,
    format: ExportFormat,
    config: ExportConfig,
    data: ExportData,
    userId: string,
    tenantId?: string
  ): string {
    const id = `export-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const job: ExportJob = {
      id,
      name,
      format,
      config,
      data,
      status: 'idle',
      createdAt: new Date(),
      createdBy: userId,
      tenantId,
    };
    
    this.jobs.set(id, job);
    this.notifyListeners();
    
    return id;
  }

  static updateJobStatus(jobId: string, status: ExportStatus, progress?: number, error?: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    job.status = status;
    if (progress !== undefined) job.progress = progress;
    if (error) job.error = error;
    
    if (status === 'exporting' && !job.startedAt) {
      job.startedAt = new Date();
    } else if (status === 'completed' || status === 'error') {
      job.completedAt = new Date();
    }
    
    this.notifyListeners();
  }

  static completeJob(jobId: string, result: ExportResult): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    
    job.status = 'completed';
    job.result = result;
    job.completedAt = new Date();
    
    this.notifyListeners();
  }

  static getJob(jobId: string): ExportJob | undefined {
    return this.jobs.get(jobId);
  }

  static getAllJobs(): ExportJob[] {
    return Array.from(this.jobs.values());
  }

  static getActiveJobs(): ExportJob[] {
    return this.getAllJobs().filter(job => 
      job.status === 'preparing' || job.status === 'exporting'
    );
  }

  static getCompletedJobs(): ExportJob[] {
    return this.getAllJobs().filter(job => 
      job.status === 'completed' || job.status === 'error'
    );
  }

  static deleteJob(jobId: string): void {
    this.jobs.delete(jobId);
    this.notifyListeners();
  }

  static clearCompletedJobs(): void {
    const completedJobs = this.getCompletedJobs();
    completedJobs.forEach(job => this.jobs.delete(job.id));
    this.notifyListeners();
  }

  // Templates
  static saveTemplate(template: Omit<ExportTemplate, 'id' | 'createdAt'>): string {
    const id = `template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullTemplate: ExportTemplate = {
      ...template,
      id,
      createdAt: new Date(),
    };
    
    this.templates.set(id, fullTemplate);
    this.persistTemplates();
    
    return id;
  }

  static getTemplates(): ExportTemplate[] {
    return Array.from(this.templates.values());
  }

  static deleteTemplate(templateId: string): void {
    this.templates.delete(templateId);
    this.persistTemplates();
  }

  // Persistence
  private static async persistTemplates(): Promise<void> {
    try {
      const templatesData = Array.from(this.templates.values()).map(template => ({
        ...template,
        createdAt: template.createdAt.toISOString(),
      }));
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('opensvm_export_templates', JSON.stringify(templatesData));
      }
    } catch (error) {
      console.error('Failed to persist export templates:', error);
    }
  }

  private static async loadTemplates(): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('opensvm_export_templates');
        if (stored) {
          const templatesData = JSON.parse(stored);
          this.templates.clear();
          templatesData.forEach((data: any) => {
            this.templates.set(data.id, {
              ...data,
              createdAt: new Date(data.createdAt),
            });
          });
        }
      }
    } catch (error) {
      console.error('Failed to load export templates:', error);
    }
  }

  private static notifyListeners(): void {
    const jobs = this.getAllJobs();
    this.listeners.forEach(listener => {
      try {
        listener(jobs);
      } catch (error) {
        console.error('Export listener error:', error);
      }
    });
  }

  static subscribe(listener: (jobs: ExportJob[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  static async initialize(): Promise<void> {
    await this.loadTemplates();
    this.notifyListeners();
  }
}

// Export engines for different formats
class ExportEngines {
  // CSV Export
  static async exportCSV(data: ExportData, config: CSVExportConfig): Promise<Blob> {
    const delimiter = config.delimiter || ',';
    const includeHeaders = config.includeHeaders ?? true;
    const quoteStrings = config.quoteStrings ?? true;
    
    let csvContent = '';
    
    // Add headers
    if (includeHeaders && data.headers) {
      csvContent += data.headers.map(header => 
        quoteStrings ? `"${header.replace(/"/g, '""')}"` : header
      ).join(delimiter) + '\n';
    }
    
    // Add data rows
    data.rows.forEach(row => {
      const csvRow = row.map(cell => {
        let value = String(cell ?? '');
        
        // Format dates
        if (cell instanceof Date && config.dateFormat) {
          value = this.formatDate(cell, config.dateFormat);
        }
        
        // Format numbers
        if (typeof cell === 'number' && config.numberFormat) {
          value = this.formatNumber(cell, config.numberFormat);
        }
        
        // Quote strings if needed
        if (quoteStrings && (typeof cell === 'string' || value.includes(delimiter))) {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        
        return value;
      }).join(delimiter);
      
      csvContent += csvRow + '\n';
    });
    
    return new Blob([csvContent], { 
      type: 'text/csv;charset=utf-8' 
    });
  }

  // PDF Export (using jsPDF)
  static async exportPDF(data: ExportData, config: PDFExportConfig): Promise<Blob> {
    // This would integrate with jsPDF library
    // For now, return a placeholder
    const pdfContent = `%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n`;
    
    return new Blob([pdfContent], { 
      type: 'application/pdf' 
    });
  }

  // JSON Export
  static async exportJSON(data: ExportData, config: JSONExportConfig): Promise<Blob> {
    const includeMetadata = config.includeMetadata ?? true;
    const pretty = config.pretty ?? true;
    
    let jsonData: any = {
      headers: data.headers,
      rows: data.rows,
    };
    
    if (includeMetadata && data.metadata) {
      jsonData.metadata = data.metadata;
    }
    
    // Exclude specified fields
    if (config.excludeFields?.length) {
      jsonData = this.excludeFields(jsonData, config.excludeFields);
    }
    
    // Format dates
    if (config.dateFormat && config.dateFormat !== 'iso') {
      jsonData = this.formatDatesInObject(jsonData, config.dateFormat, config.customDateFormat);
    }
    
    const jsonString = JSON.stringify(jsonData, null, pretty ? 2 : undefined);
    
    return new Blob([jsonString], { 
      type: 'application/json;charset=utf-8' 
    });
  }

  // Utility methods
  private static formatDate(date: Date, format: string): string {
    switch (format) {
      case 'iso':
        return date.toISOString();
      case 'timestamp':
        return date.getTime().toString();
      case 'locale':
        return date.toLocaleString();
      default:
        return date.toISOString();
    }
  }

  private static formatNumber(num: number, format: CSVExportConfig['numberFormat']): string {
    if (!format) return num.toString();
    
    let formatted = format.precision !== undefined 
      ? num.toFixed(format.precision)
      : num.toString();
    
    // Replace decimal separator
    if (format.decimalSeparator !== '.') {
      formatted = formatted.replace('.', format.decimalSeparator);
    }
    
    // Add thousands separator
    if (format.thousandsSeparator) {
      const parts = formatted.split(format.decimalSeparator);
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, format.thousandsSeparator);
      formatted = parts.join(format.decimalSeparator);
    }
    
    return formatted;
  }

  private static excludeFields(obj: any, fields: string[]): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.excludeFields(item, fields));
    } else if (obj && typeof obj === 'object') {
      const filtered: any = {};
      Object.keys(obj).forEach(key => {
        if (!fields.includes(key)) {
          filtered[key] = this.excludeFields(obj[key], fields);
        }
      });
      return filtered;
    }
    return obj;
  }

  private static formatDatesInObject(obj: any, format: string, customFormat?: string): any {
    if (obj instanceof Date) {
      return this.formatDate(obj, customFormat || format);
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.formatDatesInObject(item, format, customFormat));
    } else if (obj && typeof obj === 'object') {
      const formatted: any = {};
      Object.keys(obj).forEach(key => {
        formatted[key] = this.formatDatesInObject(obj[key], format, customFormat);
      });
      return formatted;
    }
    return obj;
  }
}

// Export provider component
export function ExportProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  
  // Handle RBAC context safely - wrap in try-catch to handle SSR
  let currentUser = null;
  let currentTenant = null;
  try {
    const rbac = useRBAC();
    currentUser = rbac.currentUser;
    currentTenant = rbac.currentTenant;
  } catch (error) {
    // RBAC context not available during SSR, continue with null values
    currentUser = null;
    currentTenant = null;
  }
  
  const { reportError } = useErrorHandling();
  const { t } = useI18n();

  // Initialize export service
  useEffect(() => {
    ExportService.initialize();
    const unsubscribe = ExportService.subscribe(setJobs);
    return unsubscribe;
  }, []);

  const activeJobs = jobs.filter(job => 
    job.status === 'preparing' || job.status === 'exporting'
  );
  
  const completedJobs = jobs.filter(job => 
    job.status === 'completed' || job.status === 'error'
  );

  const exportData = useCallback(async (
    data: ExportData, 
    config: ExportConfig, 
    name?: string
  ): Promise<string> => {
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    try {
      // Create export job
      const jobId = ExportService.createJob(
        name || `Export ${new Date().toLocaleDateString()}`,
        config.format,
        config,
        data,
        currentUser.id,
        currentTenant?.id
      );

      // Update status to preparing
      ExportService.updateJobStatus(jobId, 'preparing');

      // Start export process
      setTimeout(async () => {
        try {
          ExportService.updateJobStatus(jobId, 'exporting', 0);

          let blob: Blob;
          let filename = config.filename || `export-${Date.now()}`;

          // Export based on format
          switch (config.format) {
            case 'csv':
              blob = await ExportEngines.exportCSV(data, config as CSVExportConfig);
              if (!filename.endsWith('.csv')) filename += '.csv';
              break;
              
            case 'json':
              blob = await ExportEngines.exportJSON(data, config as JSONExportConfig);
              if (!filename.endsWith('.json')) filename += '.json';
              break;
              
            case 'pdf':
              blob = await ExportEngines.exportPDF(data, config as PDFExportConfig);
              if (!filename.endsWith('.pdf')) filename += '.pdf';
              break;
              
            default:
              throw new Error(`Unsupported export format: ${config.format}`);
          }

          // Create download URL
          const url = URL.createObjectURL(blob);
          
          // Complete the job
          const result: ExportResult = {
            success: true,
            url,
            filename,
            size: blob.size,
            format: config.format,
            downloadUrl: url,
          };
          
          ExportService.completeJob(jobId, result);
          
        } catch (error) {
          ExportService.updateJobStatus(jobId, 'error', undefined, (error as Error).message);
          reportError(error as Error, { component: 'ExportProvider', jobId });
        }
      }, 100);

      return jobId;
      
    } catch (error) {
      reportError(error as Error, { component: 'ExportProvider', action: 'exportData' });
      throw error;
    }
  }, [currentUser, currentTenant, reportError]);

  const exportChart = useCallback(async (
    chartId: string, 
    config: ImageExportConfig
  ): Promise<ExportResult> => {
    // Implementation would capture chart as image
    return {
      success: false,
      format: config.format,
      error: 'Not implemented',
    };
  }, []);

  const exportTable = useCallback(async (
    selector: string, 
    config: ExportConfig
  ): Promise<ExportResult> => {
    // Implementation would extract table data and export
    return {
      success: false,
      format: config.format,
      error: 'Not implemented',
    };
  }, []);

  const exportPage = useCallback(async (
    config: PDFExportConfig | ImageExportConfig
  ): Promise<ExportResult> => {
    // Implementation would capture entire page
    return {
      success: false,
      format: config.format,
      error: 'Not implemented',
    };
  }, []);

  const getJob = useCallback((jobId: string) => {
    return ExportService.getJob(jobId);
  }, []);

  const cancelJob = useCallback(async (jobId: string) => {
    const job = ExportService.getJob(jobId);
    if (job && (job.status === 'preparing' || job.status === 'exporting')) {
      ExportService.updateJobStatus(jobId, 'error', undefined, 'Cancelled by user');
    }
  }, []);

  const retryJob = useCallback(async (jobId: string) => {
    const job = ExportService.getJob(jobId);
    if (job && job.status === 'error') {
      // Restart the export
      await exportData(job.data, job.config, job.name);
      // Delete the old job
      ExportService.deleteJob(jobId);
    }
  }, [exportData]);

  const deleteJob = useCallback(async (jobId: string) => {
    ExportService.deleteJob(jobId);
  }, []);

  const clearCompletedJobs = useCallback(async () => {
    ExportService.clearCompletedJobs();
  }, []);

  // Template operations (placeholder implementations)
  const saveTemplate = useCallback(async (name: string, config: ExportConfig) => {
    if (!currentUser) throw new Error('User not authenticated');
    
    ExportService.saveTemplate({
      name,
      format: config.format,
      config,
      createdBy: currentUser.id,
      tenantId: currentTenant?.id,
    });
  }, [currentUser, currentTenant]);

  const getTemplates = useCallback(() => {
    return ExportService.getTemplates();
  }, []);

  const deleteTemplate = useCallback(async (templateId: string) => {
    ExportService.deleteTemplate(templateId);
  }, []);

  // Utility functions (placeholder implementations)
  const exportMultiple = useCallback(async (
    exports: Array<{ data: ExportData; config: ExportConfig; name: string }>
  ): Promise<string[]> => {
    const jobIds = await Promise.all(
      exports.map(exp => exportData(exp.data, exp.config, exp.name))
    );
    return jobIds;
  }, [exportData]);

  const createZipArchive = useCallback(async (
    jobIds: string[], 
    archiveName?: string
  ): Promise<ExportResult> => {
    return {
      success: false,
      format: 'json',
      error: 'Not implemented',
    };
  }, []);

  const validateConfig = useCallback((config: ExportConfig): string[] => {
    const errors: string[] = [];
    
    if (!config.format) {
      errors.push('Export format is required');
    }
    
    // Format-specific validation
    switch (config.format) {
      case 'csv':
        const csvConfig = config as CSVExportConfig;
        if (csvConfig.delimiter && ![',' , ';', '\t', '|'].includes(csvConfig.delimiter)) {
          errors.push('Invalid CSV delimiter');
        }
        break;
        
      case 'pdf':
        const pdfConfig = config as PDFExportConfig;
        if (pdfConfig.pageSize && !['a4', 'a3', 'letter', 'legal'].includes(pdfConfig.pageSize)) {
          errors.push('Invalid PDF page size');
        }
        break;
    }
    
    return errors;
  }, []);

  const estimateFileSize = useCallback((data: ExportData, format: ExportFormat): number => {
    // Rough estimation based on data size and format
    const baseSize = JSON.stringify(data).length;
    
    switch (format) {
      case 'csv':
        return baseSize * 0.8; // CSV is usually smaller than JSON
      case 'xlsx':
        return baseSize * 1.5; // Excel files are larger
      case 'pdf':
        return baseSize * 2; // PDF files can be much larger
      case 'json':
        return baseSize;
      default:
        return baseSize;
    }
  }, []);

  const getSupportedFormats = useCallback((): ExportFormat[] => {
    return ['pdf', 'csv', 'xlsx', 'json', 'xml', 'html', 'png', 'svg'];
  }, []);

  const getFormatInfo = useCallback((format: ExportFormat): FormatInfo => {
    const formatInfoMap: Record<ExportFormat, FormatInfo> = {
      pdf: {
        name: 'PDF',
        extension: '.pdf',
        mimeType: 'application/pdf',
        description: 'Portable Document Format',
        features: ['pagination', 'styling', 'charts', 'images'],
      },
      csv: {
        name: 'CSV',
        extension: '.csv',
        mimeType: 'text/csv',
        description: 'Comma Separated Values',
        features: ['tabular', 'lightweight', 'universal'],
      },
      xlsx: {
        name: 'Excel',
        extension: '.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        description: 'Excel Workbook',
        features: ['formulas', 'charts', 'formatting', 'multiple_sheets'],
      },
      json: {
        name: 'JSON',
        extension: '.json',
        mimeType: 'application/json',
        description: 'JavaScript Object Notation',
        features: ['structured', 'lightweight', 'api_friendly'],
      },
      xml: {
        name: 'XML',
        extension: '.xml',
        mimeType: 'application/xml',
        description: 'Extensible Markup Language',
        features: ['structured', 'self_describing', 'validation'],
      },
      html: {
        name: 'HTML',
        extension: '.html',
        mimeType: 'text/html',
        description: 'HyperText Markup Language',
        features: ['styling', 'interactive', 'web_ready'],
      },
      png: {
        name: 'PNG',
        extension: '.png',
        mimeType: 'image/png',
        description: 'Portable Network Graphics',
        features: ['lossless', 'transparency', 'web_ready'],
      },
      svg: {
        name: 'SVG',
        extension: '.svg',
        mimeType: 'image/svg+xml',
        description: 'Scalable Vector Graphics',
        features: ['scalable', 'editable', 'small_size'],
      },
    };
    
    return formatInfoMap[format];
  }, []);

  const contextValue: ExportContextType = {
    jobs,
    activeJobs,
    completedJobs,
    exportData,
    exportChart,
    exportTable,
    exportPage,
    getJob,
    cancelJob,
    retryJob,
    deleteJob,
    clearCompletedJobs,
    saveTemplate,
    getTemplates,
    deleteTemplate,
    exportMultiple,
    createZipArchive,
    validateConfig,
    estimateFileSize,
    getSupportedFormats,
    getFormatInfo,
  };

  return (
    <ExportContext.Provider value={contextValue}>
      {children}
    </ExportContext.Provider>
  );
}

export function useExport() {
  const context = useContext(ExportContext);
  if (context === undefined) {
    throw new Error('useExport must be used within an ExportProvider');
  }
  return context;
}

export { ExportService, ExportEngines };
export default ExportProvider;