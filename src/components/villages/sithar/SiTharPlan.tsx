import React, { useState } from 'react';
import {
  siTharVillage,
  siTharBuildings,
  siTharRoads,
  siTharBoundarySvgPath,
  siTharSeparationFields,
  siTharLeftSeparationFields,
  siTharRightSeparationFields,
  type SiTharBuildingData,
} from '../../../data/villages/sithar';

export interface SiTharPlanProps {
  labels?: boolean;
  onSelectLocation?: (id: string) => void;
  onSelectBuilding?: (building: SiTharBuildingData) => void;
}

/**
 * စည်သာရွာ (Si Thar Village) — 2D Map SVG Plan Component
 * Minimap နှင့် Full Ward/Village Plan များတွင် OpenStreetMap Data အတိုင်း ရေးဆွဲပြသပေးသည်။
 */
export function SiTharPlan({
  labels = true,
  onSelectLocation,
  onSelectBuilding,
}: SiTharPlanProps) {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);

  const selectedBuilding = siTharBuildings.find(
    (b) => b.id === selectedBuildingId,
  );

  const handleBuildingClick = (
    e: React.MouseEvent,
    building: SiTharBuildingData,
  ) => {
    e.stopPropagation();
    setSelectedBuildingId((prev) => (prev === building.id ? null : building.id));
    onSelectBuilding?.(building);
  };

  return (
    <g id="village-sithar-plan">
      {/* ၁။ ရွာနယ်နိမိတ် အောက်ခံနှင့် နယ်နိမိတ်မျဉ်း (Boundary) */}
      <path
        d={siTharBoundarySvgPath}
        fill="rgba(132, 153, 95, 0.24)"
        stroke="#eab308"
        strokeWidth="2.4"
        strokeDasharray="8 5"
        strokeLinejoin="round"
      />

      {/* Village gaps: ten fields north and ten south. */}
      <g id="sithar-plan-sep-fields">
        {siTharSeparationFields.map((f) => (
          <rect
            key={`st-plan-sep-${f.id}`}
            x={f.x - f.width / 2}
            y={f.z - f.depth / 2}
            width={f.width}
            height={f.depth}
            transform={`rotate(${-(f.rotation*180)/Math.PI} ${f.x} ${f.z})`}
            fill={f.color}
            stroke="#556b2f"
            strokeWidth="0.8"
            opacity="0.8"
          />
        ))}
      </g>

      {/* ၃။ OSM လမ်းကြောင်းများ (Road Polylines) */}
      <g id="sithar-plan-roads">
        {siTharRoads.map((road) => (
          <polyline
            key={`st-plan-road-${road.id}`}
            points={road.worldPoints.map((p) => `${p[0]},${p[1]}`).join(' ')}
            fill="none"
            stroke={road.highway === 'trunk' ? '#3a4443' : '#5f665e'}
            strokeWidth={road.width * 0.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>

      {/* ၄။ အဆောက်အအုံများနှင့် အိမ်ဝန်း ခြံစည်းရိုးများ (Buildings & Individual Compound Plots) */}
      <g id="sithar-plan-buildings">
        {siTharBuildings.map((b) => {
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

          const compoundW = b.compoundWidth || (b.width + 1.6);
          const compoundD = b.compoundDepth || (b.depth + 1.4);
          const sideHalf = compoundW / 2;
          const frontHalf = compoundD / 2;
          const backHalf = compoundD / 2;
          const gateWidth = Math.min(2.0, compoundW * 0.42);
          const gateHalf = gateWidth / 2;
          const showFence = !b.type.includes('church') && !b.type.includes('monastery') && !b.type.includes('station');

          return (
            <g
              key={`st-plan-bldg-${b.id}`}
              transform={`translate(${b.x} ${b.z}) rotate(${(-b.rotation * 180) / Math.PI})`}
            >
              {showFence && (
                <g className="compound-plot">
                  {/* အိမ်ဝန်း ခြံကွက် အောက်ခံ (Yard Plot Base) */}
                  <rect
                    x={-sideHalf}
                    y={-backHalf}
                    width={compoundW}
                    height={compoundD}
                    fill="#8ba06b"
                    opacity={0.32}
                    rx={0.4}
                  />
                  {/* ဘယ်ဘက် သံဇကာခြံစည်းရိုး */}
                  <line
                    x1={-sideHalf}
                    y1={-backHalf}
                    x2={-sideHalf}
                    y2={frontHalf}
                    stroke="#68767a"
                    strokeWidth={0.5}
                    strokeDasharray="1.0 0.8"
                  />
                  {/* ညာဘက် သံဇကာခြံစည်းရိုး */}
                  <line
                    x1={sideHalf}
                    y1={-backHalf}
                    x2={sideHalf}
                    y2={frontHalf}
                    stroke="#68767a"
                    strokeWidth={0.5}
                    strokeDasharray="1.0 0.8"
                  />
                  {/* နောက်ဘက် သံဇကာခြံစည်းရိုး */}
                  <line
                    x1={-sideHalf}
                    y1={-backHalf}
                    x2={sideHalf}
                    y2={-backHalf}
                    stroke="#68767a"
                    strokeWidth={0.5}
                    strokeDasharray="1.0 0.8"
                  />
                  {/* အရှေ့ဘက် သံဇကာတောင်ပံများနှင့် ဂိတ်ပေါက် */}
                  <line
                    x1={-sideHalf}
                    y1={frontHalf}
                    x2={-gateHalf}
                    y2={frontHalf}
                    stroke="#2563a6"
                    strokeWidth={0.9}
                  />
                  <line
                    x1={gateHalf}
                    y1={frontHalf}
                    x2={sideHalf}
                    y2={frontHalf}
                    stroke="#2563a6"
                    strokeWidth={0.9}
                  />
                </g>
              )}

              {/* အဆောက်အအုံ အမိုး (Building Roof) */}
              <rect
                x={-b.width / 2}
                y={-b.depth / 2}
                width={b.width}
                height={b.depth}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                rx={0.4}
                cursor="pointer"
                onClick={(e) => handleBuildingClick(e, b)}
              >
                <title>{`${b.name} (${b.type})`}</title>
              </rect>
            </g>
          );
        })}
      </g>

      {/* ၅။ အထင်ကရနေရာ စာသား Label များ (Landmark Labels) */}
      {labels && (
        <g id="sithar-plan-labels" pointerEvents="none">
          {/* ရွာအမည် Label */}
          <text
            x={siTharVillage.labelPos.x}
            y={siTharVillage.labelPos.z - 8}
            textAnchor="middle"
            fill="#fef08a"
            stroke="#1c1917"
            strokeWidth="3.2"
            paintOrder="stroke"
            fontSize="14"
            fontWeight="bold"
            fontFamily="'Pyidaungsu', 'Padauk', sans-serif"
          >
            {siTharVillage.name}
          </text>
          <text
            x={siTharVillage.labelPos.x}
            y={siTharVillage.labelPos.z + 5}
            textAnchor="middle"
            fill="#e2e8f0"
            stroke="#1c1917"
            strokeWidth="2.2"
            paintOrder="stroke"
            fontSize="9.5"
            fontFamily="'Pyidaungsu', 'Padauk', sans-serif"
          >
            Si Thar Village
          </text>

          {/* Landmarks Labels */}
          {siTharBuildings
            .filter((b) => b.isLandmark)
            .map((lm) => (
              <g key={`st-plan-label-${lm.id}`}>
                <circle
                  cx={lm.x}
                  cy={lm.z}
                  r="3.2"
                  fill="#fbbf24"
                  stroke="#78350f"
                  strokeWidth="1.0"
                />
                <text
                  x={lm.x}
                  y={lm.z - 5}
                  textAnchor="middle"
                  fill="#ffffff"
                  stroke="#0f172a"
                  strokeWidth="2.6"
                  paintOrder="stroke"
                  fontSize="8.5"
                  fontWeight="bold"
                  fontFamily="'Pyidaungsu', 'Padauk', sans-serif"
                >
                  {lm.name}
                </text>
              </g>
            ))}
        </g>
      )}

      {/* ၆။ ရွေးချယ်ထားသော အဆောက်အအုံ Info Popup Card */}
      {selectedBuilding && (
        <g
          id="sithar-plan-selected-popup"
          transform={`translate(${selectedBuilding.x + 8}, ${selectedBuilding.z - 24})`}
        >
          <rect
            width="140"
            height="46"
            rx="6"
            fill="rgba(15, 23, 42, 0.94)"
            stroke="#38bdf8"
            strokeWidth="1.5"
          />
          <text
            x="8"
            y="17"
            fill="#f8fafc"
            fontSize="9"
            fontWeight="bold"
            fontFamily="'Pyidaungsu', 'Padauk', sans-serif"
          >
            {selectedBuilding.name}
          </text>
          <text
            x="8"
            y="30"
            fill="#94a3b8"
            fontSize="7.5"
            fontFamily="'Pyidaungsu', 'Padauk', sans-serif"
          >
            {`အမျိုးအစား: ${selectedBuilding.type} · ${selectedBuilding.width}m × ${selectedBuilding.depth}m`}
          </text>
          <text
            x="8"
            y="40"
            fill="#38bdf8"
            fontSize="7.5"
            fontFamily="'Pyidaungsu', 'Padauk', sans-serif"
          >
            {`ဧရိယာ: ${selectedBuilding.area} စတုရန်းမီတာ`}
          </text>
        </g>
      )}
    </g>
  );
}
