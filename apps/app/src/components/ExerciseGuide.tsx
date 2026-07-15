import { useEffect, useState } from 'react';
import type { WorkoutExercise } from '@vitamate/domain';

type VisualKind = 'squat' | 'hinge' | 'bench' | 'row' | 'lunge' | 'overhead' | 'pulldown' | 'legpress' | 'raise' | 'curl' | 'triceps' | 'calf' | 'crunch' | 'pushup' | 'pike' | 'bridge' | 'core';

function visualKind(slug: string): VisualKind {
  if (['squat', 'goblet-squat', 'split-squat'].includes(slug)) return slug === 'split-squat' ? 'lunge' : 'squat';
  if (['romanian-deadlift', 'backpack-romanian-deadlift'].includes(slug)) return 'hinge';
  if (['incline-barbell-press', 'chest-press'].includes(slug)) return 'bench';
  if (['row', 'one-arm-row'].includes(slug)) return 'row';
  if (['reverse-lunge', 'home-reverse-lunge'].includes(slug)) return 'lunge';
  if (['shoulder-press', 'pike-push-up'].includes(slug)) return slug === 'pike-push-up' ? 'pike' : 'overhead';
  if (slug === 'lat-pulldown') return 'pulldown';
  if (slug === 'leg-press') return 'legpress';
  if (slug === 'lateral-raise') return 'raise';
  if (['barbell-curl', 'backpack-curl'].includes(slug)) return 'curl';
  if (['triceps-pressdown', 'chair-triceps-dip'].includes(slug)) return 'triceps';
  if (['standing-calf-raise', 'single-leg-calf-raise'].includes(slug)) return 'calf';
  if (slug === 'kneeling-cable-crunch') return 'crunch';
  if (slug === 'push-up') return 'pushup';
  if (slug === 'glute-bridge') return 'bridge';
  return 'core';
}

