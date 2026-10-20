import { cn } from "@/lib/utils";

/*
 * Line-art motifs for course cards. Decorative only — chosen by unit position
 * so every card gets a consistent, physics-flavoured header without stock images.
 */

const stroke = { stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Cradle() {
  const xs = [128, 152, 176, 200];
  return (
    <g {...stroke}>
      <path d="M 90 30 H 250" />
      {xs.map((x) => (
        <g key={x}>
          <path d={`M ${x} 30 V 92`} strokeOpacity="0.55" />
          <circle cx={x} cy={104} r={12} fill="currentColor" fillOpacity="0.12" />
        </g>
      ))}
      <path d="M 224 30 L 262 84" strokeOpacity="0.55" />
      <circle cx={269} cy={93} r={12} fill="currentColor" fillOpacity="0.22" />
      <path d="M 238 70 q 10 8 14 20" strokeOpacity="0.35" strokeDasharray="2 4" />
    </g>
  );
}

function Wave() {
  return (
    <g {...stroke}>
      <path d="M 60 80 C 85 30, 110 30, 135 80 S 185 130, 210 80 S 260 30, 285 80" />
      <path d="M 60 80 C 85 55, 110 55, 135 80 S 185 105, 210 80 S 260 55, 285 80" strokeOpacity="0.35" />
      <path d="M 60 80 H 290" strokeOpacity="0.2" strokeDasharray="3 5" />
    </g>
  );
}

function Graph() {
  const pts = [
    [92, 116],
    [124, 101],
    [156, 88],
    [188, 70],
    [220, 58],
    [252, 41],
  ];
  return (
    <g {...stroke}>
      <path d="M 76 28 V 128 H 280" />
      <path d="M 84 122 L 268 34" strokeOpacity="0.4" />
      {pts.map(([x, y]) => (
        <g key={x} strokeWidth={1.75}>
          <path d={`M ${x - 5} ${y - 5} l 10 10 M ${x + 5} ${y - 5} l -10 10`} />
        </g>
      ))}
    </g>
  );
}

function Field() {
  return (
    <g {...stroke}>
      <circle cx="175" cy="80" r="14" fill="currentColor" fillOpacity="0.15" />
      <path d="M 169 80 h 12 M 175 74 v 12" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        const x1 = 175 + Math.cos(a) * 24;
        const y1 = 80 + Math.sin(a) * 24;
        const x2 = 175 + Math.cos(a) * 62;
        const y2 = 80 + Math.sin(a) * 62;
        return <path key={i} d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)}`} strokeOpacity="0.5" />;
      })}
      <circle cx="175" cy="80" r="40" strokeOpacity="0.2" strokeDasharray="3 5" />
    </g>
  );
}

function Planet() {
  return (
    <g {...stroke}>
      <circle cx="175" cy="80" r="30" fill="currentColor" fillOpacity="0.12" />
      <ellipse cx="175" cy="80" rx="68" ry="16" transform="rotate(-14 175 80)" strokeOpacity="0.6" />
      {[
        [84, 34],
        [262, 40],
        [96, 126],
        [252, 122],
        [224, 22],
      ].map(([x, y]) => (
        <path key={x} d={`M ${x - 4} ${y} h 8 M ${x} ${y - 4} v 8`} strokeWidth={1.5} strokeOpacity="0.5" />
      ))}
    </g>
  );
}

function Flask() {
  return (
    <g {...stroke}>
      <path d="M 160 26 h 30 M 166 26 v 34 L 136 122 a 6 6 0 0 0 5 8 h 68 a 6 6 0 0 0 5 -8 L 184 60 V 26" />
      <path d="M 146 102 h 58" strokeOpacity="0.4" />
      <circle cx="166" cy="114" r="4" strokeOpacity="0.5" />
      <circle cx="186" cy="108" r="3" strokeOpacity="0.5" />
    </g>
  );
}

function Atom() {
  return (
    <g {...stroke}>
      <ellipse cx="175" cy="80" rx="62" ry="22" strokeOpacity="0.6" />
      <ellipse cx="175" cy="80" rx="62" ry="22" transform="rotate(60 175 80)" strokeOpacity="0.6" />
      <ellipse cx="175" cy="80" rx="62" ry="22" transform="rotate(120 175 80)" strokeOpacity="0.6" />
      <circle cx="175" cy="80" r="8" fill="currentColor" />
    </g>
  );
}

const motifs = [Cradle, Wave, Graph, Field, Planet, Flask];

export function UnitArt({ position, muted, className }: { position: number; muted?: boolean; className?: string }) {
  const Motif = motifs[position - 1] ?? Atom;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden dot-grid",
        muted ? "bg-orbit-panel text-[#8fa197]" : "bg-orbit-panel-hover text-orbit-primary",
        className
      )}
    >
      <svg viewBox="0 0 350 160" fill="none" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet">
        <Motif />
      </svg>
    </div>
  );
}
