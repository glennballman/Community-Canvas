// ============================================
// DRIVER QUALIFICATION SUMMARY CARD
// Shows driver's license, endorsements, and qualification status
// Displays at top of Fleet Dashboard
// ============================================

import { 
  User, 
  Award, 
  CheckCircle, 
  AlertTriangle, 
  Calendar,
  CreditCard,
  AlertCircle,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import { useDriverQualifications } from '@/hooks/useDriverQualifications';
import { QualificationBadgeCompact } from './QualificationBadge';

// ============================================
// TYPES
// ============================================

interface DriverQualificationSummaryProps {
  driverId: string;
  onEditQualifications?: () => void;
  compact?: boolean;
}

// ============================================
// HELPER: Format date for display
// ============================================

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Not set';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-CA', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

// ============================================
// HELPER: Check if date is expiring soon or expired
// ============================================

function getExpiryStatus(dateString: string | null): 'ok' | 'warning' | 'expired' | 'unknown' {
  if (!dateString) return 'unknown';
  const date = new Date(dateString);
  const now = new Date();
  const daysUntil = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntil < 0) return 'expired';
  if (daysUntil < 30) return 'warning';
  return 'ok';
}

// ============================================
// ENDORSEMENT BADGE COMPONENT
// ============================================

function EndorsementBadge({ 
  label, 
  active, 
  code 
}: { 
  label: string; 
  active: boolean;
  code?: string;
}) {
  if (!active) return null;
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-success/20 text-success rounded text-xs font-medium">
      <Award className="h-3 w-3" />
      {code && <span className="font-bold">{code}</span>}
      {label}
    </span>
  );
}

// ============================================
// EXPERIENCE BADGE COMPONENT
// ============================================

