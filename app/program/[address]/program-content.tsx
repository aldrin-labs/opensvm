'use client';

import DisassemblyView from './disassembly-view';
import JsonTree from '@/components/JsonTree';
import { ShareButton } from '@/components/ShareButton';

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

interface Props {
  programData: ProgramData;
  serializedAccountInfo: SerializedAccountInfo;
}

export default function ProgramContent({ programData, serializedAccountInfo }: Props) {
  // Convert serialized account info to a displayable format
  const accountInfoDisplay = {
    executable: serializedAccountInfo.executable,
    owner: serializedAccountInfo.owner,
    lamports: serializedAccountInfo.lamports,
    rentEpoch: serializedAccountInfo.rentEpoch,
    dataLength: serializedAccountInfo.data.length,
    space: serializedAccountInfo.data.length,
    // Add additional metadata
    lamportsInSol: (Number(serializedAccountInfo.lamports) / 1e9).toFixed(9),
    dataSizeKb: (serializedAccountInfo.data.length / 1024).toFixed(2),
    firstDataBytes: Array.from(serializedAccountInfo.data.slice(0, 16))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' '),
    // Add program details
    programDetails: {
      isExecutable: serializedAccountInfo.executable ? 'Yes' : 'No',
      ownerProgram: serializedAccountInfo.owner,
      rentEpochInfo: serializedAccountInfo.rentEpoch 
        ? `Epoch ${serializedAccountInfo.rentEpoch}`
        : 'Not available',
      dataInfo: {
        totalSize: `${serializedAccountInfo.data.length.toLocaleString()} bytes`,
        sizeInKb: `${(serializedAccountInfo.data.length / 1024).toFixed(2)} KB`,
      }
    }
  };

  return (
    <div>
      {/* Program Info Section */}
      <div className="bg-black/20 p-4 mb-6 rounded-lg border border-white/10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Program Information</h2>
          <ShareButton entityType="program" entityId={programData.address} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-gray-400">Address:</p>
            <p className="font-mono break-all">{programData.address}</p>
          </div>
          <div>
            <p className="text-gray-400">Owner:</p>
            <p className="font-mono break-all">{programData.owner}</p>
          </div>
          <div>
            <p className="text-gray-400">Executable:</p>
            <p>{programData.executable ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <p className="text-gray-400">Data Size:</p>
            <p>{programData.dataSize.toLocaleString()} bytes</p>
          </div>
          <div>
            <p className="text-gray-400">Balance:</p>
            <p>{(programData.lamports / 1e9).toLocaleString()} SOL</p>
          </div>
          <div>
            <p className="text-gray-400">Rent Epoch:</p>
            <p>{programData.rentEpoch}</p>
          </div>
        </div>
      </div>

      {/* Account Info Section */}
      <div className="bg-black/20 p-4 mb-6 rounded-lg border border-white/10">
        <h2 className="text-lg font-semibold mb-4">Account Info (RPC Response)</h2>
        <JsonTree data={accountInfoDisplay} expanded={true} />
      </div>

      {/* Disassembly View */}
      <div className="bg-black/20 p-4 rounded-lg border border-white/10">
        <h2 className="text-lg font-semibold mb-4">Program Disassembly</h2>
        <DisassemblyView 
          data={programData.data} 
          address={programData.address}
        />
      </div>
    </div>
  );
}