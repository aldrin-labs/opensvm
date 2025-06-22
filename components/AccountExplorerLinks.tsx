'use client';

interface Props {
  address: string;
}

export default function AccountExplorerLinks({ address }: Props) {
  const openBackground = (url: string) => {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    win?.blur();
    window.focus();
  };

  return (
    <div className="flex gap-4 mt-2">
      <button
        onClick={() => openBackground(`https://solscan.io/account/${address}`)}
        className="text-blue-500 hover:underline text-sm"
      >
        View on Solscan
      </button>
      <button
        onClick={() => openBackground(`https://step.finance/account/${address}`)}
        className="text-blue-500 hover:underline text-sm"
      >
        View on Step Finance
      </button>
    </div>
  );
}
