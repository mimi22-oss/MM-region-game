import React, { useState } from 'react';
import {
  kanbaleVillage,
  kanbaleBuildings,
  kanbaleRoads,
  kanbaleBoundarySvgPath,
  kanbaleDrain,
  kanbaleDrainSvgPath,
  type KanbaleBuildingData,
} from '../../../data/villages/kanbale';
import { hasCustomBuilding } from './KanbaleCustomBuildings';

export interface KanbalePlanProps {
  labels?: boolean;
  onSelectLocation?: (id: string) => void;
  onSelectBuilding?: (building: KanbaleBuildingData) => void;
}

/**
 * ကံပုလဲရွာ (Kanbale Village) — 2D Map SVG Plan Component
 * Minimap နှင့် Full Ward/Village Plan များတွင် တကယ့် OpenStreetMap Data အတိုင်း ရေးဆွဲပြသပေးသည်။
 *
 * ပါဝင်သော Feature များ:
 * - Village Boundary (ရွာနယ်နိမိတ် မျဉ်းကြောင်း)
 * - Real OSM Road Paths (ရွာတွင်းလမ်း ကွန်ရက်)
 * - Building Footprints (အိမ်ခြေ ၆၈၀ လုံး၏ တကယ့် Polygon ပုံသဏ္ဌာန်များ)
 * - Custom Farmhouse Highlight (`way/403027623` ရွှေဝါရောင် အမှတ်အသား)
 * - Interactive Building Selection (နှိပ်လိုက်ပါက Building ID, OSM ID, ဧရိယာ ပြသခြင်း)
 * - Fast-Travel / Teleport Target Link
 */
