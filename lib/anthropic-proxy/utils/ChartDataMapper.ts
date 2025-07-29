export interface ChartDataPoint {
    label?: string;
    value: number;
    date?: string;
    [key: string]: any;
}

export interface ChartConfig {
    type: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
    title: string;
    xAxis?: string;
    yAxis?: string;
    colorScheme?: string[];
    showLegend?: boolean;
    showTooltip?: boolean;
}

export interface SafeChartData {
    type: string;
    title: string;
    data: ChartDataPoint[];
    config: ChartConfig;
    isEmpty: boolean;
    errorMessage?: string;
}

export class RobustChartDataMapper {
    private readonly defaultColors = [
        '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
        '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'
    ];

    /**
     * Safely map data to chart format with comprehensive error handling
     */
    safeMapToChart(
        data: any[],
        config: ChartConfig,
        mapper: (item: any, index: number) => ChartDataPoint
    ): SafeChartData {
        try {
            // Validate inputs
            if (!Array.isArray(data)) {
                return this.createErrorChart(config, 'Invalid data: expected array');
            }

            if (!config || !config.type || !config.title) {
                return this.createErrorChart(config, 'Invalid chart configuration');
            }

            if (typeof mapper !== 'function') {
                return this.createErrorChart(config, 'Invalid mapper function');
            }

            // Handle empty data
            if (data.length === 0) {
                return this.createEmptyChart(config);
            }

            // Map data points with individual error handling
            const mappedData: ChartDataPoint[] = [];
            const errors: string[] = [];

            for (let i = 0; i < data.length; i++) {
                try {
                    const item = data[i];
                    if (item === null || item === undefined) {
                        errors.push(`Null/undefined item at index ${i}`);
                        continue;
                    }

                    const mappedPoint = mapper(item, i);

                    // Validate mapped point
                    if (!this.isValidDataPoint(mappedPoint)) {
                        errors.push(`Invalid data point at index ${i}: ${JSON.stringify(mappedPoint)}`);
                        continue;
                    }

                    // Sanitize the data point
                    mappedData.push(this.sanitizeDataPoint(mappedPoint));

                } catch (error) {
                    errors.push(`Error mapping item at index ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }

            // Check if we have any valid data
            if (mappedData.length === 0) {
                return this.createErrorChart(config, `No valid data points. Errors: ${errors.join(', ')}`);
            }

            // Log warnings for partial failures
            if (errors.length > 0) {
                console.warn(`Chart mapping warnings for "${config.title}":`, errors);
            }

            // Apply post-processing based on chart type
            const processedData = this.postProcessData(mappedData, config);

            return {
                type: config.type,
                title: config.title,
                data: processedData,
                config: {
                    ...config,
                    colorScheme: config.colorScheme || this.defaultColors
                },
                isEmpty: false
            };

        } catch (error) {
            console.error(`Critical error in chart mapping for "${config.title}":`, error);
            return this.createErrorChart(config, `Critical mapping error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Create standardized chart data for time series
     */
    createTimeSeriesChart(
        data: any[],
        config: Omit<ChartConfig, 'type'>,
        valueExtractor: (item: any) => number,
        dateExtractor: (item: any) => string | Date
    ): SafeChartData {
        return this.safeMapToChart(
            data,
            { ...config, type: 'line' },
            (item, index) => {
                const value = valueExtractor(item);
                const date = dateExtractor(item);

                if (typeof value !== 'number' || isNaN(value)) {
                    throw new Error(`Invalid value: ${value}`);
                }

                const dateStr = date instanceof Date ? date.toISOString() : String(date);
                if (!dateStr) {
                    throw new Error(`Invalid date: ${date}`);
                }

                return {
                    date: dateStr,
                    value,
                    label: dateStr,
                    index
                };
            }
        );
    }

    /**
     * Create standardized chart data for categorical data
     */
    createCategoricalChart(
        data: any[],
        config: Omit<ChartConfig, 'type'>,
        labelExtractor: (item: any) => string,
        valueExtractor: (item: any) => number,
        chartType: 'bar' | 'pie' = 'bar'
    ): SafeChartData {
        return this.safeMapToChart(
            data,
            { ...config, type: chartType },
            (item, index) => {
                const label = labelExtractor(item);
                const value = valueExtractor(item);

                if (typeof value !== 'number' || isNaN(value)) {
                    throw new Error(`Invalid value: ${value}`);
                }

                if (!label || typeof label !== 'string') {
                    throw new Error(`Invalid label: ${label}`);
                }

                return {
                    label,
                    value,
                    index,
                    percentage: 0 // Will be calculated in post-processing for pie charts
                };
            }
        );
    }

    /**
     * Validate if a data point is valid
     */
    private isValidDataPoint(point: any): point is ChartDataPoint {
        if (!point || typeof point !== 'object') {
            return false;
        }

        // Must have a numeric value
        if (typeof point.value !== 'number' || isNaN(point.value)) {
            return false;
        }

        // If it has a date, it should be valid
        if (point.date && !this.isValidDate(point.date)) {
            return false;
        }

        return true;
    }

    /**
     * Sanitize a data point to ensure safe values
     */
    private sanitizeDataPoint(point: ChartDataPoint): ChartDataPoint {
        const sanitized: ChartDataPoint = {
            value: this.sanitizeNumber(point.value)
        };

        // Copy other properties safely
        Object.keys(point).forEach(key => {
            if (key !== 'value') {
                const value = point[key];
                if (typeof value === 'string') {
                    sanitized[key] = value.substring(0, 1000); // Limit string length
                } else if (typeof value === 'number' && !isNaN(value)) {
                    sanitized[key] = this.sanitizeNumber(value);
                } else if (typeof value === 'boolean') {
                    sanitized[key] = value;
                } else if (value instanceof Date) {
                    sanitized[key] = value.toISOString();
                }
                // Skip other types for safety
            }
        });

        return sanitized;
    }

    /**
     * Sanitize numeric values
     */
    private sanitizeNumber(value: number): number {
        if (isNaN(value)) return 0;
        if (!isFinite(value)) return 0;

        // Round to reasonable precision
        return Math.round(value * 100) / 100;
    }

    /**
     * Validate date strings/objects
     */
    private isValidDate(date: any): boolean {
        if (date instanceof Date) {
            return !isNaN(date.getTime());
        }

        if (typeof date === 'string') {
            const parsed = new Date(date);
            return !isNaN(parsed.getTime());
        }

        return false;
    }

    /**
     * Post-process data based on chart type
     */
    private postProcessData(data: ChartDataPoint[], config: ChartConfig): ChartDataPoint[] {
        switch (config.type) {
            case 'pie':
                return this.calculatePercentages(data);
            case 'line':
            case 'area':
                return this.sortByDate(data);
            case 'bar':
                return this.sortByValue(data);
            default:
                return data;
        }
    }

    /**
     * Calculate percentages for pie charts
     */
    private calculatePercentages(data: ChartDataPoint[]): ChartDataPoint[] {
        const total = data.reduce((sum, point) => sum + point.value, 0);

        if (total === 0) return data;

        return data.map(point => ({
            ...point,
            percentage: Math.round((point.value / total) * 100 * 100) / 100
        }));
    }

    /**
     * Sort data by date for time series
     */
    private sortByDate(data: ChartDataPoint[]): ChartDataPoint[] {
        return data.sort((a, b) => {
            if (!a.date || !b.date) return 0;
            return new Date(a.date).getTime() - new Date(b.date).getTime();
        });
    }

    /**
     * Sort data by value (descending)
     */
    private sortByValue(data: ChartDataPoint[]): ChartDataPoint[] {
        return data.sort((a, b) => b.value - a.value);
    }

    /**
     * Create error chart
     */
    private createErrorChart(config: Partial<ChartConfig>, errorMessage: string): SafeChartData {
        return {
            type: config.type || 'bar',
            title: config.title || 'Chart Error',
            data: [],
            config: {
                type: config.type || 'bar',
                title: config.title || 'Chart Error',
                colorScheme: this.defaultColors
            },
            isEmpty: true,
            errorMessage
        };
    }

    /**
     * Create empty chart
     */
    private createEmptyChart(config: ChartConfig): SafeChartData {
        return {
            type: config.type,
            title: config.title,
            data: [],
            config: {
                ...config,
                colorScheme: config.colorScheme || this.defaultColors
            },
            isEmpty: true
        };
    }
}

// Global chart mapper instance
export const globalChartMapper = new RobustChartDataMapper(); 