// Reusable BPMN-style swimlane diagram. Renders an SVG with horizontal lanes,
// task / decision / event nodes, and routed edges. Designed to be data-driven —
// each /how-it-works flow defines its own Diagram object.

export type LaneTone = "manager" | "staff" | "partner" | "system";

export type Lane = {
  id: string;
  label: string;
  tone: LaneTone;
};

export type NodeKind = "start" | "end" | "task" | "decision";

export type DiagramNode = {
  id: string;
  lane: string;
  col: number; // 1-based grid column
  kind: NodeKind;
  label: string; // \n splits lines explicitly
  step?: number; // for numbered explanation list
  variant?: "primary" | "muted" | "alert";
};

export type DiagramEdge = {
  from: string;
  to: string;
  label?: string;
  branch?: "yes" | "no" | "default";
  // Routing: "auto" picks straight if same lane, L-shape otherwise.
  // "h-v" = horizontal then vertical. "v-h" = vertical then horizontal.
  routing?: "auto" | "h-v" | "v-h" | "straight";
};

export type Diagram = {
  lanes: Lane[];
  cols: number;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};

const LANE_LABEL_WIDTH = 110;
const COL_WIDTH = 160;
const COL_PADDING = 24;
const LANE_HEIGHT = 120;

const TASK_W = 138;
const TASK_H = 60;
const DECISION_R = 42;
const EVENT_R = 16;

const TONE_BG: Record<LaneTone, string> = {
  manager: "#f1f5f9", // slate-100
  staff: "#ecfeff", // cyan-50
  partner: "#fef3c7", // amber-100
  system: "#f8fafc", // slate-50
};

const TONE_LABEL_BG: Record<LaneTone, string> = {
  manager: "#0f172a", // slate-900
  staff: "#0e7490", // cyan-700
  partner: "#92400e", // amber-800
  system: "#475569", // slate-600
};

export function Swimlane({ diagram }: { diagram: Diagram }) {
  const width =
    LANE_LABEL_WIDTH + COL_PADDING * 2 + diagram.cols * COL_WIDTH;
  const height = diagram.lanes.length * LANE_HEIGHT;

  const xOfCol = (col: number) =>
    LANE_LABEL_WIDTH + COL_PADDING + (col - 1) * COL_WIDTH + COL_WIDTH / 2;

  const laneIndex = (laneId: string) =>
    diagram.lanes.findIndex((l) => l.id === laneId);

  const yOfLane = (laneId: string) =>
    laneIndex(laneId) * LANE_HEIGHT + LANE_HEIGHT / 2;

  const nodePos = (id: string) => {
    const n = diagram.nodes.find((x) => x.id === id);
    if (!n) throw new Error(`Unknown node id: ${id}`);
    return { x: xOfCol(n.col), y: yOfLane(n.lane), node: n };
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ minWidth: width, display: "block" }}
        aria-hidden="true"
        role="img"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
          </marker>
          <marker
            id="arrow-yes"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#0d9488" />
          </marker>
          <marker
            id="arrow-no"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#be123c" />
          </marker>
        </defs>

        {/* Lane backgrounds */}
        {diagram.lanes.map((lane, i) => (
          <g key={lane.id}>
            <rect
              x={LANE_LABEL_WIDTH}
              y={i * LANE_HEIGHT}
              width={width - LANE_LABEL_WIDTH}
              height={LANE_HEIGHT}
              fill={TONE_BG[lane.tone]}
            />
            {/* Lane separator line */}
            {i > 0 && (
              <line
                x1={0}
                x2={width}
                y1={i * LANE_HEIGHT}
                y2={i * LANE_HEIGHT}
                stroke="#e2e8f0"
                strokeWidth={1}
              />
            )}
            {/* Lane label column */}
            <rect
              x={0}
              y={i * LANE_HEIGHT}
              width={LANE_LABEL_WIDTH}
              height={LANE_HEIGHT}
              fill={TONE_LABEL_BG[lane.tone]}
            />
            <text
              x={LANE_LABEL_WIDTH / 2}
              y={i * LANE_HEIGHT + LANE_HEIGHT / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="13"
              fontWeight={600}
              style={{ letterSpacing: "0.02em" }}
            >
              {lane.label}
            </text>
          </g>
        ))}

        {/* Outer border */}
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="none"
          stroke="#cbd5e1"
          strokeWidth={1}
        />

        {/* Edges (drawn first so they sit behind nodes) */}
        {diagram.edges.map((edge, i) => (
          <Edge
            key={i}
            edge={edge}
            from={nodePos(edge.from)}
            to={nodePos(edge.to)}
          />
        ))}

        {/* Nodes */}
        {diagram.nodes.map((n) => (
          <Node key={n.id} node={n} x={xOfCol(n.col)} y={yOfLane(n.lane)} />
        ))}
      </svg>
    </div>
  );
}

