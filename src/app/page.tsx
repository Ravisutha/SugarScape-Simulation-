"use client";

import React, { useEffect, useMemo, useRef, useState, useDeferredValue, useCallback, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Play, Pause, RotateCcw, RefreshCw, CheckCircle, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/glass-card";
import { SliderControl, NumberInput, SwitchControl } from "@/components/ui/form-controls";
import { MiniChart as ChartComponent, type ChartData } from "@/components/ui/chart-components";
import { StatCard, ContentSection } from "@/components/ui/layout-components";
import { PerformanceMonitor } from "@/components/ui/performance-monitor";

/**
 * PERFORMANCE OPTIMIZATIONS APPLIED:
 * 
 * 1. Canvas Rendering:
 *    - Added dirty checking to prevent unnecessary redraws
 *    - Using requestAnimationFrame for smooth rendering
 *    - Reduced grid line drawing frequency
 *    - Batch canvas operations
 * 
 * 2. State Management:
 *    - Memoized expensive calculations (landSugar, heldSugar, wealthData)
 *    - Added useCallback to prevent function recreation
 *    - Debounced auto-apply changes (500ms)
 *    - Reduced chart update frequency
 * 
 * 3. Component Optimization:
 *    - Memoized UI helper components
 *    - Disabled chart animations for better performance
 *    - Simplified useEffect dependencies
 * 
 * 4. Simulation Loop:
 *    - Added minimum interval of 16ms (60fps limit)
 *    - Optimized doStep with useCallback
 *    - Reduced chart updates to every 10 ticks when running
 */

/** Types */
interface Agent { id:number; x:number; y:number; sugar:number; vision:number; metabolism:number; }
interface Cell { sugar:number; maxSugar:number; }

type IntDistribution =
  | { kind: "uniform"; min: number; max: number }
  | { kind: "normal"; mean: number; sd: number; min: number; max: number }
  | { kind: "discrete"; items: { value: number; weight: number }[] };

/** Utils */
const clamp = (v:number, lo:number, hi:number)=>Math.max(lo, Math.min(hi, v));
const randInt = (n:number)=>Math.floor(Math.random()*n);
const rand = ()=>Math.random();
const gaussian = ()=>{ let u=0,v=0; while(u===0)u=Math.random(); while(v===0)v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
const idx = (x:number,y:number,w:number)=> y*w + x;
const wrap = (n:number, size:number)=>{ const r=n%size; return r<0 ? r+size : r; };
const dirs = [[1,0],[-1,0],[0,1],[0,-1]] as const;

const gaussian2D = (x:number,y:number,cx:number,cy:number,amp:number,sigma:number)=>{
  const dx=x-cx, dy=y-cy; const d2=dx*dx+dy*dy; return amp*Math.exp(-d2/(2*sigma*sigma));
};

function sampleInt(spec: IntDistribution): number {
  switch (spec.kind) {
    case "uniform": { const v=Math.floor(spec.min + rand()*(spec.max-spec.min+1)); return clamp(v, Math.min(spec.min,spec.max), Math.max(spec.min,spec.max)); }
    case "normal": { const z=gaussian(); const x=spec.mean + z*spec.sd; return clamp(Math.round(x), Math.min(spec.min,spec.max), Math.max(spec.min,spec.max)); }
    case "discrete": { const items=spec.items.filter(i=>i.weight>0); if(!items.length) return 0; const total=items.reduce((a,c)=>a+c.weight,0); let r=rand()*total; for(const it of items){ r-=it.weight; if(r<=0) return it.value; } return items[items.length-1].value; }
  }
}

/** World builders */
function buildLandscape(width:number,height:number,maxSugarPerCell:number){
  const grid: Cell[] = new Array(width*height);
  const cx1=Math.floor(width*0.25), cy1=Math.floor(height*0.3);
  const cx2=Math.floor(width*0.75), cy2=Math.floor(height*0.7);
  const amp=maxSugarPerCell, sigma=Math.min(width,height)*0.12;
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const g = gaussian2D(x,y,cx1,cy1,amp,sigma) + gaussian2D(x,y,cx2,cy2,amp,sigma);
      const sugar = clamp(Math.round(g),0,maxSugarPerCell);
      grid[idx(x,y,width)] = { sugar, maxSugar:sugar };
    }
  }
  return grid;
}

function makeAgents(count:number,width:number,height:number,specs:{ vision:IntDistribution; metabolism:IntDistribution; initialSugar:IntDistribution }){
  const agents: Agent[] = new Array(count);
  for(let i=0;i<count;i++){
    agents[i] = { id:i, x:randInt(width), y:randInt(height), sugar:sampleInt(specs.initialSugar), vision:sampleInt(specs.vision), metabolism:sampleInt(specs.metabolism) };
  }
  return agents;
}

