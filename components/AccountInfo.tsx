import { CopyButton } from './CopyButton';
import { ShareButton } from './ShareButton';

interface AccountInfoProps {
  address: string;
  isSystemProgram: boolean;
  parsedOwner: string;
}

function AddressDisplay({ address, label }: { address: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center">
        <span className="font-mono text-sm break-all">
          {address}
        </span>
        <CopyButton text={address} />
      </div>
    </div>
  );
}

export default function AccountInfo({ address, isSystemProgram, parsedOwner }: AccountInfoProps) {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 bg-background rounded-lg border">
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold">Account Info</h2>
          <ShareButton entityType="account" entityId={address} />
        </div>
        
        <div className="flex flex-col gap-4">
          <AddressDisplay address={address} label="Address" />

          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Type</span>
            <span className="text-sm">
              {isSystemProgram ? 'System Account' : 'Program Account'}
            </span>
          </div>

          {!isSystemProgram && (
            <AddressDisplay address={parsedOwner} label="Owner" />
          )}
        </div>
      </div>
    </div>
  );
}
