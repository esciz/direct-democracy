export function TakeActionHeroAnimation() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(180deg,#fbfdff_0%,#eef6ff_42%,#f6f7fb_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:p-5">
      <div className="pointer-events-none absolute inset-x-8 top-6 h-24 rounded-full bg-civic-100/40 blur-3xl" />
      <svg
        viewBox="0 0 960 420"
        className="relative z-10 w-full"
        role="img"
        aria-label="Animated civic action story showing a resident noticing an issue, voting in the app, showing up in person, organizing support, and driving government change."
      >
        <defs>
          <linearGradient id="actionPath" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="50%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>

        <g className="hero-grid">
          <path d="M165 128 H285" className="connector connector-1" />
          <path d="M420 128 H540" className="connector connector-2" />
          <path d="M675 128 H795" className="connector connector-3" />
          <path d="M165 300 H285" className="connector connector-4" />
          <path d="M420 300 H540" className="connector connector-5" />
        </g>

        <g className="scene scene-1" transform="translate(24 24)">
          <rect x="0" y="0" width="255" height="160" rx="28" className="scene-card" />
          <text x="20" y="28" className="scene-title">1. Awareness</text>
          <text x="20" y="48" className="scene-copy">A resident notices a local problem.</text>
          <circle cx="72" cy="88" r="12" className="ink-line" />
          <line x1="72" y1="100" x2="72" y2="128" className="ink-line" />
          <line x1="72" y1="109" x2="56" y2="120" className="ink-line" />
          <line x1="72" y1="109" x2="88" y2="118" className="ink-line" />
          <line x1="72" y1="128" x2="58" y2="149" className="ink-line" />
          <line x1="72" y1="128" x2="86" y2="149" className="ink-line" />
          <path d="M136 119 h52 l8 10 h-68 z" className="icon-fill" />
          <circle cx="149" cy="134" r="7" className="scene-alert" />
          <path d="M208 68 l16 8 -16 8" className="motion-arrow" />
          <rect x="196" y="97" width="26" height="44" rx="7" className="phone-outline" />
          <circle cx="209" cy="131" r="2.4" className="ink-dot" />
        </g>

        <g className="scene scene-2" transform="translate(350 24)">
          <rect x="0" y="0" width="255" height="160" rx="28" className="scene-card" />
          <text x="20" y="28" className="scene-title">2. Vote in the app</text>
          <text x="20" y="48" className="scene-copy">A quick vote turns attention into signal.</text>
          <circle cx="50" cy="86" r="11" className="ink-line" />
          <line x1="50" y1="98" x2="50" y2="125" className="ink-line" />
          <line x1="50" y1="107" x2="36" y2="116" className="ink-line" />
          <line x1="50" y1="107" x2="66" y2="116" className="ink-line" />
          <line x1="50" y1="125" x2="38" y2="146" className="ink-line" />
          <line x1="50" y1="125" x2="62" y2="146" className="ink-line" />
          <rect x="92" y="67" width="104" height="72" rx="14" className="phone-screen" />
          <rect x="105" y="81" width="76" height="10" rx="5" className="ui-line" />
          <rect x="105" y="101" width="54" height="10" rx="5" className="ui-line ui-line-soft" />
          <circle cx="174" cy="106" r="15" className="vote-badge" />
          <path d="M167 106 l5 5 10 -13" className="vote-check" />
        </g>

        <g className="scene scene-3" transform="translate(676 24)">
          <rect x="0" y="0" width="255" height="160" rx="28" className="scene-card" />
          <text x="20" y="28" className="scene-title">3. Show up</text>
          <text x="20" y="48" className="scene-copy">People gather for meetings, rallies, and events.</text>
          <circle cx="54" cy="110" r="10" className="ink-line" />
          <circle cx="95" cy="99" r="10" className="ink-line" />
          <circle cx="136" cy="110" r="10" className="ink-line" />
          <line x1="54" y1="120" x2="54" y2="145" className="ink-line" />
          <line x1="95" y1="109" x2="95" y2="145" className="ink-line" />
          <line x1="136" y1="120" x2="136" y2="145" className="ink-line" />
          <path d="M178 74 h18 v72 h-18" className="ink-line" />
          <path d="M196 74 h35 l-8 16 h-27 z" className="flag-fill" />
          <path d="M35 148 h126" className="ground-line" />
          <path d="M174 148 h64" className="ground-line" />
        </g>

        <g className="scene scene-4" transform="translate(24 212)">
          <rect x="0" y="0" width="255" height="160" rx="28" className="scene-card" />
          <text x="20" y="28" className="scene-title">4. Use Direct Democracy</text>
          <text x="20" y="48" className="scene-copy">Posts, comments, support, messages, and debate grow.</text>
          <rect x="28" y="66" width="96" height="68" rx="14" className="phone-screen" />
          <rect x="42" y="80" width="64" height="10" rx="5" className="ui-line" />
          <rect x="42" y="100" width="44" height="10" rx="5" className="ui-line ui-line-soft" />
          <circle cx="158" cy="85" r="18" className="signal-ring signal-ring-1" />
          <circle cx="206" cy="95" r="18" className="signal-ring signal-ring-2" />
          <circle cx="177" cy="128" r="18" className="signal-ring signal-ring-3" />
          <text x="151" y="90" className="signal-text">Vote</text>
          <text x="192" y="100" className="signal-text">Talk</text>
          <text x="161" y="133" className="signal-text">Support</text>
        </g>

        <g className="scene scene-5" transform="translate(350 212)">
          <rect x="0" y="0" width="255" height="160" rx="28" className="scene-card" />
          <text x="20" y="28" className="scene-title">5. Collective action</text>
          <text x="20" y="48" className="scene-copy">Signals combine into visible civic pressure.</text>
          <path d="M52 86 C86 64 124 64 158 86" className="merge-line merge-line-1" />
          <path d="M52 122 C86 144 124 144 158 122" className="merge-line merge-line-2" />
          <rect x="170" y="73" width="52" height="64" rx="10" className="petition-card" />
          <line x1="183" y1="90" x2="209" y2="90" className="petition-line" />
          <line x1="183" y1="106" x2="209" y2="106" className="petition-line" />
          <line x1="183" y1="122" x2="205" y2="122" className="petition-line" />
          <circle cx="48" cy="83" r="7" className="pressure-node" />
          <circle cx="48" cy="125" r="7" className="pressure-node pressure-node-2" />
          <circle cx="110" cy="104" r="8" className="pressure-node pressure-node-3" />
        </g>

        <g className="scene scene-6" transform="translate(676 212)">
          <rect x="0" y="0" width="255" height="160" rx="28" className="scene-card" />
          <text x="20" y="28" className="scene-title">6. Government change</text>
          <text x="20" y="48" className="scene-copy">Officials respond and the policy picture shifts.</text>
          <path d="M42 138 h116" className="ground-line" />
          <path d="M54 133 v-42 h92 v42" className="building-outline" />
          <path d="M46 92 h108 l-54 -28 z" className="building-roof" />
          <rect x="70" y="104" width="12" height="16" className="building-window building-window-1" />
          <rect x="94" y="104" width="12" height="16" className="building-window building-window-2" />
          <rect x="118" y="104" width="12" height="16" className="building-window building-window-3" />
          <rect x="90" y="118" width="20" height="15" rx="4" className="building-door" />
          <rect x="178" y="72" width="48" height="64" rx="10" className="reform-sheet" />
          <line x1="188" y1="90" x2="215" y2="90" className="petition-line" />
          <line x1="188" y1="104" x2="214" y2="104" className="petition-line" />
          <path d="M189 122 l8 8 18 -22" className="reform-check" />
        </g>

        <g className="loop-orbit">
          <circle cx="152" cy="202" r="6" className="orbit-dot orbit-dot-1" />
          <circle cx="412" cy="202" r="6" className="orbit-dot orbit-dot-2" />
          <circle cx="700" cy="202" r="6" className="orbit-dot orbit-dot-3" />
        </g>
      </svg>

      <style jsx>{`
        .scene-card {
          fill: rgba(255, 255, 255, 0.82);
          stroke: rgba(148, 163, 184, 0.22);
          stroke-width: 1.5;
        }

        .scene-title {
          fill: #0f766e;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        .scene-copy {
          fill: #64748b;
          font-size: 11px;
        }

        .ink-line,
        .motion-arrow,
        .ground-line,
        .building-outline,
        .petition-line,
        .vote-check,
        .reform-check,
        .merge-line {
          fill: none;
          stroke: #0f172a;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-width: 3;
        }

        .building-outline {
          stroke-width: 2.5;
        }

        .motion-arrow,
        .merge-line {
          stroke: #2563eb;
        }

        .icon-fill,
        .flag-fill,
        .building-roof,
        .petition-card,
        .reform-sheet {
          fill: rgba(37, 99, 235, 0.12);
          stroke: rgba(37, 99, 235, 0.45);
          stroke-width: 2;
        }

        .phone-outline,
        .phone-screen {
          fill: rgba(15, 23, 42, 0.03);
          stroke: rgba(15, 23, 42, 0.5);
          stroke-width: 2.2;
        }

        .vote-badge {
          fill: rgba(16, 185, 129, 0.18);
          stroke: rgba(16, 185, 129, 0.8);
          stroke-width: 2;
        }

        .ui-line {
          fill: #2563eb;
          opacity: 0.85;
        }

        .ui-line-soft {
          opacity: 0.42;
        }

        .ink-dot {
          fill: #0f172a;
        }

        .scene-alert {
          fill: #f97316;
        }

        .signal-ring,
        .pressure-node {
          fill: rgba(15, 118, 110, 0.12);
          stroke: rgba(15, 118, 110, 0.7);
          stroke-width: 2;
        }

        .signal-text {
          fill: #0f766e;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .building-window {
          fill: rgba(255, 255, 255, 0.55);
          stroke: rgba(15, 23, 42, 0.12);
          stroke-width: 1;
        }

        .building-door {
          fill: rgba(15, 23, 42, 0.12);
        }

        .connector {
          fill: none;
          stroke: url(#actionPath);
          stroke-linecap: round;
          stroke-width: 5;
          stroke-dasharray: 12 16;
          animation: flow 8s linear infinite;
          opacity: 0.65;
        }

        .connector-2,
        .connector-5 {
          animation-delay: -1.2s;
        }

        .connector-3,
        .connector-4 {
          animation-delay: -2.4s;
        }

        .scene {
          animation: breathe 8s ease-in-out infinite;
        }

        .scene-2 {
          animation-delay: -6.8s;
        }

        .scene-3 {
          animation-delay: -5.6s;
        }

        .scene-4 {
          animation-delay: -4.4s;
        }

        .scene-5 {
          animation-delay: -3.2s;
        }

        .scene-6 {
          animation-delay: -2s;
        }

        .signal-ring-1,
        .pressure-node {
          animation: pulse 8s ease-in-out infinite;
        }

        .signal-ring-2,
        .pressure-node-2,
        .building-window-1 {
          animation: pulse 8s ease-in-out infinite;
          animation-delay: -5.8s;
        }

        .signal-ring-3,
        .pressure-node-3,
        .building-window-2 {
          animation: pulse 8s ease-in-out infinite;
          animation-delay: -4.6s;
        }

        .building-window-3,
        .reform-check,
        .vote-badge,
        .vote-check {
          animation: pulse 8s ease-in-out infinite;
          animation-delay: -2.2s;
        }

        .orbit-dot {
          fill: #f97316;
          animation: orbit 8s ease-in-out infinite;
        }

        .orbit-dot-2 {
          animation-delay: -5.3s;
        }

        .orbit-dot-3 {
          animation-delay: -2.7s;
        }

        @keyframes flow {
          from {
            stroke-dashoffset: 56;
          }
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes breathe {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-3px);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 0.55;
            transform-box: fill-box;
            transform-origin: center;
            transform: scale(0.96);
          }
          50% {
            opacity: 1;
            transform-box: fill-box;
            transform-origin: center;
            transform: scale(1.05);
          }
        }

        @keyframes orbit {
          0%, 100% {
            opacity: 0.12;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.08);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .connector,
          .scene,
          .signal-ring,
          .pressure-node,
          .building-window,
          .reform-check,
          .vote-badge,
          .vote-check,
          .orbit-dot {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
