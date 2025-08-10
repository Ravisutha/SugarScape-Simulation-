"use client";

import React, { useState, useEffect, useRef } from 'react';

interface PerformanceMonitorProps {
  isRunning: boolean;
  tick: number;
}

export function PerformanceMonitor({ isRunning, tick }: PerformanceMonitorProps) {
  const [fps, setFps] = useState(0);
  const [renderTime, setRenderTime] = useState(0);
  const lastUpdateTime = useRef(performance.now());
  const frameCount = useRef(0);
  const renderStartTime = useRef(0);

  useEffect(() => {
    if (isRunning) {
      renderStartTime.current = performance.now();
    }
  }, [tick]);

  useEffect(() => {
    if (isRunning) {
      const currentTime = performance.now();
      const deltaTime = currentTime - lastUpdateTime.current;
      
      if (renderStartTime.current > 0) {
        setRenderTime(currentTime - renderStartTime.current);
        renderStartTime.current = 0;
      }
      
      frameCount.current++;
      
      if (deltaTime >= 1000) { // Update every second
        setFps(Math.round((frameCount.current * 1000) / deltaTime));
        frameCount.current = 0;
        lastUpdateTime.current = currentTime;
      }
    }
  }, [isRunning, tick]);

  useEffect(() => {
    if (!isRunning) {
      setFps(0);
      frameCount.current = 0;
      lastUpdateTime.current = performance.now();
    }
  }, [isRunning]);

  if (!isRunning) return null;

  return (
    <div className="absolute top-2 right-12 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1 text-xs text-white font-mono">
      <div className="flex gap-4">
        <div>FPS: {fps}</div>
        <div>Render: {renderTime.toFixed(1)}ms</div>
        <div>Tick: {tick}</div>
      </div>
    </div>
  );
}
