import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Tag } from '../../types';
import { forceSimulation, forceManyBody, forceCollide, forceLink } from 'd3-force';
import { Home } from 'lucide-react';

interface TagCloudViewProps {
  tags: Tag[];
  tagCounts: Map<string, number>;
  tagPathMap: Map<string, string>;
  searchQuery: string;
  selectedTagId: string | null;
  onTagSelect: (tagId: string) => void;
}

interface CloudNode {
  id: string;
  name: string;
  path: string;
  count: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  radius: number;
  weight: number;
  targetX: number;
  targetY: number;
  parentId?: string;
  childCount: number;
  depth: number;
}

interface HoverState {
  node: CloudNode;
  x: number;
  y: number;
}

interface ToggleMarker {
  nodeId: string;
  x: number;
  y: number;
  collapsed: boolean;
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MIN_NODE_RADIUS = 16;
const MAX_NODE_RADIUS = 54;
const COLLISION_PADDING = 14;
const TOGGLE_RADIUS = 9;
const MIN_ZOOM = 0.14;
const MAX_ZOOM = 2.8;
const FIT_MAX_ZOOM = 1.05;
const ROOT_SPIRAL_STEP = 58;
const ROOT_TREE_GAP = 24;
const TREE_RADIUS_BASE = 20;
const TREE_RADIUS_PER_NODE = 3;
const CHILD_SPIRAL_STEP = 30;
const CHILD_DEPTH_GAP = 36;
const MIN_SIBLING_CLEARANCE = 36;

// ──────────────────────────────────────
// 数据计算
// ──────────────────────────────────────

/** 累计子节点计数 */
function buildInflatedCounts(
  tags: Tag[],
  rawCounts: Map<string, number>
): Map<string, number> {
  const result = new Map<string, number>();
  const childMap = new Map<string, Tag[]>();
  for (const t of tags) {
    if (t.parentId) {
      const arr = childMap.get(t.parentId) || [];
      arr.push(t);
      childMap.set(t.parentId, arr);
    }
  }

  function accumulate(id: string): number {
    let sum = rawCounts.get(id) || 0;
    const children = childMap.get(id) || [];
    for (const c of children) {
      sum += accumulate(c.id);
    }
    result.set(id, sum);
    return sum;
  }

  for (const t of tags) {
    if (!t.parentId || !tags.some(p => p.id === t.parentId)) {
      accumulate(t.id);
    }
  }
  for (const t of tags) {
    if (!result.has(t.id)) {
      result.set(t.id, rawCounts.get(t.id) || 0);
    }
  }
  return result;
}

/** 计算默认折叠：深度 > 2 的子树折叠 */
function computeDefaultCollapsed(tags: Tag[]): Set<string> {
  const tagMap = new Map<string, Tag>(tags.map(t => [t.id, t]));
  const childMap = new Map<string, string[]>();
  for (const t of tags) {
    if (t.parentId && tagMap.has(t.parentId)) {
      const arr = childMap.get(t.parentId) || [];
      arr.push(t.id);
      childMap.set(t.parentId, arr);
    }
  }

  function depth(id: string): number {
    const t = tagMap.get(id);
    if (!t?.parentId || !tagMap.has(t.parentId)) return 0;
    return 1 + depth(t.parentId);
  }

  const collapsed = new Set<string>();
  for (const t of tags) {
    if (childMap.has(t.id) && depth(t.id) >= 2) {
      collapsed.add(t.id);
    }
  }
  return collapsed;
}

/** 创建节点 + 边 */
function createNodesAndLinks(
  tags: Tag[],
  tagCounts: Map<string, number>,
  tagPathMap: Map<string, string>,
  searchQuery: string,
  collapsedIds: Set<string>
): { nodes: CloudNode[]; links: Array<{ source: string; target: string }> } {
  const query = searchQuery.toLowerCase().trim();
  const inflatedCounts = buildInflatedCounts(tags, tagCounts);
  const maxCount = Math.max(1, ...Array.from(inflatedCounts.values()));

  const filtered = tags.filter(tag => {
    if (!query) return true;
    const path = tagPathMap.get(tag.id) || tag.name;
    return tag.name.toLowerCase().includes(query) || path.toLowerCase().includes(query);
  });

  if (filtered.length === 0) return { nodes: [], links: [] };

  // 标记哪些节点因折叠被排除
  const excluded = new Set<string>();
  for (const cid of collapsedIds) {
    // 排除该节点的所有子孙
    function markDescendants(id: string) {
      for (const t of filtered) {
        if (t.parentId === id) {
          excluded.add(t.id);
          markDescendants(t.id);
        }
      }
    }
    markDescendants(cid);
  }

  const visible = filtered.filter(t => !excluded.has(t.id));

  const tagMap = new Map(visible.map(t => [t.id, t]));
  const childMap = new Map<string, string[]>();
  for (const t of visible) {
    if (t.parentId && tagMap.has(t.parentId)) {
      const arr = childMap.get(t.parentId) || [];
      arr.push(t.id);
      childMap.set(t.parentId, arr);
    }
  }

  const roots = visible.filter(t => !t.parentId || !tagMap.has(t.parentId));
  const n = visible.length;
  const positions = new Map<string, { x: number; y: number }>();

  // 计算每个节点的直接子节点数（基于全量 filtered，折叠的父节点也需要知道有子节点）
  const totalChildCount = new Map<string, number>();
  for (const t of filtered) {
    if (t.parentId) {
      totalChildCount.set(t.parentId, (totalChildCount.get(t.parentId) || 0) + 1);
    }
  }

  const depthCache = new Map<string, number>();
  function cachedDepth(id: string): number {
    if (depthCache.has(id)) return depthCache.get(id)!;
    const t = tagMap.get(id);
    const d = !t?.parentId || !tagMap.has(t.parentId) ? 0 : 1 + cachedDepth(t.parentId);
    depthCache.set(id, d);
    return d;
  }

  const rootById = new Map<string, string>();
  function rootOf(id: string): string {
    if (rootById.has(id)) return rootById.get(id)!;
    const t = tagMap.get(id);
    const root = t?.parentId && tagMap.has(t.parentId) ? rootOf(t.parentId) : id;
    rootById.set(id, root);
    return root;
  }

  const subtreeSizeCache = new Map<string, number>();
  function visibleSubtreeSize(id: string): number {
    if (subtreeSizeCache.has(id)) return subtreeSizeCache.get(id)!;
    let size = 1;
    const children = childMap.get(id) || [];
    for (const childId of children) {
      size += visibleSubtreeSize(childId);
    }
    subtreeSizeCache.set(id, size);
    return size;
  }

  const nodeMeta = new Map<string, {
    count: number;
    weight: number;
    radius: number;
    childCount: number;
    depth: number;
  }>();
  for (const tag of visible) {
    const count = inflatedCounts.get(tag.id) || 0;
    const weight = Math.log1p(count) / Math.log1p(maxCount);
    const childBoost = Math.min(6, (totalChildCount.get(tag.id) || 0) * 0.75);
    const radius = Math.min(
      MAX_NODE_RADIUS,
      MIN_NODE_RADIUS + Math.pow(weight, 0.72) * (MAX_NODE_RADIUS - MIN_NODE_RADIUS) + childBoost
    );
    nodeMeta.set(tag.id, {
      count,
      weight,
      radius,
      childCount: totalChildCount.get(tag.id) || 0,
      depth: cachedDepth(tag.id),
    });
  }

  function compareTreeImportance(a: string, b: string): number {
    const subtreeDelta = visibleSubtreeSize(b) - visibleSubtreeSize(a);
    if (subtreeDelta !== 0) return subtreeDelta;
    const countDelta = (inflatedCounts.get(b) || 0) - (inflatedCounts.get(a) || 0);
    if (countDelta !== 0) return countDelta;
    return a.localeCompare(b);
  }

  const sortedChildren = new Map<string, string[]>();
  for (const [parentId, children] of childMap) {
    sortedChildren.set(parentId, [...children].sort(compareTreeImportance));
  }

  function stableJitter(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i += 1) {
      hash = (hash * 31 + id.charCodeAt(i)) | 0;
    }
    return ((Math.abs(hash) % 1000) / 1000) - 0.5;
  }

