import { CopyButton } from './CopyButton';
import { ShareButton } from './ShareButton';

interface AccountInfoProps {
  address: string;
  isSystemProgram: boolean;
  parsedOwner: string;
}

function AddressDisplay({ address, label }: { address: string; label: string }) {
  return (
    <div className="space-y-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-start gap-2">
        <span className="font-mono text-xs leading-relaxed break-all flex-1 bg-muted/50 p-2 rounded">
          {address}
        </span>
        <div className="flex-shrink-0 mt-1">
          <CopyButton text={address} />
        </div>
      </div>
    </div>
  );
}

export default function AccountInfo({ address, isSystemProgram, parsedOwner }: AccountInfoProps) {
  return (
    <div className="h-full">
      <div className="bg-background rounded-lg border p-4 h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Account Info</h2>
          <ShareButton entityType="account" entityId={address} />
        </div>

        <div className="flex-1 space-y-4">
          <AddressDisplay address={address} label="Address" />

          <div className="space-y-1">
            <span className="text-sm text-muted-foreground">Type</span>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${isSystemProgram
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                  : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                }`}>
                {isSystemProgram ? 'System Account' : 'Program Account'}
              </span>
            </div>
          </div>

          {!isSystemProgram && (
            <AddressDisplay address={parsedOwner} label="Owner Program" />
          )}
        </div>
      </div>
    </div>
  );
}