/** Step mechanics (two-phase with single occupancy & torus) */
function chooseIntents(agentsPrev:Agent[], gridPrev:Cell[], width:number, height:number){
  const occPrev = new Uint8Array(width*height);
  for(const a of agentsPrev) occPrev[idx(a.x,a.y,width)] = 1;

  const intents = new Array(agentsPrev.length) as {to:number; from:number}[];
  for(let i=0;i<agentsPrev.length;i++){
    const a = agentsPrev[i];
    let best = { x:a.x, y:a.y, sugar:gridPrev[idx(a.x,a.y,width)].sugar, dist:0 };
    for(const [dx,dy] of dirs){
      for(let d=1; d<=a.vision; d++){
        const nx=wrap(a.x+dx*d,width); const ny=wrap(a.y+dy*d,height); const j=idx(nx,ny,width);
        if (occPrev[j]) continue; // single occupancy constraint
        const s = gridPrev[j].sugar;
        if (s>best.sugar || (s===best.sugar && d<best.dist)) best={ x:nx, y:ny, sugar:s, dist:d };
      }
    }
    intents[i] = { to: idx(best.x,best.y,width), from: idx(a.x,a.y,width) };
  }
  return intents;
}

function resolveConflicts(intents:{to:number;from:number}[], width:number, height:number){
  const winners = new Int32Array(width*height).fill(-1);
  for(let i=0;i<intents.length;i++){
    const t=intents[i].to;
    if (winners[t] === -1) winners[t] = i; else if (Math.random()<0.5) winners[t] = i; // fair tie-breaker
  }
  return winners;
}

function applyMoves(agentsPrev:Agent[], intents:{to:number;from:number}[], winners:Int32Array, width:number){
  const agentsNext = agentsPrev.map(a=>({...a}));
  const occNext = new Uint8Array(winners.length);
  for(let i=0;i<agentsPrev.length;i++){
    const a = agentsNext[i];
    const t = intents[i].to; const win = winners[t] === i;
    if (win){ a.x = t % width; a.y = Math.floor(t/width); }
    occNext[idx(a.x,a.y,width)] = 1;
  }
  return { agentsNext, occNext };
}

function harvestMetabolizeDieGrow(agentsNext:Agent[], gridPrev:Cell[], growbackRate:number, width:number){
  const gridNext = gridPrev.slice();
  // harvest
  for(const a of agentsNext){ const j=idx(a.x,a.y,width); a.sugar += gridNext[j].sugar; gridNext[j].sugar = 0; }
  // metabolize
  for(const a of agentsNext) a.sugar -= a.metabolism;
  // death (baseline Pareto-friendly)
  const alive = agentsNext.filter(a=>a.sugar >= 0);
  // growback
  for(let j=0;j<gridNext.length;j++){ const c=gridNext[j]; c.sugar = Math.min(c.maxSugar, c.sugar + growbackRate); }
  return { alive, gridNext };
}

/** Wealth histogram */
function wealthHistogram(agents:Agent[], auto=true, binCount=12){
  const n=agents.length; if(n===0) return [{ bin:"0-0", count:0 }];
  let minS=Infinity, maxS=-Infinity; for(let i=0;i<n;i++){ const v=Math.floor(agents[i].sugar); if(v<minS)minS=v; if(v>maxS)maxS=v; }
  if(minS===maxS) return [{ bin:`${minS}-${maxS}`, count:n }];
  let k:number; if(auto){ const st=Math.ceil(Math.log2(Math.max(2,n))+1); k=clamp(st,5,30);} else { k=clamp(binCount,1,50); }
  const range=maxS-minS+1; const binSize=Math.max(1, Math.ceil(range/k)); const nb=Math.ceil(range/binSize);
  const arr=new Array(nb).fill(0); for(let i=0;i<n;i++){ const v=Math.floor(agents[i].sugar); const bi=clamp(Math.floor((v-minS)/binSize),0,nb-1); arr[bi]++; }
  return arr.map((c,i)=>({ bin:`${minS+i*binSize}-${minS+i*binSize+binSize-1}`, count:c }));
}

function previewHistogram(spec:IntDistribution, N=200){
  const samples:number[] = new Array(N); for(let i=0;i<N;i++) samples[i]=sampleInt(spec);
  let min=samples[0], max=samples[0]; for(let i=1;i<N;i++){ const v=samples[i]; if(v<min)min=v; if(v>max)max=v; }
  if(min===max) return [{ bin:`${min}-${max}`, count:N }];
  const st=Math.ceil(Math.log2(Math.max(2,N))+1); const bins=Math.max(5, Math.min(24, st));
  const range=max-min+1; const binSize=Math.max(1, Math.ceil(range/bins)); const nb=Math.ceil(range/binSize);
  const arr=new Array(nb).fill(0); for(let i=0;i<N;i++){ const bi=clamp(Math.floor((samples[i]-min)/binSize),0,nb-1); arr[bi]++; }
  return arr.map((c,i)=>({ bin:`${min+i*binSize}-${min+i*binSize+binSize-1}`, count:c }));
}

