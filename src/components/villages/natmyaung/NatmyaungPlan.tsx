import React, { useState } from 'react';
import {
  natmyaungVillage,
  natmyaungBuildings,
  natmyaungRoads,
  natmyaungBoundarySvgPath,
  natmyaungPonds,
  type NatmyaungBuildingData,
} from '../../../data/villages/natmyaung';

export interface NatmyaungPlanProps {
  labels?: boolean;
  onSelectLocation?: (id: string) => void;
  onSelectBuilding?: (building: NatmyaungBuildingData) => void;
}

/**
 * နတ်မြောင်းရွာ (Nat Myaung Village) — 2D Map SVG Plan Component
 * Minimap နှင့် Full Ward/Village Plan များတွင် တကယ့် OpenStreetMap Data အတိုင်း ရေးဆွဲပြသပေးသည်။
 */
export function NatmyaungPlan({
  labels = true,
  onSelectLocation,
  onSelectBuilding,
}: NatmyaungPlanProps) {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  const selectedBuilding = natmyaungBuildings.find(
    (b) => b.id === selectedBuildingId,
  );

  const handleBuildingClick = (
    e: React.MouseEvent,
    building: NatmyaungBuildingData,
  ) => {
    e.stopPropagation();
    setSelectedBuildingId((prev) => (prev === building.id ? null : building.id));
    onSelectBuilding?.(building);
  };

  return (
    <g id="village-natmyaung-plan">
      {/* ======================================================== */}
      {/* ၁။ ရွာနယ်နိမိတ် အောက်ခံနှင့် နယ်နိမိတ်မျဉ်း (Boundary) */}
      {/* ======================================================== */}
      <path
        d={natmyaungBoundarySvgPath}
        fill="rgba(132, 153, 95, 0.24)"
        stroke="#eab308"
        strokeWidth="2.4"
        strokeDasharray="8 5"
        strokeLinejoin="round"
      />

      {/* ======================================================== */}
      {/* ၂။ OSM လမ်းကြောင်းများ (Road Polylines) */}
      {/* ======================================================== */}
      <g id="natmyaung-plan-roads">
        {natmyaungRoads.map((road) => (
          <polyline
            key={`nm-plan-road-${road.id}`}
            points={road.worldPoints.map((p) => `${p[0]},${p[1]}`).join(' ')}
            fill="none"
            stroke={road.highway === 'trunk' ? '#3a4443' : '#5f665e'}
            strokeWidth={road.width * 0.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>

      {/* ======================================================== */}
      {/* ၃။ နတ်မြောင်း ရွာလယ်ရေကန် (Village Pond) */}
      {/* ======================================================== */}
      {natmyaungPonds.map((pond) => (
        <circle
          key={`nm-plan-pond-${pond.id}`}
          cx={pond.x}
          cy={pond.z}
          r={pond.width / 2}
          fill="#2a6f97"
          stroke="#606c38"
          strokeWidth="1.2"
        />
      ))}

      {/* ======================================================== */}
      {/* ၄။ အဆောက်အအုံများ (Buildings) */}
      {/* ======================================================== */}
      <g id="natmyaung-plan-buildings">
        {natmyaungBuildings.map((b) => {
          const isSelected = selectedBuildingId === b.id;
          let fillColor = b.roofColor;
          let strokeColor = '#2d3748';
          let strokeWidth = 0.5;

          if (b.isLandmark) {
            strokeColor = '#fbbf24';
            strokeWidth = 1.4;
          }

          if (isSelected) {
            fillColor = '#38bdf8';
            strokeColor = '#ffffff';
            strokeWidth = 2.0;
          }

          const rotDeg = (b.rotation * 180) / Math.PI;

          return (
            <g
              key={`nm-plan-bld-${b.id}`}
              transform={`translate(${b.x} ${b.z}) rotate(${rotDeg})`}
              style={{ cursor: 'pointer' }}
              onClick={(e) => handleBuildingClick(e, b)}
            >
              <rect
                x={-b.width / 2}
                y={-b.depth / 2}
                width={b.width}
                height={b.depth}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                rx="0.8"
              />
              <title>{`${b.name} (${b.id})`}</title>
            </g>
          );
        })}
      </g>

      {/* ======================================================== */}
      {/* ၅။ ရွေးချယ်ထားသော အဆောက်အအုံ Card Popup */}
      {/* ======================================================== */}
      {selectedBuilding && (
        <g
          transform={`translate(${selectedBuilding.x + 8} ${selectedBuilding.z - 8})`}
          style={{ pointerEvents: 'none' }}
        >
          <rect
            x="-4"
            y="-18"
            width="88"
            height="32"
            rx="4"
            fill="#0f172a"
            stroke="#38bdf8"
            strokeWidth="1.0"
            opacity="0.95"
          />
          <text
            x="4"
            y="-9"
            fontSize="4.5"
            fill="#38bdf8"
            fontWeight="bold"
          >
            {selectedBuilding.name}
          </text>
          <text x="4" y="-3" fontSize="3.8" fill="#e2e8f0">
            ID: {selectedBuilding.id}
          </text>
          <text x="4" y="3" fontSize="3.5" fill="#94a3b8">
            ဧရိယာ: {selectedBuilding.area} m² | {selectedBuilding.storeys ? `${selectedBuilding.storeys} ထပ်` : '၂ ထပ်'} | {selectedBuilding.type}
          </text>
          <text x="4" y="9" fontSize="3.2" fill="#64748b">
            OSM ID: {selectedBuilding.osmId}
          </text>
        </g>
      )}

      {/* ======================================================== */}
      {/* ၆။ ရွာအမည် စာသားနှင့် ရပ်ကွက်များ (Wards & Quarter Labels) */}
      {/* ======================================================== */}
      {labels && (
        <g id="natmyaung-ward-labels">
          <g
            className="map-region-clickable"
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectLocation?.('natmyaung');
            }}
          >
            <rect
              x={natmyaungVillage.labelPos.x - 38}
              y={natmyaungVillage.labelPos.z - 12}
              width="76"
              height="20"
              rx="5"
              fill="#1e293b"
              stroke="#eab308"
              strokeWidth="1.2"
              opacity="0.92"
            />
            <text
              x={natmyaungVillage.labelPos.x}
              y={natmyaungVillage.labelPos.z + 2}
              textAnchor="middle"
              fontSize="12"
              fill="#fef08a"
              stroke="#0f172a"
              strokeWidth="0.5"
              fontWeight="bold"
            >
              {natmyaungVillage.name} ↗
            </text>
          </g>

          {/* ရပ်ကွက် နာမည်များ (Wards & Quarters) */}
          {[
            { name: 'အထက ရပ်ကွက်', x: 2925.9, z: 2942.9 },
            { name: 'ဆရာခန့် ရပ်ကွက်', x: 2959.2, z: 3008.7 },
            { name: 'နတ်မြောင်း ဗဟိုရပ်ကွက်', x: 2987.5, z: 2952.1 },
            { name: 'ဂျပန်ကြီး ရပ်ကွက်', x: 2984.0, z: 2828.4 },
            { name: 'ငွေသရဖူ ရပ်ကွက်', x: 3033.5, z: 2977.0 },
            { name: 'ကျော်အင်နာဂျီ ရပ်ကွက်', x: 3047.6, z: 3026.4 },
            { name: 'မြောက်ပိုင်း ရပ်ကွက်', x: 2945.1, z: 2909.7 },
            { name: 'အရှေ့စု ရပ်ကွက်', x: 3051.2, z: 2916.9 },
          ].map((q) => (
            <g key={`nm-ward-${q.name}`} transform={`translate(${q.x} ${q.z})`}>
              <rect
                x="-24"
                y="-6"
                width="48"
                height="12"
                rx="3"
                fill="#0f172a"
                stroke="#64748b"
                strokeWidth="0.6"
                opacity="0.82"
              />
              <text
                x="0"
                y="2.5"
                textAnchor="middle"
                fontSize="4.2"
                fill="#94a3b8"
                fontWeight="bold"
              >
                {q.name}
              </text>
            </g>
          ))}
        </g>
      )}
    </g>
  );
}
