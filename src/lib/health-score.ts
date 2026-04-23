/**
 * Health Score System - computes a detailed report card from model insights.
 * 6 sections, each with score, rating, and actionable recommendation.
 */

export type HealthRating = 'good' | 'fair' | 'poor';

export type HealthSection = {
  label: string;
  score: number;
  maxScore: number;
  rating: HealthRating;
  detail: string;
  recommendation: string;
};

export type HealthBreakdown = {
  totalScore: number;
  maxScore: number;
  rating: HealthRating;
  sections: HealthSection[];
  unavailable: { label: string; reason: string }[];
};

export function computeHealthBreakdown(data: {
  fileSize: number;
  totalElements?: number;
  familyCount: number;
  inPlaceCount: number;
  revitLinkCount: number;
  cadLinkCount: number;
  sheetCount: number;
  viewCount?: number;
  fetchedAt: string;
  details?: Record<string, unknown>;
}): HealthBreakdown {
  const sections: HealthSection[] = [];
  const sizeMB = data.fileSize / (1024 * 1024);
  const linkCount = data.revitLinkCount + data.cadLinkCount;
  const userWorksets = data.details?.['userWorksets'] as Record<string, number> | undefined;
  const worksetCount = userWorksets ? Object.keys(userWorksets).length : 0;
  const families = data.details?.['families'] as Record<string, Record<string, number>> | undefined;
  const revitLinks = data.details?.['revitLinks'] as string[] | undefined;

  // 1. Model Size (25 pts)
  let sizeScore = 25;
  let sizeRating: HealthRating = 'good';
  let sizeRec = 'File size is healthy.';
  if (sizeMB > 500) { sizeScore = 5; sizeRating = 'poor'; sizeRec = 'File exceeds 500 MB. Audit families, purge unused content, check for imported CAD bloat.'; }
  else if (sizeMB > 300) { sizeScore = 12; sizeRating = 'fair'; sizeRec = 'File is getting large. Consider purging unused families and reducing imported geometry.'; }
  else if (sizeMB > 100) { sizeScore = 18; sizeRating = 'fair'; sizeRec = 'File size is moderate. Monitor growth over time.'; }
  sections.push({ label: 'Model Size', score: sizeScore, maxScore: 25, rating: sizeRating, detail: `${sizeMB.toFixed(0)} MB`, recommendation: sizeRec });

  // 2. External References (20 pts)
  let linkScore = 20;
  let linkRating: HealthRating = 'good';
  let linkRec = 'No external references detected.';
  const unpublished = (revitLinks || []).filter(l => l.includes('NotPublished')).length;
  if (unpublished > 0) { linkScore = 5; linkRating = 'poor'; linkRec = `${unpublished} linked model(s) not published. Publish all links before coordinating.`; }
  else if (linkCount > 15) { linkScore = 5; linkRating = 'poor'; linkRec = 'Too many external references. Consider consolidating linked models.'; }
  else if (linkCount > 5) { linkScore = 12; linkRating = 'fair'; linkRec = 'Multiple external references. Verify all links are current.'; }
  else if (linkCount > 0) { linkScore = 18; linkRating = 'good'; linkRec = 'Links are manageable and all published.'; }
  sections.push({ label: 'External References', score: linkScore, maxScore: 20, rating: linkRating, detail: `${linkCount} linked file(s)`, recommendation: linkRec });

  // 3. Best Practices (15 pts)
  let bpScore = 15;
  let bpRating: HealthRating = 'good';
  let bpRec = 'No best practice issues detected.';
  const issues: string[] = [];
  if (data.inPlaceCount > 0) { bpScore -= 7; issues.push(`${data.inPlaceCount} in-place`); }
  let singleCount = 0;
  if (families) {
    for (const types of Object.values(families)) {
      for (const count of Object.values(types)) {
        if (count === 1) singleCount++;
      }
    }
  }
  if (singleCount > 5) { bpScore -= 5; issues.push(`${singleCount} single-instance types`); }
  else if (singleCount > 0) { bpScore -= 2; issues.push(`${singleCount} single-instance`); }
  bpScore = Math.max(0, bpScore);
  if (bpScore < 8) { bpRating = 'poor'; bpRec = 'In-place components hurt performance. Convert to loadable families. Remove unused single-instance types.'; }
  else if (bpScore < 13) { bpRating = 'fair'; bpRec = 'Minor issues. Review single-instance families for potential cleanup.'; }
  sections.push({ label: 'Best Practices', score: bpScore, maxScore: 15, rating: bpRating, detail: issues.length > 0 ? issues.join(', ') : 'Clean', recommendation: bpRec });

  // 4. Publishing Readiness (15 pts)
  let pubScore = 15;
  let pubRating: HealthRating = 'good';
  let pubRec = 'Model has published sheets.';
  if (data.sheetCount === 0) { pubScore = 8; pubRating = 'fair'; pubRec = 'No sheets in published model. Sheets are only visible if published separately from the 3D model.'; }
  sections.push({ label: 'Publishing Readiness', score: pubScore, maxScore: 15, rating: pubRating, detail: data.sheetCount > 0 ? `${data.sheetCount} sheets` : 'No sheets published', recommendation: pubRec });

  // 5. Model Currency (15 pts)
  let currScore = 15;
  let currRating: HealthRating = 'good';
  const daysSince = data.fetchedAt ? (Date.now() - new Date(data.fetchedAt).getTime()) / (1000 * 60 * 60 * 24) : 999;
  let currRec = 'Model data is current.';
  let currDetail = daysSince < 1 ? 'Updated today' : `${Math.floor(daysSince)} days since analysis`;
  if (daysSince > 30) { currScore = 5; currRating = 'poor'; currRec = 'Not analyzed in over 30 days. Re-analyze to check for changes.'; currDetail = `${Math.floor(daysSince)} days stale`; }
  else if (daysSince > 7) { currScore = 10; currRating = 'fair'; currRec = 'Consider re-analyzing to ensure data is current.'; }
  sections.push({ label: 'Model Currency', score: currScore, maxScore: 15, rating: currRating, detail: currDetail, recommendation: currRec });

  // 6. Organization (10 pts)
  let orgScore = 10;
  let orgRating: HealthRating = 'good';
  let orgRec = 'Workset organization looks good.';
  let orgDetail = `${worksetCount} user worksets`;
  if (worksetCount === 0) { orgScore = 3; orgRating = 'poor'; orgRec = 'No user worksets detected. Use worksets for team coordination.'; }
  else if (worksetCount > 15) { orgScore = 5; orgRating = 'fair'; orgRec = 'Many worksets detected. Consider consolidating for simpler management.'; }
  else if (worksetCount < 3 && (data.totalElements || 0) > 1000) { orgScore = 6; orgRating = 'fair'; orgRec = 'Few worksets for a model this size. Consider adding worksets by discipline or area.'; }
  sections.push({ label: 'Organization', score: orgScore, maxScore: 10, rating: orgRating, detail: orgDetail, recommendation: orgRec });

  const totalScore = sections.reduce((s, sec) => s + sec.score, 0);
  const maxScore = 100;
  const rating: HealthRating = totalScore >= 80 ? 'good' : totalScore >= 60 ? 'fair' : 'poor';

  return {
    totalScore,
    maxScore,
    rating,
    sections,
    unavailable: [
      { label: 'Warnings Analysis', reason: 'Requires Revit Plugin' },
      { label: 'Purge Candidates', reason: 'Requires Revit Plugin' },
      { label: 'Unpinned Elements', reason: 'Requires Revit Plugin' },
    ],
  };
}
