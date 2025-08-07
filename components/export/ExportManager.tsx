'use client';

import React, { useState } from 'react';
import {
  Download,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Trash2,
  Eye,
  FileText,
  Table,
  Image,
  Settings,
  X
} from 'lucide-react';
import { useExport, ExportJob, ExportFormat } from '@/lib/export';
import { useI18n } from '@/lib/i18n';
import { useAccessibility } from '@/lib/accessibility';

interface ExportJobCardProps {
  job: ExportJob;
  onDownload: (job: ExportJob) => void;
  onRetry: (jobId: string) => void;
  onCancel: (jobId: string) => void;
  onDelete: (jobId: string) => void;
}

function ExportJobCard({ job, onDownload, onRetry, onCancel, onDelete }: ExportJobCardProps) {
  const { t } = useI18n();

  const getStatusIcon = () => {
    switch (job.status) {
      case 'preparing':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'exporting':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getFormatIcon = (format: ExportFormat) => {
    switch (format) {
      case 'pdf':
        return <FileText className="w-4 h-4" />;
      case 'csv':
      case 'xlsx':
        return <Table className="w-4 h-4" />;
      case 'png':
      case 'svg':
        return <Image className="w-4 h-4" aria-label="Image format icon" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusText = () => {
    switch (job.status) {
      case 'preparing':
        return 'Preparing';
      case 'exporting':
        return job.progress ? `Exporting ${job.progress}%` : 'Exporting';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  const canDownload = job.status === 'completed' && job.result?.success;
  const canRetry = job.status === 'error';
  const canCancel = job.status === 'preparing' || job.status === 'exporting';

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <h3 className="font-medium text-foreground">{job.name}</h3>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              {getFormatIcon(job.format)}
              <span className="uppercase">{job.format}</span>
              <span>•</span>
              <span>{getStatusText()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {canDownload && (
            <button
              onClick={() => onDownload(job)}
              className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-950 rounded-md transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          
          {canRetry && (
            <button
              onClick={() => onRetry(job.id)}
              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-md transition-colors"
              title="Retry"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          
          {canCancel && (
            <button
              onClick={() => onCancel(job.id)}
              className="p-2 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950 rounded-md transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          
          <button
            onClick={() => onDelete(job.id)}
            className="p-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar for active exports */}
      {(job.status === 'exporting' && job.progress !== undefined) && (
        <div className="mb-3">
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Job details */}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Created:</span>
          <span className="text-foreground">{job.createdAt.toLocaleString()}</span>
        </div>
        
        {job.completedAt && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Completed:</span>
            <span className="text-foreground">{job.completedAt.toLocaleString()}</span>
          </div>
        )}
        
        {job.result?.size && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">File Size:</span>
            <span className="text-foreground">{formatFileSize(job.result.size)}</span>
          </div>
        )}
        
        {job.error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-2">
            <p className="text-destructive text-xs">{job.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ExportManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportManager({ isOpen, onClose }: ExportManagerProps) {
  const { 
    jobs, 
    activeJobs, 
    completedJobs, 
    retryJob, 
    cancelJob, 
    deleteJob, 
    clearCompletedJobs 
  } = useExport();
  const { t } = useI18n();
  const { announceToScreenReader } = useAccessibility();

  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const filteredJobs = filter === 'all' ? jobs : 
                      filter === 'active' ? activeJobs : 
                      completedJobs;

  const handleDownload = (job: ExportJob) => {
    if (job.result?.downloadUrl) {
      const link = document.createElement('a');
      link.href = job.result.downloadUrl;
      link.download = job.result.filename || `export-${Date.now()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      announceToScreenReader(`Download started for ${job.name}`, 'polite');
    }
  };

  const handleRetry = async (jobId: string) => {
    try {
      await retryJob(jobId);
      announceToScreenReader('Export retry initiated', 'polite');
    } catch (error) {
      console.error('Failed to retry export:', error);
      announceToScreenReader('Failed to retry export', 'assertive');
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await cancelJob(jobId);
      announceToScreenReader('Export cancelled', 'polite');
    } catch (error) {
      console.error('Failed to cancel export:', error);
      announceToScreenReader('Failed to cancel export', 'assertive');
    }
  };

  const handleDelete = async (jobId: string) => {
    try {
      await deleteJob(jobId);
      announceToScreenReader('Export deleted', 'polite');
    } catch (error) {
      console.error('Failed to delete export:', error);
      announceToScreenReader('Failed to delete export', 'assertive');
    }
  };

  const handleClearCompleted = async () => {
    if (confirm('Are you sure you want to clear all completed exports?')) {
      try {
        await clearCompletedJobs();
        announceToScreenReader('Completed exports cleared', 'polite');
      } catch (error) {
        console.error('Failed to clear completed exports:', error);
        announceToScreenReader('Failed to clear completed exports', 'assertive');
      }
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
      <div className="relative bg-background border border-border rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Export Manager</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor and manage your export jobs
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-muted transition-colors"
            aria-label="Close export manager"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/50">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({jobs.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'active'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Active ({activeJobs.length})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === 'completed'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Completed ({completedJobs.length})
            </button>
          </div>

          {completedJobs.length > 0 && (
            <button
              onClick={handleClearCompleted}
              className="text-sm text-destructive hover:text-destructive/80 transition-colors"
            >
              Clear Completed
            </button>
          )}
        </div>

        {/* Export Jobs List */}
        <div className="p-6 overflow-y-auto max-h-96">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                <Download className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No {filter === 'all' ? '' : filter} exports
              </h3>
              <p className="text-muted-foreground">
                {filter === 'all' 
                  ? 'No export jobs found. Start by exporting some data!'
                  : `No ${filter} export jobs at the moment.`
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredJobs.map((job) => (
                <ExportJobCard
                  key={job.id}
                  job={job}
                  onDownload={handleDownload}
                  onRetry={handleRetry}
                  onCancel={handleCancel}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {jobs.length > 0 && (
          <div className="px-6 py-4 border-t border-border bg-muted/50">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Total: {jobs.length} exports
              </span>
              <span>
                {activeJobs.length > 0 && (
                  <>Active: {activeJobs.length}</>
                )}
                {completedJobs.length > 0 && activeJobs.length > 0 && ' • '}
                {completedJobs.length > 0 && (
                  <>Completed: {completedJobs.length}</>
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ExportManager;
