import { useState } from "react";
import { ChevronRight, ChevronDown, Globe, Map, Building2, MapPin, Home } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  GEO_HIERARCHY, 
  getChildren, 
  type GeoNode, 
  type GeoLevel 
} from "@shared/geography";

interface GeoTreeProps {
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  startFromLevel?: GeoLevel;
  startNodeId?: string;
}

const LEVEL_ICONS: Record<GeoLevel, typeof Globe> = {
  planet: Globe,
  country: Map,
  province: Map,
  region: MapPin,
  municipality: Building2,
  community: Home,
  address: Home,
};

const LEVEL_COLORS: Record<GeoLevel, string> = {
  planet: "text-blue-400",
  country: "text-red-400",
  province: "text-emerald-400",
  region: "text-amber-400",
  municipality: "text-cyan-400",
  community: "text-violet-400",
  address: "text-slate-400",
};

interface TreeNodeProps {
  node: GeoNode;
  depth: number;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  expandedNodes: Set<string>;
  toggleExpand: (nodeId: string) => void;
}

function TreeNode({ node, depth, selectedNodeId, onSelectNode, expandedNodes, toggleExpand }: TreeNodeProps) {
  const children = getChildren(node.id);
  const hasChildren = children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNodeId === node.id;
  const Icon = LEVEL_ICONS[node.level];
  const colorClass = LEVEL_COLORS[node.level];

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer transition-colors ${
          isSelected 
            ? "bg-primary/20 border border-primary/30" 
            : "hover-elevate"
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onSelectNode(node.id)}
        data-testid={`tree-node-${node.id}`}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(node.id);
            }}
            className="p-0.5 hover:bg-muted rounded"
            data-testid={`tree-expand-${node.id}`}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        
        <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
        
        <span className="text-xs truncate flex-1">
          {node.shortName || node.name}
        </span>
        
        {hasChildren && (
          <Badge variant="secondary" className="text-[9px] px-1 py-0">
            {children.length}
          </Badge>
        )}
      </div>
      
      {isExpanded && hasChildren && (
        <div>
          {children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function GeoTree({ 
  selectedNodeId, 
  onSelectNode, 
  startNodeId = "earth" 
}: GeoTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set(["earth", "canada", "bc"])
  );

  const toggleExpand = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const startNode = GEO_HIERARCHY[startNodeId];
  if (!startNode) return null;

  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        <TreeNode
          node={startNode}
          depth={0}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
          expandedNodes={expandedNodes}
          toggleExpand={toggleExpand}
        />
      </div>
    </ScrollArea>
  );
}
