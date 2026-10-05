import { useState } from 'react';
import { SITES, LATERALITY_LABELS } from './catalog';

// Esquema corporal frontal. Convención médica: la derecha del paciente queda a la
// izquierda de quien mira (marcado con D / I). Cada forma tiene su sitio, su
// lateralidad y el punto donde se dibuja la lesión.
const SHAPES = [
  { site: 'brain', laterality: 'na', marker: [100, 28], el: <ellipse cx="100" cy="28" rx="16" ry="11" /> },
  { site: 'head_neck', laterality: 'na', marker: [100, 46], el: <ellipse cx="100" cy="46" rx="9" ry="5" /> },
  { site: 'thyroid', laterality: 'na', marker: [100, 78], el: <path d="M92 74q-6 4 0 9q6 1 8-3q2 4 8 3q6-5 0-9q-5-1-8 3q-3-4-8-3z" /> },
  { site: 'lung', laterality: 'right', marker: [86, 128], el: <path d="M96 92C86 90 78 98 75 116C72 136 72 154 75 166C82 170 90 168 96 162Z" /> },
  { site: 'lung', laterality: 'left', marker: [114, 128], el: <path d="M104 92C114 90 122 98 125 116C128 136 128 154 125 166C118 170 110 168 104 162Z" /> },
  { site: 'esophagus', laterality: 'na', marker: [100, 126], el: <rect x="97.5" y="86" width="5" height="80" rx="2.5" /> },
  { site: 'breast', laterality: 'right', marker: [60, 134], el: <circle cx="60" cy="134" r="10" /> },
  { site: 'breast', laterality: 'left', marker: [140, 134], el: <circle cx="140" cy="134" r="10" /> },
  { site: 'liver', laterality: 'na', marker: [82, 184], el: <path d="M62 176C70 170 96 170 104 176L102 190C92 200 72 200 64 194Z" /> },
  { site: 'stomach', laterality: 'na', marker: [120, 188], el: <path d="M106 176C116 170 132 174 134 186C136 200 124 208 112 204C108 196 106 188 106 176Z" /> },
  { site: 'pancreas', laterality: 'na', marker: [104, 213], el: <ellipse cx="104" cy="213" rx="18" ry="4.5" /> },
  { site: 'kidney', laterality: 'right', marker: [78, 220], el: <ellipse cx="78" cy="220" rx="7" ry="11" /> },
  { site: 'kidney', laterality: 'left', marker: [122, 220], el: <ellipse cx="122" cy="220" rx="7" ry="11" /> },
  { site: 'colorectal', laterality: 'na', marker: [100, 236], tube: true, el: <path d="M78 282L78 236L122 236L122 282Q122 294 112 296L112 312" /> },
  { site: 'uterus_cervix', laterality: 'na', marker: [100, 266], sex: 'Femenino', el: <path d="M91 258Q100 252 109 258Q110 272 102 280L98 280Q90 272 91 258Z" /> },
  { site: 'ovary', laterality: 'right', marker: [86, 262], sex: 'Femenino', el: <circle cx="86" cy="262" r="4" /> },
  { site: 'ovary', laterality: 'left', marker: [114, 262], sex: 'Femenino', el: <circle cx="114" cy="262" r="4" /> },
  { site: 'bladder', laterality: 'na', marker: [98, 290], el: <ellipse cx="98" cy="290" rx="9" ry="6" /> },
  { site: 'prostate', laterality: 'na', marker: [98, 304], sex: 'Masculino', el: <circle cx="98" cy="304" r="4.5" /> },
  { site: 'testis', laterality: 'right', marker: [95, 330], sex: 'Masculino', el: <circle cx="95" cy="330" r="4.5" /> },
  { site: 'testis', laterality: 'left', marker: [105, 330], sex: 'Masculino', el: <circle cx="105" cy="330" r="4.5" /> },
];

