/**
 * D3 force-directed layout for the Astrolabe skill tree.
 *
 * Takes an array of concepts and computes node positions and edges
 * for rendering an SVG skill tree.
 */

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3";
import type { Concept, ConceptState } from "@/types/concept";

export interface SkillNode extends SimulationNodeDatum {
  id: string;
  name: string;
  state: ConceptState;
  masteryScore: number;
  domain: string;
  domainColor: string;
  moduleId: string;
  fx?: number | null;
  fy?: number | null;
}

export interface SkillEdge extends SimulationLinkDatum<SkillNode> {
  source: string | SkillNode;
  target: string | SkillNode;
}

export interface SkillTreeLayout {
  nodes: SkillNode[];
  edges: SkillEdge[];
  width: number;
  height: number;
}

/**
 * Compute the force-directed layout for a set of concepts.
 *
 * @param concepts Array of concepts from the curriculum
 * @param width Canvas width
 * @param height Canvas height
 * @returns Positioned nodes and edges ready for SVG rendering
 */
export function computeSkillTreeLayout(
  concepts: Concept[],
  width: number = 900,
  height: number = 600
): SkillTreeLayout {
  if (concepts.length === 0) {
    return { nodes: [], edges: [], width, height };
  }

  // Build nodes
  const nodes: SkillNode[] = concepts.map((c) => ({
    id: c.id,
    name: c.name,
    state: c.state,
    masteryScore: c.masteryScore,
    domain: c.domain.id,
    domainColor: c.domain.color,
    moduleId: c.moduleId,
  }));

  const nodeIds = new Set(nodes.map((n) => n.id));

  // Build edges from prerequisites
  const edges: SkillEdge[] = [];
  for (const concept of concepts) {
    for (const prereqId of concept.prerequisites) {
      if (nodeIds.has(prereqId)) {
        edges.push({
          source: prereqId,
          target: concept.id,
        });
      }
    }
  }

  // Run the simulation synchronously
  const simulation = forceSimulation<SkillNode>(nodes)
    .force(
      "link",
      forceLink<SkillNode, SkillEdge>(edges)
        .id((d) => d.id)
        .distance(100)
        .strength(0.8)
    )
    .force("charge", forceManyBody().strength(-300))
    .force("center", forceCenter(width / 2, height / 2))
    .force("collision", forceCollide().radius(40))
    .force(
      "vertical",
      forceY<SkillNode>()
        .y((d) => {
          // Position nodes vertically by state for a natural flow
          switch (d.state) {
            case "mastered":
              return height * 0.2;
            case "in_progress":
              return height * 0.4;
            case "unlocked":
              return height * 0.6;
            case "locked":
              return height * 0.8;
            default:
              return height / 2;
          }
        })
        .strength(0.15)
    )
    .stop();

  // Tick the simulation to completion
  const iterations = Math.ceil(
    Math.log(simulation.alphaMin()) /
      Math.log(1 - simulation.alphaDecay())
  );
  for (let i = 0; i < iterations; i++) {
    simulation.tick();
  }

  // Clamp nodes within bounds
  const padding = 50;
  for (const node of nodes) {
    node.x = Math.max(padding, Math.min(width - padding, node.x ?? width / 2));
    node.y = Math.max(padding, Math.min(height - padding, node.y ?? height / 2));
  }

  return { nodes, edges, width, height };
}

/**
 * Get the color for a concept state.
 */
export function getNodeColor(state: ConceptState): string {
  switch (state) {
    case "locked":
      return "var(--node-locked)";
    case "unlocked":
      return "var(--node-unlocked)";
    case "in_progress":
      return "var(--node-in-progress)";
    case "mastered":
      return "var(--node-mastered)";
  }
}

/**
 * Get the Tailwind color class for a concept state.
 */
export function getNodeColorClass(state: ConceptState): string {
  switch (state) {
    case "locked":
      return "text-warm-300 dark:text-warm-600";
    case "unlocked":
      return "text-primary-400";
    case "in_progress":
      return "text-accent-400";
    case "mastered":
      return "text-success-400";
  }
}
