import { render, screen } from '@testing-library/react';

// Test program to verify visualizer layout
const testData = new Uint8Array([
  // First row (16 bytes)
  0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, // First 8 bytes
  0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, // Second 8 bytes (ASCII: ABCDEFGH)

  // Second row (16 bytes)
  0x20, 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, // First 8 bytes
  0x49, 0x4A, 0x4B, 0x4C, 0x4D, 0x4E, 0x4F, 0x50, // Second 8 bytes (ASCII: IJKLMNOP)

  // Third row (16 bytes)
  0xFF, 0xFE, 0xFD, 0xFC, 0xFB, 0xFA, 0xF9, 0xF8, // First 8 bytes
  0x51, 0x52, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58  // Second 8 bytes (ASCII: QRSTUVWX)
]);

const ProgramVisualizer = ({ data }: { data: number[] }) => {
  // Use data for program visualization and analysis
  console.log(`Visualizing program data: ${data.length} bytes`);
  const dataPreview = data.slice(0, 8).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ');

  return (
    <div>
      <h3>Program Data Visualizer</h3>
      <p>Data length: {data.length} bytes</p>
      <p>Preview: {dataPreview}...</p>
    </div>
  );
};

export default function TestPage() {
  return (
    <div className="p-8">
      <ProgramVisualizer data={Array.from(testData)} />
    </div>
  );
}

describe('TestPage', () => {
  it('renders program visualizer', () => {
    render(<TestPage />);
    expect(screen.getByText('Program Data Visualizer')).toBeInTheDocument();
  });
});
