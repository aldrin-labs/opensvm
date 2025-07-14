/**
 * User History Export Component
 * Handles CSV export and zip download functionality
 */

'use client';

import { useState } from 'react';
import { UserProfile } from '@/types/user-history';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Download, 
  FileText, 
  Loader2, 
  Package,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface UserHistoryExportProps {
  profile: UserProfile;
}

export function UserHistoryExport({ profile }: UserHistoryExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const exportHistoryAsCSV = () => {
    const headers = [
      'Timestamp',
      'Date',
      'Time',
      'Page Type',
      'Page Title',
      'Path',
      'Transaction ID',
      'Account Address',
      'Block Number',
      'Program ID',
      'Token Mint',
      'Validator Address',
      'Search Query',
      'User Agent',
      'Referrer'
    ];

    const rows = profile.history.map(entry => [
      entry.timestamp,
      new Date(entry.timestamp).toISOString().split('T')[0],
      new Date(entry.timestamp).toTimeString().split(' ')[0],
      entry.pageType,
      entry.pageTitle,
      entry.path,
      entry.metadata?.transactionId || '',
      entry.metadata?.accountAddress || '',
      entry.metadata?.blockNumber || '',
      entry.metadata?.programId || '',
      entry.metadata?.tokenMint || '',
      entry.metadata?.validatorAddress || '',
      entry.metadata?.searchQuery || '',
      entry.userAgent || '',
      entry.referrer || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return csvContent;
  };

  const exportStatsAsCSV = () => {
    const headers = [
      'Metric',
      'Value',
      'Description'
    ];

    const rows = [
      ['Total Visits', profile.stats.totalVisits, 'Total number of page visits'],
      ['Unique Pages', profile.stats.uniquePages, 'Number of unique pages visited'],
      ['Most Visited Page Type', profile.stats.mostVisitedPageType, 'Most frequently visited page type'],
      ['First Visit', new Date(profile.stats.firstVisit).toISOString(), 'Date and time of first visit'],
      ['Last Visit', new Date(profile.stats.lastVisit).toISOString(), 'Date and time of last visit'],
      ['Days Active', profile.stats.dailyActivity.length, 'Number of days with activity'],
      ...profile.stats.pageTypeDistribution.map(type => [
        `${type.type} Pages`,
        type.count,
        `Number of ${type.type} pages visited (${type.percentage.toFixed(1)}%)`
      ])
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return csvContent;
  };

  const exportDailyActivityAsCSV = () => {
    const headers = ['Date', 'Visits', 'Day of Week'];

    const rows = profile.stats.dailyActivity.map(day => [
      day.date,
      day.visits,
      new Date(day.date).toLocaleDateString('en-US', { weekday: 'long' })
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return csvContent;
  };

  const createZipFile = async () => {
    try {
      // For client-side ZIP creation, we'd need a library like JSZip
      // For simplicity, we'll create a combined CSV file with multiple sheets
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const walletShort = profile.walletAddress.slice(0, 8);
      
      const historyCSV = exportHistoryAsCSV();
      const statsCSV = exportStatsAsCSV();
      const activityCSV = exportDailyActivityAsCSV();
      
      // Create a combined file with sections
      const combinedContent = [
        '# OpenSVM User History Export',
        `# Generated on: ${new Date().toISOString()}`,
        `# Wallet: ${profile.walletAddress}`,
        `# Total Visits: ${profile.stats.totalVisits}`,
        '',
        '## BROWSING HISTORY',
        historyCSV,
        '',
        '## STATISTICS',
        statsCSV,
        '',
        '## DAILY ACTIVITY',
        activityCSV
      ].join('\n');

      // Create blob and download
      const blob = new Blob([combinedContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `opensvm-history-${walletShort}-${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error creating export file:', error);
      return false;
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportStatus('idle');
    
    try {
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const success = await createZipFile();
      
      if (success) {
        setExportStatus('success');
        setTimeout(() => setExportStatus('idle'), 3000);
      } else {
        setExportStatus('error');
        setTimeout(() => setExportStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const getButtonContent = () => {
    if (isExporting) {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Exporting...
        </>
      );
    }
    
    if (exportStatus === 'success') {
      return (
        <>
          <CheckCircle className="h-4 w-4" />
          Downloaded!
        </>
      );
    }
    
    if (exportStatus === 'error') {
      return (
        <>
          <AlertCircle className="h-4 w-4" />
          Error
        </>
      );
    }
    
    return (
      <>
        <Download className="h-4 w-4" />
        Export CSV
      </>
    );
  };

  const getButtonVariant = () => {
    if (exportStatus === 'success') return 'default';
    if (exportStatus === 'error') return 'destructive';
    return 'outline';
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={getButtonVariant()}
        size="sm"
        onClick={handleExport}
        disabled={isExporting}
        className="flex items-center gap-2"
      >
        {getButtonContent()}
      </Button>
      
      {/* Export Info Tooltip */}
      <Card className="hidden group-hover:block absolute top-full right-0 mt-2 z-10 w-80">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" />
            Export Information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <FileText className="h-3 w-3" />
              <span>CSV format with browsing history, statistics, and daily activity</span>
            </div>
            <div className="flex items-center gap-2">
              <Download className="h-3 w-3" />
              <span>Downloads as a single file with multiple sections</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              File includes: {profile.history.length} history entries, 
              {profile.stats.pageTypeDistribution.length} page types, 
              {profile.stats.dailyActivity.length} days of activity
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}