  function childClearanceFor(children: string[]): number {
    return Math.max(
      MIN_SIBLING_CLEARANCE,
      ...children.map(childId => {
        const childMeta = nodeMeta.get(childId);
        return (childMeta?.radius || MIN_NODE_RADIUS) * 2 + COLLISION_PADDING * 2 + 8;
      })
    );
  }

  function packedRingRadius(parentRadius: number, children: string[], extraDepth = 0): number {
    if (children.length === 0) return parentRadius;
    const clearance = childClearanceFor(children);
    const firstRing = parentRadius + clearance * (0.76 + extraDepth * 0.035);
    const ringGap = clearance * 0.64;
    let remaining = children.length;
    let ring = 0;
    let radius = firstRing;

    while (remaining > 0) {
      radius = firstRing + ring * ringGap;
      const capacity = Math.max(6, Math.floor((Math.PI * 2 * radius) / clearance));
      remaining -= capacity;
      ring += 1;
    }

    return radius + clearance * 0.32;
  }

  function treeRadius(rootId: string): number {
    const ownMeta = nodeMeta.get(rootId);
    const children = sortedChildren.get(rootId) || [];
    if (children.length === 0) {
      return (ownMeta?.radius || MIN_NODE_RADIUS) + ROOT_TREE_GAP * 0.35;
    }

    function maxSubtreeDepth(id: string): number {
      const childIds = sortedChildren.get(id) || [];
      if (childIds.length === 0) return cachedDepth(id);
      return Math.max(cachedDepth(id), ...childIds.map(maxSubtreeDepth));
    }
    const maxDepth = Math.max(1, maxSubtreeDepth(rootId));
    return TREE_RADIUS_BASE + packedRingRadius(ownMeta?.radius || MIN_NODE_RADIUS, children) + Math.sqrt(visibleSubtreeSize(rootId)) * TREE_RADIUS_PER_NODE + maxDepth * 8;
  }

