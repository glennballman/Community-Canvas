import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type TabType = 'theme' | 'sections' | 'areas' | 'seo';

interface Community {
  id: string;
  name: string;
  portal_slug: string;
}

interface PortalConfig {
  theme: {
    primary_color: string;
    accent_color: string;
    background_color: string;
    logo_url: string;
    tagline: string;
  };
  sections: Array<{ key: string; label: string; visible: boolean }>;
  area_groups: Array<{ tenant_id: string; name: string; portal_slug: string }>;
  seo: {
    meta_title: string;
    meta_description: string;
    social_image_url: string;
  };
}

const DEFAULT_CONFIG: PortalConfig = {
  theme: {
    primary_color: '#3b82f6',
    accent_color: '#f59e0b',
    background_color: '#0c1829',
    logo_url: '',
    tagline: '',
  },
  sections: [
    { key: 'hero', label: 'Hero', visible: true },
    { key: 'businesses', label: 'Businesses', visible: true },
    { key: 'services', label: 'Services', visible: true },
    { key: 'events', label: 'Events', visible: true },
    { key: 'good_news', label: 'Good News', visible: true },
    { key: 'about', label: 'About', visible: true },
  ],
  area_groups: [],
  seo: {
    meta_title: '',
    meta_description: '',
    social_image_url: '',
  },
};

