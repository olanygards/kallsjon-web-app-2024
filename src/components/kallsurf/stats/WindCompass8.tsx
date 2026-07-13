import { WIND_SECTORS_8, type WindSector8 } from '../../../utils/windDirection8';

interface WindCompass8Props {
  selected: WindSector8[];
  onToggle: (sector: WindSector8) => void;
}

function wedgePath(index: number, outerR: number, innerR: number): string {
  const start = ((index * 45 - 22.5 - 90) * Math.PI) / 180;
  const end = ((index * 45 + 22.5 - 90) * Math.PI) / 180;
  const x1 = 50 + outerR * Math.cos(start);
  const y1 = 50 + outerR * Math.sin(start);
  const x2 = 50 + outerR * Math.cos(end);
  const y2 = 50 + outerR * Math.sin(end);
  const x3 = 50 + innerR * Math.cos(end);
  const y3 = 50 + innerR * Math.sin(end);
  const x4 = 50 + innerR * Math.cos(start);
  const y4 = 50 + innerR * Math.sin(start);
  return `M ${x1} ${y1} A ${outerR} ${outerR} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 0 0 ${x4} ${y4} Z`;
}

function labelPosition(index: number, r: number): { x: number; y: number } {
  const angle = ((index * 45 - 90) * Math.PI) / 180;
  return { x: 50 + r * Math.cos(angle), y: 50 + r * Math.sin(angle) };
}

export function WindCompass8({ selected, onToggle }: WindCompass8Props) {
  return (
    <div className="relative mx-auto w-full max-w-[220px]">
      <svg viewBox="0 0 100 100" className="w-full h-auto">
        {WIND_SECTORS_8.map((sector, index) => {
          const active = selected.includes(sector);
          const pos = labelPosition(index, 38);
          return (
            <g key={sector}>
              <path
                d={wedgePath(index, 46, 14)}
                fill={active ? '#00813E' : '#f3f3f1'}
                stroke="#e0e0dc"
                strokeWidth="0.5"
                className="cursor-pointer"
                onClick={() => onToggle(sector)}
              />
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="6"
                fontWeight="700"
                fill={active ? '#ffffff' : '#1c1c1c'}
                className="pointer-events-none select-none"
              >
                {sector}
              </text>
            </g>
          );
        })}
        <circle cx="50" cy="50" r="12" fill="#ffffff" stroke="#e0e0dc" strokeWidth="0.5" />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" fontSize="5" fill="#6b6b6b">
          {selected.length > 0 ? `${selected.length} valda` : 'Alla'}
        </text>
      </svg>
    </div>
  );
}
