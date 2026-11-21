/**
 * Flat illustration for "Report in Telegram": a resident photographs an
 * overflowing bin with her phone, and the report bubble flies off to the bot.
 * Same drawing style and palette as the before/after street scene.
 */
export function ReportIllustration() {
  const skin = "#A0673F";
  const skinShade = "#8A5634";
  const hair = "#2F1F17";

  return (
    <svg
      viewBox="0 0 400 420"
      preserveAspectRatio="xMidYMax meet"
      overflow="visible"
      role="img"
      aria-label="Illustration of a resident taking a photo of an overflowing bin with her phone"
      className="nk-illus"
    >
      <defs>
        <pattern id="illus-kerb" width="40" height="8" patternUnits="userSpaceOnUse">
          <rect width="20" height="8" fill="#F7941D" />
          <rect x="20" width="20" height="8" fill="#2F1F17" />
        </pattern>
      </defs>

      {/* Sky and buildings */}
      <rect x="-800" y="-800" width="2000" height="1220" fill="#FFE6D3" />
      <circle cx="330" cy="70" r="34" fill="#FFC98F" />
      <rect x="-200" y="160" width="170" height="170" rx="4" fill="#EFC6A6" />
      <rect x="-10" y="120" width="130" height="210" rx="4" fill="#F3D3BA" />
      <rect x="430" y="150" width="190" height="180" rx="4" fill="#F3D3BA" />
      <rect x="250" y="100" width="170" height="230" rx="4" fill="#EFC6A6" />
      <g fill="#FFF6EC">
        {[0, 1, 2, 3].map((r) =>
          [0, 1].map((c) => <rect key={`a${r}${c}`} x={14 + c * 46} y={142 + r * 42} width="24" height="24" rx="2" />)
        )}
        {[0, 1, 2, 3].map((r) =>
          [0, 1, 2].map((c) => <rect key={`b${r}${c}`} x={272 + c * 44} y={122 + r * 44} width="24" height="24" rx="2" />)
        )}
      </g>

      {/* Footpath and kerb */}
      <rect x="-800" y="330" width="2000" height="400" fill="#E6C6AC" />
      <rect x="-800" y="330" width="2000" height="8" fill="url(#illus-kerb)" />

      {/* Overflowing bin with bags */}
      <g>
        <rect x="282" y="262" width="62" height="72" rx="6" fill="#6E5C51" />
        <rect x="276" y="254" width="74" height="11" rx="4" fill="#5A4A42" transform="rotate(-12 313 259)" />
        <circle cx="298" cy="252" r="17" fill="#8A8F5A" />
        <circle cx="322" cy="244" r="19" fill="#6F7447" />
        <circle cx="312" cy="228" r="13" fill="#A49B63" />
        <ellipse cx="262" cy="340" rx="22" ry="13" fill="#7C8150" />
        <ellipse cx="362" cy="342" rx="24" ry="14" fill="#6F7447" />
        <g fill="#3A2C25">
          <circle cx="296" cy="210" r="2.2" className="nk-ba__fly" />
          <circle cx="328" cy="214" r="2.2" className="nk-ba__fly nk-ba__fly--b" />
        </g>
      </g>

      {/* Resident */}
      <g>
        {/* legs and shoes */}
        <rect x="110" y="300" width="17" height="96" rx="8" fill="#3A2C25" />
        <rect x="134" y="300" width="17" height="96" rx="8" fill="#3A2C25" />
        <ellipse cx="116" cy="398" rx="16" ry="7" fill="#2F1F17" />
        <ellipse cx="146" cy="398" rx="16" ry="7" fill="#2F1F17" />

        {/* kurta */}
        <path d="M100 190 Q130 176 162 190 L176 316 Q131 328 86 316 Z" fill="#F7941D" />
        {/* dupatta */}
        <path d="M104 192 Q118 188 126 196 L168 300 Q158 308 148 304 Z" fill="#C46A00" />
        <path d="M98 196 Q92 250 96 300" stroke="#C46A00" strokeWidth="10" strokeLinecap="round" fill="none" />

        {/* hanging arm */}
        <path d="M102 198 Q92 236 96 274" stroke="#F7941D" strokeWidth="18" strokeLinecap="round" fill="none" />
        <circle cx="96" cy="280" r="8" fill={skin} />

        {/* raised arm holding the phone */}
        <path d="M156 198 Q186 214 196 196" stroke="#F7941D" strokeWidth="18" strokeLinecap="round" fill="none" />
        <path d="M196 196 Q206 178 214 164" stroke={skin} strokeWidth="14" strokeLinecap="round" fill="none" />

        {/* neck and head */}
        <rect x="123" y="158" width="15" height="24" rx="6" fill={skinShade} />
        <circle cx="131" cy="138" r="25" fill={skin} />
        {/* hair, swept back into a bun; face turned toward the bin */}
        <path d="M106 140 Q104 108 134 110 Q154 112 156 128 Q140 120 124 128 Q114 136 112 152 Z" fill={hair} />
        <circle cx="106" cy="126" r="11" fill={hair} />
        <circle cx="128" cy="146" r="4" fill={skinShade} opacity="0.5" />
        {/* small jasmine flowers in the bun */}
        <circle cx="100" cy="120" r="2.5" fill="#FFF6EC" />
        <circle cx="104" cy="116" r="2.5" fill="#FFF6EC" />
      </g>

      {/* Phone, showing the bin in the camera frame */}
      <g transform="rotate(-14 222 142)">
        <rect x="198" y="102" width="46" height="80" rx="8" fill="#2F1F17" />
        <rect x="202" y="108" width="38" height="66" rx="5" fill="#FFF6EC" />
        <rect x="213" y="140" width="16" height="20" rx="2" fill="#6E5C51" />
        <circle cx="217" cy="138" r="5" fill="#8A8F5A" />
        <circle cx="225" cy="135" r="5" fill="#6F7447" />
        <path
          d="M206 116 v-4 h6 M236 116 v-4 h-6 M206 166 v4 h6 M236 166 v4 h-6"
          stroke="#C46A00"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="221" cy="182" r="5" fill="#F7941D" />
      </g>
      {/* hand gripping the phone */}
      <ellipse cx="214" cy="166" rx="9" ry="8" fill={skin} />

      {/* Report sent bubble */}
      <g className="nk-illus__sent">
        <path d="M232 48 h96 a14 14 0 0 1 14 14 v20 a14 14 0 0 1 -14 14 h-80 l-12 12 v-12 h-4 a14 14 0 0 1 -14 -14 v-20 a14 14 0 0 1 14 -14 z" fill="#fff" />
        <circle cx="246" cy="72" r="12" fill="#F7941D" />
        <path d="M240 72 l13 -6 l-4 13 l-3 -5 z" fill="#fff" />
        <rect x="264" y="63" width="62" height="7" rx="3.5" fill="#2F1F17" />
        <rect x="264" y="76" width="44" height="6" rx="3" fill="#D9BFA9" />
      </g>
    </svg>
  );
}
