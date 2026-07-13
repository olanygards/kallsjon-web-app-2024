/** 8-sektors vindros enligt Beslut 06.4 (N NO O SO S SV V NV). */

export const WIND_SECTORS_8 = ['N', 'NO', 'O', 'SO', 'S', 'SV', 'V', 'NV'] as const;
export type WindSector8 = (typeof WIND_SECTORS_8)[number];

/** N centrerad på 0° ± 22,5° → sektor = 45°. */
export function degreesToSector8(degrees: number): WindSector8 {
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.floor((normalized + 22.5) / 45) % 8;
  return WIND_SECTORS_8[index];
}

export function formatDirectionLabel(degrees: number): string {
  return `${degreesToSector8(degrees)} ${Math.round(degrees)}°`;
}
