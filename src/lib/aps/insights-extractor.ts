// Health score thresholds (used by computeHealthScore)
const HEALTH_THRESHOLDS = {
  fileSizeMB: { good: 100, fair: 300, large: 500 },
  viewCount: { normal: 500, large: 1000 },
  linkCount: { few: 10, many: 20 },
  inPlaceCount: { none: 0, few: 5 },
  freshnessDays: { recent: 7, moderate: 30 },
};

// Max items stored in detail arrays (prevents bloated JSON in SQLite)
const DETAIL_LIMITS = {
  views: 500,
  sheets: 200,
  schedules: 100,
  inPlaceComponents: 100,
  rooms: 500,
};

export type ModelInsightsData = {
  viewCount: number;
  sheetCount: number;
  scheduleCount: number;
  revitLinkCount: number;
  cadLinkCount: number;
  familyCount: number;
  inPlaceCount: number;
  roomCount: number;
  levelCount: number;
  totalElements: number;
  healthScore: number;
  details: {
    views: string[];
    sheets: string[];
    schedules: string[];
    revitLinks: string[];
    cadLinks: string[];
    families: Record<string, Record<string, number>>;
    inPlaceComponents: string[];
    rooms: string[];
    levels: string[];
    worksets: string[];
    userWorksets: Record<string, number>;
    projectInfo: Record<string, string>;
  };
};

// Known Revit categories for classification
const REVIT_CATEGORIES: Record<string, string> = {
  'Walls': 'Walls', 'Doors': 'Doors', 'Windows': 'Windows', 'Floors': 'Floors',
  'Roofs': 'Roofs', 'Ceilings': 'Ceilings', 'Stairs': 'Stairs', 'Railings': 'Railings',
  'Columns': 'Columns', 'Structural Columns': 'Structural Columns',
  'Structural Foundations': 'Structural Foundations', 'Structural Framing': 'Structural Framing',
  'Furniture': 'Furniture', 'Furniture Systems': 'Furniture Systems',
  'Casework': 'Casework', 'Generic Models': 'Generic Models',
  'Specialty Equipment': 'Specialty Equipment', 'Plumbing Fixtures': 'Plumbing Fixtures',
  'Mechanical Equipment': 'Mechanical Equipment', 'Electrical Equipment': 'Electrical Equipment',
  'Electrical Fixtures': 'Electrical Fixtures', 'Lighting Fixtures': 'Lighting Fixtures',
  'Mass': 'Mass', 'Curtain Panels': 'Curtain Panels', 'Curtain Wall Mullions': 'Curtain Wall Mullions',
  'Rooms': 'Rooms', 'Areas': 'Areas', 'Parking': 'Parking',
  'Topography': 'Topography', 'Planting': 'Planting', 'Site': 'Site',
  'Ducts': 'Ducts', 'Pipes': 'Pipes', 'Pipe Fittings': 'Pipe Fittings',
  'Duct Fittings': 'Duct Fittings', 'Conduits': 'Conduits', 'Cable Trays': 'Cable Trays',
  'Sprinklers': 'Sprinklers', 'Air Terminals': 'Air Terminals',
  'RVT Links': 'RVT Links', 'Imports in Families': 'CAD Links',
};

// Object tree node from Model Derivative API
interface TreeNode {
  objectid: number;
  name: string;
  objects?: TreeNode[];
}

interface TreeResponse {
  data?: { objects?: TreeNode[] };
}

interface PropertyGroup {
  [key: string]: string | number | undefined;
}

interface PropertyObject {
  objectid: number;
  name: string;
  properties: Record<string, PropertyGroup>;
}

/**
 * Extract structured insights from Model Derivative properties.
 */