export default function PortalConfigPage() {
  const queryClient = useQueryClient();
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('theme');
  const [config, setConfig] = useState<PortalConfig>(DEFAULT_CONFIG);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const { data: communitiesData } = useQuery<{ communities: Community[] }>({
    queryKey: ['admin-communities-list'],
    queryFn: async () => {
      const res = await fetch('/api/admin/communities?filter=has_portal', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const communities = communitiesData?.communities || [];

  const { data: configData, isLoading: loadingConfig } = useQuery<{ config: PortalConfig }>({
    queryKey: ['portal-config', selectedCommunityId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/communities/${selectedCommunityId}/portal-config`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch config');
      return res.json();
    },
    enabled: !!selectedCommunityId,
  });

  useEffect(() => {
    if (configData?.config) {
      setConfig({ ...DEFAULT_CONFIG, ...configData.config });
    }
  }, [configData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/communities/${selectedCommunityId}/portal-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      setSaveMessage('Changes saved successfully');
      setTimeout(() => setSaveMessage(null), 3000);
      queryClient.invalidateQueries({ queryKey: ['portal-config', selectedCommunityId] });
    },
  });

  const tabs: { key: TabType; label: string }[] = [
    { key: 'theme', label: 'Theme' },
    { key: 'sections', label: 'Sections' },
    { key: 'areas', label: 'Area Switcher' },
    { key: 'seo', label: 'SEO' },
  ];

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            Portal Configuration
          </h1>
          <p style={{ color: '#9ca3af' }}>
            Customize how community portals look and feel.
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
            Select a community:
          </label>
          <select
            value={selectedCommunityId || ''}
            onChange={(e) => setSelectedCommunityId(e.target.value || null)}
            data-testid="select-community"
            style={{
              width: '100%',
              maxWidth: '300px',
              padding: '10px 12px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '14px',
            }}
          >
            <option value="">Choose a community...</option>
            {communities.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {selectedCommunityId && (
          <>
            <div style={{ 
              display: 'flex', 
              gap: '4px', 
              marginBottom: '24px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              paddingBottom: '12px',
            }}>
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  data-testid={`tab-${tab.key}`}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '14px',
                    cursor: 'pointer',
                    backgroundColor: activeTab === tab.key ? '#8b5cf6' : 'transparent',
                    color: activeTab === tab.key ? 'white' : '#9ca3af',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {loadingConfig ? (
              <p style={{ color: '#9ca3af' }}>Loading configuration...</p>
            ) : (
              <>
                {activeTab === 'theme' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <ColorField
                      label="Primary Color"
                      value={config.theme.primary_color}
                      onChange={(v) => setConfig({ ...config, theme: { ...config.theme, primary_color: v } })}
                    />
                    <ColorField
                      label="Accent Color"
                      value={config.theme.accent_color}
                      onChange={(v) => setConfig({ ...config, theme: { ...config.theme, accent_color: v } })}
                    />
                    <ColorField
                      label="Background Color"
                      value={config.theme.background_color}
                      onChange={(v) => setConfig({ ...config, theme: { ...config.theme, background_color: v } })}
                    />
                    <TextField
                      label="Logo URL"
                      value={config.theme.logo_url}
                      onChange={(v) => setConfig({ ...config, theme: { ...config.theme, logo_url: v } })}
                      helper="Recommended: 200x50px PNG with transparency"
                    />
                    <TextField
                      label="Tagline"
                      value={config.theme.tagline}
                      onChange={(v) => setConfig({ ...config, theme: { ...config.theme, tagline: v } })}
                      helper="A short phrase that appears below the community name"
                    />
                  </div>
                )}

                {activeTab === 'sections' && (
                  <div>
                    <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '16px' }}>
                      Drag to reorder. Toggle visibility.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {config.sections.map((section, i) => (
                        <div
                          key={section.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            borderRadius: '8px',
                          }}
                        >
                          <span>{section.label}</span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={section.visible}
                              onChange={(e) => {
                                const newSections = [...config.sections];
                                newSections[i] = { ...section, visible: e.target.checked };
                                setConfig({ ...config, sections: newSections });
                              }}
                            />
                            <span style={{ fontSize: '13px', color: '#9ca3af' }}>Visible</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'areas' && (
                  <div>
                    <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '16px' }}>
                      Let visitors switch between related communities (e.g., Bamfield ↔ Ucluelet)
                    </p>
                    {config.area_groups.length === 0 ? (
                      <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No area groups configured.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                        {config.area_groups.map((area, i) => (
                          <div
                            key={area.tenant_id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 16px',
                              backgroundColor: 'rgba(255,255,255,0.05)',
                              borderRadius: '8px',
                            }}
                          >
                            <span>{area.name}</span>
                            <button
                              onClick={() => {
                                const newAreas = config.area_groups.filter((_, idx) => idx !== i);
                                setConfig({ ...config, area_groups: newAreas });
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#f87171',
                                cursor: 'pointer',
                                fontSize: '13px',
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      data-testid="button-add-area"
                      style={{
                        padding: '8px 16px',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        borderRadius: '6px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '13px',
                      }}
                    >
                      + Add Area
                    </button>
                  </div>
                )}

                {activeTab === 'seo' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <TextField
                      label="Meta Title"
                      value={config.seo.meta_title}
                      onChange={(v) => setConfig({ ...config, seo: { ...config.seo, meta_title: v } })}
                      helper="Shown in browser tabs and search results"
                    />
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
                        Meta Description
                      </label>
                      <textarea
                        value={config.seo.meta_description}
                        onChange={(e) => setConfig({ ...config, seo: { ...config.seo, meta_description: e.target.value } })}
                        maxLength={155}
                        rows={3}
                        data-testid="input-meta-description"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '8px',
                          color: 'white',
                          fontSize: '14px',
                          resize: 'vertical',
                        }}
                      />
                      <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                        155 characters max
                      </p>
                    </div>
                    <TextField
                      label="Social Image URL"
                      value={config.seo.social_image_url}
                      onChange={(v) => setConfig({ ...config, seo: { ...config.seo, social_image_url: v } })}
                      helper="Used when shared on social media. 1200x630px recommended."
                    />
                  </div>
                )}

                <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    data-testid="button-save-changes"
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: saveMutation.isPending ? 'not-allowed' : 'pointer',
                      opacity: saveMutation.isPending ? 0.7 : 1,
                    }}
                  >
                    {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                  {saveMessage && (
                    <span style={{ color: '#10b981', fontSize: '14px' }}>{saveMessage}</span>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          data-testid={`input-${label.toLowerCase().replace(/\s+/g, '-')}`}
          style={{
            flex: 1,
            padding: '10px 12px',
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
          }}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '40px',
            height: '40px',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        />
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, helper }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  helper?: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', color: '#9ca3af', marginBottom: '6px' }}>
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={`input-${label.toLowerCase().replace(/\s+/g, '-')}`}
        style={{
          width: '100%',
          padding: '10px 12px',
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          color: 'white',
          fontSize: '14px',
        }}
      />
      {helper && (
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>{helper}</p>
      )}
    </div>
  );
}