export function KanbalePlan({
  labels = true,
  onSelectLocation,
  onSelectBuilding,
}: KanbalePlanProps) {
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    'way/403027623',
  );

  const selectedBuilding = kanbaleBuildings.find(
    (b) => b.id === selectedBuildingId,
  );

  const handleBuildingClick = (
    e: React.MouseEvent,
    building: KanbaleBuildingData,
  ) => {
    e.stopPropagation();
    setSelectedBuildingId((prev) => (prev === building.id ? null : building.id));
    onSelectBuilding?.(building);
  };

  return (
    <g id="village-kanbale-plan">
      {/* ======================================================== */}
      {/* ၁။ ရွာနယ်နိမိတ် အောက်ခံနှင့် နယ်နိမိတ်မျဉ်း (Boundary) */}
      {/* ======================================================== */}
      <path
        d={kanbaleBoundarySvgPath}
        fill="rgba(136, 156, 98, 0.22)"
        stroke="#eab308"
        strokeWidth="2.4"
        strokeDasharray="8 5"
        strokeLinejoin="round"
      />

      {/* ======================================================== */}
      {/* ၂။ OSM လမ်းကြောင်းများ (Road Polylines) */}
      {/* ======================================================== */}
      <g id="kanbale-plan-roads">
        {kanbaleRoads.map((road) => (
          <polyline
            key={`plan-road-${road.id}`}
            points={road.worldPoints.map((p) => `${p[0]},${p[1]}`).join(' ')}
            fill="none"
            stroke="#596663"
            strokeWidth={road.width * 0.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </g>

      {/* ======================================================== */}
      {/* ၂.၅။ ရေနုတ်မြောင်း (Waterway Drain Path & Bridges) */}
      {/* ======================================================== */}
      <g id="kanbale-plan-drain">
        {/* မြောင်းဘောင် (Earthen/Concrete Trench Bank) */}
        <path
          d={kanbaleDrainSvgPath}
          fill="none"
          stroke="#736952"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
        {/* ရေပြင်အလွှာ (Water Channel Ribbon) */}
        <path
          d={kanbaleDrainSvgPath}
          fill="none"
          stroke="#4d9395"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
        />
        {/* တံတားများ (Bridges & Culverts) */}
        {kanbaleDrain.bridges.map((b, i) => {
          const x = b.u * Math.cos(Math.PI / 4) + b.v * Math.sin(Math.PI / 4);
          const z = -b.u * Math.sin(Math.PI / 4) + b.v * Math.cos(Math.PI / 4);
          const isAh1 = i === 0;
          return (
            <g
              key={`drain-bridge-${i}`}
              transform={`translate(${x} ${z}) rotate(${-45})`}
            >
              <rect
                x={-b.width / 2}
                y={-b.depth / 2}
                width={b.width}
                height={b.depth}
                fill={isAh1 ? '#596663' : '#b7ad95'}
                stroke="#2d3748"
                strokeWidth="0.4"
              />
              {isAh1 && (
                <>
                  <line
                    x1={-b.width / 2}
                    y1={-b.depth / 2}
                    x2={b.width / 2}
                    y2={-b.depth / 2}
                    stroke="#eee8d5"
                    strokeWidth="0.5"
                  />
                  <line
                    x1={-b.width / 2}
                    y1={b.depth / 2}
                    x2={b.width / 2}
                    y2={b.depth / 2}
                    stroke="#eee8d5"
                    strokeWidth="0.5"
                  />
                </>
              )}
            </g>
          );
        })}
        {labels && (
          <g transform="translate(101.96 -214.02)">
            <rect
              x="-24"
              y="-7"
              width="48"
              height="14"
              rx="3"
              fill="#1e293b"
              fillOpacity="0.85"
              stroke="#4d9395"
              strokeWidth="0.6"
            />
            <text
              x="0"
              y="3.5"
              textAnchor="middle"
              fontSize="5"
              fill="#a5f3fc"
              fontWeight="bold"
            >
              ရေနုတ်မြောင်း
            </text>
          </g>
        )}
      </g>

      {/* ======================================================== */}
      {/* ၃။ အဆောက်အအုံများ (Building Footprint Polygons) */}
      {/* ======================================================== */}
      <g id="kanbale-plan-buildings">
        {kanbaleBuildings.map((b) => {
          const isSelected = selectedBuildingId === b.id;
          const isCustom = hasCustomBuilding(b.id);
          const ptsStr = b.polygonPoints
            .map((p) => `${p[0]},${p[1]}`)
            .join(' ');

          let fillColor = b.roofColor;
          let strokeColor = '#2d3748';
          let strokeWidth = 0.4;

          if (isCustom) {
            fillColor = '#f59e0b';
            strokeColor = '#b45309';
            strokeWidth = 1.2;
          }

          if (isSelected) {
            fillColor = '#38bdf8';
            strokeColor = '#ffffff';
            strokeWidth = 2.0;
          }

          return (
            <polygon
              key={`plan-bld-${b.id}`}
              points={ptsStr}
              fill={fillColor}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              style={{ cursor: 'pointer' }}
              onClick={(e) => handleBuildingClick(e, b)}
            >
              <title>{`${b.name} (${b.id}) - ${b.area} m²`}</title>
            </polygon>
          );
        })}
      </g>

      {/* ======================================================== */}
      {/* ၄။ Custom Model စံပြအိမ် အထူးအမှတ်အသား (Star Marker) */}
      {/* ======================================================== */}
      <g
        transform={`translate(${kanbaleVillage.x} ${kanbaleVillage.z})`}
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedBuildingId('way/403027623');
        }}
      >
        <circle r="6" fill="#f59e0b" opacity="0.35" />
        <circle r="3.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="0.8" />
        {labels && (
          <text
            x="7"
            y="2.5"
            fontSize="4.8"
            fill="#fef08a"
            stroke="#1e293b"
            strokeWidth="0.6"
            fontWeight="bold"
          >
            ★ စံပြစိုက်ခင်းအိမ် (Kanbale Farmhouse)
          </text>
        )}
      </g>

      {/* ======================================================== */}
      {/* ၄.၁။ Custom Model ကံပုလဲကျောင်း အထူးအမှတ်အသား (School Landmark Star Marker) */}
      {/* ======================================================== */}
      <g
        transform="translate(451.73 -569.03)"
        style={{ cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedBuildingId('way/403030614');
        }}
      >
        <circle r="7" fill="#10b981" opacity="0.35" />
        <circle r="4" fill="#059669" stroke="#ffffff" strokeWidth="0.8" />
        {labels && (
          <text
            x="8"
            y="2.5"
            fontSize="4.8"
            fill="#a7f3d0"
            stroke="#1e293b"
            strokeWidth="0.6"
            fontWeight="bold"
          >
            ★ ကံပုလဲကျောင်း (School & Football Field)
          </text>
        )}
      </g>

      {/* ======================================================== */}
      {/* ၅။ ရွေးချယ်ထားသော အဆောက်အအုံ အချက်အလက် Card Popup */}
      {/* ======================================================== */}
      {selectedBuilding && (
        <g
          transform={`translate(${selectedBuilding.x + 8} ${selectedBuilding.z - 8})`}
          style={{ pointerEvents: 'none' }}
        >
          {/* Card Background */}
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
          {/* Building Title */}
          <text
            x="4"
            y="-9"
            fontSize="4.5"
            fill="#38bdf8"
            fontWeight="bold"
          >
            {selectedBuilding.id === 'way/403030614'
              ? '★ ကံပုလဲကျောင်း (School & Football Field)'
              : selectedBuilding.id === 'way/403027623'
                ? '★ Kanbale Farmhouse (Custom)'
                : hasCustomBuilding(selectedBuilding.id)
                  ? '★ Custom အဆောက်အအုံ'
                  : 'OSM အဆောက်အအုံ'}
          </text>
          {/* Details */}
          <text x="4" y="-3" fontSize="3.8" fill="#e2e8f0">
            ID: {selectedBuilding.id}
          </text>
          <text x="4" y="3" fontSize="3.5" fill="#94a3b8">
            ဧရိယာ: {selectedBuilding.area} m² | အမြင့်: {selectedBuilding.height}m
          </text>
          <text x="4" y="9" fontSize="3.2" fill="#64748b">
            OSM ID: {selectedBuilding.osmId}
          </text>
        </g>
      )}

      {/* ======================================================== */}
      {/* ၆။ ရွာအမည် စာသားနှင့် Teleport သွားရောက်နိုင်သော ခလုတ် */}
      {/* ======================================================== */}
      {labels && (
        <g
          className="map-region-clickable"
          style={{ cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectLocation?.('kanbale');
          }}
        >
          <rect
            x={kanbaleVillage.labelPos.x - 38}
            y={kanbaleVillage.labelPos.z - 12}
            width="76"
            height="20"
            rx="5"
            fill="#1e293b"
            stroke="#eab308"
            strokeWidth="1.2"
            opacity="0.92"
          />
          <text
            x={kanbaleVillage.labelPos.x}
            y={kanbaleVillage.labelPos.z + 2}
            textAnchor="middle"
            fontSize="12"
            fill="#fef08a"
            stroke="#0f172a"
            strokeWidth="0.5"
            fontWeight="bold"
          >
            {kanbaleVillage.name} ↗
          </text>
        </g>
      )}
    </g>
  );
}