  const rootOrder = [...roots].sort((a, b) => compareTreeImportance(a.id, b.id));
  const rootRadius = new Map<string, number>();
  for (const root of rootOrder) {
    rootRadius.set(root.id, treeRadius(root.id));
  }

  const rootGrid = new Map<string, Array<{ x: number; y: number; radius: number }>>();
  const maxRootRadius = Math.max(TREE_RADIUS_BASE, ...Array.from(rootRadius.values()));
  const rootGridCellSize = Math.max(96, maxRootRadius + ROOT_TREE_GAP);
  const gridKey = (gx: number, gy: number) => `${gx}:${gy}`;

  function rootCellRange(x: number, y: number, radius: number) {
    const span = radius + maxRootRadius + ROOT_TREE_GAP;
    return {
      minX: Math.floor((x - span) / rootGridCellSize),
      maxX: Math.floor((x + span) / rootGridCellSize),
      minY: Math.floor((y - span) / rootGridCellSize),
      maxY: Math.floor((y + span) / rootGridCellSize),
    };
  }

  function rootOverlaps(x: number, y: number, radius: number): boolean {
    const range = rootCellRange(x, y, radius);
    for (let gx = range.minX; gx <= range.maxX; gx += 1) {
      for (let gy = range.minY; gy <= range.maxY; gy += 1) {
        const rootsInCell = rootGrid.get(gridKey(gx, gy));
        if (!rootsInCell) continue;
        for (const other of rootsInCell) {
          const minDistance = radius + other.radius + ROOT_TREE_GAP;
          if (Math.hypot(x - other.x, y - other.y) < minDistance) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function indexRoot(x: number, y: number, radius: number) {
    const root = { x, y, radius };
    const gx = Math.floor(x / rootGridCellSize);
    const gy = Math.floor(y / rootGridCellSize);
    const key = gridKey(gx, gy);
    const rootsInCell = rootGrid.get(key);
    if (rootsInCell) rootsInCell.push(root);
    else rootGrid.set(key, [root]);
  }

  function placeRoot(rootId: string, index: number) {
    const radius = rootRadius.get(rootId) || TREE_RADIUS_BASE;
    let x = 0;
    let y = 0;
    let rootAngle = 0;

    if (index > 0) {
      let attempt = index;
      for (let guard = 0; guard < rootOrder.length * 8; guard += 1) {
        const angle = attempt * GOLDEN_ANGLE;
        const distance = Math.sqrt(attempt) * (ROOT_SPIRAL_STEP + Math.min(80, radius * 0.18));
        x = Math.cos(angle) * distance;
        y = Math.sin(angle) * distance;
        rootAngle = angle;

        if (!rootOverlaps(x, y, radius)) break;
        attempt += 1;
      }
    }

    indexRoot(x, y, radius);
    positions.set(rootId, { x, y });
    placeChildren(rootId, rootAngle, Math.PI * 2, 1);
  }

  function placeChildren(parentId: string, parentAngle: number, spread: number, depth: number) {
    const children = sortedChildren.get(parentId) || [];
    if (children.length === 0) return;

    const parentPos = positions.get(parentId);
    const parentMeta = nodeMeta.get(parentId);
    if (!parentPos || !parentMeta) return;

    children.forEach((childId, index) => {
      const childMeta = nodeMeta.get(childId);
      if (!childMeta) return;

      const childClearance = childClearanceFor(children);
      const firstRing = parentMeta.radius + childClearance * (0.76 + depth * 0.035);
      const ringGap = Math.max(CHILD_SPIRAL_STEP, childClearance * 0.64);
      let remainingIndex = index;
      let ring = 0;
      let ringRadius = firstRing;
      let ringCapacity = 1;

      while (true) {
        ringRadius = firstRing + ring * ringGap;
        ringCapacity = Math.max(6, Math.floor((Math.PI * 2 * ringRadius) / childClearance));
        if (remainingIndex < ringCapacity) break;
        remainingIndex -= ringCapacity;
        ring += 1;
      }

      const ringAngle = parentAngle + (remainingIndex / ringCapacity) * Math.PI * 2 + ring * GOLDEN_ANGLE + stableJitter(childId) * 0.12;
      const subtreeLift = Math.min(18, Math.sqrt(visibleSubtreeSize(childId)) * 2);
      const distance = ringRadius + childMeta.radius * 0.1 + subtreeLift;

      positions.set(childId, {
        x: parentPos.x + Math.cos(ringAngle) * distance,
        y: parentPos.y + Math.sin(ringAngle) * distance,
      });

      placeChildren(
        childId,
        ringAngle,
        Math.PI * 2,
        depth + 1
      );
    });
  }

  rootOrder.forEach((root, index) => {
    placeRoot(root.id, index);
  });

  const nodes = visible.map(tag => {
    const pos = positions.get(tag.id)!;
    const meta = nodeMeta.get(tag.id)!;
    const root = rootOf(tag.id);
    return {
      id: tag.id,
      name: tag.name,
      path: tagPathMap.get(tag.id) || tag.name,
      count: meta.count,
      x: pos.x,
      y: pos.y,
      targetX: pos.x,
      targetY: pos.y,
      radius: meta.radius,
      weight: meta.weight,
      parentId: tag.parentId,
      childCount: meta.childCount,
      depth: root === tag.id ? 0 : meta.depth,
    };
  });

  const links: Array<{ source: string; target: string }> = [];
  for (const t of visible) {
    if (t.parentId && tagMap.has(t.parentId)) {
      links.push({ source: t.parentId, target: t.id });
    }
  }

  return { nodes, links };
}

// ──────────────────────────────────────
// 渲染
// ──────────────────────────────────────

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}...`).width > maxWidth) {
    end -= 1;
  }
  return `${text.slice(0, Math.max(1, end))}...`;
}

function draw(
  ctx: CanvasRenderingContext2D,
  nodes: CloudNode[],
  toggleMarkers: ToggleMarker[],
  width: number,
  height: number,
  selectedTagId: string | null,
  hoverId: string | null,
  isDarkMode: boolean,
  zoom: number,
  panX: number,
  panY: number
) {
  // 背景
  ctx.fillStyle = isDarkMode ? '#111827' : '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  // 视口裁剪边界（屏幕像素 → 虚拟空间，保证足够宽松）
  const screenMargin = 200;
  const vMinX = -panX / zoom - screenMargin / zoom;
  const vMaxX = (width - panX) / zoom + screenMargin / zoom;
  const vMinY = -panY / zoom - screenMargin / zoom;
  const vMaxY = (height - panY) / zoom + screenMargin / zoom;

  // 可见节点集合
  const visibleNodes: CloudNode[] = [];
  for (const n of nodes) {
    if (n.x + n.radius < vMinX || n.x - n.radius > vMaxX ||
        n.y + n.radius < vMinY || n.y - n.radius > vMaxY) continue;
    visibleNodes.push(n);
  }

  // LOD — 根据缩放级别决定渲染细节
  const lodPoints = zoom < 0.12;
  const lodText = zoom >= 0.16;
  const lodEdges = zoom >= 0.1;
  const lodAllText = zoom >= 0.42;
  // 点模式下虚拟空间半径，保证屏幕上至少 3px
  const pointScreenR = 3;
  const pointVirtualR = pointScreenR / zoom;

  // ── 连线（批处理） ──
  if (lodEdges && visibleNodes.length > 0) {
    const nodeMap = new Map(visibleNodes.map(n => [n.id, n]));
    ctx.beginPath();
    for (const node of visibleNodes) {
      if (!node.parentId) continue;
      if (visibleNodes.length > 1600 && zoom < 0.22 && node.depth > 2) continue;
      if (visibleNodes.length > 900 && zoom < 0.16 && node.weight < 0.08) continue;
      const parent = nodeMap.get(node.parentId);
      if (!parent) continue;
      ctx.moveTo(parent.x, parent.y);
      ctx.lineTo(node.x, node.y);
    }
    const edgeAlpha = visibleNodes.length > 1600 ? 0.055 : visibleNodes.length > 900 ? 0.085 : visibleNodes.length > 400 ? 0.13 : 0.2;
    ctx.strokeStyle = isDarkMode ? `rgba(148, 163, 184, ${edgeAlpha})` : `rgba(100, 116, 139, ${edgeAlpha})`;
    ctx.lineWidth = Math.max(0.6, 0.9 / zoom);
    ctx.stroke();
  }

  // ── 节点（按 tier 分组） ──
  const tiers: { high: CloudNode[]; mid: CloudNode[]; low: CloudNode[] } = { high: [], mid: [], low: [] };
  for (const n of visibleNodes) {
    if (n.weight > 0.5) tiers.high.push(n);
    else if (n.weight > 0.15) tiers.mid.push(n);
    else tiers.low.push(n);
  }

  function drawTier(nodesGroup: CloudNode[], fillHigh: string, fillHighSel: string, strokeHigh: string,
                    fillMid: string, fillMidSel: string, strokeMid: string,
                    fillLow: string, strokeLow: string) {
    for (const node of nodesGroup) {
      const isSelected = selectedTagId === node.id;
      const isHover = hoverId === node.id;

      ctx.beginPath();
      if (lodPoints) {
        ctx.arc(node.x, node.y, pointVirtualR, 0, Math.PI * 2);
        ctx.fillStyle = isDarkMode ? '#4b5563' : '#cbd5e1';
        ctx.fill();
        continue;
      }

      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

      // 填充
      if (nodesGroup === tiers.high) {
        ctx.fillStyle = isSelected ? fillHighSel : fillHigh;
      } else if (nodesGroup === tiers.mid) {
        ctx.fillStyle = isSelected ? fillMidSel : fillMid;
      } else {
        ctx.fillStyle = fillLow;
      }

      ctx.setLineDash([]);

      // 描边
      ctx.strokeStyle = nodesGroup === tiers.high ? strokeHigh : nodesGroup === tiers.mid ? strokeMid : strokeLow;
      ctx.lineWidth = isSelected ? 3.5 : isHover ? 2.5 : nodesGroup === tiers.low ? 1.2 : 1.8;

      // shadow 只对选中/hover
      if (isSelected || isHover) {
        ctx.save();
        ctx.shadowColor = isDarkMode ? 'rgba(147, 197, 253, 0.32)' : 'rgba(37, 99, 235, 0.26)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 6;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  const dHigh = isDarkMode ? '#b45309' : '#f59e0b';
  const dHighSel = isDarkMode ? '#d97706' : '#fbbf24';
  const dHighStroke = isDarkMode ? '#fed7aa' : '#92400e';
  const dMid = isDarkMode ? '#0e7490' : '#06b6d4';
  const dMidSel = isDarkMode ? '#0891b2' : '#67e8f9';
  const dMidStroke = isDarkMode ? '#a5f3fc' : '#155e75';
  const dLow = isDarkMode ? 'rgba(51, 65, 85, 0.92)' : '#e2e8f0';
  const dLowStroke = isDarkMode ? 'rgba(148, 163, 184, 0.38)' : 'rgba(71, 85, 105, 0.32)';

  drawTier(tiers.high, dHigh, dHighSel, dHighStroke, dMid, dMidSel, dMidStroke,
           dLow, dLowStroke);
  drawTier(tiers.mid, dHigh, dHighSel, dHighStroke, dMid, dMidSel, dMidStroke,
           dLow, dLowStroke);
  drawTier(tiers.low, dHigh, dHighSel, dHighStroke, dMid, dMidSel, dMidStroke,
           dLow, dLowStroke);

  // ── 文字 ──
  if (lodText && visibleNodes.length > 0) {
    for (const node of visibleNodes) {
      if (!lodAllText && node.weight < 0.3) continue;

      const fontSize = Math.max(10, Math.min(20, node.radius * 0.32));
      const tier = node.weight > 0.5 ? 'high' : node.weight > 0.15 ? 'mid' : 'low';

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isDarkMode
        ? (tier === 'low' ? '#e5e7eb' : '#ffffff')
        : (tier === 'high' ? '#78350f' : tier === 'mid' ? '#164e63' : '#0f172a');
      ctx.font = `${tier === 'high' ? 700 : 600} ${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.fillText(fitText(ctx, node.name, node.radius * 1.48), node.x, node.y - (node.count > 0 ? 6 : 0));

      if (node.count > 0) {
        ctx.globalAlpha = 0.72;
        ctx.font = `600 ${Math.max(9, fontSize * 0.6)}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillText(String(node.count), node.x, node.y + Math.max(10, node.radius * 0.24));
        ctx.globalAlpha = 1;
      }
    }
  }

  // ── +/- 标记 ──
  if (zoom >= 0.25) {
    const toggleRadius = TOGGLE_RADIUS / zoom;
    for (const tm of toggleMarkers) {
      const tmNode = nodeMapGet(visibleNodes, tm.nodeId);
      if (!tmNode) continue;
      if (tmNode.x + tmNode.radius < vMinX || tmNode.x - tmNode.radius > vMaxX ||
          tmNode.y + tmNode.radius < vMinY || tmNode.y - tmNode.radius > vMaxY) continue;

      ctx.beginPath();
      ctx.arc(tm.x, tm.y, toggleRadius, 0, Math.PI * 2);
      ctx.fillStyle = isDarkMode ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.95)';
      ctx.strokeStyle = isDarkMode ? '#4b5563' : '#94a3b8';
      ctx.lineWidth = 1.5 / zoom;
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isDarkMode ? '#d1d5db' : '#475569';
      ctx.font = `bold ${Math.max(10, 12 / zoom)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tm.collapsed ? '+' : '−', tm.x, tm.y + 0.5 / zoom);
    }
  }

  ctx.restore();
}

// 轻量 nodeMap 查询（避免每次重建 Map）
function nodeMapGet(nodes: CloudNode[], id: string): CloudNode | undefined {
  for (const n of nodes) { if (n.id === id) return n; }
  return undefined;
}

// ──────────────────────────────────────
// React 组件
// ──────────────────────────────────────

export const TagCloudView: React.FC<TagCloudViewProps> = ({
  tags,
  tagCounts,
  tagPathMap,
  searchQuery,
  selectedTagId,
  onTagSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<CloudNode[]>([]);
  const dimensionsRef = useRef({ width: 800, height: 600 });
  const hoverIdRef = useRef<string | null>(null);
  const selectedTagIdRef = useRef(selectedTagId);
  const toggleMarkersRef = useRef<ToggleMarker[]>([]);

  // 视口
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);

  // 拖拽
  const draggingNodeRef = useRef<CloudNode | null>(null);
  const pendingToggleNodeIdRef = useRef<string | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragMovedRef = useRef(false);
  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panStartOffsetRef = useRef({ x: 0, y: 0 });

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hover, setHover] = useState<HoverState | null>(null);

  // 展开/收起
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => computeDefaultCollapsed(tags));

