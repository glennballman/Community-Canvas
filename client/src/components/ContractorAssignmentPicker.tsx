import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  UserCircle, Search, Check, X, Loader2, Eye, ExternalLink 
} from 'lucide-react';

interface Contractor {
  id: string;
  displayName: string;
  email: string | null;
  personType: string;
}

interface ContractorAssignmentPickerProps {
  value: string | null;
  onChange: (contractorId: string | null) => void;
  onPreviewAsContractor?: () => void;
  workRequestId?: string;
  disabled?: boolean;
}

function getAuthHeaders() {
  const token = localStorage.getItem('hostToken');
  return { 'Authorization': `Bearer ${token}` };
}

export function ContractorAssignmentPicker({
  value,
  onChange,
  onPreviewAsContractor,
  workRequestId,
  disabled = false
}: ContractorAssignmentPickerProps) {
  const [search, setSearch] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch contractors (people with entity_type = 'contractor')
  const { data: contractorsData, isLoading } = useQuery<{ people: Contractor[] }>({
    queryKey: ['/api/p2/people', 'contractor'],
    queryFn: async () => {
      const res = await fetch('/api/p2/people?personType=contractor', { 
        headers: getAuthHeaders() 
      });
      if (!res.ok) return { people: [] };
      return res.json();
    }
  });

  const contractors = contractorsData?.people || [];
  
  // Filter contractors by search
  const filteredContractors = contractors.filter(c => 
    search === '' || 
    c.displayName.toLowerCase().includes(search.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  // Find selected contractor
  const selectedContractor = contractors.find(c => c.id === value);

  const handleSelect = (contractorId: string) => {
    onChange(contractorId);
    setIsExpanded(false);
    setSearch('');
  };

  const handleClear = () => {
    onChange(null);
    setSearch('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading contractors...</span>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <UserCircle className="h-4 w-4" />
          Assigned Contractor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Selected Contractor Display */}
        {selectedContractor ? (
          <div className="flex items-center gap-2 p-2 bg-primary/5 border border-primary/20 rounded-md">
            <UserCircle className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="font-medium text-sm">{selectedContractor.displayName}</div>
              {selectedContractor.email && (
                <div className="text-xs text-muted-foreground">{selectedContractor.email}</div>
              )}
            </div>
            <Badge variant="secondary" className="text-xs">Assigned</Badge>
            {!disabled && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleClear}
                data-testid="button-clear-contractor"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground p-2 bg-muted/50 rounded-md">
            No contractor assigned
          </div>
        )}

        {/* Preview as Contractor Button */}
        {selectedContractor && onPreviewAsContractor && workRequestId && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPreviewAsContractor}
            className="w-full"
            data-testid="button-preview-as-contractor"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview as Contractor
          </Button>
        )}

        {/* Contractor Selection */}
        {!disabled && (
          <>
            {!isExpanded ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(true)}
                className="w-full"
                data-testid="button-assign-contractor"
              >
                <UserCircle className="h-4 w-4 mr-2" />
                {selectedContractor ? 'Change Contractor' : 'Assign Contractor'}
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contractors..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                    autoFocus
                    data-testid="input-contractor-search"
                  />
                </div>

                {contractors.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2 text-center">
                    No contractors found. Add people with contractor type first.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-1">
                    {filteredContractors.map((contractor) => (
                      <button
                        key={contractor.id}
                        type="button"
                        onClick={() => handleSelect(contractor.id)}
                        className={`w-full flex items-center gap-2 p-2 rounded-md text-left text-sm transition-colors ${
                          value === contractor.id 
                            ? 'bg-primary/10 border border-primary/30' 
                            : 'hover:bg-muted'
                        }`}
                        data-testid={`button-contractor-option-${contractor.id}`}
                      >
                        <UserCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{contractor.displayName}</div>
                          {contractor.email && (
                            <div className="text-xs text-muted-foreground truncate">{contractor.email}</div>
                          )}
                        </div>
                        {value === contractor.id && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </button>
                    ))}
                    {filteredContractors.length === 0 && search && (
                      <p className="text-sm text-muted-foreground py-2 text-center">
                        No contractors match "{search}"
                      </p>
                    )}
                  </div>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsExpanded(false);
                    setSearch('');
                  }}
                  className="w-full"
                  data-testid="button-cancel-contractor-selection"
                >
                  Cancel
                </Button>
              </div>
            )}
          </>
        )}

        <p className="text-xs text-muted-foreground">
          The assigned contractor will have access to shared work catalog items for this work request.
        </p>
      </CardContent>
    </Card>
  );
}

export type { Contractor };