const BODY = 'M90 56L90 66C70 68 56 74 48 86C42 96 40 112 40 130L38 190C38 196 46 198 48 192L54 128L58 176C58 210 60 240 64 262C66 280 66 296 70 318L74 350L96 350L100 318L104 350L126 350L130 318C134 296 134 280 136 262C140 240 142 210 142 176L146 128L152 192C154 198 162 196 162 190L160 130C160 112 158 96 152 86C144 74 130 68 110 66L110 56Z';

function shapeLabel(shape) {
  const site = SITES[shape.site]?.label || shape.site;
  return shape.laterality === 'na' ? site : `${site} ${LATERALITY_LABELS[shape.laterality].toLowerCase()}`;
}

export function markerFor(site, laterality) {
  const shapes = SHAPES.filter((shape) => shape.site === site);
  if (!shapes.length) return null;
  if (laterality === 'bilateral') return shapes.map((shape) => shape.marker);
  const exact = shapes.find((shape) => shape.laterality === laterality);
  return [(exact || shapes[0]).marker];
}

// selected: { site, laterality } resaltado y con marcador.
// marks: otros tumores del paciente para marcar (solo lectura).
// onSelect(site, laterality): si falta, el mapa es de solo lectura.
export default function AnatomyMap({ selected = null, marks = [], onSelect = null, gender = 'No especificado' }) {
  const [hover, setHover] = useState('');
  const visibleShapes = SHAPES.filter((shape) => !shape.sex || !['Femenino', 'Masculino'].includes(gender) || shape.sex === gender);
  const interactive = typeof onSelect === 'function';

  const isSelected = (shape) => selected
    && shape.site === selected.site
    && (selected.laterality === 'bilateral' || shape.laterality === 'na' || shape.laterality === selected.laterality);

  const markerPoints = [
    ...(selected ? (markerFor(selected.site, selected.laterality) || []).map((point) => ({ point, strong: true })) : []),
    ...marks.flatMap((mark) => (markerFor(mark.site, mark.laterality) || []).map((point) => ({ point, strong: false }))),
  ];

  const choose = (shape) => {
    if (!interactive) return;
    onSelect(shape.site, shape.laterality);
  };

  return (
    <div className="anatomy">
      <svg viewBox="0 0 200 360" role="group" aria-label="Esquema corporal frontal">
        <circle className="body-outline" cx="100" cy="32" r="24" />
        <path className="body-outline" d={BODY} />
        <text x="22" y="104" fontSize="11" fontWeight="700" fill="var(--faint)">D</text>
        <text x="171" y="104" fontSize="11" fontWeight="700" fill="var(--faint)">I</text>

        {visibleShapes.map((shape) => {
          const label = shapeLabel(shape);
          const selectedClass = isSelected(shape) ? ' organ--selected' : '';
          return (
            <g
              key={`${shape.site}-${shape.laterality}`}
              className={`organ${shape.tube ? ' organ--tube' : ''}${selectedClass}${interactive ? '' : ' organ--readonly'}`}
              role={interactive ? 'button' : 'img'}
              tabIndex={interactive ? 0 : -1}
              aria-label={label}
              aria-pressed={interactive ? Boolean(isSelected(shape)) : undefined}
              onClick={() => choose(shape)}
              onKeyDown={(event) => {
                if (interactive && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  choose(shape);
                }
              }}
              onMouseEnter={() => setHover(label)}
              onMouseLeave={() => setHover('')}
              onFocus={() => setHover(label)}
              onBlur={() => setHover('')}
            >
              <title>{label}</title>
              {shape.el}
            </g>
          );
        })}

        {markerPoints.map(({ point: [x, y], strong }, index) => (
          <g key={index} className="lesion-marker" pointerEvents="none">
            {strong ? <circle cx={x} cy={y} r="10" /> : null}
            <circle cx={x} cy={y} r={strong ? 4 : 3} fill="var(--danger)" stroke="#fff" strokeWidth="1.5" />
          </g>
        ))}
      </svg>
      <p className="anatomy__hint" aria-live="polite">
        {hover || (interactive ? 'Tocá el órgano para ubicar el tumor' : 'Vista frontal · D = derecha del paciente')}
      </p>
    </div>
  );
}