function Node({ node, x, y }: { node: DiagramNode; x: number; y: number }) {
  if (node.kind === "start" || node.kind === "end") {
    const fill = node.kind === "start" ? "#10b981" : "#475569";
    return (
      <g>
        <circle cx={x} cy={y} r={EVENT_R} fill="white" stroke={fill} strokeWidth={3} />
        {node.kind === "end" && (
          <circle cx={x} cy={y} r={EVENT_R - 6} fill={fill} />
        )}
        <NodeLabelBelow x={x} y={y + EVENT_R + 6} label={node.label} />
      </g>
    );
  }

  if (node.kind === "decision") {
    const points = `${x},${y - DECISION_R} ${x + DECISION_R},${y} ${x},${y + DECISION_R} ${x - DECISION_R},${y}`;
    return (
      <g>
        <polygon
          points={points}
          fill="#fef3c7"
          stroke="#d97706"
          strokeWidth={1.5}
        />
        <NodeLabelInside
          x={x}
          y={y}
          label={node.label}
          color="#78350f"
          maxWidth={DECISION_R * 1.6}
        />
        {typeof node.step === "number" && (
          <StepBadge x={x - DECISION_R + 8} y={y - DECISION_R + 8} step={node.step} />
        )}
      </g>
    );
  }

  // task
  const tone = nodeToneStyles(node.variant);
  return (
    <g>
      <rect
        x={x - TASK_W / 2}
        y={y - TASK_H / 2}
        width={TASK_W}
        height={TASK_H}
        rx={10}
        ry={10}
        fill={tone.fill}
        stroke={tone.stroke}
        strokeWidth={1.5}
      />
      <NodeLabelInside
        x={x}
        y={y}
        label={node.label}
        color={tone.text}
        maxWidth={TASK_W - 18}
      />
      {typeof node.step === "number" && (
        <StepBadge x={x - TASK_W / 2 + 8} y={y - TASK_H / 2 + 8} step={node.step} />
      )}
    </g>
  );
}

function nodeToneStyles(variant?: "primary" | "muted" | "alert") {
  if (variant === "alert") {
    return { fill: "#fff1f2", stroke: "#e11d48", text: "#881337" };
  }
  if (variant === "muted") {
    return { fill: "#f8fafc", stroke: "#cbd5e1", text: "#475569" };
  }
  return { fill: "white", stroke: "#0f172a", text: "#0f172a" };
}

function StepBadge({ x, y, step }: { x: number; y: number; step: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={9} fill="#0f172a" />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="10"
        fontWeight={700}
      >
        {step}
      </text>
    </g>
  );
}

function NodeLabelInside({
  x,
  y,
  label,
  color,
  maxWidth,
}: {
  x: number;
  y: number;
  label: string;
  color: string;
  maxWidth: number;
}) {
  const lines = splitLabel(label, maxWidth);
  const lineHeight = 13;
  const totalH = (lines.length - 1) * lineHeight;
  const startY = y - totalH / 2;
  return (
    <text
      x={x}
      textAnchor="middle"
      fill={color}
      fontSize="11.5"
      fontWeight={500}
      style={{ pointerEvents: "none" }}
    >
      {lines.map((line, i) => (
        <tspan key={i} x={x} y={startY + i * lineHeight} dominantBaseline="central">
          {line}
        </tspan>
      ))}
    </text>
  );
}

function NodeLabelBelow({ x, y, label }: { x: number; y: number; label: string }) {
  if (!label) return null;
  return (
    <text
      x={x}
      y={y + 10}
      textAnchor="middle"
      fill="#475569"
      fontSize="10.5"
      fontWeight={500}
    >
      {label}
    </text>
  );
}

// Rough character-count line splitter. Caller can force a break with \n.
function splitLabel(label: string, maxWidth: number): string[] {
  const explicit = label.split("\n");
  const charsPerLine = Math.max(8, Math.floor(maxWidth / 6.5));
  const out: string[] = [];
  for (const segment of explicit) {
    const words = segment.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (next.length > charsPerLine && line) {
        out.push(line);
        line = w;
      } else {
        line = next;
      }
    }
    if (line) out.push(line);
  }
  return out.slice(0, 3); // hard cap so labels don't overflow
}

