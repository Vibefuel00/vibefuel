// Hand-inked cloud band between the hero and the integrations section.
// Each layer is one 1600-wide tile drawn three times; the CSS drift moves
// the layer by exactly one tile so the loop never shows a seam.

type Puff = readonly [x: number, y: number, r: number]

const FRONT: ReadonlyArray<readonly Puff[]> = [
  [[110, 132, 44], [176, 104, 60], [262, 96, 66], [346, 112, 52], [412, 138, 36]],
  [[560, 140, 34], [616, 116, 48], [676, 124, 42], [724, 144, 28]],
  [[840, 128, 50], [922, 92, 70], [1018, 88, 66], [1102, 112, 52], [1166, 140, 36]],
  [[1300, 142, 30], [1350, 120, 44], [1406, 128, 38], [1450, 146, 26]],
  [[1520, 130, 40], [1584, 106, 56], [1640, 126, 44]],
]

const BACK: ReadonlyArray<readonly Puff[]> = [
  [[40, 98, 26], [86, 80, 38], [136, 88, 32], [178, 104, 22]],
  [[470, 90, 30], [520, 70, 42], [578, 82, 34], [622, 98, 24]],
  [[760, 102, 22], [798, 86, 32], [840, 96, 26]],
  [[1220, 94, 28], [1270, 74, 40], [1326, 88, 32], [1370, 104, 22]],
  [[1470, 106, 20], [1504, 94, 28], [1540, 108, 20]],
]

const SPECKS: ReadonlyArray<readonly [number, number]> = [
  [470, 150], [500, 62], [760, 150], [790, 46], [1230, 150], [1260, 60],
  [1480, 150], [1600, 58], [1655, 100],
]

const TILE = 1600
const TILES = 3

function CloudTile({
  clouds,
  id,
  ink,
  fill,
}: {
  clouds: ReadonlyArray<readonly Puff[]>
  id: string
  ink: string
  fill: string
}) {
  const wrapped = clouds.map((cloud) =>
    cloud.map(([x, y, r]) => [x - TILE, y, r] as const)
  )
  const all = [...clouds, ...wrapped]
  return (
    <symbol id={id} viewBox="0 0 1600 200">
      {/* Outline pass: slightly larger ink circles under the fill pass give
          one continuous outline around each cloud's union. */}
      {all.map((cloud, i) => (
        <g key={`o${i}`} fill={ink}>
          {cloud.map(([x, y, r], j) => (
            <circle key={j} cx={x} cy={y} r={r + 2.5} />
          ))}
        </g>
      ))}
      {all.map((cloud, i) => (
        <g key={`f${i}`} fill={fill}>
          {cloud.map(([x, y, r], j) => (
            <circle key={j} cx={x} cy={y} r={r} />
          ))}
        </g>
      ))}
      {/* Soft underside shading, like the film's clouds. */}
      {all.map((cloud, i) => {
        const [x, y, r] = cloud[cloud.length - 1]!
        const [x0, y0, r0] = cloud[0]!
        return (
          <g key={`s${i}`} fill="#dfe4ec" opacity="0.9">
            <ellipse cx={x - r * 0.2} cy={y + r * 0.55} rx={r * 0.75} ry={r * 0.28} />
            <ellipse cx={x0 + r0 * 0.25} cy={y0 + r0 * 0.55} rx={r0 * 0.7} ry={r0 * 0.26} />
          </g>
        )
      })}
    </symbol>
  )
}

export function CloudDivider() {
  const offsets = Array.from({ length: TILES }, (_, i) => i * TILE)
  const width = TILE * TILES
  return (
    <div className="cloud-divider" aria-hidden="true">
      <svg
        className="cloud-layer cloud-layer-back"
        viewBox={`0 0 ${width} 200`}
        preserveAspectRatio="xMinYMid meet"
      >
        <CloudTile clouds={BACK} id="cloud-tile-back" ink="#3a3835" fill="#faf6f1" />
        {offsets.map((x) => (
          <use key={x} href="#cloud-tile-back" x={x} width={TILE} height="200" />
        ))}
      </svg>
      <svg
        className="cloud-layer cloud-layer-front"
        viewBox={`0 0 ${width} 200`}
        preserveAspectRatio="xMinYMid meet"
      >
        <CloudTile clouds={FRONT} id="cloud-tile-front" ink="#000" fill="#ffffff" />
        <g fill="#000">
          {offsets.flatMap((ox) =>
            SPECKS.map(([x, y], i) => (
              <circle key={`${ox}-${i}`} cx={x + ox} cy={y} r="2.2" />
            ))
          )}
        </g>
        {offsets.map((x) => (
          <use key={x} href="#cloud-tile-front" x={x} width={TILE} height="200" />
        ))}
      </svg>
    </div>
  )
}
