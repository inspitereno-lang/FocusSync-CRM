import React, { useState, useEffect, useRef } from 'react';
import { gazeTracker } from '../../lib/gaze-tracking';
import { EyeIcon, MousePointer2, CheckCircle } from 'lucide-react';
import GazeDebugOverlay from './GazeDebugOverlay';

const GazeCalibration = ({ onCalibrationComplete }) => {
    const [step, setStep] = useState('intro'); // intro, calibrate, verify, complete
    const [pointsClicked, setPointsClicked] = useState([]);
    const [currentPointIndex, setCurrentPointIndex] = useState(0);
    const [isCapturing, setIsCapturing] = useState(false);
    const [hasFace, setHasFace] = useState(false); // Feedback state
    const [captureProgress, setCaptureProgress] = useState(0);
    const [userDistance, setUserDistance] = useState("good"); // good, too-close, too-far
    const [currentGazeData, setCurrentGazeData] = useState(null); // Local data for overlay

    // Buffer for collecting points during 'isCapturing' phase
    const collectionBuffer = useRef([]);

    // 13-point calibration grid (9 standard + 4 intermediate for better accuracy)
    const calibrationPoints = [
        // Row 1 (top)
        { x: '10%', y: '10%', cx: window.innerWidth * 0.1, cy: window.innerHeight * 0.1 },
        { x: '50%', y: '10%', cx: window.innerWidth * 0.5, cy: window.innerHeight * 0.1 },
        { x: '90%', y: '10%', cx: window.innerWidth * 0.9, cy: window.innerHeight * 0.1 },
        // Intermediate row
        { x: '30%', y: '30%', cx: window.innerWidth * 0.3, cy: window.innerHeight * 0.3 },
        { x: '70%', y: '30%', cx: window.innerWidth * 0.7, cy: window.innerHeight * 0.3 },
        // Row 2 (middle)
        { x: '10%', y: '50%', cx: window.innerWidth * 0.1, cy: window.innerHeight * 0.5 },
        { x: '50%', y: '50%', cx: window.innerWidth * 0.5, cy: window.innerHeight * 0.5 },
        { x: '90%', y: '50%', cx: window.innerWidth * 0.9, cy: window.innerHeight * 0.5 },
        // Intermediate row
        { x: '30%', y: '70%', cx: window.innerWidth * 0.3, cy: window.innerHeight * 0.7 },
        { x: '70%', y: '70%', cx: window.innerWidth * 0.7, cy: window.innerHeight * 0.7 },
        // Row 3 (bottom)
        { x: '10%', y: '90%', cx: window.innerWidth * 0.1, cy: window.innerHeight * 0.9 },
        { x: '50%', y: '90%', cx: window.innerWidth * 0.5, cy: window.innerHeight * 0.9 },
        { x: '90%', y: '90%', cx: window.innerWidth * 0.9, cy: window.innerHeight * 0.9 }
    ];

    useEffect(() => {
        // Initialize the tracker
        gazeTracker.startTracking();

        // Persistent Listener
        const unregister = gazeTracker.setGazeListener((data) => {
            // 1. Update local state for the Overlay (always runs)
            setCurrentGazeData(data);

            // 2. Face Detection Logic
            if (data && data.faceDetected !== false && !data.isOffScreen) {
                setHasFace(true);

                // Check distance using normalized pupil distance (index 10 in rawFeatures)
                if (data.rawFeatures && data.rawFeatures[10]) {
                    const dist = data.rawFeatures[10];
                    if (dist < 0.25) setUserDistance("too-far");
                    else if (dist > 0.45) setUserDistance("too-close");
                    else setUserDistance("good");
                }
            } else {
                setHasFace(false);
            }

            // 3. Data Collection Logic (driven by ref flag)
            // If we are currently capturing for a point, add this sample to the buffer
            if (isCapturingRef.current && data && data.rawFeatures) {
                collectionBuffer.current.push(data.rawFeatures);
            }
        });

        return () => {
            gazeTracker.showDebug(false); // Hide optional debug
            unregister();
        };
    }, []);

    // We use a ref for isCapturing inside the listener closure availability
    const isCapturingRef = useRef(false);
    useEffect(() => {
        isCapturingRef.current = isCapturing;
    }, [isCapturing]);

    const startCalibration = () => {
        gazeTracker.clearCalibration();
        setPointsClicked([]);
        setCurrentPointIndex(0);
        setStep('calibrate');
    };

    const handlePointClick = async (index) => {
        if (index !== currentPointIndex) return;

        // Clear buffer and start capturing
        collectionBuffer.current = [];
        setIsCapturing(true);

        // Collect samples for 1 second
        // The listener (running in background) will fill collectionBuffer
        await new Promise(r => setTimeout(r, 1000));

        setIsCapturing(false);

        // Process collected samples
        const collectedSamples = collectionBuffer.current;

        if (collectedSamples.length > 0) {
            const pt = calibrationPoints[index];
            collectedSamples.forEach(f => {
                gazeTracker.addCalibrationPoint(pt.cx, pt.cy, f);
            });

            // Move to next
            setPointsClicked([...pointsClicked, index]);

            if (index + 1 < calibrationPoints.length) {
                setCurrentPointIndex(index + 1);
            } else {
                // Finalize the calibration (train regression model)
                const success = gazeTracker.finalizeCalibration();
                if (!success) {
                    alert("Calibration failed. Please try again.");
                    startCalibration();
                    return;
                }

                setStep('verify');
                // The listener continues to run and update currentGazeData
                // The overlay will now show predicted X/Y
            }
        } else {
            alert("No face data detected. Please ensure you are visible and that camera permissions are granted in Mac System Settings (Privacy & Security -> Camera).");
            // Don't advance index, let them retry
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center select-none text-gray-800 font-sans">

            {step === 'intro' && (
                <div className="text-center max-w-lg p-10 bg-white rounded-xl shadow-2xl border border-gray-100">
                    <div className="w-24 h-24 mx-auto mb-6 bg-red-500 rounded-full animate-pulse shadow-lg flex items-center justify-center">
                        <EyeIcon className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-4xl font-light mb-4 text-gray-900">Eye Tracking Calibration</h2>
                    <p className="mb-8 text-xl text-gray-500 font-light leading-relaxed">
                        To ensure high precision, please follow the red dot with your eyes.
                        <br />
                        <span className="font-medium text-gray-700">Keep your head steady.</span>
                    </p>
                    <button
                        className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white text-lg rounded-full shadow-lg transition-all transform hover:scale-105 font-medium"
                        onClick={startCalibration}
                    >
                        Start Calibration
                    </button>
                </div>
            )}

            {step === 'calibrate' && (
                <div className="relative w-full h-full bg-white">
                    <div className="absolute top-10 left-0 right-0 text-center pointer-events-none">
                        <h3 className="text-2xl font-light text-gray-400 tracking-widest uppercase">
                            Calibration
                        </h3>
                        <p className="text-sm text-gray-300 mt-2">
                            {currentPointIndex + 1} / {calibrationPoints.length}
                        </p>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="flex flex-col items-center gap-4 z-10 transition-all">
                            {!hasFace && (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="bg-red-500 text-white px-6 py-3 rounded-full shadow-xl animate-bounce font-bold border-4 border-white text-lg">
                                        ⚠️ No Face Detected
                                    </div>
                                    <div className="bg-white/90 px-4 py-2 rounded-lg text-red-600 text-sm font-medium shadow-sm border border-red-100 max-w-sm text-center">
                                        Please ensure camera permissions are granted in Mac System Settings (Privacy & Security → Camera)
                                    </div>
                                </div>
                            )}
                            {hasFace && userDistance !== 'good' && (
                                <div className="bg-orange-500 text-white px-6 py-2 rounded-full shadow-lg font-bold animate-pulse">
                                    {userDistance === 'too-close' ? 'Move Back' : 'Move Closer'}
                                </div>
                            )}
                        </div>
                    </div>

                    {calibrationPoints.map((pos, idx) => (
                        <button
                            key={idx}
                            disabled={idx !== currentPointIndex || isCapturing}
                            className={`absolute rounded-full transition-all duration-500 flex items-center justify-center
                            ${idx === currentPointIndex ? 'w-16 h-16 opacity-100 cursor-pointer' : 'w-4 h-4 opacity-0 pointer-events-none'}
                        `}
                            style={{
                                left: pos.x,
                                top: pos.y,
                                transform: 'translate(-50%, -50%)',
                                transitionProperty: 'opacity, transform, width, height'
                            }}
                            onClick={() => handlePointClick(idx)}
                        >
                            {/* Inner Dot */}
                            <div className={`
                                rounded-full transition-all duration-300
                                ${idx === currentPointIndex ? 'w-6 h-6 bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.6)]' : 'w-2 h-2 bg-gray-300'}
                                ${isCapturing ? 'scale-150 bg-green-500' : 'animate-pulse scale-100'}
                            `} />

                            {/* Outer Ring */}
                            {idx === currentPointIndex && !isCapturing && (
                                <div className="absolute inset-0 border-2 border-red-200 rounded-full animate-ping opacity-50"></div>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {step === 'verify' && (
                <div className="text-center max-w-lg p-10 bg-white rounded-xl shadow-2xl border border-gray-100 relative">
                    <CheckCircle className="w-24 h-24 mx-auto mb-6 text-green-500" />
                    <h2 className="text-4xl font-light mb-4 text-gray-900">Calibration Successful</h2>
                    <p className="mb-8 text-xl text-gray-500">
                        The eye tracking is now active.
                    </p>

                    <div className="flex gap-4 justify-center">
                        <button className="px-6 py-3 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50" onClick={startCalibration}>Recalibrate</button>
                        <button className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-lg" onClick={onCalibrationComplete}>Start Session</button>
                    </div>
                </div>
            )}

            {/* Visual Pointer for Verification */}
            <div id="gaze-pointer"
                className="fixed w-6 h-6 bg-red-600/50 rounded-full pointer-events-none z-[100] border-2 border-white shadow-lg backdrop-blur-sm"
                style={{
                    display: step === 'verify' ? 'block' : 'none',
                    top: (currentGazeData?.y ?? -50) - 20,
                    left: (currentGazeData?.x ?? -50) - 20,
                    transition: 'all 0.1s ease-out'
                }}
            >
                <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-30"></div>
            </div>

            <GazeDebugOverlay data={currentGazeData} />
        </div>
    );
};

export default GazeCalibration;
