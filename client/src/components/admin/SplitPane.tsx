import { ReactNode } from 'react';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  leftWidth?: string;
}

export function SplitPane({ left, right, leftWidth = '400px' }: SplitPaneProps) {
  return (
    <div style={{
      display: 'flex',
      gap: '24px',
      minHeight: '500px',
    }}>
      <div style={{
        width: leftWidth,
        flexShrink: 0,
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 300px)',
      }}>
        {left}
      </div>
      <div style={{
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '12px',
        padding: '24px',
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 300px)',
      }}>
        {right}
      </div>
    </div>
  );
}
