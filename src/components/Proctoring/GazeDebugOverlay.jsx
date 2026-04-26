import React, { useEffect, useState } from 'react';
import { gazeTracker } from '../../lib/gaze-tracking';

const GazeDebugOverlay = ({ data }) => {
    const [metrics, setMetrics] = useState({
        GazeX: 0, GazeY: 0,
        HeadX: 0, HeadY: 0, HeadZ: 0,
        Yaw: 0, Pitch: 0, Roll: 0,
        // v2 metrics
        blinkState: 'OPEN',
        filterMode: 'fixation',
        lightingCondition: 'BRIGHT',
        ambientBrightness: 1.0,
        workerActive: false,
        modelType: 'none',
        fps: 0,
        confidence: 0
    });

    const [position, setPosition] = useState({ x: window.innerWidth - 300, y: 20 });
    const [size, setSize] = useState({ width: 280 });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [resizeStart, setResizeStart] = useState({ x: 0, w: 0 });

    useEffect(() => {
        if (data) {
            setMetrics({
                GazeX: data.GazeX || 0,
                GazeY: data.GazeY || 0,
                HeadX: data.HeadX || 0,
                HeadY: data.HeadY || 0,
                HeadZ: data.HeadZ || 0,
                Yaw: data.Yaw || 0,
                Pitch: data.Pitch || 0,
                Roll: data.Roll || 0,
                blinkState: data.blinkState || 'OPEN',
                filterMode: data.filterMode || 'fixation',
                lightingCondition: data.lightingCondition || 'BRIGHT',
                ambientBrightness: data.ambientBrightness ?? 1.0,
                workerActive: data.workerActive || false,
                modelType: data.modelType || 'none',
                fps: data.fps || 0,
                confidence: data.confidence || 0
            });
            return;
        }

        // Subscribe to tracker updates
        const unregister = gazeTracker.setGazeListener((internalData) => {
            if (internalData) {
                setMetrics({
                    GazeX: internalData.GazeX || 0,
                    GazeY: internalData.GazeY || 0,
                    HeadX: internalData.HeadX || 0,
                    HeadY: internalData.HeadY || 0,
                    HeadZ: internalData.HeadZ || 0,
                    Yaw: internalData.Yaw || 0,
                    Pitch: internalData.Pitch || 0,
                    Roll: internalData.Roll || 0,
                    blinkState: internalData.blinkState || 'OPEN',
                    filterMode: internalData.filterMode || 'fixation',
                    lightingCondition: internalData.lightingCondition || 'BRIGHT',
                    ambientBrightness: internalData.ambientBrightness ?? 1.0,
                    workerActive: internalData.workerActive || false,
                    modelType: internalData.modelType || 'none',
                    fps: internalData.fps || 0,
                    confidence: internalData.confidence || 0
                });
            }
        });

        return () => {
            unregister();
        };
    }, [data]);

    // Drag handlers
    const handleMouseDown = (e) => {
        if (e.button !== 0) return; // Only left click
        e.preventDefault(); // Prevent text selection/default behavior
        setIsDragging(true);
        setDragOffset({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    // Resize handlers
    const handleResizeMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation(); // Don't trigger drag
        setIsResizing(true);
        setResizeStart({
            x: e.clientX,
            w: size.width
        });
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragOffset.x,
                    y: e.clientY - dragOffset.y
                });
            } else if (isResizing) {
                const newWidth = Math.max(200, resizeStart.w + (e.clientX - resizeStart.x));
                setSize({ width: newWidth });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
        };

        if (isDragging || isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, dragOffset, resizeStart]);

    // Helper for status indicator colors
    const getBlinkColor = () => metrics.blinkState === 'OPEN' ? '#00FF88' : '#FF4444';
    const getFilterColor = () => metrics.filterMode === 'saccade' ? '#FFD700' : '#00BFFF';
    const getLightColor = () => {
        const map = { BRIGHT: '#00FF88', MEDIUM: '#FFD700', LOW: '#FF4444' };
        return map[metrics.lightingCondition] || '#888';
    };
    const getWorkerColor = () => metrics.workerActive ? '#00FF88' : '#FF8800';
    const getModelColor = () => {
        const map = { mlp: '#BB86FC', ridge: '#FFD700', none: '#888' };
        return map[metrics.modelType] || '#888';
    };
    const getConfidenceColor = () => {
        if (metrics.confidence > 0.7) return '#00FF88';
        if (metrics.confidence > 0.4) return '#FFD700';
        return '#FF4444';
    };

    return (
        <div
            className="fixed z-[9999] font-mono text-xs text-green-400 bg-black/85 p-4 rounded-lg shadow-2xl border border-green-500/30 backdrop-blur-md pointer-events-auto select-none"
            style={{
                left: position.x,
                top: position.y,
                width: size.width,
                cursor: isDragging ? 'grabbing' : 'move'
            }}
            onMouseDown={handleMouseDown}
        >
            <div
                className="flex justify-between items-center mb-3 border-b border-green-500/30 pb-2"
            >
                <h3 className="font-bold text-green-300 uppercase tracking-wider text-[10px]">Gaze Tracker v2</h3>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] opacity-60">{metrics.fps} FPS</span>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                </div>
            </div>

            {/* Gaze Coordinates */}
            <div className="space-y-0.5 mb-2">
                <div className="flex justify-between">
                    <span className="opacity-70">GazeX:</span>
                    <span className="font-bold">{metrics.GazeX}</span>
                </div>
                <div className="flex justify-between">
                    <span className="opacity-70">GazeY:</span>
                    <span className="font-bold">{metrics.GazeY}</span>
                </div>
            </div>

            <div className="h-px bg-green-500/20 my-2"></div>

            {/* Head Pose */}
            <div className="space-y-0.5 mb-2">
                <div className="flex justify-between">
                    <span className="opacity-70">HeadX:</span>
                    <span>{metrics.HeadX}</span>
                </div>
                <div className="flex justify-between">
                    <span className="opacity-70">HeadY:</span>
                    <span>{metrics.HeadY}</span>
                </div>
                <div className="flex justify-between">
                    <span className="opacity-70">HeadZ:</span>
                    <span>{metrics.HeadZ}</span>
                </div>
            </div>

            <div className="h-px bg-green-500/20 my-2"></div>

            {/* Orientation */}
            <div className="space-y-0.5 mb-2">
                <div className="flex justify-between">
                    <span className="opacity-70">Yaw:</span>
                    <span>{metrics.Yaw}°</span>
                </div>
                <div className="flex justify-between">
                    <span className="opacity-70">Pitch:</span>
                    <span>{metrics.Pitch}°</span>
                </div>
                <div className="flex justify-between">
                    <span className="opacity-70">Roll:</span>
                    <span>{metrics.Roll}°</span>
                </div>
            </div>

            <div className="h-px bg-emerald-500/40 my-2"></div>

            {/* v2 Status Panel */}
            <div className="space-y-1">
                <div className="flex justify-between items-center">
                    <span className="opacity-70">👁 Blink:</span>
                    <span className="font-bold px-1.5 py-0.5 rounded text-[10px]" style={{ color: getBlinkColor(), backgroundColor: getBlinkColor() + '15' }}>
                        {metrics.blinkState}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="opacity-70">⚡ Filter:</span>
                    <span className="font-bold px-1.5 py-0.5 rounded text-[10px]" style={{ color: getFilterColor(), backgroundColor: getFilterColor() + '15' }}>
                        {metrics.filterMode.toUpperCase()}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="opacity-70">💡 Light:</span>
                    <span className="font-bold px-1.5 py-0.5 rounded text-[10px]" style={{ color: getLightColor(), backgroundColor: getLightColor() + '15' }}>
                        {metrics.lightingCondition} ({(metrics.ambientBrightness * 100).toFixed(0)}%)
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="opacity-70">🔧 Worker:</span>
                    <span className="font-bold px-1.5 py-0.5 rounded text-[10px]" style={{ color: getWorkerColor(), backgroundColor: getWorkerColor() + '15' }}>
                        {metrics.workerActive ? 'ON' : 'OFF'}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="opacity-70">🧠 Model:</span>
                    <span className="font-bold px-1.5 py-0.5 rounded text-[10px]" style={{ color: getModelColor(), backgroundColor: getModelColor() + '15' }}>
                        {metrics.modelType.toUpperCase()}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="opacity-70">📊 Confidence:</span>
                    <span className="font-bold px-1.5 py-0.5 rounded text-[10px]" style={{ color: getConfidenceColor(), backgroundColor: getConfidenceColor() + '15' }}>
                        {(metrics.confidence * 100).toFixed(0)}%
                    </span>
                </div>
            </div>

            {/* Resize Handle */}
            <div
                className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center opacity-50 hover:opacity-100"
                onMouseDown={handleResizeMouseDown}
            >
                <div className="w-2 h-2 border-r-2 border-b-2 border-green-500/50"></div>
            </div>
        </div>
    );
};

export default GazeDebugOverlay;
