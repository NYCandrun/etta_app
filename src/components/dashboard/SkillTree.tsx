import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { select, zoom } from "d3";
import type { Concept } from "@/types/concept";
import {
  computeSkillTreeLayout,
  getNodeColor,
  type SkillNode,
  type SkillEdge,
} from "@/lib/skill-tree-layout";
import { useSession } from "@/hooks/useSession";

interface SkillTreeProps {
  concepts: Concept[];
  className?: string;
}

const NODE_RADIUS = 24;

export function SkillTree({ concepts, className = "" }: SkillTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });
  const [tooltip, setTooltip] = useState<{
    node: SkillNode;
    x: number;
    y: number;
  } | null>(null);
  const navigate = useNavigate();
  const { selectConcept } = useSession();

  // Measure container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: Math.max(400, entry.contentRect.height),
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleNodeClick = useCallback(
    (node: SkillNode) => {
      const concept = concepts.find((c) => c.id === node.id);
      if (concept && concept.state !== "locked") {
        selectConcept(concept);
        navigate("/lesson");
      }
    },
    [concepts, selectConcept, navigate]
  );

  // Render with D3
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || concepts.length === 0) return;

    const { nodes, edges } = computeSkillTreeLayout(
      concepts,
      dimensions.width,
      dimensions.height
    );

    const root = select(svg);
    root.selectAll("*").remove();

    // Zoom group
    const g = root.append("g");

    // Pan + zoom
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      });

    root.call(zoomBehavior);

    // Defs for filters
    const defs = root.append("defs");
    const filter = defs.append("filter").attr("id", "glow");
    filter
      .append("feGaussianBlur")
      .attr("stdDeviation", "3")
      .attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Edges
    g.selectAll<SVGLineElement, SkillEdge>("line")
      .data(edges)
      .join("line")
      .attr("x1", (d) => (d.source as SkillNode).x ?? 0)
      .attr("y1", (d) => (d.source as SkillNode).y ?? 0)
      .attr("x2", (d) => (d.target as SkillNode).x ?? 0)
      .attr("y2", (d) => (d.target as SkillNode).y ?? 0)
      .attr("stroke", "var(--color-border)")
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.5);

    // Node groups
    const nodeGroups = g
      .selectAll<SVGGElement, SkillNode>("g.node")
      .data(nodes, (d) => d.id)
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
      .style("cursor", (d) => (d.state === "locked" ? "default" : "pointer"));

    // Node circles
    nodeGroups
      .append("circle")
      .attr("r", NODE_RADIUS)
      .attr("fill", (d) => getNodeColor(d.state))
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .attr("filter", (d) =>
        d.state === "in_progress" ? "url(#glow)" : null
      )
      .style("transition", "all 0.2s ease");

    // Mastery ring
    nodeGroups
      .filter((d) => d.state === "in_progress" || d.state === "mastered")
      .append("circle")
      .attr("r", NODE_RADIUS + 4)
      .attr("fill", "none")
      .attr("stroke", (d) => getNodeColor(d.state))
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", (d) => {
        const c = 2 * Math.PI * (NODE_RADIUS + 4);
        return `${c * d.masteryScore} ${c * (1 - d.masteryScore)}`;
      })
      .attr("stroke-linecap", "round")
      .attr("transform", "rotate(-90)")
      .attr("opacity", 0.6);

    // Lock icon for locked
    nodeGroups
      .filter((d) => d.state === "locked")
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", "14px")
      .attr("fill", "white")
      .text("\u{1F512}");

    // Initials for unlocked
    nodeGroups
      .filter((d) => d.state !== "locked")
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("fill", "white")
      .text((d) =>
        d.name
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      );

    // Labels
    nodeGroups
      .append("text")
      .attr("text-anchor", "middle")
      .attr("y", NODE_RADIUS + 16)
      .attr("font-size", "11px")
      .attr("fill", "var(--color-text-secondary)")
      .text((d) =>
        d.name.length > 14 ? d.name.slice(0, 12) + "..." : d.name
      );

    // Interactions
    nodeGroups
      .on("mouseenter", function (event, d) {
        select(this).select("circle").attr("r", NODE_RADIUS + 3);
        setTooltip({ node: d, x: event.offsetX, y: event.offsetY });
      })
      .on("mouseleave", function () {
        select(this).select("circle").attr("r", NODE_RADIUS);
        setTooltip(null);
      })
      .on("click", (_, d) => handleNodeClick(d));
  }, [concepts, dimensions, handleNodeClick]);

  if (concepts.length === 0) {
    return (
      <div
        className={`card flex items-center justify-center py-16 ${className}`}
      >
        <p className="text-warm-400 dark:text-warm-500">
          Your skill tree will appear here once you begin learning.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`card relative overflow-hidden p-0 ${className}`}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="block"
      />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-xl bg-warm-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-warm-100 dark:text-warm-900"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y - 40,
          }}
        >
          <p className="font-semibold">{tooltip.node.name}</p>
          <p className="capitalize text-warm-300 dark:text-warm-500">
            {tooltip.node.state.replace("_", " ")} —{" "}
            {Math.round(tooltip.node.masteryScore * 100)}%
          </p>
        </div>
      )}
    </div>
  );
}