/** Component */
export default function SugarscapeFullVizPatched(){
  const INITIAL = {
    width:60, height:60, agentCount:400, maxSugarPerCell:4, growbackRate:1,
    vision: { kind:"uniform", min:1, max:6 } as IntDistribution,
    metabolism: { kind:"uniform", min:1, max:4 } as IntDistribution,
    initialSugar: { kind:"normal", mean:10, sd:2, min:0, max:30 } as IntDistribution,
    // Important: respawn off for baseline Pareto tail
    respawn:false, autoBins:true, binCount:12, tps:10,
  };

  // params (deterministic)
  const [width,setWidth]=useState(INITIAL.width);
  const [height,setHeight]=useState(INITIAL.height);
  const [agentCount,setAgentCount]=useState(INITIAL.agentCount);
  const [maxSugarPerCell,setMaxSugarPerCell]=useState(INITIAL.maxSugarPerCell);
  const [growbackRate,setGrowbackRate]=useState(INITIAL.growbackRate);
  const [visionSpec,setVisionSpec]=useState<IntDistribution>(INITIAL.vision);
  const [metSpec,setMetSpec]=useState<IntDistribution>(INITIAL.metabolism);
  const [initSugarSpec,setInitSugarSpec]=useState<IntDistribution>(INITIAL.initialSugar);
  const [respawn,setRespawn]=useState(INITIAL.respawn);
  const [autoBins,setAutoBins]=useState(INITIAL.autoBins);
  const [binCount,setBinCount]=useState(INITIAL.binCount);
  const [running,setRunning]=useState(false);
  const [tick,setTick]=useState(0);
  const [tps,setTps]=useState(INITIAL.tps);
  const [autoApply,setAutoApply]=useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [chartData, setChartData] = useState<{bin:string; count:number}[]>([{bin: "0-0", count: 0}]);
  const [lastChartUpdate, setLastChartUpdate] = useState(Date.now());
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // world (client init)
  const [grid,setGrid]=useState<Cell[]|null>(null);
  const [agents,setAgents]=useState<Agent[]|null>(null);
  
  // Optimize world initialization with useCallback
  const initializeWorld = useCallback(() => {
    console.log('Initializing world with dimensions:', width, 'x', height);
    const g = buildLandscape(width, height, maxSugarPerCell); 
    const a = makeAgents(agentCount, width, height, {
      vision: visionSpec,
      metabolism: metSpec,
      initialSugar: initSugarSpec
    }); 
    console.log('Created grid size:', g.length, 'expected:', width * height);
    setGrid(g); 
    setAgents(a); 
    setTick(0);
    
    // Initialize chart data with stable bin count
    const initialBinCount = autoBins ? Math.ceil(Math.log2(Math.max(2, agentCount))) + 1 : binCount;
    const initialChart = wealthHistogram(a, false, initialBinCount);
    setChartData(initialChart.length > 0 ? initialChart : [{bin: "0-0", count: 0}]);
  }, [width, height, maxSugarPerCell, agentCount, visionSpec, metSpec, initSugarSpec, autoBins, binCount]);
  
  useEffect(() => {
    initializeWorld();
  }, [width, height, maxSugarPerCell]); // Only depend on essential world parameters

  // Debounced auto-apply with reduced frequency updates
  const deferredParams = useDeferredValue({ width, height, agentCount, maxSugarPerCell, visionSpec, metSpec, initSugarSpec });
  const autoApplyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => { 
    if (!autoApply) return;
    
    // Clear existing timeout
    if (autoApplyTimeoutRef.current) {
      clearTimeout(autoApplyTimeoutRef.current);
    }
    
    // Debounce auto-apply to reduce frequent re-initializations
    autoApplyTimeoutRef.current = setTimeout(() => {
      const { width, height, agentCount, maxSugarPerCell, visionSpec, metSpec, initSugarSpec } = deferredParams;
      const g = buildLandscape(width, height, maxSugarPerCell);
      const a = makeAgents(agentCount, width, height, {
        vision: visionSpec,
        metabolism: metSpec,
        initialSugar: initSugarSpec
      });
      setGrid(g);
      setAgents(a);
      setTick(0);
    }, 500); // Increased debounce time from 150ms to 500ms
    
    return () => {
      if (autoApplyTimeoutRef.current) {
        clearTimeout(autoApplyTimeoutRef.current);
      }
    };
  }, [deferredParams, autoApply]);

  // Optimized canvas drawing with RAF and dirty checking
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastRenderData = useRef({ grid: null as Cell[] | null, agents: null as Agent[] | null, tick: -1 });
  const animationFrameRef = useRef<number | null>(null);
  
  const drawCanvas = useCallback(() => {
    if (!grid || !agents) return;
    const cnv = canvasRef.current;
    if (!cnv) return;
    
    // Skip render if data hasn't changed (dirty check)
    if (lastRenderData.current.grid === grid && 
        lastRenderData.current.agents === agents && 
        lastRenderData.current.tick === tick) {
      return;
    }
    
    const scale = 8;
    cnv.width = width * scale;
    cnv.height = height * scale;
    const ctx = cnv.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    
    // Ensure grid size matches expected dimensions
    const expectedSize = width * height;
    if (grid.length !== expectedSize) {
      console.warn(`Grid size mismatch: expected ${expectedSize}, got ${grid.length}`);
      return;
    }
    
    // Batch draw operations for better performance
    ctx.save();
    
    // Draw sugar landscape with enhanced colors
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cellIndex = idx(x, y, width);
        const c = grid[cellIndex];
        if (!c) {
          console.warn(`Undefined cell at (${x},${y}), index ${cellIndex}`);
          continue;
        }
        
        // Enhanced sugar visualization with color gradient
        const sugarRatio = c.maxSugar > 0 ? c.sugar / c.maxSugar : 0;
        const intensity = Math.round(sugarRatio * 255);
        
        // Use a warm color palette for sugar (brown to golden yellow)
        if (sugarRatio > 0) {
          const r = Math.round(139 + intensity * 0.45);
          const g = Math.round(69 + intensity * 0.7);
          const b = Math.round(19 + intensity * 0.3);
          ctx.fillStyle = `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
        } else {
          ctx.fillStyle = '#2a2a2a';
        }
        
        ctx.fillRect(x * scale, y * scale, scale, scale);
        
        // Add a subtle highlight for max sugar cells
        if (c.sugar === c.maxSugar && c.maxSugar > 0) {
          ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
    
    // Draw grid lines for better cell visibility (less frequently)
    if (scale >= 6) { // Only draw grid for larger scales
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; // More transparent
      ctx.lineWidth = 0.5;
      
      // Draw every 5th line only for performance
      for (let x = 0; x <= width; x += 5) {
        ctx.beginPath();
        ctx.moveTo(x * scale, 0);
        ctx.lineTo(x * scale, height * scale);
        ctx.stroke();
      }
      
      for (let y = 0; y <= height; y += 5) {
        ctx.beginPath();
        ctx.moveTo(0, y * scale);
        ctx.lineTo(width * scale, y * scale);
        ctx.stroke();
      }
    }
    
    // Draw agents with enhanced appearance
    ctx.fillStyle = '#10b981'; // Pre-set fill style
    ctx.strokeStyle = '#065f46'; // Pre-set stroke style
    ctx.lineWidth = 1;
    
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i];
      const agentSize = Math.max(2, scale - 3);
      const centerX = a.x * scale + scale / 2;
      const centerY = a.y * scale + scale / 2;
      
      // Agent body (circle for better visibility)
      ctx.beginPath();
      ctx.arc(centerX, centerY, agentSize / 2, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      // Wealth indicator (less frequent for performance)
      if (a.sugar > 5) { // Only show for wealthy agents
        const wealthRatio = Math.min(1, a.sugar / 20);
        ctx.strokeStyle = `rgba(255, 215, 0, ${0.3 + wealthRatio * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(centerX, centerY, agentSize / 2 + 1, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.strokeStyle = '#065f46'; // Reset stroke style
        ctx.lineWidth = 1;
      }
    }
    
    ctx.restore();
    
    // Update last render data
    lastRenderData.current = { grid, agents, tick };
  }, [grid, agents, width, height, tick]);

  useEffect(() => {
    // Cancel previous animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Schedule drawing with requestAnimationFrame for smooth rendering
    animationFrameRef.current = requestAnimationFrame(drawCanvas);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [drawCanvas]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // step (two-phase)
  const gridRef=useRef<Cell[]|null>(null); const agentsRef=useRef<Agent[]|null>(null);
  useEffect(()=>{ gridRef.current=grid; },[grid]); useEffect(()=>{ agentsRef.current=agents; },[agents]);

  // Optimized simulation step with memoized calculations
  const doStep = useCallback(() => {
    if (!gridRef.current || !agentsRef.current) return;
    const gridPrev = gridRef.current;
    const agentsPrev = agentsRef.current;
    
    // Phase A: choose intents from previous state (single occupancy, torus)
    const intents = chooseIntents(agentsPrev, gridPrev, width, height);
    // Phase B: resolve conflicts (1 winner per target)
    const winners = resolveConflicts(intents, width, height);
    // Phase C: apply moves
    const { agentsNext } = applyMoves(agentsPrev, intents, winners, width);
    // Phase D: harvest/metabolize/death/growback
    const { alive, gridNext } = harvestMetabolizeDieGrow(agentsNext, gridPrev, growbackRate, width);

    // Optional respawn AFTER death (off by default)
    let finalAgents = alive;
    if (respawn && alive.length < agentCount) {
      const births = agentCount - alive.length;
      const newborns = makeAgents(births, width, height, {
        vision: visionSpec,
        metabolism: metSpec,
        initialSugar: initSugarSpec
      });
      finalAgents = alive.concat(newborns);
    }

    setGrid(gridNext);
    setAgents(finalAgents);
    setTick(t => t + 1);
    setForceUpdate(f => f + 1);
    
    // Update chart data less frequently for better performance
    const now = Date.now();
    if (now - lastChartUpdate >= 2000) { // Reduced from 5s to 2s
      const currentBinCount = autoBins ? 
        Math.ceil(Math.log2(Math.max(2, finalAgents.length))) + 1 : 
        binCount;
      const newHistData = wealthHistogram(finalAgents, false, currentBinCount);
      setChartData(newHistData.length > 0 ? newHistData : [{ bin: "0-0", count: 0 }]);
      setLastChartUpdate(now);
    }
  }, [width, height, growbackRate, respawn, agentCount, visionSpec, metSpec, initSugarSpec, 
      autoBins, binCount, lastChartUpdate]);

  // Optimized simulation loop with better performance
  useEffect(() => {
    if (!running) return;
    
    const intervalTime = Math.max(16, Math.floor(1000 / Math.max(1, tps))); // Min 16ms (60fps limit)
    const id = setInterval(doStep, intervalTime);
    
    return () => clearInterval(id);
  }, [running, tps, doStep]); // Simplified dependencies

  // Memoized stats calculations to prevent unnecessary recalculations
  const landSugar = useMemo(() => {
    if (!grid) return 0;
    let total = 0;
    for (let i = 0; i < grid.length; i++) {
      total += grid[i].sugar;
    }
    return total;
  }, [grid]);
  
  const heldSugar = useMemo(() => {
    if (!agents) return 0;
    let total = 0;
    for (let i = 0; i < agents.length; i++) {
      total += Math.max(0, agents[i].sugar);
    }
    return total;
  }, [agents]);
  
  // Optimized wealth data calculation with reduced frequency updates
  const wealthData = useMemo(() => {
    if (!agents || agents.length === 0) {
      return [{ bin: "0-0", count: 0 }];
    }
    
    // Use stable bin count to prevent chart structure changes during simulation
    const stableBinCount = autoBins ? 
      Math.ceil(Math.log2(Math.max(2, agentCount))) + 1 : 
      binCount;
    const histData = wealthHistogram(agents, false, stableBinCount);
    
    return histData.length > 0 ? histData : [{ bin: "0-0", count: 0 }];
  }, [agents, autoBins, binCount, agentCount, tick]); // Include tick for periodic updates

  // Simplified chart updates - remove redundant useEffects
  useEffect(() => {
    if (agents) {
      // Update chart when settings change or when not running
      if (!running || tick % 10 === 0) { // Update every 10 ticks when running
        const newBinCount = autoBins ? 
          Math.ceil(Math.log2(Math.max(2, agentCount))) + 1 : 
          binCount;
        const histData = wealthHistogram(agents, false, newBinCount);
        setChartData(histData.length > 0 ? histData : [{ bin: "0-0", count: 0 }]);
        setLastChartUpdate(Date.now());
      }
    }
  }, [agents, autoBins, binCount, agentCount, running, tick]);

  // Optimized settings panel click handler with useCallback
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
      setShowSettings(false);
    }
  }, []);

  useEffect(() => {
    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings, handleClickOutside]);

  // Optimized preview charts with debounced updates
  const [visionPreview, setVisionPreview] = useState<{ bin: string; count: number }[]>([]);
  const [metPreview, setMetPreview] = useState<{ bin: string; count: number }[]>([]);
  const [initPreview, setInitPreview] = useState<{ bin: string; count: number }[]>([]);
  
  const updatePreviewsDebounced = useCallback(() => {
    const timer = setTimeout(() => {
      setVisionPreview(previewHistogram(visionSpec, 200));
      setMetPreview(previewHistogram(metSpec, 200));
      setInitPreview(previewHistogram(initSugarSpec, 200));
    }, 150);
    
    return () => clearTimeout(timer);
  }, [visionSpec, metSpec, initSugarSpec]);
  
  useEffect(() => {
    const cleanup = updatePreviewsDebounced();
    return cleanup;
  }, [updatePreviewsDebounced]);

  // Optimized actions with useCallback to prevent unnecessary re-renders
  const applyChanges = useCallback(() => {
    const g = buildLandscape(width, height, maxSugarPerCell);
    const a = makeAgents(agentCount, width, height, {
      vision: visionSpec,
      metabolism: metSpec,
      initialSugar: initSugarSpec
    });
    setGrid(g);
    setAgents(a);
    setTick(0);
    // Update chart data with stable bin count
    const newBinCount = autoBins ? 
      Math.ceil(Math.log2(Math.max(2, agentCount))) + 1 : 
      binCount;
    const newChart = wealthHistogram(a, false, newBinCount);
    setChartData(newChart.length > 0 ? newChart : [{ bin: "0-0", count: 0 }]);
  }, [width, height, maxSugarPerCell, agentCount, visionSpec, metSpec, initSugarSpec, autoBins, binCount]);
  
  const resetToInitial = useCallback(() => {
    setRunning(false);
    setWidth(INITIAL.width);
    setHeight(INITIAL.height);
    setAgentCount(INITIAL.agentCount);
    setMaxSugarPerCell(INITIAL.maxSugarPerCell);
    setGrowbackRate(INITIAL.growbackRate);
    setVisionSpec(INITIAL.vision);
    setMetSpec(INITIAL.metabolism);
    setInitSugarSpec(INITIAL.initialSugar);
    setRespawn(INITIAL.respawn);
    setAutoBins(INITIAL.autoBins);
    setBinCount(INITIAL.binCount);
    setTps(INITIAL.tps);
    const g = buildLandscape(INITIAL.width, INITIAL.height, INITIAL.maxSugarPerCell);
    const a = makeAgents(INITIAL.agentCount, INITIAL.width, INITIAL.height, {
      vision: INITIAL.vision,
      metabolism: INITIAL.metabolism,
      initialSugar: INITIAL.initialSugar
    });
    setGrid(g);
    setAgents(a);
    setTick(0);
    // Reset chart data with stable bin count
    const resetBinCount = INITIAL.autoBins ? 
      Math.ceil(Math.log2(Math.max(2, INITIAL.agentCount))) + 1 : 
      INITIAL.binCount;
    const resetChart = wealthHistogram(a, false, resetBinCount);
    setChartData(resetChart.length > 0 ? resetChart : [{ bin: "0-0", count: 0 }]);
  }, []); // No dependencies since it uses INITIAL constants
  
  // Memoized toggle functions
  const toggleRunning = useCallback(() => setRunning(r => !r), []);
  const toggleShowSettings = useCallback(() => setShowSettings(s => !s), []);

  return (
    <div className="w-full min-h-screen p-4 md:p-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white relative overflow-hidden">
      {/* Glass morphism background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-32 w-80 h-80 bg-gradient-to-br from-indigo-500/15 to-pink-500/15 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-1/4 w-64 h-64 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-gradient-to-br from-emerald-500/5 to-teal-500/5 rounded-full blur-3xl"></div>
      </div>
      <div className="max-w-7xl mx-auto space-y-6 relative z-10">
        {/* Game Area - Full Width */}
        <ContentSection>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-white">Sugarscape</h1>
              <p className="text-slate-300">Two-phase move with conflicts, single occupancy, torus, death-before-respawn.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                onClick={toggleRunning} 
                className="rounded-2xl bg-gradient-to-r from-emerald-600/90 to-teal-700/90 hover:from-emerald-700 hover:to-teal-800 text-white border-0 shadow-lg backdrop-blur-sm" 
                disabled={!grid || !agents}
              >
                {running ? (
                  <>
                    <Pause className="mr-2 h-4 w-4" />
                    Pause
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start
                  </>
                )}
              </Button>
              <Button 
                variant="secondary" 
                onClick={doStep} 
                className="rounded-2xl bg-white/20 hover:bg-white/30 text-white border border-white/30 shadow-md backdrop-blur-sm" 
                disabled={!grid || !agents}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Step
              </Button>
              <Button 
                variant="outline" 
                onClick={resetToInitial} 
                className="rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/30 shadow-md backdrop-blur-sm"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full flex justify-center">
              <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 shadow-2xl border border-slate-700">
                {!grid||!agents? (
                  <div className="px-6 py-16 text-slate-400 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mx-auto mb-3"></div>
                      Loading world…
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <canvas 
                      ref={canvasRef} 
                      className="rounded-xl shadow-lg border border-slate-600" 
                      style={{ 
                        imageRendering: "pixelated",
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                        maxWidth: '100%',
                        height: 'auto'
                      }} 
                    />
                    <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-white">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-amber-600 to-yellow-400"></div>
                          <span>Sugar</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-700"></div>
                          <span>Agents</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Performance Monitor */}
                    <PerformanceMonitor isRunning={running} tick={tick} />
                    
                    {/* Settings Button */}
                    <div className="absolute top-2 right-2" ref={settingsRef}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleShowSettings}
                        className="w-8 h-8 p-0 bg-black/50 backdrop-blur-sm hover:bg-black/70 text-white border-0 rounded-lg"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      
                      {/* Settings Panel */}
                      {showSettings && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9, y: -10 }}
                          className="absolute top-10 right-0 bg-black/80 backdrop-blur-xl rounded-xl p-4 min-w-80 border border-slate-600 shadow-2xl z-50"
                        >
                          <h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Simulation Settings
                          </h3>
                          <div className="space-y-3">
                            <SliderControl 
                              label="Width" 
                              value={width} 
                              min={20} 
                              max={120} 
                              onChange={setWidth}
                              labelWidth="w-16"
                            />
                            <SliderControl 
                              label="Height" 
                              value={height} 
                              min={20} 
                              max={120} 
                              onChange={setHeight}
                              labelWidth="w-16"
                            />
                            <SliderControl 
                              label="Ticks/sec" 
                              value={tps} 
                              min={1} 
                              max={60} 
                              onChange={setTps}
                              labelWidth="w-16"
                            />
                            <div className="pt-2 border-t border-slate-600">
                              <SwitchControl 
                                label="Auto-apply changes" 
                                checked={autoApply} 
                                onCheckedChange={setAutoApply}
                                className="text-xs mb-2"
                              />
                              {!autoApply && (
                                <Button 
                                  onClick={applyChanges} 
                                  className="w-full h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                                >
                                  <CheckCircle className="mr-1 h-3 w-3"/>
                                  Apply Changes
                                </Button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            <div className="mt-4 text-center">
              <p className="text-slate-300 text-sm">
                Adjust world dimensions and simulation speed using the <Settings className="inline h-4 w-4 mx-1"/> settings panel in the top-right corner of the simulation.
              </p>
            </div>

            {/* Stats and Analytics moved inside game box */}
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* World Stats */}
              <ContentSection title="World Stats" className="h-full flex flex-col">
                <div className="grid grid-cols-1 gap-4 text-sm flex-1">
                  <StatCard label="Tick" value={tick} />
                  <StatCard label="Agents" value={agents?.length ?? 0} />
                  <StatCard label="Sugar on land" value={landSugar} />
                  <StatCard label="Sugar held by agents" value={heldSugar} />
                </div>
              </ContentSection>

              {/* Distribution of Agent Wealth */}
              <GlassCard variant="subtle" className="p-4">
                <h2 className="text-xl font-semibold text-white mb-2">Distribution of Agent Wealth</h2>
                <p className="text-xs text-slate-400 mb-4">
                  Tick: {tick} | Chart Data: {chartData.length} | Memo Data: {wealthData.length} | Agents: {agents?.length || 0} | 
                  Last Update: {Math.round((Date.now() - lastChartUpdate) / 1000)}s ago
                </p>
                <div className="h-72" key={`chart-container-${tick}-${forceUpdate}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={chartData}
                      key={`${tick}-${forceUpdate}`}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                      <XAxis 
                        dataKey="bin" 
                        tick={{ fontSize: 12, fill: '#cbd5e1' }} 
                        angle={-20} 
                        textAnchor="end" 
                        height={50}
                      />
                      <YAxis 
                        allowDecimals={false} 
                        tick={{ fill: '#cbd5e1' }}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(30, 41, 59, 0.95)', 
                          border: '1px solid rgba(71, 85, 105, 0.5)',
                          borderRadius: '12px',
                          backdropFilter: 'blur(10px)',
                          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                          color: '#ffffff'
                        }}
                        animationDuration={0}
                      />
                      <Bar 
                        dataKey="count" 
                        fill="url(#barGradient)"
                        isAnimationActive={false}
                        animationDuration={0}
                      />
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#065f46" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center mt-4">
                  <SwitchControl label="Auto bins" checked={autoBins} onCheckedChange={setAutoBins} />
                  <SliderControl 
                    label="# of bins" 
                    value={binCount} 
                    min={1} 
                    max={30} 
                    onChange={setBinCount}
                    disabled={autoBins}
                    labelWidth="whitespace-nowrap"
                    className="sm:col-span-2"
                  />
                </div>
                <p className="text-slate-300 text-sm mt-4">Two-phase movement with exclusivity tends to produce a heavier tail. Try turning **Respawn** off and running long.</p>
              </GlassCard>
            </div>
        </ContentSection>

        {/* Parameters and Stats - Full Width Layout */}
        <div className="w-full space-y-4">
          {/* World Parameters */}
          <ContentSection className="text-center">
            <h2 className="text-xl font-semibold mb-4 text-white">World Parameters</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SliderControl 
                label="# Agents (target)" 
                value={agentCount} 
                min={20} 
                max={2000} 
                step={20} 
                onChange={setAgentCount} 
              />
              <SliderControl 
                label="Max sugar / cell" 
                value={maxSugarPerCell} 
                min={1} 
                max={10} 
                onChange={setMaxSugarPerCell} 
              />
              <SliderControl 
                label="Growback / tick" 
                value={growbackRate} 
                min={0} 
                max={3} 
                onChange={setGrowbackRate} 
              />
              <SwitchControl 
                label="Respawn after death" 
                checked={respawn} 
                onCheckedChange={setRespawn} 
              />
            </div>
          </ContentSection>

          {/* Agent Parameter Distributions */}
          <ContentSection className="text-center">
            <h2 className="text-xl font-semibold mb-4 text-white">Agent Parameter Distributions</h2>
            <div className="space-y-6">
              <DistEditor 
                label="Vision" 
                spec={visionSpec} 
                onChange={setVisionSpec} 
                clampMin={1} 
                clampMax={15} 
                previewData={visionPreview} 
              />
              <DistEditor 
                label="Metabolism" 
                spec={metSpec} 
                onChange={setMetSpec} 
                clampMin={0} 
                clampMax={8} 
                previewData={metPreview} 
              />
              <DistEditor 
                label="Initial Sugar" 
                spec={initSugarSpec} 
                onChange={setInitSugarSpec} 
                clampMin={0} 
                clampMax={100} 
                previewData={initPreview} 
              />
            </div>
          </ContentSection>
        </div>
      </div>
    </div>
  );
}

/** UI helpers */
const Stat = memo(({ label, value }: { label: string; value: number; }) => {
  return <StatCard label={label} value={value} />;
});

const MiniChart = memo(({ title, data }: { title: string; data: { bin: string; count: number }[] }) => {
  return <ChartComponent data={data} />;
});

const DiscreteEditor = memo(({ spec, onChange, clampMin, clampMax }: { 
  spec: Extract<IntDistribution, { kind: "discrete" }>; 
  onChange: (s: IntDistribution) => void; 
  clampMin: number; 
  clampMax: number; 
}) => {
  const { Input } = require("@/components/ui/input");
  const { Label } = require("@/components/ui/label");
  const items = spec.items; 
  const setItems = (next: { value: number; weight: number }[]) => onChange({ kind: "discrete", items: next });
  
  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-6 gap-2 items-center">
            <Label className="col-span-1 text-xs text-slate-300">Value</Label>
            <Input 
              className="col-span-2 bg-white/10 border-white/20 text-white" 
              value={it.value} 
              onChange={(e: any) => { 
                const v = clamp(Math.round(Number(e.target.value) || 0), clampMin, clampMax); 
                const next = items.slice(); 
                next[i] = { ...it, value: v }; 
                setItems(next); 
              }} 
            />
            <Label className="col-span-1 text-xs text-slate-300">Weight</Label>
            <Input 
              className="col-span-1 bg-white/10 border-white/20 text-white" 
              value={it.weight} 
              onChange={(e: any) => { 
                const w = Math.max(0, Number(e.target.value) || 0); 
                const next = items.slice(); 
                next[i] = { ...it, weight: w }; 
                setItems(next); 
              }} 
            />
            <Button 
              variant="outline" 
              className="col-span-1 bg-white/10 hover:bg-white/20 border-white/20 text-white" 
              onClick={() => { 
                const next = items.slice(); 
                next.splice(i, 1); 
                setItems(next); 
              }}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button 
          variant="secondary" 
          className="bg-white/20 hover:bg-white/30 text-white border border-white/20" 
          onClick={() => setItems([...items, { value: clampMin, weight: 1 }])}
        >
          Add Row
        </Button>
        <Button 
          variant="outline" 
          className="bg-white/10 hover:bg-white/20 border-white/20 text-white" 
          onClick={() => setItems([{ value: clampMin, weight: 1 }, { value: clampMax, weight: 1 }])}
        >
          Reset Rows
        </Button>
      </div>
    </div>
  );
});

function DistEditor({ label, spec, onChange, clampMin = -9999, clampMax = 9999, previewData }: {
  label: string; 
  spec: IntDistribution; 
  onChange: (s: IntDistribution) => void; 
  clampMin?: number; 
  clampMax?: number; 
  previewData?: { bin: string; count: number; }[]; 
}) {
  const kind = spec.kind;
  return (
    <GlassCard variant="subtle" className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-white font-medium">{label}</div>
        <Select value={kind} onValueChange={(k)=>{ if(k==='uniform') onChange({ kind:'uniform', min:clampMin, max:clampMin+5 }); else if(k==='normal') onChange({ kind:'normal', mean:Math.max(clampMin,5), sd:2, min:clampMin, max:clampMax }); else onChange({ kind:'discrete', items:[ { value:clampMin, weight:1 }, { value:Math.min(clampMax, clampMin+1), weight:1 } ] }); }}>
          <SelectTrigger className="w-36 bg-white/10 border-white/20 text-white"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-white/10 backdrop-blur-xl border-white/20 shadow-2xl">
            <SelectItem value="uniform">Uniform</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="discrete">Discrete</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {kind==='uniform' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <NumberInput label="Min" value={(spec as any).min} onChange={(v: number)=> onChange({ kind:'uniform', min: clamp(v, clampMin, clampMax), max: Math.max((spec as any).max, v) }) } />
              <NumberInput label="Max" value={(spec as any).max} onChange={(v: number)=> onChange({ kind:'uniform', min: Math.min((spec as any).min, v), max: clamp(v, clampMin, clampMax) }) } />
            </div>
          )}

          {kind==='normal' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <NumberInput label="Mean" value={(spec as any).mean} onChange={(v: number)=> onChange({ ...(spec as any), mean: v }) } />
              <NumberInput label="SD" value={(spec as any).sd} onChange={(v: number)=> onChange({ ...(spec as any), sd: Math.max(0, v) }) } />
              <NumberInput label="Min" value={(spec as any).min} onChange={(v: number)=> onChange({ ...(spec as any), min: Math.min(v, (spec as any).max) }) } />
              <NumberInput label="Max" value={(spec as any).max} onChange={(v: number)=> onChange({ ...(spec as any), max: Math.max(v, (spec as any).min) }) } />
            </div>
          )}

          {kind==='discrete' && (
            <DiscreteEditor spec={spec as any} onChange={onChange} clampMin={clampMin} clampMax={clampMax} />
          )}
        </div>
        
        {previewData && (
          <div className="lg:col-span-1">
            <MiniChart title={`${label} preview`} data={previewData} />
          </div>
        )}
      </div>
    </GlassCard>
  );
}
