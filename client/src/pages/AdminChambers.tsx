import { useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search,
  CheckCircle,
  XCircle,
  Briefcase,
  Store,
  Globe,
  Link2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { BC_CHAMBERS_OF_COMMERCE, type ChamberOfCommerce } from "@shared/chambers-of-commerce";
import { chamberMembers, type ChamberMember } from "@shared/chamber-members";
import { naicsSubsectorLabels } from "@shared/naics-codes";
import { GEO_HIERARCHY, type GeoNode } from "@shared/geography";

function findMatchingMunicipality(name: string | undefined): GeoNode | null {
  if (!name) return null;
  const searchName = name.toLowerCase();
  
  for (const region of GEO_HIERARCHY.children || []) {
    for (const muni of region.children || []) {
      if (muni.shortName?.toLowerCase() === searchName) return muni;
      if (muni.name.toLowerCase() === searchName) return muni;
    }
  }
  
  for (const region of GEO_HIERARCHY.children || []) {
    for (const muni of region.children || []) {
      const cleaned = muni.name
        .replace(/^(City of|District of|Town of|Village of|Township of|Resort Municipality of|District Municipality of|Island Municipality of)\s+/i, '')
        .toLowerCase();
      const searchCleaned = searchName
        .replace(/^(city of|district of|town of|village of|township of|resort municipality of|district municipality of|island municipality of)\s+/i, '')
        .toLowerCase();
      if (cleaned.toLowerCase() === searchCleaned) return muni;
      if (muni.shortName?.toLowerCase() === searchCleaned) return muni;
    }
  }
  
  return null;
}

function findMatchingRegion(regionId: string | undefined): GeoNode | null {
  if (!regionId) return null;
  for (const region of GEO_HIERARCHY.children || []) {
    if (region.id === regionId) return region;
    const cleanedName = region.name.toLowerCase().replace(/\s+/g, '-');
    if (cleanedName === regionId.toLowerCase()) return region;
  }
  return null;
}

interface ChamberWithMatch extends ChamberOfCommerce {
  matchedMunicipality: GeoNode | null;
  matchedRegion: GeoNode | null;
}

export default function AdminChambers() {
  const [chamberSearch, setChamberSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberNaicsFilter, setMemberNaicsFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("chambers");

  const chamberWithMatches: ChamberWithMatch[] = useMemo(() => {
    return BC_CHAMBERS_OF_COMMERCE.map(chamber => {
      const matchedMunicipality = findMatchingMunicipality(chamber.municipality);
      const matchedRegion = findMatchingRegion(chamber.region.toLowerCase().replace(/\s+/g, '-'));
      return {
        ...chamber,
        matchedMunicipality,
        matchedRegion,
      };
    });
  }, []);

  const filteredChambers = useMemo(() => {
    if (!chamberSearch) return chamberWithMatches;
    const search = chamberSearch.toLowerCase();
    return chamberWithMatches.filter(c => 
      c.name.toLowerCase().includes(search) ||
      c.municipality?.toLowerCase().includes(search) ||
      c.region?.toLowerCase().includes(search) ||
      c.matchedMunicipality?.name.toLowerCase().includes(search) ||
      c.matchedRegion?.name.toLowerCase().includes(search) ||
      c.notes?.toLowerCase().includes(search) ||
      c.website?.toLowerCase().includes(search)
    );
  }, [chamberWithMatches, chamberSearch]);

  const chamberStats = useMemo(() => {
    const matched = chamberWithMatches.filter(c => c.matchedMunicipality).length;
    const regionOnly = chamberWithMatches.filter(c => !c.matchedMunicipality && c.matchedRegion).length;
    const unmatched = chamberWithMatches.filter(c => !c.matchedMunicipality && !c.matchedRegion).length;
    const byRegion: Record<string, number> = {};
    chamberWithMatches.forEach(c => {
      byRegion[c.region] = (byRegion[c.region] || 0) + 1;
    });
    const withWebsite = chamberWithMatches.filter(c => c.website).length;
    const withPhone = chamberWithMatches.filter(c => c.phone).length;
    const withMembers = chamberWithMatches.filter(c => c.members).length;
    return { 
      total: chamberWithMatches.length, 
      matched, 
      regionOnly, 
      unmatched, 
      byRegion,
      withWebsite,
      withPhone,
      withMembers
    };
  }, [chamberWithMatches]);

  const filteredMembers = useMemo(() => {
    let filtered = chamberMembers;
    
    if (memberNaicsFilter !== "all") {
      filtered = filtered.filter(m => m.naicsSubsector === memberNaicsFilter);
    }
    
    if (!memberSearch) return filtered;
    const search = memberSearch.toLowerCase();
    return filtered.filter(m => {
      const businessName = m.businessName?.toLowerCase() || '';
      const naicsTitle = m.naicsTitle?.toLowerCase() || '';
      const subcategory = m.subcategory?.toLowerCase() || '';
      const description = m.description?.toLowerCase() || '';
      const municipality = m.municipality?.toLowerCase() || '';
      const region = m.region?.toLowerCase() || '';
      const website = m.website?.toLowerCase() || '';
      const subsectorLabel = naicsSubsectorLabels[m.naicsSubsector || '']?.toLowerCase() || '';
      
      return businessName.includes(search) ||
        naicsTitle.includes(search) ||
        subcategory.includes(search) ||
        description.includes(search) ||
        municipality.includes(search) ||
        region.includes(search) ||
        website.includes(search) ||
        subsectorLabel.includes(search);
    });
  }, [memberSearch, memberNaicsFilter]);

  const memberStats = useMemo(() => {
    const byNaicsSubsector: Record<string, number> = {};
    chamberMembers.forEach(m => {
      const subsector = m.naicsSubsector || 'unknown';
      byNaicsSubsector[subsector] = (byNaicsSubsector[subsector] || 0) + 1;
    });
    const withWebsite = chamberMembers.filter(m => m.website && !m.websiteNeedsCollection).length;
    const needsWebsite = chamberMembers.filter(m => m.websiteNeedsCollection).length;
    const withCrossRef = chamberMembers.filter(m => m.crossReference).length;
    const byChamber: Record<string, number> = {};
    chamberMembers.forEach(m => {
      byChamber[m.chamberId] = (byChamber[m.chamberId] || 0) + 1;
    });
    const usedSubsectors = Object.keys(byNaicsSubsector).filter(s => s !== 'unknown').sort();
    return { 
      total: chamberMembers.length, 
      byNaicsSubsector,
      byChamber,
      withWebsite,
      needsWebsite,
      withCrossRef,
      usedSubsectors
    };
  }, []);

  return (
    <div className="h-full flex flex-col font-mono">
      <div className="border-b border-border/50 p-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <h1 className="text-sm font-bold tracking-wider text-foreground">CHAMBERS DATABASE</h1>
          <Badge variant="outline" className="text-[10px]">
            {chamberStats.total} CHAMBERS
          </Badge>
          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
            {memberStats.total.toLocaleString()} MEMBERS
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          BC Chambers of Commerce and verified member directories with NAICS industry classifications
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="w-full justify-start rounded-none border-b border-border/30 bg-transparent p-0 h-auto">
          <TabsTrigger 
            value="chambers" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-400 data-[state=active]:bg-transparent px-4 py-2 text-xs"
            data-testid="tab-chambers"
          >
            CHAMBERS ({chamberStats.total})
          </TabsTrigger>
          <TabsTrigger 
            value="members" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-400 data-[state=active]:bg-transparent px-4 py-2 text-xs"
            data-testid="tab-members"
          >
            MEMBERS ({memberStats.total.toLocaleString()})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chambers" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search chambers of commerce..."
                value={chamberSearch}
                onChange={e => setChamberSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-chamber-search"
              />
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
              <span className="text-green-400">{chamberStats.matched} MATCHED</span>
              <span className="text-blue-400">{chamberStats.withWebsite} WEBSITES</span>
              <span className="text-cyan-400">{chamberStats.withPhone} PHONE</span>
              <span className="text-amber-400">{chamberStats.withMembers} MEMBER DATA</span>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 px-2">CHAMBER</th>
                    <th className="text-left py-2 px-2">REGION</th>
                    <th className="text-left py-2 px-2">SOURCE MUNICIPALITY</th>
                    <th className="text-left py-2 px-2">MATCHED TO</th>
                    <th className="text-left py-2 px-2">CONTACT</th>
                    <th className="text-left py-2 px-2">DETAILS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChambers.map(chamber => (
                    <tr 
                      key={chamber.id} 
                      className="border-b border-border/20 hover-elevate"
                      data-testid={`row-chamber-${chamber.id}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-3 h-3 text-indigo-400" />
                          <div>
                            <div className="font-medium">{chamber.name}</div>
                            {chamber.location.address && <div className="text-[10px] text-muted-foreground">{chamber.location.address}</div>}
                            <div className="text-[10px] text-muted-foreground">{chamber.location.lat.toFixed(4)}, {chamber.location.lng.toFixed(4)}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline" className="text-[8px] bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
                          {chamber.region}
                        </Badge>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{chamber.municipality}</td>
                      <td className="py-2 px-2">
                        {chamber.matchedMunicipality ? (
                          <div className="flex items-center gap-1 text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            <span>{chamber.matchedMunicipality.name}</span>
                          </div>
                        ) : chamber.matchedRegion ? (
                          <span className="text-yellow-400">(region only)</span>
                        ) : (
                          <div className="flex items-center gap-1 text-red-400">
                            <XCircle className="w-3 h-3" />
                            <span>No match</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-[10px]">
                          {chamber.phone && <div className="text-muted-foreground">{chamber.phone}</div>}
                          {chamber.email && <div className="text-muted-foreground">{chamber.email}</div>}
                          {chamber.website && <div className="text-blue-400/70 truncate max-w-[150px]">{chamber.website.replace(/^https?:\/\//, '')}</div>}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-[10px]">
                          {chamber.founded && <div className="text-muted-foreground">Est. {chamber.founded}</div>}
                          {chamber.members && <div className="text-cyan-400">{chamber.members} members</div>}
                          {chamber.notes && <div className="text-muted-foreground/70 truncate max-w-[180px]">{chamber.notes}</div>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="members" className="flex-1 overflow-hidden m-0 flex flex-col data-[state=inactive]:hidden">
          <div className="p-3 border-b border-border/30 flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                className="pl-8 h-8 text-xs bg-background/50"
                data-testid="input-member-search"
              />
            </div>
            <select
              value={memberNaicsFilter}
              onChange={e => setMemberNaicsFilter(e.target.value)}
              className="h-8 text-xs bg-background/50 border border-border/50 rounded-md px-2"
              data-testid="select-member-naics"
            >
              <option value="all">All Industries ({memberStats.total.toLocaleString()})</option>
              {memberStats.usedSubsectors.map(subsector => (
                <option key={subsector} value={subsector}>
                  {subsector}: {naicsSubsectorLabels[subsector] || 'Unknown'} ({memberStats.byNaicsSubsector[subsector] || 0})
                </option>
              ))}
            </select>
            <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
              <span className="text-emerald-400">{memberStats.withWebsite} WITH WEBSITE</span>
              <span className="text-amber-400">{memberStats.needsWebsite} NEEDS WEBSITE</span>
              <span className="text-cyan-400">{memberStats.withCrossRef} CROSS-REF</span>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 px-2">BUSINESS</th>
                    <th className="text-left py-2 px-2">NAICS INDUSTRY</th>
                    <th className="text-left py-2 px-2">CHAMBER</th>
                    <th className="text-left py-2 px-2">LOCATION</th>
                    <th className="text-left py-2 px-2">WEBSITE</th>
                    <th className="text-left py-2 px-2">CROSS-REF</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map(member => (
                    <tr 
                      key={member.id} 
                      className="border-b border-border/20 hover-elevate"
                      data-testid={`row-member-${member.id}`}
                    >
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <Store className="w-3 h-3 text-emerald-400" />
                          <div>
                            <div className="font-medium text-foreground">{member.businessName}</div>
                            {member.description && <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">{member.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-[10px]">
                          <Badge variant="outline" className="text-[8px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                            {member.naicsSubsector}: {naicsSubsectorLabels[member.naicsSubsector || ''] || 'Unknown'}
                          </Badge>
                          <div className="text-[9px] text-muted-foreground mt-0.5">{member.naicsTitle}</div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <span className="text-indigo-400 text-[10px]">{member.chamberId}</span>
                      </td>
                      <td className="py-2 px-2">
                        <div className="text-[10px]">
                          <div className="text-foreground">{member.municipality}</div>
                          <div className="text-muted-foreground">{member.region}</div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        {member.website ? (
                          <a 
                            href={member.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-[10px]"
                            data-testid={`link-member-website-${member.id}`}
                          >
                            <Globe className="w-3 h-3" />
                            <span className="truncate max-w-[120px]">{member.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
                          </a>
                        ) : member.websiteNeedsCollection ? (
                          <span className="text-amber-400/70 text-[10px]">Needs collection</span>
                        ) : (
                          <span className="text-muted-foreground/50 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {member.crossReference ? (
                          <div className="flex items-center gap-1 text-cyan-400 text-[10px]">
                            <Link2 className="w-3 h-3" />
                            <span>{member.crossReference.dataset}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 text-[10px]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
