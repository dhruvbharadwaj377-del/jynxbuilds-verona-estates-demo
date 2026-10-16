// Story beats for the residence walkthrough.
// Each chapter is one viewport of scroll. The camera flies between the
// keyframes, and the same data drives the text, the hotspots and the
// still-image fallback, so the three can never drift apart.

const IMG = '/Images'

export const chapters = [
  {
    id: 'intro',
    label: 'Overview',
    camera: { position: [-27, 9.5, 31], target: [-3.5, 0.8, 1] },
    still: `${IMG}/hero.jpg`,
    hotspots: [],
  },
  {
    id: 'arrival',
    label: 'Arrival',
    index: '01',
    eyebrow: 'Chapter 01 / Arrival',
    title: ['A slow', 'approach.'],
    copy:
      'A lit stone path rises through the garden. The house reveals itself in stages — the stone core first, then the glass, then the light inside.',
    camera: { position: [9, 1.5, 31], target: [1.5, 2.6, 0] },
    still: `${IMG}/property-03.jpg`,
    hotspots: [
      {
        id: 'path',
        label: 'Garden path',
        position: [5.6, -0.3, 19.5],
        detail:
          'Low bollard lighting traces the route to the door, keeping the garden dark enough to read the architecture.',
      },
      {
        id: 'core',
        label: 'Stone core',
        position: [8.2, 5.2, 5.45],
        detail:
          'A solid travertine volume anchors the plan and carries the cantilevered upper level.',
      },
    ],
  },
  {
    id: 'terrace',
    label: 'Terrace',
    index: '02',
    eyebrow: 'Chapter 02 / The Terrace',
    title: ['Water as', 'architecture.'],
    copy:
      'The pool runs the length of the terrace and ends in a vanishing edge — the living room opens straight onto it, so outdoors becomes another room.',
    camera: { position: [-15.5, 1.55, 12.5], target: [-1.5, 1.4, 3.5] },
    still: `${IMG}/pool.jpg`,
    hotspots: [
      {
        id: 'pool',
        label: 'Infinity edge',
        position: [-9.5, 0.05, 8.2],
        detail:
          'The water spills over a concealed edge, so the surface appears to meet the horizon.',
      },
      {
        id: 'deck',
        label: 'Sun terrace',
        position: [-6.5, 0.05, 4.3],
        detail:
          'A continuous stone floor runs from the living room to the water with no change in level.',
      },
    ],
  },
  {
    id: 'living',
    label: 'Living',
    index: '03',
    eyebrow: 'Chapter 03 / The Pavilion',
    title: ['Glass, light,', 'room to breathe.'],
    copy:
      'The ground floor is a glass pavilion under a timber soffit. Full-height glazing slides away and the living room joins the terrace.',
    camera: { position: [7, 1.85, 9.5], target: [-3, 1.9, 0.5] },
    still: `${IMG}/living-room.jpg`,
    hotspots: [
      {
        id: 'glazing',
        label: 'Full-height glazing',
        position: [-2.6, 1.9, 3.6],
        detail:
          'Slim-framed sliding panels run floor to ceiling, so the interior reads as one continuous view.',
      },
      {
        id: 'soffit',
        label: 'Timber soffit',
        position: [3.2, 3.35, 4.6],
        detail:
          'Warm timber lines the underside of the cantilever, lit by recessed downlights at dusk.',
      },
    ],
  },
  {
    id: 'suite',
    label: 'The Suite',
    index: '04',
    eyebrow: 'Chapter 04 / The Suite',
    title: ['A suite that', 'floats.'],
    copy:
      'The upper level cantilevers over the terrace and turns towards the skyline. Private quarters, held above the garden.',
    camera: { position: [9.5, 6.6, 15.5], target: [-1.5, 5.4, 1] },
    still: `${IMG}/bedroom.jpg`,
    hotspots: [
      {
        id: 'cantilever',
        label: 'Cantilever',
        position: [-9.6, 3.6, 4.9],
        detail:
          'The suite projects over the terrace with no columns below, sheltering the pool deck.',
      },
      {
        id: 'outlook',
        label: 'Skyline outlook',
        position: [-2.2, 5.8, 4.75],
        detail:
          'Glazing on the upper level faces the city, framing the skyline from the bed.',
      },
    ],
  },
  {
    id: 'closing',
    label: 'Your Viewing',
    index: '05',
    camera: { position: [26, 15, 30], target: [-2, 1.2, 1] },
    still: `${IMG}/hero.jpg`,
    hotspots: [],
  },
]

export const hotspotIndex = Object.fromEntries(
  chapters.flatMap((chapter) =>
    chapter.hotspots.map((hotspot) => [hotspot.id, { ...hotspot, chapter: chapter.id }]),
  ),
)
