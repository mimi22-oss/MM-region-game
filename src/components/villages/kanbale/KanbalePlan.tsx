import React, { useEffect, useState } from 'react';
import {
  kanbaleVillage,
  kanbaleBoundarySvgPath,
  kanbaleDrain,
  kanbaleDrainSvgPath,
} from '../../../data/villages/kanbale/kanbaleMeta';
import { hasCustomBuilding } from './KanbaleCustomBuildings';
import {
  getCachedKanbaleStreamedData,
  loadKanbaleStreamedData,
  type KanbaleStreamedData,
} from '../../../game/kanbaleTiledEditor';
import type { StreamedBuildingRecord } from '../../../game/streamedChunkRegistry';

export type KanbalePlanBuilding = StreamedBuildingRecord;

export interface KanbalePlanProps {
  labels?: boolean;
  onSelectLocation?: (id: string) => void;
  onSelectBuilding?: (building: KanbalePlanBuilding) => void;
}

/**
 * ကံပုလဲရွာ (Kanbale Village) — 2D Map SVG Plan Component
 * Reads detailed footprints and roads on demand from versioned streamed JSON chunks.
 */
export function KanbalePlan({
  labels = true,
  onSelectLocation,
  onSelectBuilding,
}: KanbalePlanProps) {
  const [streamed, setStreamed] = useState<KanbaleStreamedData | null>(() =>
    getCachedKanbaleStreamedData(),
  );
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    'way/403027623',
  );

  useEffect(() => {
    let cancelled = false;
    if (!streamed) {
      void loadKanbaleStreamedData()
        .then((data) => {
          if (!cancelled) setStreamed(data);
        })
        .catch(() => {
          // Offline / unavailable tiles degrade safely to boundary + drain outline
        });
    }
    return () => {
      cancelled = true;
    };
  }, [streamed]);

  const buildings = streamed?.buildings ?? [];
  const roads = streamed?.roads ?? [];

  const selectedBuilding = buildings.find(
    (b) => b.id === selectedBuildingId,
  );

  const handleBuildingClick = (
    e: React.MouseEvent,
    building: KanbalePlanBuilding,
  ) => {
    e.stopPropagation();
    setSelectedBuildingId((prev) => (prev === building.id ? null : building.id));
    onSelectBuilding?.(building);
  };

  return (
    <g id="village-kanbale-plan">
      <path
        d={kanbaleBoundarySvgPath}
        fill="rgba(136, 156, 98, 0.22)"
        stroke="#eab308"
        strokeWidth="2.4"
        strokeDasharray="8 5"
        strokeLinejoin="round"
      />

      <g id="kanbale-plan-roads">
        {roads.map((road) => (
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

      <g id="kanbale-plan-drain">
        <path
          d={kanbaleDrainSvgPath}
          fill="none"
          stroke="#736952"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
        <path
          d={kanbaleDrainSvgPath}
          fill="none"
          stroke="#4d9395"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
        />
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
                fill={isAh1 ? '#334155' : '#78716c'}
                stroke="#1e293b"
                strokeWidth="0.4"
                rx="0.5"
              />
              {isAh1 && (
                <line
                  x1={0}
                  y1={-b.depth / 2}
                  x2={0}
                  y2={b.depth / 2}
                  stroke="#facc15"
                  strokeWidth="0.3"
                  strokeDasharray="1.5 1.5"
                />
              )}
            </g>
          );
        })}
        {labels && (
          <g transform="translate(80 -35)">
            <rect
              x="-24"
              y="-6"
              width="48"
              height="12"
              rx="3"
              fill="#0f172a"
              opacity="0.85"
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

      <g id="kanbale-plan-buildings">
        {buildings.map((b) => {
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
            {selectedBuilding.id === 'way/403030614'
              ? '★ ကံပုလဲကျောင်း (School & Football Field)'
              : selectedBuilding.id === 'way/403027623'
                ? '★ Kanbale Farmhouse (Custom)'
                : hasCustomBuilding(selectedBuilding.id)
                  ? '★ Custom အဆောက်အအုံ'
                  : 'OSM အဆောက်အအုံ'}
          </text>
          <text x="4" y="-3" fontSize="3.8" fill="#e2e8f0">
            ID: {selectedBuilding.id}
          </text>
          <text x="4" y="3" fontSize="3.5" fill="#94a3b8">
            ဧရိယာ: {selectedBuilding.area} m² | အမြင့်: {selectedBuilding.height}m
          </text>
          <text x="4" y="9" fontSize="3.2" fill="#64748b">
            OSM ID: {selectedBuilding.osmId ?? ''}
          </text>
        </g>
      )}

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