function Edge({
  edge,
  from,
  to,
}: {
  edge: DiagramEdge;
  from: { x: number; y: number; node: DiagramNode };
  to: { x: number; y: number; node: DiagramNode };
}) {
  const branch = edge.branch ?? "default";
  const stroke =
    branch === "yes" ? "#0d9488" : branch === "no" ? "#be123c" : "#475569";
  const marker =
    branch === "yes" ? "url(#arrow-yes)" : branch === "no" ? "url(#arrow-no)" : "url(#arrow)";

  // Trim endpoints so arrows touch node edge, not center.
  const trimmed = trimToNodeEdges(from, to, edge.routing ?? "auto");

  return (
    <g>
      <path
        d={trimmed.path}
        fill="none"
        stroke={stroke}
        strokeWidth={1.6}
        markerEnd={marker}
      />
      {edge.label && (
        <EdgeLabel
          x={trimmed.labelX}
          y={trimmed.labelY}
          label={edge.label}
          branch={branch}
        />
      )}
    </g>
  );
}

function EdgeLabel({
  x,
  y,
  label,
  branch,
}: {
  x: number;
  y: number;
  label: string;
  branch: "yes" | "no" | "default";
}) {
  const fill = branch === "yes" ? "#0d9488" : branch === "no" ? "#be123c" : "#334155";
  const padding = 4;
  const charW = 6;
  const w = label.length * charW + padding * 2;
  const h = 16;
  return (
    <g>
      <rect
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={3}
        fill="white"
        stroke={fill}
        strokeWidth={1}
      />
      <text
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="central"
        fill={fill}
        fontSize="10"
        fontWeight={600}
      >
        {label}
      </text>
    </g>
  );
}

function trimToNodeEdges(
  from: { x: number; y: number; node: DiagramNode },
  to: { x: number; y: number; node: DiagramNode },
  routing: "auto" | "h-v" | "v-h" | "straight",
) {
  const fromOffset = nodeEdgeOffset(from.node);
  const toOffset = nodeEdgeOffset(to.node);

  const sameLane = from.y === to.y;
  const sameCol = from.x === to.x;
  const goingRight = to.x > from.x;
  const goingDown = to.y > from.y;

  let mode = routing;
  if (mode === "auto") {
    if (sameLane) mode = "straight";
    else if (sameCol) mode = "straight";
    else mode = "h-v";
  }

  if (mode === "straight") {
    if (sameLane) {
      const x1 = goingRight ? from.x + fromOffset.right : from.x - fromOffset.right;
      const x2 = goingRight ? to.x - toOffset.right : to.x + toOffset.right;
      return {
        path: `M ${x1} ${from.y} L ${x2} ${to.y}`,
        labelX: (x1 + x2) / 2,
        labelY: from.y - 8,
      };
    }
    if (sameCol) {
      const y1 = goingDown ? from.y + fromOffset.bottom : from.y - fromOffset.top;
      const y2 = goingDown ? to.y - toOffset.top : to.y + toOffset.bottom;
      return {
        path: `M ${from.x} ${y1} L ${to.x} ${y2}`,
        labelX: from.x + 8,
        labelY: (y1 + y2) / 2,
      };
    }
    // diagonal fallback
    return {
      path: `M ${from.x} ${from.y} L ${to.x} ${to.y}`,
      labelX: (from.x + to.x) / 2,
      labelY: (from.y + to.y) / 2 - 8,
    };
  }

  if (mode === "h-v") {
    // exit horizontally first, then vertical to target
    const x1 = goingRight ? from.x + fromOffset.right : from.x - fromOffset.right;
    const elbowX = to.x;
    const y2 = goingDown ? to.y - toOffset.top : to.y + toOffset.bottom;
    return {
      path: `M ${x1} ${from.y} L ${elbowX} ${from.y} L ${elbowX} ${y2}`,
      labelX: (x1 + elbowX) / 2,
      labelY: from.y - 8,
    };
  }

  // v-h: exit vertically first, then horizontal to target
  const y1 = goingDown ? from.y + fromOffset.bottom : from.y - fromOffset.top;
  const elbowY = to.y;
  const x2 = goingRight ? to.x - toOffset.right : to.x + toOffset.right;
  return {
    path: `M ${from.x} ${y1} L ${from.x} ${elbowY} L ${x2} ${elbowY}`,
    labelX: from.x + 8,
    labelY: (y1 + elbowY) / 2,
  };
}

function nodeEdgeOffset(node: DiagramNode) {
  if (node.kind === "start" || node.kind === "end") {
    return { right: EVENT_R + 2, top: EVENT_R + 2, bottom: EVENT_R + 2 };
  }
  if (node.kind === "decision") {
    return { right: DECISION_R + 2, top: DECISION_R + 2, bottom: DECISION_R + 2 };
  }
  return { right: TASK_W / 2 + 2, top: TASK_H / 2 + 2, bottom: TASK_H / 2 + 2 };
}