function ExperienceBadge({ label, active }: { label: string; active: boolean }) {
  if (!active) return null;
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-muted-foreground rounded text-xs">
      <CheckCircle className="h-3 w-3" />
      {label}
    </span>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DriverQualificationSummary({ 
  driverId, 
  onEditQualifications,
  compact = false
}: DriverQualificationSummaryProps) {
  const { data, isLoading, error, refetch } = useDriverQualifications(driverId);

  // ============================================
  // LOADING STATE
  // ============================================
  if (isLoading) {
    return (
      <div className="bg-card rounded-lg p-4 border border-border animate-pulse" data-testid="qualification-summary-loading">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 bg-muted rounded-full"></div>
          <div className="flex-1">
            <div className="h-5 bg-muted rounded w-1/3 mb-2"></div>
            <div className="h-4 bg-muted rounded w-1/4"></div>
          </div>
        </div>
        <div className="h-2 bg-muted rounded w-full"></div>
      </div>
    );
  }

  // ============================================
  // ERROR STATE
  // ============================================
  if (error || !data) {
    return (
      <div className="bg-card rounded-lg p-4 border border-destructive/50" data-testid="qualification-summary-error">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <div>
            <p className="font-medium">Unable to load qualifications</p>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : 'Please try again'}
            </p>
          </div>
          <button 
            onClick={() => refetch()} 
            className="ml-auto p-2 hover:bg-muted rounded"
            data-testid="retry-qualifications"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const { driver, summary, trailerQualifications } = data;
  const licenseExpiry = getExpiryStatus(driver.licenseExpiry);
  const medicalExpiry = getExpiryStatus(driver.medicalExpiry);
  const hasAnyEndorsement = driver.endorsements.airBrake || 
                           driver.endorsements.houseTrailer || 
                           driver.endorsements.heavyTrailer;
  const hasAnyExperience = driver.experience.fifthWheel || 
                          driver.experience.gooseneck || 
                          driver.experience.horseTrailer || 
                          driver.experience.boatLaunching;

  const hasIssues = summary.qualifiedFor < summary.totalTrailers;
  const borderClass = hasIssues ? 'border-warning/50' : 'border-border';

  // ============================================
  // COMPACT VIEW (for sidebars, etc)
  // ============================================
  if (compact) {
    return (
      <div 
        className={`bg-card rounded-lg p-3 border ${borderClass}`}
        data-testid="qualification-summary-compact"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{driver.name}</span>
            {driver.licenseClass && (
              <span className="text-xs text-muted-foreground">
                Class {driver.licenseClass}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">
              <span className="font-medium">{summary.qualifiedFor}</span>
              <span className="text-muted-foreground">/{summary.totalTrailers}</span>
            </span>
            <QualificationBadgeCompact 
              isQualified={summary.qualifiedFor === summary.totalTrailers}
              warningCount={summary.totalTrailers - summary.qualifiedFor}
            />
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // FULL VIEW
  // ============================================
  return (
    <div 
      className={`bg-card rounded-lg p-4 border ${borderClass}`}
      data-testid="qualification-summary"
    >
      {/* Header Row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-muted rounded-full">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
          
          <div>
            <h3 className="font-semibold text-foreground">{driver.name}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="h-3.5 w-3.5" />
              {driver.licenseClass ? (
                <span>
                  Class {driver.licenseClass}
                  {driver.licenseProvince && ` (${driver.licenseProvince})`}
                </span>
              ) : (
                <span className="text-warning">No license on file</span>
              )}
            </div>
          </div>
        </div>
        
        {onEditQualifications && (
          <button
            onClick={onEditQualifications}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
            data-testid="edit-qualifications-button"
          >
            Edit Qualifications
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* License Expiry Warning */}
      {licenseExpiry === 'expired' && (
        <div className="mb-3 p-2 bg-destructive/10 border border-destructive/30 rounded text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          License expired on {formatDate(driver.licenseExpiry)}
        </div>
      )}
      {licenseExpiry === 'warning' && (
        <div className="mb-3 p-2 bg-warning/10 border border-warning/30 rounded text-sm text-warning flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          License expires {formatDate(driver.licenseExpiry)}
        </div>
      )}

      {/* Endorsements Row */}
      <div className="mb-3">
        <div className="flex flex-wrap gap-2">
          <EndorsementBadge 
            label="Air Brake" 
            active={driver.endorsements.airBrake} 
          />
          <EndorsementBadge 
            label="House Trailer" 
            code="07"
            active={driver.endorsements.houseTrailer} 
          />
          <EndorsementBadge 
            label="Heavy Trailer" 
            code="20"
            active={driver.endorsements.heavyTrailer} 
          />
          {!hasAnyEndorsement && (
            <span className="text-xs text-muted-foreground italic">
              No endorsements on file
            </span>
          )}
        </div>
        
        {driver.endorsements.heavyTrailer && (
          <div className={`mt-2 text-xs flex items-center gap-1 ${
            medicalExpiry === 'expired' ? 'text-destructive' :
            medicalExpiry === 'warning' ? 'text-warning' :
            'text-muted-foreground'
          }`}>
            <Calendar className="h-3 w-3" />
            Medical: {formatDate(driver.medicalExpiry)}
            {medicalExpiry === 'expired' && ' (EXPIRED)'}
            {medicalExpiry === 'warning' && ' (Expiring soon)'}
          </div>
        )}
      </div>

      {/* Experience Row */}
      {hasAnyExperience && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-1.5">Experience:</p>
          <div className="flex flex-wrap gap-1.5">
            <ExperienceBadge label="Fifth Wheel" active={driver.experience.fifthWheel} />
            <ExperienceBadge label="Gooseneck" active={driver.experience.gooseneck} />
            <ExperienceBadge label="Horse Trailer" active={driver.experience.horseTrailer} />
            <ExperienceBadge label="Boat Launching" active={driver.experience.boatLaunching} />
          </div>
        </div>
      )}

      {/* Qualification Summary Bar */}
      <div className="flex items-center gap-4 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          {summary.qualifiedFor === summary.totalTrailers ? (
            <CheckCircle className="h-5 w-5 text-success" />
          ) : summary.qualifiedFor > 0 ? (
            <AlertCircle className="h-5 w-5 text-warning" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          )}
          <span className="text-sm">
            <span className="font-semibold text-foreground">{summary.qualifiedFor}</span>
            <span className="text-muted-foreground"> / {summary.totalTrailers} trailers</span>
          </span>
        </div>
        
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${
              summary.percentageQualified === 100 
                ? 'bg-success' 
                : summary.percentageQualified >= 50 
                  ? 'bg-warning' 
                  : 'bg-destructive'
            }`}
            style={{ width: `${summary.percentageQualified}%` }}
          />
        </div>
        
        <span className="text-sm font-medium text-muted-foreground min-w-[3rem] text-right">
          {summary.percentageQualified}%
        </span>
      </div>

      {/* Unqualified Trailers List (if any) */}
      {summary.qualifiedFor < summary.totalTrailers && trailerQualifications && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Cannot tow:</p>
          <div className="space-y-1">
            {trailerQualifications
              .filter(t => !t.isQualified)
              .slice(0, 3)
              .map(trailer => (
                <div key={trailer.trailerId} className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-foreground">{trailer.trailerName}</span>
                  {trailer.primaryIssue && (
                    <span className="text-xs text-muted-foreground">- {trailer.primaryIssue}</span>
                  )}
                </div>
              ))}
            {trailerQualifications.filter(t => !t.isQualified).length > 3 && (
              <p className="text-xs text-muted-foreground">
                + {trailerQualifications.filter(t => !t.isQualified).length - 3} more
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DriverQualificationSummary;
