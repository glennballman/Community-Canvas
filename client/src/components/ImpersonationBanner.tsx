/**
 * IMPERSONATION BANNER
 * 
 * CRITICAL REQUIREMENTS:
 * 1. Position: fixed at top of viewport
 * 2. Z-index: 9999 (above everything)
 * 3. Visible on ALL pages when impersonating
 * 4. Pushes all content down via body padding
 * 
 * DO NOT MODIFY THIS FILE.
 */

import React, { useEffect, useState } from 'react';
import { useTenant } from '../contexts/TenantContext';

export function ImpersonationBanner(): React.ReactElement | null {
  const { impersonation, stopImpersonation } = useTenant();
  const [stopping, setStopping] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  // Calculate and update time remaining
  useEffect(() => {
    if (!impersonation.is_impersonating || !impersonation.expires_at) {
      return;
    }

    function updateTime() {
      if (!impersonation.expires_at) return;
      
      const expires = new Date(impersonation.expires_at).getTime();
      const now = Date.now();
      const diff = expires - now;

      if (diff <= 0) {
        setTimeLeft('Expired');
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (minutes > 60) {
        const hours = Math.floor(minutes / 60);
        setTimeLeft(`${hours}h ${minutes % 60}m remaining`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s remaining`);
      }
    }

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [impersonation.expires_at, impersonation.is_impersonating]);

  // Add/remove body padding when banner visibility changes
  useEffect(() => {
    if (impersonation.is_impersonating) {
      document.body.style.paddingTop = '48px';
    } else {
      document.body.style.paddingTop = '0';
    }
    
    return () => {
      document.body.style.paddingTop = '0';
    };
  }, [impersonation.is_impersonating]);

  // Handle stop click
  async function handleStop() {
    if (stopping) return;
    
    setStopping(true);
    try {
      await stopImpersonation();
      // stopImpersonation handles the redirect
    } catch (error) {
      console.error('Failed to stop impersonation:', error);
      setStopping(false);
    }
  }

  // Don't render if not impersonating
  if (!impersonation.is_impersonating) {
    return null;
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '48px',
        backgroundColor: '#f59e0b',
        color: '#451a03',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '14px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }}
    >
      {/* Left side - Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Pulsing dot */}
        <span 
          style={{
            width: '10px',
            height: '10px',
            backgroundColor: '#78350f',
            borderRadius: '50%',
            animation: 'pulse 2s infinite',
          }}
        />
        <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Impersonating:
        </span>
        <span style={{ fontWeight: 600 }}>
          {impersonation.tenant_name}
        </span>
        <span style={{ 
          backgroundColor: '#fcd34d', 
          padding: '2px 8px', 
          borderRadius: '4px',
          fontSize: '12px',
          textTransform: 'capitalize',
        }}>
          {impersonation.tenant_type}
        </span>
      </div>

      {/* Right side - Timer and Stop button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {timeLeft && (
          <span style={{ opacity: 0.8, fontSize: '13px' }}>
            {timeLeft}
          </span>
        )}
        <button
          onClick={handleStop}
          disabled={stopping}
          style={{
            backgroundColor: '#78350f',
            color: '#fef3c7',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: stopping ? 'not-allowed' : 'pointer',
            opacity: stopping ? 0.7 : 1,
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            if (!stopping) {
              e.currentTarget.style.backgroundColor = '#451a03';
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#78350f';
          }}
        >
          {stopping ? 'Stopping...' : '✕ Exit Impersonation'}
        </button>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
