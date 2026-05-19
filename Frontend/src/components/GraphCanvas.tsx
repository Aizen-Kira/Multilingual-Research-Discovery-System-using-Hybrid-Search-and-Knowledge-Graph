import ReactFlow, { Controls, MiniMap } from "reactflow";
import type { Node, Edge } from "reactflow";
import "reactflow/dist/style.css";

/* ---------- Geometry constants ---------- */
const CENTER = { x: 420, y: 260 };
const RADIUS = 220;

/* ---------- Base node style ---------- */
const baseNodeStyle = {
  border: "2px solid #2f2f2f",
  background: "#fafafa",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center" as const,
};

/* ---------- Nodes ---------- */
const nodes: Node[] = [
  {
    id: "center",
    position: CENTER,
    data: { label: "Paper Title" },
    style: {
      ...baseNodeStyle,
      width: 160,
      height: 160,
      borderRadius: "50%",
      fontSize: "20px",
      fontWeight: 600,
    },
  },

  {
    id: "a",
    position: {
      x: CENTER.x - RADIUS,
      y: CENTER.y - 120,
    },
    data: { label: "Paper Title" },
    style: {
      ...baseNodeStyle,
      width: 110,
      height: 110,
      borderRadius: "50%",
      fontSize: "14px",
    },
  },

  {
    id: "b",
    position: {
      x: CENTER.x + RADIUS,
      y: CENTER.y - 120,
    },
    data: { label: "Paper Title" },
    style: {
      ...baseNodeStyle,
      width: 110,
      height: 110,
      borderRadius: "50%",
      fontSize: "14px",
    },
  },

  {
    id: "c",
    position: {
      x: CENTER.x,
      y: CENTER.y + RADIUS,
    },
    data: { label: "Paper Title" },
    style: {
      ...baseNodeStyle,
      width: 110,
      height: 110,
      borderRadius: "50%",
      fontSize: "14px",
    },
  },

  {
    id: "d",
    position: {
      x: CENTER.x - 140,
      y: CENTER.y + 160,
    },
    data: { label: "Paper Title" },
    style: {
      ...baseNodeStyle,
      width: 90,
      height: 90,
      borderRadius: "50%",
      fontSize: "13px",
    },
  },

  {
    id: "e",
    position: {
      x: CENTER.x + 140,
      y: CENTER.y + 160,
    },
    data: { label: "Paper Title" },
    style: {
      ...baseNodeStyle,
      width: 90,
      height: 90,
      borderRadius: "50%",
      fontSize: "13px",
    },
  },
];

/* ---------- Edges ---------- */
const edges: Edge[] = [
  { id: "e1", source: "center", target: "a" },
  { id: "e2", source: "center", target: "b" },
  { id: "e3", source: "center", target: "c" },
  { id: "e4", source: "c", target: "d" },
  { id: "e5", source: "c", target: "e" },
];

/* ---------- Component ---------- */
export default function GraphCanvas() {
  return (
    <div className="flex-1 bg-[#F8FAFC]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodesDraggable={false}
        zoomOnScroll={false}
        panOnScroll
        fitView
      >
        <MiniMap />
        <Controls />
      </ReactFlow>
    </div>
  );
}
