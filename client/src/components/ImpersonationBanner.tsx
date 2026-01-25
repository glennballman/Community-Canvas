/**
 * IMPERSONATION BANNER
 * 
 * CRITICAL REQUIREMENTS:
 * 1. Position: fixed at top of viewport
 * 2. Z-index: 9999 (above everything)
 * 3. Visible on ALL pages when impersonating
 * 4. Pushes all content down via body padding
 * 5. SPA-smooth transitions (no window.location reload)
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { queryClient } from '@/lib/queryClient';

export function ImpersonationBanner(): React.ReactElement | null {
  const { impersonation, refreshSession, token } = useAuth();
  const navigate = useNavigate();
  const [stopping, setStopping] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  const isImpersonating = impersonation?.active ?? false;
  const expiresAt = impersonation?.expires_at;

  useEffect(() => {
    if (!isImpersonating || !expiresAt) {
      return;
    }

    function updateTime() {
      if (!expiresAt) return;
      
      const expires = new Date(expiresAt).getTime();
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
  }, [expiresAt, isImpersonating]);

  useEffect(() => {
    if (isImpersonating) {
      document.body.style.paddingTop = '48px';
    } else {
      document.body.style.paddingTop = '0';
    }
    
    return () => {
      document.body.style.paddingTop = '0';
    };
  }, [isImpersonating]);

  async function handleStop() {
    if (stopping) return;
    
    setStopping(true);
    setShowOverlay(true);
    
    try {
      const response = await fetch('/api/admin/impersonation/stop', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      if (!response.ok) {
        console.error('Stop impersonation failed:', response.status);
        setStopping(false);
        setShowOverlay(false);
        return;
      }

      const data = await response.json();
      if (data.ok) {
        queryClient.clear();
        const refreshed = await refreshSession();
        if (refreshed) {
          navigate('/app/platform/impersonation');
        }
      } else {
        console.error('Stop impersonation returned not ok:', data.error);
      }
    } catch (error) {
      console.error('Failed to stop impersonation:', error);
    } finally {
      setStopping(false);
      setShowOverlay(false);
    }
  }

  if (!isImpersonating) {
    return null;
  }

  const targetUser = impersonation?.target_user;
  const tenant = impersonation?.tenant;
  const role = impersonation?.role;

  return (
    <>
      {showOverlay && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div style={{ textAlign: 'center', color: 'white' }}>
            <div 
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid transparent',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px',
              }}
            />
            <p style={{ fontSize: '18px', fontWeight: 500 }}>Switching identity...</p>
          </div>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
      <div 
        data-testid="impersonation-banner"
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            {targetUser?.display_name || targetUser?.email || 'Unknown'}
          </span>
          <span style={{ opacity: 0.6 }}>|</span>
          {tenant ? (
            <span style={{ fontWeight: 500 }}>
              Tenant: {tenant.slug || tenant.name}
            </span>
          ) : (
            <span style={{ fontWeight: 500, fontStyle: 'italic', opacity: 0.8 }}>
              Tenant: (none selected)
            </span>
          )}
          {role && (
            <span style={{ 
              backgroundColor: '#fcd34d', 
              padding: '2px 8px', 
              borderRadius: '4px',
              fontSize: '12px',
              textTransform: 'capitalize',
            }}>
              {role}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {timeLeft && (
            <span style={{ opacity: 0.8, fontSize: '13px' }}>
              {timeLeft}
            </span>
          )}
          <button
            onClick={handleStop}
            disabled={stopping}
            data-testid="button-stop-impersonation-banner"
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

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.1); }
          }
        `}</style>
      </div>
    </>
  );
}