function Pose({ kind, finish }: { kind: VisualKind; finish: boolean }) {
  const body = { fill: 'none', stroke: '#193c35', strokeWidth: 5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const load = { fill: 'none', stroke: '#5a7d5e', strokeWidth: 4, strokeLinecap: 'round' as const };
  if (kind === 'squat') return <g {...body}><circle cx="60" cy={finish ? 39 : 25} r="9" /><path d={finish ? 'M55 49 L46 76 L30 92 M46 76 L74 78 L84 97 M53 57 L34 62 M53 57 L74 61' : 'M60 35 L60 72 L43 103 M60 72 L78 103 M58 46 L38 54 M58 46 L79 54'} /><path {...load} d={finish ? 'M30 52 H82' : 'M33 42 H86'} /></g>;
  if (kind === 'hinge') return <g {...body}><circle cx={finish ? 86 : 60} cy={finish ? 43 : 25} r="9" /><path d={finish ? 'M78 50 L47 67 L42 96 M47 67 L71 100 M72 54 L89 80 M53 64 L71 82' : 'M60 35 L60 71 L45 103 M60 71 L75 103 M57 47 L45 76 M62 47 L75 76'} /><path {...load} d={finish ? 'M65 82 H96 M70 78 V88 M91 78 V88' : 'M40 78 H80 M45 74 V84 M75 74 V84'} /></g>;
  if (kind === 'bench') return <g {...body}><path {...load} d="M20 87 H100 M28 87 V103 M92 87 V103" /><circle cx={finish ? 58 : 48} cy="55" r="9" /><path d={finish ? 'M66 61 L88 75 M66 61 L88 74 M88 74 L94 44 M55 64 L45 84 L35 102 M55 64 L69 84 L82 102' : 'M56 61 L83 76 M83 76 L92 75 M47 64 L37 84 L28 102 M47 64 L64 84 L76 102'} /><path {...load} d={finish ? 'M77 43 H106 M81 39 V47 M102 39 V47' : 'M80 72 H105 M84 68 V76 M101 68 V76'} /></g>;
  if (kind === 'row') return <g {...body}><circle cx="84" cy="40" r="9" /><path d="M77 48 L46 62 L38 92 M46 62 L68 101 M73 52 L88 73 M53 61 L75 74" /><path {...load} d={finish ? 'M70 72 H99 M74 68 V77 M95 68 V77' : 'M82 89 H111 M86 85 V94 M107 85 V94'} /></g>;
  if (kind === 'lunge') return <g {...body}><circle cx="60" cy={finish ? 35 : 24} r="9" /><path d={finish ? 'M60 45 L58 72 L36 86 L23 103 M58 72 L84 82 L96 103 M56 53 L39 68 M63 53 L80 68' : 'M60 34 L60 70 L43 102 M60 70 L83 91 L103 94 M58 46 L42 60 M62 46 L77 60'} /></g>;
  if (kind === 'overhead') return <g {...body}><circle cx="60" cy="29" r="9" /><path d="M60 39 L60 72 L43 103 M60 72 L77 103" /><path d={finish ? 'M57 47 L45 22 M63 47 L75 22' : 'M57 47 L42 60 M63 47 L78 60'} /><path {...load} d={finish ? 'M34 18 H86 M39 14 V22 M81 14 V22' : 'M34 63 H86 M39 59 V67 M81 59 V67'} /></g>;
  if (kind === 'pulldown') return <g {...body}><circle cx="60" cy="39" r="9" /><path d="M60 49 L60 79 L45 102 M60 79 L75 102" /><path d={finish ? 'M57 55 L38 62 M63 55 L82 62' : 'M57 52 L39 25 M63 52 L81 25'} /><path {...load} d={finish ? 'M31 65 H89' : 'M30 21 H90'} /></g>;
  if (kind === 'legpress') return <g {...body}><path {...load} d="M91 28 L108 93 M88 31 L100 28 M105 92 L114 89" /><circle cx="36" cy="54" r="9" /><path d="M44 59 L60 75 L37 96 M60 75 L45 102" /><path d={finish ? 'M60 75 L91 51 M60 75 L96 70' : 'M60 75 L76 60 L91 51 M60 75 L78 78 L96 70'} /></g>;
  if (kind === 'raise') return <g {...body}><circle cx="60" cy="26" r="9" /><path d="M60 36 L60 72 L43 103 M60 72 L77 103" /><path d={finish ? 'M57 47 L27 50 M63 47 L93 50' : 'M57 47 L45 72 M63 47 L75 72'} /></g>;
  if (kind === 'curl') return <g {...body}><circle cx="60" cy="25" r="9" /><path d="M60 35 L60 72 L43 103 M60 72 L77 103" /><path d={finish ? 'M57 47 L45 59 L53 43 M63 47 L75 59 L67 43' : 'M57 47 L45 76 M63 47 L75 76'} /><path {...load} d={finish ? 'M45 40 H75' : 'M39 79 H81'} /></g>;
  if (kind === 'triceps') return <g {...body}><circle cx="60" cy="25" r="9" /><path d="M60 35 L60 72 L43 103 M60 72 L77 103 M57 47 L47 57 M63 47 L73 57" /><path d={finish ? 'M47 57 L43 80 M73 57 L77 80' : 'M47 57 L57 70 M73 57 L63 70'} /><path {...load} d="M42 17 H80 M78 17 V47" /></g>;
  if (kind === 'calf') return <g {...body}><circle cx="60" cy={finish ? 20 : 25} r="9" /><path d={finish ? 'M60 30 L60 66 L46 94 L39 101 M60 66 L74 94 L81 101' : 'M60 35 L60 72 L43 103 M60 72 L77 103'} /><path {...load} d="M25 105 H95" /></g>;
  if (kind === 'crunch') return <g {...body}><circle cx={finish ? 72 : 60} cy={finish ? 51 : 28} r="9" /><path d={finish ? 'M65 58 Q47 69 51 84 L38 103 M51 84 L72 103 M65 62 L81 72' : 'M60 38 L58 75 L43 103 M58 75 L76 103 M57 48 L72 58'} /><path {...load} d="M92 15 V78 M87 18 H98" /></g>;
  if (kind === 'pushup') return <g {...body}><circle cx={finish ? 91 : 92} cy={finish ? 72 : 50} r="8" /><path d={finish ? 'M83 75 L54 78 L23 90 M54 78 L69 99 M82 77 L94 99' : 'M84 55 L55 65 L22 88 M55 65 L70 94 M84 57 L98 86'} /></g>;
  if (kind === 'pike') return <g {...body}><circle cx={finish ? 91 : 96} cy={finish ? 73 : 55} r="8" /><path d={finish ? 'M84 75 L57 54 L28 94 M57 54 L69 98 M84 77 L96 99' : 'M89 59 L57 45 L27 94 M57 45 L72 94 M89 61 L102 88'} /></g>;
  if (kind === 'bridge') return <g {...body}><circle cx="94" cy={finish ? 58 : 78} r="8" /><path d={finish ? 'M86 62 L58 48 L34 79 M58 48 L75 86 M35 79 L24 99 M75 86 L91 99' : 'M86 82 L57 86 L32 91 M57 86 L74 99 M32 91 L21 101'} /></g>;
  return <g {...body}><circle cx="92" cy="54" r="8" /><path d={finish ? 'M84 58 L58 70 L31 91 M58 70 L71 98 M84 60 L101 88' : 'M84 58 L57 66 L28 88 M57 66 L72 95 M84 60 L98 84'} /></g>;
}

function TechniqueDiagram({ exercise }: { exercise: WorkoutExercise }) {
  const kind = visualKind(exercise.slug);
  return <div className="exercise-guide-fallback exercise-guide-fallback--diagram" role="img" aria-label={`Secuencia visual de inicio y final para ${exercise.name}`}>
    <svg viewBox="0 0 360 180" aria-hidden="true">
      <rect width="360" height="180" rx="22" fill="#eef4ed" />
      <rect x="14" y="14" width="158" height="134" rx="16" fill="#fff" />
      <rect x="188" y="14" width="158" height="134" rx="16" fill="#fff" />
      <g transform="translate(35 24)"><Pose kind={kind} finish={false} /></g>
      <g transform="translate(209 24)"><Pose kind={kind} finish /></g>
      <path d="M168 82 H192 M185 75 L192 82 L185 89" fill="none" stroke="#5a7d5e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <text x="93" y="166" textAnchor="middle">INICIO</text><text x="267" y="166" textAnchor="middle">POSICIÓN CLAVE</text>
    </svg>
    <small>{exercise.name} · esquema técnico específico</small>
  </div>;
}

export function ExerciseGuide({ exercise }: { exercise: WorkoutExercise }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [exercise.mediaUrl]);
  if (exercise.mediaUrl && !failed) return <img className="exercise-guide-image" src={exercise.mediaUrl} alt={`Postura técnica revisada para ${exercise.name}`} loading="lazy" onError={() => setFailed(true)} />;
  return <TechniqueDiagram exercise={exercise} />;
}
