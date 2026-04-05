import { useCallback } from 'react';
import * as d3 from 'd3';
import type { ContributorNode, ContributorEdge } from '../../types/gitStats';
import { D3Container } from './D3Container';

interface Props {
  nodes: ContributorNode[];
  edges: ContributorEdge[];
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  connections: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  weight: number;
}

export function ContributorNetwork({ nodes, edges }: Props) {
  const render = useCallback(
    (svg: SVGSVGElement, width: number, height: number) => {
      const sel = d3.select(svg);
      sel.selectAll('*').remove();

      // Count connections per node
      const connectionCount = new Map<string, number>();
      for (const e of edges) {
        connectionCount.set(e.source, (connectionCount.get(e.source) ?? 0) + 1);
        connectionCount.set(e.target, (connectionCount.get(e.target) ?? 0) + 1);
      }

      const simNodes: SimNode[] = nodes.map((n) => ({
        id: n.id,
        name: n.name,
        connections: connectionCount.get(n.id) ?? 1,
      }));

      const nodeById = new Map(simNodes.map((n) => [n.id, n]));

      const simLinks: SimLink[] = edges
        .filter((e) => nodeById.has(e.source) && nodeById.has(e.target))
        .map((e) => ({
          source: e.source,
          target: e.target,
          weight: e.weight,
        }));

      const maxConnections = Math.max(1, ...simNodes.map((n) => n.connections));
      const maxWeight = Math.max(1, ...edges.map((e) => e.weight));

      const radiusScale = d3.scaleLinear().domain([1, maxConnections]).range([6, 24]);
      const linkWidthScale = d3.scaleLinear().domain([1, maxWeight]).range([1, 5]);

      const simulation = d3
        .forceSimulation<SimNode>(simNodes)
        .force(
          'link',
          d3
            .forceLink<SimNode, SimLink>(simLinks)
            .id((d) => d.id)
            .distance(120),
        )
        .force('charge', d3.forceManyBody().strength(-200))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collide', d3.forceCollide(30));

      const linkGroup = sel.append('g');
      const nodeGroup = sel.append('g');
      const labelGroup = sel.append('g');

      const linkElements = linkGroup
        .selectAll('line')
        .data(simLinks)
        .enter()
        .append('line')
        .attr('stroke', '#334155')
        .attr('stroke-width', (d) => linkWidthScale(d.weight))
        .attr('stroke-opacity', 0.6);

      const nodeElements = nodeGroup
        .selectAll('circle')
        .data(simNodes)
        .enter()
        .append('circle')
        .attr('r', (d) => radiusScale(d.connections))
        .attr('fill', '#38bdf8')
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 2)
        .style('cursor', 'grab');

      const labelElements = labelGroup
        .selectAll('text')
        .data(simNodes)
        .enter()
        .append('text')
        .text((d) => (d.name.length > 14 ? d.name.slice(0, 12) + '...' : d.name))
        .attr('fill', '#94a3b8')
        .attr('font-size', 10)
        .attr('text-anchor', 'middle')
        .attr('dy', (d) => radiusScale(d.connections) + 14);

      // Drag behaviour
      function dragstarted(event: d3.D3DragEvent<SVGCircleElement, SimNode, SimNode>) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      function dragged(event: d3.D3DragEvent<SVGCircleElement, SimNode, SimNode>) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      function dragended(event: d3.D3DragEvent<SVGCircleElement, SimNode, SimNode>) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }

      nodeElements.call(
        d3
          .drag<SVGCircleElement, SimNode>()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended),
      );

      simulation.on('tick', () => {
        linkElements
          .attr('x1', (d) => (d.source as SimNode).x!)
          .attr('y1', (d) => (d.source as SimNode).y!)
          .attr('x2', (d) => (d.target as SimNode).x!)
          .attr('y2', (d) => (d.target as SimNode).y!);

        nodeElements.attr('cx', (d) => d.x!).attr('cy', (d) => d.y!);

        labelElements.attr('x', (d) => d.x!).attr('y', (d) => d.y!);
      });

      return () => {
        simulation.stop();
      };
    },
    [nodes, edges],
  );

  if (nodes.length === 0) return null;

  return <D3Container render={render} height={500} />;
}
