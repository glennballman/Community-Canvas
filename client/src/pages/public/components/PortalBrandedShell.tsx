import { usePortalSite } from '../hooks/usePortalSite';

type Props = {
  portalSlug?: string;
  preloadedData?: {
    portal?: { name?: string; slug?: string };
    theme?: { primaryColor?: string };
  };
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
};

export function PortalBrandedShell({
  portalSlug,
  preloadedData,
  backHref,
  backLabel,
  children,
}: Props) {
  const { portal, theme, isLoading } = usePortalSite(
    preloadedData ? undefined : portalSlug
  );

  const resolvedPortal = preloadedData?.portal ?? portal;
  const resolvedTheme = preloadedData?.theme ?? theme;
  const portalName = resolvedPortal?.name || portalSlug || 'Portal';

  if (portalSlug && !resolvedPortal && isLoading) {
    return <div className="p-6">Loading…</div>;
  }

  return (
    <div
      className="min-h-screen"
      style={{
        '--portal-primary': resolvedTheme?.primaryColor,
      } as React.CSSProperties}
    >
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <div className="font-semibold text-lg">{portalName}</div>
        {backHref && (
          <a href={backHref} className="text-sm underline">
            {backLabel ?? 'Back'}
          </a>
        )}
      </header>

      <main className="p-6">{children}</main>
    </div>
  );
}
