import { memo } from 'react'
import { BUILDINGS, ROAD, SITE, worldRect } from './estate/plan.js'

// The master plan as an architectural drawing, generated from the same data as the
// 3D estate. It is the poster while the 3D view loads and the fallback when WebGL is
// unavailable. Layers appear stage by stage (see experience.css, [data-stage]).
// SVG x = world z (entrance on the right), SVG y = world x.

const pad = 18
const vb = [SITE.z0 - pad, SITE.x0 - pad, SITE.z1 - SITE.z0 + pad * 2 + 30, SITE.x1 - SITE.x0 + pad * 2]

function rect(r, props) {
  return <rect x={r.cz - r.hd} y={r.cx - r.hw} width={r.hd * 2} height={r.hw * 2} {...props} />
}

export default memo(function SitePlan({ stage }) {
  const C = ROAD.circle
  return (
    <svg className="site-plan" data-stage={stage} viewBox={vb.join(' ')} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <pattern id="plan-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="3" className="plan-hatch-line" />
        </pattern>
      </defs>
      <g className="plan-layer plan-layer--land">
        <rect x={SITE.z0} y={SITE.x0} width={SITE.z1 - SITE.z0} height={SITE.x1 - SITE.x0} className="plan-boundary" />
        {Array.from({ length: 14 }, (_, i) => (
          <path key={i} className="plan-contour" d={`M ${SITE.z0 - pad} ${SITE.x0 - pad + i * 12} C ${-40} ${SITE.x0 + i * 12 + 9}, ${60} ${SITE.x0 + i * 12 - 9}, ${SITE.z1 + 40} ${SITE.x0 - pad + i * 12 + 4}`} />
        ))}
      </g>
      <g className="plan-layer plan-layer--prep">
        <rect x={C.z} y={-ROAD.halfWidth} width={ROAD.z0 + 30 - C.z} height={ROAD.halfWidth * 2} className="plan-road" />
        <circle cx={C.z} cy={C.x} r={C.r} className="plan-road" />
        {BUILDINGS.map((b) => (
          <g key={b.id}>{rect(b.plotRect, { className: 'plan-plot' })}</g>
        ))}
      </g>
      <g className="plan-layer plan-layer--foundations">
        {BUILDINGS.map((b) => (
          <g key={b.id}>{rect(b.footprint, { className: 'plan-slab', fill: 'url(#plan-hatch)' })}</g>
        ))}
      </g>
      <g className="plan-layer plan-layer--structure">
        {BUILDINGS.map((b) =>
          b.upper ? <g key={b.id}>{rect(worldRect(b, b.upper.x0, b.upper.x1, b.upper.z0, b.upper.z1), { className: 'plan-upper' })}</g> : null,
        )}
      </g>
      <g className="plan-layer plan-layer--architecture">
        {BUILDINGS.map((b) => (
          <g key={b.id}>{rect(b.footprint, { className: 'plan-house' })}</g>
        ))}
      </g>
      <g className="plan-layer plan-layer--landscape">
        <rect x={C.z} y={-ROAD.halfWidth} width={ROAD.z0 + 30 - C.z} height={ROAD.halfWidth * 2} className="plan-asphalt" />
        <circle cx={C.z} cy={C.x} r={C.r} className="plan-asphalt" />
        <circle cx={C.z} cy={C.x} r={ROAD.island} className="plan-lawn" />
        {BUILDINGS.map((b) => (
          <g key={b.id}>
            {rect(worldRect(b, b.pool.x0, b.pool.x1, b.pool.z0, b.pool.z1), { className: 'plan-pool' })}
            {rect(b.driveRect, { className: 'plan-drive' })}
          </g>
        ))}
        {Array.from({ length: 18 }, (_, i) => (
          <g key={i}>
            <circle cx={ROAD.z0 - 10 - i * 13} cy={-4.8} r={1.4} className="plan-tree" />
            <circle cx={ROAD.z0 - 16 - i * 13} cy={4.8} r={1.4} className="plan-tree" />
          </g>
        ))}
      </g>
    </svg>
  )
})
