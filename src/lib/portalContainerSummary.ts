export interface PortalContainerSummary {
  total: number;
  in_yard: number;
  released: number;
  on_hold: number;
  repair: number;
}

export function portalContainerSummarySelect(containerAlias = 'c') {
  return `
    COUNT(*) AS total,
    SUM(CASE WHEN ${containerAlias}.status = 'in_yard' THEN 1 ELSE 0 END) AS in_yard,
    SUM(CASE WHEN ${containerAlias}.status IN ('released', 'gated_out') THEN 1 ELSE 0 END) AS released,
    SUM(CASE WHEN ISNULL(${containerAlias}.hold_status, '') <> '' THEN 1 ELSE 0 END) AS on_hold,
    SUM(CASE WHEN ${containerAlias}.status IN ('repair', 'under_repair', 'mnr') THEN 1 ELSE 0 END) AS repair
  `;
}

export function normalizePortalContainerSummary(row: Partial<PortalContainerSummary> | undefined): PortalContainerSummary {
  return {
    total: Number(row?.total || 0),
    in_yard: Number(row?.in_yard || 0),
    released: Number(row?.released || 0),
    on_hold: Number(row?.on_hold || 0),
    repair: Number(row?.repair || 0),
  };
}
