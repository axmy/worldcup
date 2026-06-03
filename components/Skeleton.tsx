import type { CSSProperties } from "react";

// Lightweight, server-rendered loading skeletons. These are shown instantly by
// the route-level loading.tsx files while the page's data streams in, so tab
// switches feel responsive instead of frozen on the previous screen.

function Bar({ w, h = 14, r = 7, style }: { w: number | string; h?: number; r?: number; style?: CSSProperties }) {
  return <span className="skltn" style={{ display: "block", width: w, height: h, borderRadius: r, ...style }} />;
}

function CardSkeleton() {
  return (
    <div className="card-sport" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Bar w={90} h={11} />
        <Bar w={54} h={11} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="skltn" style={{ width: 38, height: 38, borderRadius: 11 }} />
        <Bar w="40%" h={16} />
        <span className="skltn" style={{ width: 46, height: 30, borderRadius: 9, marginInlineStart: "auto" }} />
        <span className="skltn" style={{ width: 46, height: 30, borderRadius: 9 }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="skltn" style={{ width: 38, height: 38, borderRadius: 11 }} />
        <Bar w="46%" h={16} />
      </div>
    </div>
  );
}

export function ScreenSkeleton({ rows = 5, grid = true }: { rows?: number; grid?: boolean }) {
  return (
    <div className="screen-enter" aria-busy="true" aria-label="Loading">
      {/* Hero / title */}
      <div style={{ display: "flex", gap: 12, alignItems: "stretch", marginBottom: 18 }}>
        <span className="slash" aria-hidden style={{ width: 7 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 9, justifyContent: "center" }}>
          <Bar w={210} h={26} r={8} />
          <Bar w={130} h={12} />
        </div>
      </div>
      {/* League switcher chip row */}
      <Bar w={160} h={36} r={12} style={{ marginBottom: 18 }} />
      {/* Card list/grid */}
      <div className={grid ? "wc-grid" : undefined} style={grid ? undefined : { display: "flex", flexDirection: "column", gap: 12 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