export function extractInsights(
  properties: PropertyObject[],
  fileSize: number = 0,
  lastModifiedAt: string = ''
): ModelInsightsData {
  const views: string[] = [];
  const sheets: string[] = [];
  const schedules: string[] = [];
  const revitLinks: string[] = [];
  const cadLinks: string[] = [];
  const familyMap: Record<string, Set<string>> = {};
  const inPlaceComponents: string[] = [];
  const rooms: string[] = [];
  const levels: string[] = [];
  const worksetSet = new Set<string>();
  const projectInfo: Record<string, string> = {};

  for (const obj of properties) {
    // APS Model Derivative uses '__category__' for Revit element classification.
    // Fallback to 'Identity Data' if the standard path is missing.
    const categoryGroup = obj.properties?.['__category__'] ?? obj.properties?.['Identity Data'] ?? {};
    const category = String(categoryGroup['Category'] ?? categoryGroup['category'] ?? '');
    const family = String(categoryGroup['Family'] ?? categoryGroup['family'] ?? '');
    const name = obj.name ?? '';

    // Views
    if (category === 'Views') {
      views.push(name);
    }
    // Sheets
    else if (category === 'Sheets') {
      sheets.push(name);
    }
    // Schedules
    else if (
      category === 'Schedule Graphics' ||
      category === 'Schedules'
    ) {
      schedules.push(name);
    }
    // Revit Links
    else if (category === 'RVT Links') {
      if (!revitLinks.includes(name)) {
        revitLinks.push(name);
      }
    }
    // CAD Links
    else if (
      category === 'Imports in Families' ||
      name.endsWith('.dwg') ||
      name.endsWith('.DWG')
    ) {
      if (!cadLinks.includes(name)) {
        cadLinks.push(name);
      }
    }
    // Rooms
    else if (category === 'Rooms') {
      rooms.push(name);
    }
    // Levels
    else if (category === 'Levels') {
      levels.push(name);
    }
    // Project Information
    else if (category === 'Project Information') {
      const propDict = obj.properties ?? {};
      for (const [group, params] of Object.entries(propDict)) {
        if (group.startsWith('__')) {
          continue;
        }
        const paramGroup = params ?? {};
        for (const [key, val] of Object.entries(paramGroup)) {
          projectInfo[key] = String(val ?? '');
        }
      }
    }

    // Track families by category
    if (
      family &&
      category &&
      !category.startsWith('__')
    ) {
      if (!familyMap[category]) {
        familyMap[category] = new Set<string>();
      }
      familyMap[category]?.add(family);
    }

    // Detect in-place components: family name contains the element name pattern
    // In-place families typically have family name = "Model Group" or match element name
    if (
      family &&
      name &&
      family === name &&
      category !== 'Views' &&
      category !== 'Sheets' &&
      category !== 'Levels'
    ) {
      inPlaceComponents.push(`${category}: ${name}`);
    }

    // Track worksets
    const workset = String(categoryGroup['Workset'] ?? '');
    if (workset && workset !== '') {
      worksetSet.add(workset);
    }
  }

  // Convert family sets to count maps (each family gets count 1 from old extractor)
  const families: Record<string, Record<string, number>> = {};
  for (const [cat, fams] of Object.entries(familyMap)) {
    const famSet = fams ?? new Set<string>();
    families[cat] = {};
    for (const f of Array.from(famSet).sort()) {
      families[cat][f] = 1;
    }
  }

  const familyCount = Object.values(families).reduce(
    (sum, catFams) => sum + Object.keys(catFams).length,
    0
  );
  const totalElements = Object.values(families).reduce(
    (sum, catFams) => sum + Object.values(catFams).reduce((s, n) => s + n, 0), 0
  );
  const healthScore = computeHealthScore(
    fileSize,
    views.length,
    sheets.length,
    revitLinks.length + cadLinks.length,
    inPlaceComponents.length,
    lastModifiedAt
  );

  return {
    viewCount: views.length,
    sheetCount: sheets.length,
    scheduleCount: schedules.length,
    revitLinkCount: revitLinks.length,
    cadLinkCount: cadLinks.length,
    familyCount,
    inPlaceCount: inPlaceComponents.length,
    roomCount: rooms.length,
    levelCount: levels.length,
    totalElements,
    healthScore,
    details: {
      views: views.slice(0, DETAIL_LIMITS.views),
      sheets: sheets.slice(0, DETAIL_LIMITS.sheets),
      schedules: schedules.slice(0, DETAIL_LIMITS.schedules),
      revitLinks,
      cadLinks,
      families,
      inPlaceComponents: inPlaceComponents.slice(0, DETAIL_LIMITS.inPlaceComponents),
      rooms: rooms.slice(0, DETAIL_LIMITS.rooms),
      levels,
      worksets: Array.from(worksetSet).sort(),
      userWorksets: {},
      projectInfo,
    },
  };
}

