"use client";

import { useState } from 'react';
import { useProgramInfo } from '@/contexts/ProgramRegistryContext';
import DisassemblyView from '../disassembly-view';
import InstructionBrowser from './instruction-browser';
import { LiveActivity } from './live-activity';
import JsonTree from '@/components/JsonTree';
import { AlertTriangle, CheckCircle, Info, ExternalLink, Code, Activity } from 'lucide-react';

interface ProgramData {
  address: string;
  executable: boolean;
  owner: string;
  lamports: number;
  rentEpoch: number;
  data: number[];
  dataSize: number;
}

interface SerializedAccountInfo {
  executable: boolean;
  owner: string;
  lamports: string;
  rentEpoch: string;
  data: number[];
}

interface ProgramViewProps {
  programData: ProgramData;
  serializedAccountInfo: SerializedAccountInfo;
}

export default function ProgramView({ programData, serializedAccountInfo }: ProgramViewProps) {
  const { isKnown, displayName, category, riskLevel, program } = useProgramInfo(programData.address);
  const [activeTab, setActiveTab] = useState<'overview' | 'idl' | 'live' | 'disassembly' | 'raw'>(isKnown ? 'overview' : 'disassembly');

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'low': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'medium': return <Info className="w-4 h-4 text-yellow-500" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-500 bg-green-500/10 border-green-500/20';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      case 'high': return 'text-red-500 bg-red-500/10 border-red-500/20';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Program Info */}
      <div className="bg-background border border-border rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{displayName}</h2>
            {program && (
              <p className="text-muted-foreground mt-1">{program.description}</p>
            )}
            {!isKnown && (
              <div className="flex items-center mt-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 mr-2" />
                <span className="text-sm text-yellow-600">Unknown program - not in registry</span>
              </div>
            )}
          </div>
          {isKnown && (
            <div className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getRiskColor(riskLevel)}`}>
              {getRiskIcon(riskLevel)}
              <span className="ml-1 capitalize">{riskLevel} Risk</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Address</div>
            <div className="font-mono text-sm break-all text-foreground">{programData.address}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Owner</div>
            <div className="font-mono text-sm break-all text-foreground">{programData.owner}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Data Size</div>
            <div className="text-foreground">{programData.dataSize.toLocaleString()} bytes</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Balance</div>
            <div className="text-foreground">{(programData.lamports / 1e9).toLocaleString()} SOL</div>
          </div>
        </div>

        {/* Additional metadata for known programs */}
        {isKnown && program && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Category</div>
                <div className="capitalize text-foreground">{category}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Instructions</div>
                <div className="text-foreground">{program.instructions.length}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Registry Status</div>
                <div className="text-green-500">✓ Recognized</div>
              </div>
            </div>

            {/* Links */}
            {(program.website || program.documentation) && (
              <div className="flex gap-3 pt-3 border-t border-border">
                {program.website && (
                  <a
                    href={program.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-blue-500 hover:text-blue-400"
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Website
                  </a>
                )}
                {program.documentation && (
                  <a
                    href={program.documentation}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-blue-500 hover:text-blue-400"
                  >
                    <Code className="w-4 h-4 mr-1" />
                    Documentation
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Enhanced View Selection */}
      <div className="flex space-x-4 border-b border-border">
        {isKnown && (
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 -mb-px ${
              activeTab === 'overview'
                ? 'text-primary border-b-2 border-primary font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Overview
          </button>
        )}
        {isKnown && (
          <button
            onClick={() => setActiveTab('idl')}
            className={`px-4 py-2 -mb-px ${
              activeTab === 'idl'
                ? 'text-primary border-b-2 border-primary font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            IDL Interface
          </button>
        )}
        <button
          onClick={() => setActiveTab('live')}
          className={`px-4 py-2 -mb-px flex items-center space-x-1 ${
            activeTab === 'live'
              ? 'text-primary border-b-2 border-primary font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Live Activity</span>
        </button>
        <button
          onClick={() => setActiveTab('disassembly')}
          className={`px-4 py-2 -mb-px ${
            activeTab === 'disassembly'
              ? 'text-primary border-b-2 border-primary font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Disassembly
        </button>
        <button
          onClick={() => setActiveTab('raw')}
          className={`px-4 py-2 -mb-px ${
            activeTab === 'raw'
              ? 'text-primary border-b-2 border-primary font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Raw Data
        </button>
      </div>

      {/* Content */}
      <div className="bg-background border border-border rounded-lg overflow-hidden">
        {activeTab === 'overview' && isKnown && program && (
          <div className="p-6">
            <InstructionBrowser programId={programData.address} />
          </div>
        )}
        {activeTab === 'idl' && isKnown && (
          <div className="p-6">
            <InstructionBrowser programId={programData.address} />
          </div>
        )}
        {activeTab === 'live' && (
          <div className="p-6">
            <LiveActivity programId={programData.address} />
          </div>
        )}
        {activeTab === 'disassembly' && (
          <DisassemblyView 
            data={serializedAccountInfo.data} 
            address={programData.address}
          />
        )}
        {activeTab === 'raw' && (
          <div className="p-4">
            <JsonTree data={serializedAccountInfo} />
          </div>
        )}
      </div>
    </div>
  );
}
