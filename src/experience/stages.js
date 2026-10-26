// The story of the estate, stage by stage. Scroll progress windows come from the
// master plan (estate/plan.js), so the copy, the rail and the 3D world never drift apart.
// VÉRONA is a fictional development: nothing here describes a real site.

import { SEG } from './estate/plan.js'

export const stages = [
  {
    id: 'land',
    label: 'The Land',
    range: SEG.land,
    rest: 0.06,
  },
  {
    id: 'prep',
    label: 'Preparation',
    index: '01',
    eyebrow: 'Stage 01 / Preparing the ground',
    title: ['The land is', 'read first.'],
    copy:
      'Plots are set out to the master plan. The access road is graded, the ground is cleared only where we build, and excavation begins plot by plot.',
    facts: ['Eight plots on one master plan', 'Access road graded from the gate', 'Mature woodland retained'],
    range: SEG.prep,
    rest: 0.2,
  },
  {
    id: 'foundations',
    label: 'Foundations',
    index: '02',
    eyebrow: 'Stage 02 / Foundations',
    title: ['Built on', 'what you cannot see.'],
    copy:
      'Footings are cast in the excavations, the ground is consolidated, and each slab is reinforced bar by bar before the concrete is poured across it.',
    facts: ['Reinforced ground-bearing slabs', 'Pool shells cast with the foundations', 'Backfilled to finished levels'],
    range: SEG.foundations,
    rest: 0.32,
  },
  {
    id: 'structure',
    label: 'Structure',
    index: '03',
    eyebrow: 'Stage 03 / Structure',
    title: ['A frame that', 'holds the view.'],
    copy:
      'Columns rise, slabs are propped and poured, and each upper volume is cast to cantilever beyond the floor below. The crane works across every plot.',
    facts: ['Cast in-situ concrete frame', 'Cantilevered upper storeys', 'Formwork struck after curing'],
    range: SEG.structure,
    rest: 0.47,
  },
  {
    id: 'architecture',
    label: 'Architecture',
    index: '04',
    eyebrow: 'Stage 04 / Architecture',
    title: ['Stone, glass,', 'oak and light.'],
    copy:
      'Walls close in, clad in travertine and mineral render. Full-height glazing goes in bay by bay, then oak soffits and fins temper the afternoon sun.',
    facts: ['Travertine and mineral render', 'Floor-to-ceiling glazing', 'Oak soffits and solar fins'],
    range: SEG.architecture,
    rest: 0.63,
  },
  {
    id: 'landscape',
    label: 'Landscape',
    index: '05',
    eyebrow: 'Stage 05 / Landscape & infrastructure',
    title: ['Streets that', 'feel like gardens.'],
    copy:
      'The road is surfaced from the gate inwards, footpaths and lighting follow, and a cypress avenue is planted. Gardens, terraces and pools are finished last.',
    facts: ['Cypress avenue and lit footpaths', 'Private gardens and pool terraces', 'Hoarding removed, ground restored'],
    range: SEG.landscape,
    rest: 0.8,
  },
  {
    id: 'reveal',
    label: 'The Estate',
    index: '06',
    eyebrow: 'Stage 06 / The estate',
    title: ['Eight homes,', 'one landscape.'],
    copy:
      'At dusk the estate comes alive: lit interiors, warm terraces and still water, all held within the trees that were here before we arrived.',
    facts: ['Seven villas and a residents’ club', 'Golden-hour orientation', 'A private, gated setting'],
    range: SEG.reveal,
    rest: 0.935,
  },
  {
    id: 'handoff',
    label: 'Your Viewing',
    range: SEG.handoff,
    rest: 0.985,
  },
]

export const LAST = stages.length - 1

export function stageAt(progress) {
  for (let i = stages.length - 1; i >= 0; i--) if (progress >= stages[i].range[0]) return i
  return 0
}
