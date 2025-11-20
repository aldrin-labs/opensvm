'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';
import { SchemaField, ResponseSchema } from '@/lib/api/api-response-schemas';

interface SchemaFieldViewerProps {
  name: string;
  field: SchemaField;
  level?: number;
}

const SchemaFieldViewer: React.FC<SchemaFieldViewerProps> = ({ name, field, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels
  
  const hasChildren = field.type === 'object' && field.fields;
  const isArray = field.type === 'array' && field.items;
  
  const indent = level * 24;
  
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'string': return 'text-green-600 dark:text-green-400';
      case 'number': return 'text-blue-600 dark:text-blue-400';
      case 'boolean': return 'text-purple-600 dark:text-purple-400';
      case 'object': return 'text-orange-600 dark:text-orange-400';
      case 'array': return 'text-pink-600 dark:text-pink-400';
      case 'null': return 'text-gray-600 dark:text-gray-400';
      default: return 'text-gray-800 dark:text-gray-200';
    }
  };
  
  const renderExample = (example: any) => {
    if (example === null || example === undefined) return 'null';
    if (typeof example === 'string') return `"${example}"`;
    if (typeof example === 'object') return JSON.stringify(example);
    return String(example);
  };

  return (
    <div className="font-mono text-sm">
      <div 
        className="flex items-start gap-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-2 -mx-2"
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        {/* Expand/collapse button for objects and arrays */}
        {(hasChildren || isArray) && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-shrink-0 mt-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}
        {!hasChildren && !isArray && <div className="w-4" />}
        
        {/* Field name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {name}
              {field.optional && <span className="text-gray-400 text-xs ml-1">(optional)</span>}
            </span>
            <span className="text-gray-400">:</span>
            <span className={`font-semibold ${getTypeColor(field.type)}`}>
              {field.type}
              {isArray && field.items && `<${field.items.type}>`}
            </span>
          </div>
          
          {/* Description */}
          <div className="text-gray-600 dark:text-gray-400 text-xs mt-0.5 flex items-start gap-1">
            <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
            <span>{field.description}</span>
          </div>
          
          {/* Example value */}
          {field.example !== undefined && (
            <div className="text-xs mt-1 text-gray-500 dark:text-gray-500">
              Example: <span className="text-gray-700 dark:text-gray-300">{renderExample(field.example)}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Nested fields for objects */}
      {hasChildren && isExpanded && field.fields && (
        <div className="mt-1">
          {Object.entries(field.fields).map(([childName, childField]) => (
            <SchemaFieldViewer
              key={childName}
              name={childName}
              field={childField}
              level={level + 1}
            />
          ))}
        </div>
      )}
      
      {/* Array items */}
      {isArray && isExpanded && field.items && (
        <div className="mt-1">
          <SchemaFieldViewer
            name="[item]"
            field={field.items}
            level={level + 1}
          />
        </div>
      )}
    </div>
  );
};

interface ApiSchemaViewerProps {
  schema: ResponseSchema;
  title?: string;
}

export const ApiSchemaViewer: React.FC<ApiSchemaViewerProps> = ({ schema, title = 'Response Schema' }) => {
  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900">
      <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 border-b border-gray-300 dark:border-gray-700">
        <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{title}</h4>
      </div>
      <div className="p-4 max-h-[600px] overflow-y-auto">
        {Object.entries(schema).map(([fieldName, field]) => (
          <SchemaFieldViewer
            key={fieldName}
            name={fieldName}
            field={field}
            level={0}
          />
        ))}
      </div>
    </div>
  );
};

export default ApiSchemaViewer;