/**
 * Compute model health score (0-100).
 *
 * Weights prioritize model quality over freshness:
 * - File size: 25 pts (biggest performance impact)
 * - Link count: 20 pts (coordination complexity)
 * - In-place components: 15 pts (bad practice indicator)
 * - Sheets: 15 pts (publishing readiness)
 * - Freshness: 15 pts (staleness indicator)
 * - View count: 10 pts (high counts not always bad)
 */
function computeHealthScore(
  fileSize: number,
  viewCount: number,
  sheetCount: number,
  linkCount: number,
  inPlaceCount: number,
  lastModifiedAt: string
): number {
  let score = 0;
  const sizeMB = fileSize / (1024 * 1024);
  const t = HEALTH_THRESHOLDS;

  // File size (25 pts max)
  if (sizeMB === 0) score += 15; // unknown
  else if (sizeMB < t.fileSizeMB.good) score += 25;
  else if (sizeMB < t.fileSizeMB.fair) score += 18;
  else if (sizeMB < t.fileSizeMB.large) score += 10;
  else score += 5;

  // Link count (20 pts max)
  if (linkCount < t.linkCount.few) score += 20;
  else if (linkCount < t.linkCount.many) score += 12;
  else score += 5;

  // In-place components (15 pts max)
  if (inPlaceCount === t.inPlaceCount.none) score += 15;
  else if (inPlaceCount <= t.inPlaceCount.few) score += 8;
  else score += 3;

  // Sheets (15 pts max)
  score += sheetCount > 0 ? 15 : 8;

  // Freshness (15 pts max)
  if (lastModifiedAt) {
    const daysSince = (Date.now() - new Date(lastModifiedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < t.freshnessDays.recent) score += 15;
    else if (daysSince < t.freshnessDays.moderate) score += 10;
    else score += 5;
  } else {
    score += 8;
  }

  // View count (10 pts max) - high counts not always bad
  if (viewCount < t.viewCount.normal) score += 10;
  else if (viewCount < t.viewCount.large) score += 7;
  else score += 4;

  return Math.min(100, Math.max(0, score));
}

/**
 * Extract insights using the object tree (category hierarchy) + properties (worksets, identity data).
 * This is the primary extraction method since Model Derivative properties don't always have __category__.
 */
export function extractInsightsFromTree(
  treeResponse: unknown,
  properties: PropertyObject[],
  fileSize: number,
  lastModifiedAt: string,
  viewCount: number,
  sheetCount: number
): ModelInsightsData {
  const tree = treeResponse as TreeResponse;
  const root = tree?.data?.objects?.[0];

  // Build objectid -> properties lookup for O(1) access
  const propMap = new Map<number, PropertyObject>();
  for (const p of properties) {
    propMap.set(p.objectid, p);
  }

  const revitLinks: string[] = [];
  const cadLinks: string[] = [];
  // category -> familyOrTypeName -> instance count
  const familyCountMap: Record<string, Record<string, number>> = {};
  const inPlaceComponents: string[] = [];
  const rooms: string[] = [];
  const levels: string[] = [];
  const schedules: string[] = [];
  let scheduleCount = 0;

  // Internal/nested component names to filter from display
  const INTERNAL_NAMES = ['Nested_Clearance', 'Face_Node', 'Layout Point', 'Layout_Point'];

  // Count elements, looking up Type Name from properties
  function countElement(catName: string, node: TreeNode) {
    const props = propMap.get(node.objectid);
    const idData = props?.properties?.['Identity Data'] ?? {};
    const typeName = String(idData['Type Name'] ?? idData['Family and Type'] ?? node.name ?? '');
    const rawName = typeName || node.name || 'Unknown';

    // Strip Revit element IDs like [4711205] from names
    const cleanName = rawName.replace(/\s*\[\d+\]\s*$/, '').trim() || 'Unknown';

    // Skip internal/nested component names
    if (INTERNAL_NAMES.some(n => cleanName.startsWith(n))) return;

    if (!familyCountMap[catName]) familyCountMap[catName] = {};
    familyCountMap[catName][cleanName] = (familyCountMap[catName][cleanName] || 0) + 1;
  }

  function walkTree(node: TreeNode, parentCategory: string) {
    const name = node.name || '';
    const children = node.objects || [];
    const isKnownCategory = name in REVIT_CATEGORIES;

    if (isKnownCategory) {
      const catName = REVIT_CATEGORIES[name] || name;

      if (catName === 'RVT Links') {
        for (const child of children) { if (child.name) revitLinks.push(child.name); }
        return;
      }
      if (catName === 'CAD Links') {
        for (const child of children) { if (child.name) cadLinks.push(child.name); }
        return;
      }
      if (catName === 'Rooms') {
        for (const child of children) { if (child.name) rooms.push(child.name); }
        return;
      }

      // Tree structure: Category -> Family Type -> Instance Type -> leaf elements
      // Count leaf elements, using the nearest named ancestor as the type name
      function countLeaves(node: TreeNode, typeName: string) {
        const leafChildren = node.objects || [];
        if (leafChildren.length === 0) {
          // Leaf node: count it under the type name
          countElement(catName, { ...node, name: typeName || node.name });
        } else {
          // Has children: use this node's name as type name and recurse
          const name = node.name?.replace(/\s*\[\d+\]\s*$/, '').trim() || typeName;
          for (const child of leafChildren) {
            countLeaves(child, name);
          }
        }
      }

      for (const child of children) {
        countLeaves(child, child.name || '');
      }
    } else if (parentCategory !== '') {
      // Element under a known category (recursed from above)
      countElement(parentCategory, node);
      for (const child of children) {
        walkTree(child, parentCategory);
      }
    } else {
      // Top-level element not in a known category
      if (name.includes('Level') || name.includes('level')) {
        levels.push(name);
      } else if (name.includes('Schedule') || name.includes('schedule')) {
        schedules.push(name);
        scheduleCount++;
      }
      for (const child of children) {
        walkTree(child, '');
      }
    }
  }

  if (root?.objects) {
    for (const child of root.objects) {
      walkTree(child, '');
    }
  }

  // Detect CAD links from .dwg names
  for (const node of root?.objects || []) {
    if (node.name?.endsWith('.dwg') || node.name?.endsWith('.DWG')) {
      if (!cadLinks.includes(node.name)) cadLinks.push(node.name);
    }
  }

  // Extract worksets from properties, filter to user worksets only
  const allWorksetCounts: Record<string, number> = {};
  const projectInfo: Record<string, string> = {};
  for (const obj of properties) {
    const idData = obj.properties?.['Identity Data'] ?? {};
    const ws = String(idData['Workset'] ?? '');
    if (ws) {
      allWorksetCounts[ws] = (allWorksetCounts[ws] || 0) + 1;
    }
  }

  // User worksets: exclude those starting with "Family" (with double space) or containing "Types"
  const userWorksets: Record<string, number> = {};
  const allWorksetNames: string[] = [];
  for (const [ws, count] of Object.entries(allWorksetCounts)) {
    allWorksetNames.push(ws);
    const isSystemWorkset = ws.startsWith('Family  :') || ws.startsWith('Family :')
      || ws.includes('Types') || ws.includes(' Types');
    if (!isSystemWorkset) {
      userWorksets[ws] = count;
    }
  }

  // families is now Record<string, Record<string, number>>
  const families = familyCountMap;
  const familyCount = Object.values(families).reduce(
    (sum, catFams) => sum + Object.keys(catFams).length, 0
  );
  const totalElements = Object.values(families).reduce(
    (sum, catFams) => sum + Object.values(catFams).reduce((s, n) => s + n, 0), 0
  );
  const linkCount = revitLinks.length + cadLinks.length;
  const healthScore = computeHealthScore(fileSize, viewCount, sheetCount, linkCount, inPlaceComponents.length, lastModifiedAt);

  return {
    viewCount,
    sheetCount,
    scheduleCount,
    revitLinkCount: revitLinks.length,
    cadLinkCount: cadLinks.length,
    familyCount,
    inPlaceCount: inPlaceComponents.length,
    roomCount: rooms.length,
    levelCount: levels.length,
    totalElements,
    healthScore,
    details: {
      views: [],
      sheets: [],
      schedules: schedules.slice(0, DETAIL_LIMITS.schedules),
      revitLinks,
      cadLinks,
      families,
      inPlaceComponents: inPlaceComponents.slice(0, DETAIL_LIMITS.inPlaceComponents),
      rooms: rooms.slice(0, DETAIL_LIMITS.rooms),
      levels,
      worksets: allWorksetNames.sort(),
      userWorksets,
      projectInfo,
    },
  };
}
