import React, { useEffect, useRef, useState } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { gazeTracker } from '../../lib/gaze-tracking';
import GazeDebugOverlay from './GazeDebugOverlay';

/**
 * ProctoringTracker
 * 
 * Handles all "spy" logic:
 * - WebGazer (Eye Tracking) - NOW INTEGRATED
 * - Mouse Tracking (Region)
 * - Keyboard Tracking (WPM)
 * - Visibility Tracking (Tab focus)
 * 
 * Props:
 * - onStatUpdate: (stats) => void  // Callback to parent with latest stats
 * - onTimeout: () => void          // Callback when auto-logout occurs
 * - userDraft: string              // Current text for WPM calc
 * - sessionId: string              // ID of the current session
 */
const ProctoringTracker = ({ onStatUpdate, onTimeout, userDraft, socket, sessionId }) => {
    // STATE
    const [mouseRegion, setMouseRegion] = useState("Center");
    const [wpm, setWpm] = useState(0);
    const [gazeStatus, setGazeStatus] = useState("On Screen"); // NEW
    const [faceDetected, setFaceDetected] = useState(true); // Face detection status
    const [keyCount, setKeyCount] = useState(0);
    const [lastFaceDetectedAt, setLastFaceDetectedAt] = useState(Date.now());
    const [lastInteractionAt, setLastInteractionAt] = useState(Date.now());
    const [showLogoutWarning, setShowLogoutWarning] = useState(false);
    const [warningCountdown, setWarningCountdown] = useState(60);
    const [logoutReason, setLogoutReason] = useState("");

    // REFS
    const typingHistoryRef = useRef([]);
    const lastDraftLengthRef = useRef(0);
    const heatmapBufferRef = useRef([]);

    // --- 0. GAZE TRACKING ---
    useEffect(() => {
        // Assume calibration already happened in parent component
        gazeTracker.startTracking();

        const unregister = gazeTracker.setGazeListener((data) => {
            if (!data) return;

            // Update face detection status
            const hasFace = data.faceDetected !== false && !data.isOffScreen;
            setFaceDetected(hasFace);
            
            if (hasFace) {
                setLastFaceDetectedAt(Date.now());
                setShowLogoutWarning(false);
            }

            // Update Visual Pointer
            if (pointerRef.current && data.x !== null && data.y !== null) {
                if (!data.isOffScreen && hasFace) {
                    pointerRef.current.style.display = 'block';

                    // Visual feedback for confidence
                    const confidence = data.confidence || 1.0;
                    const scale = confidence < 0.5 ? 1.5 : 1;
                    
                    // Use hardware-accelerated transform for ultra-smooth realistic movement
                    pointerRef.current.style.transform = `translate(${data.x}px, ${data.y}px) scale(${scale})`;
                    pointerRef.current.style.opacity = Math.max(0.3, confidence); // Dim if unsure

                    // Optional: Change color if low confidence
                    pointerRef.current.style.backgroundColor = confidence < 0.6 ? 'orange' : 'red';

                    // BUFFER HEATMAP DATA
                    if (confidence > 0.5) {
                        heatmapBufferRef.current.push({
                            x: Math.round(data.x),
                            y: Math.round(data.y),
                            timestamp: Date.now()
                        });
                    }

                } else {
                    pointerRef.current.style.display = 'none';
                }
            } else if (pointerRef.current) {
                pointerRef.current.style.display = 'none';
            }

            // Determine gaze status
            if (data.isOffScreen || !hasFace) {
                setGazeStatus("Off Screen");
                return;
            }

            // Check bounds if we have coordinates
            if (data.x !== null && data.y !== null) {
                const margin = 50;
                const inWidth = data.x >= -margin && data.x <= window.innerWidth + margin;
                const inHeight = data.y >= -margin && data.y <= window.innerHeight + margin;

                if (inWidth && inHeight) {
                    setGazeStatus("On Screen");
                } else {
                    setGazeStatus("Off Screen");
                }
            } else {
                setGazeStatus("On Screen");
            }
        });

        return () => {
            unregister();
        };
    }, []);

    // ... (rest of observers)
    
    // --- 1. MOUSE REGION & ACTIVITY TRACKING ---
    useEffect(() => {
        const resetTimer = () => setLastInteractionAt(Date.now());

        const handleMouseMove = (e) => {
            resetTimer();
            const { clientX, clientY } = e;
            const width = window.innerWidth;
            const height = window.innerHeight;

            let hRegion = "Center";
            let vRegion = "Center";

            if (clientX < width / 3) hRegion = "Left";
            else if (clientX > (width * 2) / 3) hRegion = "Right";

            if (clientY < height / 3) vRegion = "Top";
            else if (clientY > (height * 2) / 3) vRegion = "Bottom";

            let region = "";
            if (hRegion === "Center" && vRegion === "Center") region = "Center";
            else region = `${vRegion} ${hRegion}`.replace("Center", "").trim();

            setMouseRegion(region);
        };

        const handleMouseDown = () => resetTimer();

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('click', handleMouseDown);
        window.addEventListener('scroll', resetTimer, { passive: true });

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('click', handleMouseDown);
            window.removeEventListener('scroll', resetTimer);
        };
    }, []);

    // --- 1.05 GLOBAL ACTIVITY POLLING (Tauri Native) ---
    useEffect(() => {
        // Poll system idle time every 5 seconds
        const pollInterval = setInterval(async () => {
            try {
                const idleSeconds = await invoke("get_system_idle_time");
                // If idle time is less than 5 seconds, it means user was active recently
                if (idleSeconds < 5) {
                    setLastInteractionAt(Date.now() - (idleSeconds * 1000));
                }
            } catch (err) {
                console.error("Failed to fetch system idle time:", err);
            }
        }, 5000);

        return () => clearInterval(pollInterval);
    }, []);

    // --- 1.1 KEYBOARD ACTIVITY TRACKING ---
    useEffect(() => {
        const handleKeyDown = () => {
            setKeyCount(prev => prev + 1);
            setLastInteractionAt(Date.now());
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // --- 1.2 AUTO LOGOUT LOGIC (2 MINS) ---
    useEffect(() => {
        const checkInterval = setInterval(() => {
            const now = Date.now();
            const idleElapsed = now - lastInteractionAt;
            const faceMissingElapsed = faceDetected ? 0 : now - lastFaceDetectedAt;
            
            // Choose the more critical one
            const isIdle = idleElapsed > 60000;
            const isFaceMissing = faceMissingElapsed > 60000;

            if (isIdle || isFaceMissing) {
                const maxElapsed = Math.max(idleElapsed, faceMissingElapsed);
                const reason = isIdle ? "Inactivity" : "Face Not Detected";
                setLogoutReason(reason);
                
                // Show warning after 1 minute
                if (maxElapsed > 60000 && maxElapsed < 120000) {
                    setShowLogoutWarning(true);
                    setWarningCountdown(Math.ceil((120000 - maxElapsed) / 1000));
                }
                
                // Logout after 2 minutes
                if (maxElapsed >= 120000) {
                    console.error(`CRITICAL: ${reason} for 2 minutes. Triggering auto-logout.`);
                    handleAutoLogout(reason);
                }
            } else {
                setShowLogoutWarning(false);
            }
        }, 1000);

        return () => clearInterval(checkInterval);
    }, [faceDetected, lastFaceDetectedAt, lastInteractionAt]);

    const handleAutoLogout = async (reason = "Inactivity") => {
        if (socket && sessionId) {
            socket.emit('session_timeout', { sessionId, reason });
        }
        
        if (onTimeout) {
            onTimeout();
        } else {
            alert(`You have been logged out due to ${reason.toLowerCase()} for 2 minutes.`);
            window.location.reload();
        }
    };

    // --- 2. WPM CALCULATION (Sliding Window: Last 30 Seconds) ---
    useEffect(() => {
        if (userDraft === undefined) return;
        
        const diff = Math.abs((userDraft?.length || 0) - lastDraftLengthRef.current);
        let charsToAdd = 0;
        
        if (diff > 0 && diff <= 15) {
            charsToAdd = diff;
        } else if (diff > 15) {
            charsToAdd = 1; // gentle penalty/limit for paste
        }
        
        lastDraftLengthRef.current = userDraft?.length || 0;
        
        if (charsToAdd > 0) {
            typingHistoryRef.current.push({ timestamp: Date.now(), chars: charsToAdd });
        }
    }, [userDraft]);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            const windowMs = 30000; // 30 sec sliding window
            
            typingHistoryRef.current = typingHistoryRef.current.filter(entry => now - entry.timestamp <= windowMs);
            const charsInWindow = typingHistoryRef.current.reduce((sum, entry) => sum + entry.chars, 0);
            
            let timeElapsedMin = windowMs / 60000; 
            if (typingHistoryRef.current.length > 0) {
                const oldest = typingHistoryRef.current[0].timestamp;
                const actualElapsed = (now - oldest) / 60000;
                timeElapsedMin = Math.max(10 / 60, Math.min(actualElapsed, timeElapsedMin));
            }
            
            const calculatedWpm = Math.round((charsInWindow / 5) / timeElapsedMin);
            setWpm(Math.min(calculatedWpm, 250));
        }, 2000);

        return () => clearInterval(interval);
    }, []);

    // Removed: Tab Visibility and Copy/Paste tracking logic per user request.
    // --- 5. PERIODIC SYNC (Heatmap & Stats) ---
    useEffect(() => {
        if (!sessionId) return;

        const syncInterval = setInterval(() => {
            // Sample heatmap points (max 50 per sync)
            const pointsToSync = heatmapBufferRef.current.slice(0, 50);
            heatmapBufferRef.current = heatmapBufferRef.current.slice(50);

            const payload = {
                heatmapPoints: pointsToSync,
                lastStats: {
                    wpm,
                    faceDetected,
                    gazeStatus,
                    keyCount
                }
            };

            // Always sync latest stats every 5s for reliability
            console.log("Syncing proctoring data:", payload);
            
            // Incrementally update session stats in DB
            if (sessionId) {
                // Here we would call updateSessionStats from useAttendance
                // But since this is a component, we rely on onStatUpdate to bubble it up
            }
        }, 5000); // Sync every 5 seconds

        return () => clearInterval(syncInterval);
    }, [sessionId, wpm, mouseRegion, faceDetected, gazeStatus, keyCount]);


    // Last reported stats
    const lastReportedStats = useRef({});

    // Pointer Ref for direct DOM manipulation (performance)
    const pointerRef = useRef(null);

    useEffect(() => {
        if (onStatUpdate) {
            // Only report if at least one value has changed to prevent infinite loops
            const hasChanged =
                mouseRegion !== lastReportedStats.current.mouseRegion ||
                wpm !== lastReportedStats.current.wpm ||
                gazeStatus !== lastReportedStats.current.gazeStatus ||
                faceDetected !== lastReportedStats.current.faceDetected;

            if (hasChanged) {
                const stats = {
                    mouseRegion,
                    wpm,
                    gazeStatus,
                    faceDetected,
                    keyCount
                };
                lastReportedStats.current = stats;
                onStatUpdate(stats);
            }
        }
    }, [mouseRegion, wpm, gazeStatus, faceDetected, keyCount, onStatUpdate]);

    return (
        <>
            {/* Gaze Pointer */}
            <div
                ref={pointerRef}
                style={{
                    position: 'fixed',
                    width: '20px',
                    height: '20px',
                    backgroundColor: 'red',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                    zIndex: 9999,
                    transition: 'transform 0.15s cubic-bezier(0.33, 1, 0.68, 1), opacity 0.2s',
                    display: 'none', // Hidden by default, shown by JS
                    opacity: 0.7,
                    border: '2px solid white',
                    boxShadow: '0 0 10px rgba(255,0,0,0.5)',
                    top: '-10px',
                    left: '-10px'
                }}
            />

            {/* Real-time Data Overlay (GazeCloud Style) */}
            <GazeDebugOverlay />

            {/* Logout Warning Overlay */}
            {showLogoutWarning && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10000,
                    backgroundColor: 'rgba(220, 38, 38, 0.9)',
                    color: 'white',
                    padding: '1rem 2rem',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    animation: 'pulse 2s infinite'
                }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>⚠️ {logoutReason === "Inactivity" ? "Idle Timeout" : "Face Not Detected"}!</div>
                    <div>Auto-logout in <span style={{ fontSize: '1.5rem', fontWeight: '900' }}>{warningCountdown}s</span></div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                        {logoutReason === "Inactivity" ? "Please move your mouse or type to stay logged in." : "Please look at the camera to maintain your session."}
                    </div>
                </div>
            )}

            <style>{`
                @keyframes pulse {
                    0% { transform: translateX(-50%) scale(1); }
                    50% { transform: translateX(-50%) scale(1.05); }
                    100% { transform: translateX(-50%) scale(1); }
                }
            `}</style>
        </>
    );
};

export default ProctoringTracker;