  // d3 simulation refs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simRef = useRef<any>(null);
  const canvasSizeRef = useRef({ width: 800, height: 600, dpr: 1 });

  useEffect(() => { selectedTagIdRef.current = selectedTagId; }, [selectedTagId]);

  // resize
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const width = Math.max(320, Math.floor(entry.contentRect.width));
      const height = Math.max(320, Math.floor(entry.contentRect.height));
      dimensionsRef.current = { width, height };
      setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // ── 单次渲染函数 ──
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvasSizeRef.current;
    const dpr = window.devicePixelRatio || 1;
    const scaledWidth = Math.floor(width * dpr);
    const scaledHeight = Math.floor(height * dpr);

    if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const isDarkMode = document.documentElement.classList.contains('dark');

    draw(
      ctx,
      nodesRef.current,
      toggleMarkersRef.current,
      width,
      height,
      selectedTagIdRef.current,
      hoverIdRef.current,
      isDarkMode,
      zoomRef.current,
      panRef.current.x,
      panRef.current.y
    );
  }, []);

  // ── fit-to-view: 计算 pan/zoom 使所有节点可见 ──
  const fitToView = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes.length === 0) return;

    // 直接从 DOM 读尺寸，不依赖可能过期的 ref
    const container = containerRef.current;
    const width = container ? Math.max(320, container.clientWidth) : dimensionsRef.current.width;
    const height = container ? Math.max(320, container.clientHeight) : dimensionsRef.current.height;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x - n.radius);
      minY = Math.min(minY, n.y - n.radius);
      maxX = Math.max(maxX, n.x + n.radius);
      maxY = Math.max(maxY, n.y + n.radius);
    }

    const pad = 96;
    const cw = maxX - minX + pad * 2;
    const ch = maxY - minY + pad * 2;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    let z = Math.min(width / cw, height / ch, FIT_MAX_ZOOM);
    z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

    zoomRef.current = z;
    setZoom(z);
    panRef.current = {
      x: width / 2 - midX * z,
      y: height / 2 - midY * z,
    };
    renderFrame();
  }, [renderFrame]);

  // ── 构建 simulation ──
  const buildSimulation = useCallback((nodes: CloudNode[], links: Array<{ source: string; target: string }>) => {
    // 停止旧 simulation
    simRef.current?.stop();

    const n = nodes.length;
    const chargeBase = n > 1800 ? 520 : n > 900 ? 660 : 900;
    const chargeDistance = Math.max(760, Math.min(1800, 58 * Math.sqrt(Math.max(n, 1))));
    const collideIterations = n > 1800 ? 2 : n > 900 ? 3 : 5;

    const simLinks = links.map(link => ({ ...link }));
    const sim = forceSimulation<CloudNode>(nodes)
      .force('link', forceLink<CloudNode, { source: string | CloudNode; target: string | CloudNode }>(simLinks)
        .id(d => d.id)
        .distance(link => {
          const target = typeof link.target === 'string' ? undefined : link.target;
          const source = typeof link.source === 'string' ? undefined : link.source;
          const depth = target?.depth ?? 1;
          const sourceRadius = source?.radius ?? MIN_NODE_RADIUS;
          const targetRadius = target?.radius ?? MIN_NODE_RADIUS;
          const leafGap = target && target.childCount === 0 ? 16 : 0;
          return sourceRadius + targetRadius + COLLISION_PADDING * 2 + CHILD_DEPTH_GAP + depth * 14 + leafGap;
        })
        .strength(link => {
          const target = typeof link.target === 'string' ? undefined : link.target;
          return target && target.depth <= 1 ? 0.028 : 0.016;
        })
        .iterations(1))
      .force('charge', forceManyBody<CloudNode>()
        .strength(d => -(chargeBase + d.radius * 6 + Math.min(420, d.childCount * 26)))
        .theta(n > 900 ? 0.9 : 0.78)
        .distanceMin(4)
        .distanceMax(chargeDistance))
      .force('collide', forceCollide<CloudNode>()
        .radius(d => d.radius + COLLISION_PADDING + Math.min(48, d.depth * 9))
        .strength(1)
        .iterations(collideIterations))
      .alpha(1)
      .alphaDecay(n > 1800 ? 0.08 : n > 900 ? 0.055 : 0.032)
      .alphaMin(0.018)
      .velocityDecay(n > 900 ? 0.6 : 0.44)
      .on('tick', () => {
        // 计算 +/- 标记位置（节点边缘）
        const markers: ToggleMarker[] = [];
        for (const nd of nodesRef.current) {
          if (nd.childCount > 0) {
            markers.push({
              nodeId: nd.id,
              x: nd.x + nd.radius + TOGGLE_RADIUS + 2,
              y: nd.y,
              collapsed: collapsedIds.has(nd.id),
            });
          }
        }
        toggleMarkersRef.current = markers;
        renderFrame();
      })
      .on('end', () => {
        // 模拟结束后只渲染最终帧，不重置视口
        renderFrame();
      });

    sim.stop();
    // 大图不能在扩展页面主线程同步跑几百 tick，否则整个插件会卡住。
    sim.tick(n > 1800 ? 12 : n > 900 ? 24 : n > 450 ? 54 : 90);

    const markers: ToggleMarker[] = [];
    for (const nd of nodesRef.current) {
      if (nd.childCount > 0) {
        markers.push({
          nodeId: nd.id,
          x: nd.x + nd.radius + TOGGLE_RADIUS + 2,
          y: nd.y,
          collapsed: collapsedIds.has(nd.id),
        });
      }
    }
    toggleMarkersRef.current = markers;
    simRef.current = sim;
    renderFrame();
  }, [collapsedIds, renderFrame]);

  // ── 数据变化时重建 ──
  useEffect(() => {
    const graph = createNodesAndLinks(tags, tagCounts, tagPathMap, searchQuery, collapsedIds);
    nodesRef.current = graph.nodes;
    initialFitDoneRef.current = false; // 让 canvasSizeRef effect 重新 fitToView

    if (graph.nodes.length > 0) {
      buildSimulation(graph.nodes, graph.links);
      fitToView(); // 从 DOM 读尺寸，确保居中
    } else {
      simRef.current?.stop();
      renderFrame();
    }
    setHover(null);
  }, [tags, tagCounts, tagPathMap, searchQuery, collapsedIds, buildSimulation, renderFrame, fitToView]);

  // ── 坐标转换 ──
  const screenToVirtual = useCallback((sx: number, sy: number) => {
    const z = zoomRef.current;
    const p = panRef.current;
    return { x: (sx - p.x) / z, y: (sy - p.y) / z };
  }, []);

  const getNodeAtScreen = useCallback((sx: number, sy: number) => {
    const v = screenToVirtual(sx, sy);
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = v.x - n.x;
      const dy = v.y - n.y;
      if (dx * dx + dy * dy <= n.radius * n.radius) return n;
    }
    return null;
  }, [screenToVirtual]);

  const getToggleAtScreen = useCallback((sx: number, sy: number): CloudNode | null => {
    const v = screenToVirtual(sx, sy);
    const markers = toggleMarkersRef.current;
    const toggleR = TOGGLE_RADIUS / zoomRef.current;
    for (const tm of markers) {
      const dx = v.x - tm.x;
      const dy = v.y - tm.y;
      if (dx * dx + dy * dy <= toggleR * toggleR) {
        return nodeMapGet(nodesRef.current, tm.nodeId) || null;
      }
    }
    return null;
  }, [screenToVirtual]);

  // ── 事件 ──
  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;

    // 先检查 +/- 标记
    const toggleNode = getToggleAtScreen(sx, sy);
    if (toggleNode) {
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.style.cursor = 'pointer';
      pendingToggleNodeIdRef.current = toggleNode.id;
      dragMovedRef.current = false;
      return;
    }

    const node = getNodeAtScreen(sx, sy);
    if (node) {
      event.currentTarget.setPointerCapture(event.pointerId);
      draggingNodeRef.current = node;
      dragMovedRef.current = false;
      const v = screenToVirtual(sx, sy);
      dragOffsetRef.current = { x: v.x - node.x, y: v.y - node.y };
      event.currentTarget.style.cursor = 'grabbing';
      if (nodesRef.current.length <= 900) {
        simRef.current?.alpha(0.3).restart();
      }
    } else {
      event.currentTarget.setPointerCapture(event.pointerId);
      panningRef.current = true;
      dragMovedRef.current = false;
      panStartRef.current = { x: event.clientX, y: event.clientY };
      panStartOffsetRef.current = { ...panRef.current };
      event.currentTarget.style.cursor = 'grabbing';
    }
  }, [getNodeAtScreen, getToggleAtScreen, screenToVirtual]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;

    if (draggingNodeRef.current) {
      const v = screenToVirtual(sx, sy);
      draggingNodeRef.current.x = v.x - dragOffsetRef.current.x;
      draggingNodeRef.current.y = v.y - dragOffsetRef.current.y;
      draggingNodeRef.current.targetX = draggingNodeRef.current.x;
      draggingNodeRef.current.targetY = draggingNodeRef.current.y;
      draggingNodeRef.current.vx = 0;
      draggingNodeRef.current.vy = 0;
      dragMovedRef.current = true;
      return;
    }

    if (panningRef.current) {
      const dx = event.clientX - panStartRef.current.x;
      const dy = event.clientY - panStartRef.current.y;
      panRef.current = {
        x: panStartOffsetRef.current.x + dx,
        y: panStartOffsetRef.current.y + dy,
      };
      dragMovedRef.current = Math.abs(dx) + Math.abs(dy) > 3;
      renderFrame();
      return;
    }

    // hover
    const node = getNodeAtScreen(sx, sy);
    const prevId = hoverIdRef.current;
    hoverIdRef.current = node?.id || null;
    event.currentTarget.style.cursor = node ? 'grab' : 'default';
    if (node && node.id !== prevId) {
      setHover({ node, x: sx, y: sy });
    } else if (!node && prevId) {
      setHover(null);
    }
    renderFrame();
  }, [screenToVirtual, getNodeAtScreen, renderFrame]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (pendingToggleNodeIdRef.current) {
      const nodeId = pendingToggleNodeIdRef.current;
      pendingToggleNodeIdRef.current = null;
      setCollapsedIds(prev => {
        const next = new Set(prev);
        if (next.has(nodeId)) next.delete(nodeId);
        else next.add(nodeId);
        return next;
      });
      event.currentTarget.style.cursor = 'default';
      return;
    }

    if (draggingNodeRef.current) {
      const id = draggingNodeRef.current.id;
      if (!dragMovedRef.current) {
        onTagSelect(id);
      }
      draggingNodeRef.current = null;
      event.currentTarget.style.cursor = 'default';
      return;
    }

    if (panningRef.current) {
      panningRef.current = false;
      event.currentTarget.style.cursor = 'default';
    }
  }, [onTagSelect]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;

    const oldZoom = zoomRef.current;
    const factor = event.deltaY < 0 ? 1.12 : 0.88;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));

    panRef.current = {
      x: sx - (sx - panRef.current.x) * (newZoom / oldZoom),
      y: sy - (sy - panRef.current.y) * (newZoom / oldZoom),
    };
    zoomRef.current = newZoom;
    setZoom(newZoom);
    renderFrame();
  }, [renderFrame]);

  const handlePointerLeave = useCallback(() => {
    hoverIdRef.current = null;
    draggingNodeRef.current = null;
    pendingToggleNodeIdRef.current = null;
    panningRef.current = false;
    setHover(null);
  }, []);

  const handleHome = useCallback(() => {
    for (const node of nodesRef.current) {
      node.x = node.targetX;
      node.y = node.targetY;
      node.vx = 0;
      node.vy = 0;
    }
    if (nodesRef.current.length <= 900) {
      simRef.current?.alpha(0.18).restart();
    }
    fitToView();
  }, [fitToView]);

  const zoomPercent = Math.round(zoom * 100);

  // canvas 尺寸 sync — 首次尺寸就绪时 fitToView
  const initialFitDoneRef = useRef(false);
  useEffect(() => {
    canvasSizeRef.current = { width: dimensions.width, height: dimensions.height, dpr: window.devicePixelRatio || 1 };
    if (!initialFitDoneRef.current && nodesRef.current.length > 0) {
      initialFitDoneRef.current = true;
      fitToView();
    } else {
      renderFrame();
    }
  }, [dimensions, renderFrame, fitToView]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-white dark:bg-gray-900">
      <canvas
        ref={canvasRef}
        className="block w-full h-full touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerLeave}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
        aria-label="标签云"
      />

      {nodesRef.current.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">
          {searchQuery ? '没有匹配的标签' : '暂无标签'}
        </div>
      )}

      <button
        type="button"
        onClick={handleHome}
        className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 bg-white/95 text-gray-600 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800/95 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-700 dark:hover:text-white"
        title="回到初始视图"
        aria-label="回到初始视图"
      >
        <Home className="h-4 w-4" />
      </button>

      <div className="absolute right-3 bottom-3 px-2 py-1 rounded bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 shadow-sm select-none">
        {zoomPercent}% · 滚轮缩放 · 空白处拖拽平移
      </div>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 max-w-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-800/95 px-3 py-2 text-xs text-gray-700 dark:text-gray-200 shadow-lg"
          style={{
            left: Math.min(hover.x + 12, dimensions.width - 220),
            top: Math.max(8, hover.y - 12),
          }}
        >
          <div className="font-semibold">{hover.node.path}</div>
          <div className="mt-0.5 text-gray-500 dark:text-gray-400">{hover.node.count} 个书签</div>
        </div>
      )}
    </div>
  );
};
