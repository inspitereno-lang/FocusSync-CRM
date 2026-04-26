/**
 * Gaze Tracking Web Worker
 * 
 * Offloads MediaPipe FaceLandmarker inference to a background thread.
 * Receives ImageBitmap frames via zero-copy Transferable,
 * runs detectForVideo(), extracts features, and posts results back.
 * 
 * Messages IN:
 *   { type: 'init' }
 *   { type: 'process', frame: ImageBitmap, timestamp: number, videoWidth: number, videoHeight: number }
 *   { type: 'destroy' }
 * 
 * Messages OUT:
 *   { type: 'init-complete', success: boolean, error?: string }
 *   { type: 'result', features: number[], mesh3D: number[][], hasLandmarks: boolean, timestamp: number }
 *   { type: 'error', message: string }
 */

let FaceLandmarker, FilesetResolver;
let faceLandmarker = null;
let offscreenCanvas = null;
let offscreenCtx = null;

// Load MediaPipe inside the worker
async function loadMediaPipe() {
    const cdnUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/vision_bundle.mjs';
    const vision = await import(cdnUrl);
    FaceLandmarker = vision.FaceLandmarker;
    FilesetResolver = vision.FilesetResolver;
}

async function initialize() {
    try {
        await loadMediaPipe();

        const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm'
        );

        // Try GPU first, then CPU
        try {
            faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                    delegate: 'GPU'
                },
                outputFaceBlendshapes: false,
                outputFacialTransformationMatrixes: false,
                runningMode: 'VIDEO',
                numFaces: 1
            });
        } catch (gpuErr) {
            faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                    delegate: 'CPU'
                },
                outputFaceBlendshapes: false,
                outputFacialTransformationMatrixes: false,
                runningMode: 'VIDEO',
                numFaces: 1
            });
        }

        self.postMessage({ type: 'init-complete', success: true });
    } catch (err) {
        self.postMessage({ type: 'init-complete', success: false, error: err.message });
    }
}

function processFrame(frame, timestamp, videoWidth, videoHeight) {
    if (!faceLandmarker) {
        frame.close();
        return;
    }

    try {
        // Draw ImageBitmap to OffscreenCanvas for MediaPipe
        if (!offscreenCanvas || offscreenCanvas.width !== videoWidth || offscreenCanvas.height !== videoHeight) {
            offscreenCanvas = new OffscreenCanvas(videoWidth, videoHeight);
            offscreenCtx = offscreenCanvas.getContext('2d');
        }

        offscreenCtx.drawImage(frame, 0, 0);
        frame.close(); // Release the ImageBitmap

        const results = faceLandmarker.detectForVideo(offscreenCanvas, timestamp);

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];
            const vw = videoWidth;
            const vh = videoHeight;

            // Convert to pixel coordinates with Z
            const mesh = [];
            for (let i = 0; i < landmarks.length; i++) {
                mesh.push([
                    landmarks[i].x * vw,
                    landmarks[i].y * vh,
                    landmarks[i].z * vw
                ]);
            }

            // Extract features in the worker
            const features = extractFeatures(mesh);

            // Send back features and a minimal mesh subset for 3D gaze
            // Only send the landmarks we actually need (saves transfer cost)
            const keyIndices = [
                1, 10, 33, 133, 152, 234, 263, 362, 454, 468, 473,
                // Eyelid points
                144, 145, 153, 158, 159, 160, 373, 374, 380, 385, 386, 387
            ];
            const keyMesh = keyIndices.map(i => mesh[i] || [0, 0, 0]);

            self.postMessage({
                type: 'result',
                features,
                keyMesh,
                keyIndices,
                hasLandmarks: true,
                timestamp
            });
        } else {
            self.postMessage({
                type: 'result',
                features: null,
                keyMesh: null,
                hasLandmarks: false,
                timestamp
            });
        }
    } catch (err) {
        self.postMessage({ type: 'error', message: err.message });
    }
}

// === Feature Extraction (duplicated from main thread for worker independence) ===

function extractFeatures(mesh) {
    const leftIris = mesh[468];
    const rightIris = mesh[473];
    const leftInner = mesh[33];
    const leftOuter = mesh[133];
    const rightInner = mesh[362];
    const rightOuter = mesh[263];
    const noseTip = mesh[1];
    const forehead = mesh[10];
    const chin = mesh[152];
    const leftCheek = mesh[234];
    const rightCheek = mesh[454];

    const leftUpperLid = avgPoint(mesh, [159, 158, 160]);
    const leftLowerLid = avgPoint(mesh, [145, 144, 153]);
    const rightUpperLid = avgPoint(mesh, [386, 385, 387]);
    const rightLowerLid = avgPoint(mesh, [374, 373, 380]);

    const leftRel = getIrisPosition(leftIris, leftInner, leftOuter, leftUpperLid, leftLowerLid);
    const rightRel = getIrisPosition(rightIris, rightInner, rightOuter, rightUpperLid, rightLowerLid);

    const headPose = computeHeadPose(noseTip, forehead, chin, leftCheek, rightCheek, mesh);

    const leftOpenness = getEyeOpenness(mesh, 'left');
    const rightOpenness = getEyeOpenness(mesh, 'right');

    const faceWidth = dist3D(leftCheek, rightCheek);
    const pupilDist = dist3D(leftIris, rightIris);
    const normalizedPupilDist = pupilDist / (faceWidth + 0.001);

    const avgFaceZ = (noseTip[2] + forehead[2]) / 2;
    const leftIrisZ = (leftIris[2] - avgFaceZ) / 50;
    const rightIrisZ = (rightIris[2] - avgFaceZ) / 50;

    // 3D Gaze Vector features
    const gaze3D = compute3DGazeFeatures(mesh, leftIris, rightIris, noseTip, forehead, leftCheek, rightCheek);

    return [
        leftRel[0], leftRel[1],           // 0,1: Left iris X/Y
        rightRel[0], rightRel[1],          // 2,3: Right iris X/Y
        headPose.yaw, headPose.pitch, headPose.roll, // 4,5,6
        leftOpenness, rightOpenness,       // 7,8
        normalizedPupilDist,               // 9  (was index 10 in old, but keeping order)
        leftIrisZ, rightIrisZ,             // 10,11
        // New 3D gaze features
        gaze3D.azimuthLeft, gaze3D.elevationLeft,       // 12,13
        gaze3D.azimuthRight, gaze3D.elevationRight,     // 14,15
        gaze3D.convergence                               // 16
    ];
}

function compute3DGazeFeatures(mesh, leftIris, rightIris, noseTip, forehead, leftCheek, rightCheek) {
    // Estimate face normal from 3 points: forehead, noseTip, chin-like
    const faceCenter = [
        (leftCheek[0] + rightCheek[0]) / 2,
        (leftCheek[1] + rightCheek[1]) / 2,
        (leftCheek[2] + rightCheek[2]) / 2
    ];

    // Face normal: cross product of two face-plane vectors
    const v1 = [forehead[0] - noseTip[0], forehead[1] - noseTip[1], forehead[2] - noseTip[2]];
    const v2 = [rightCheek[0] - leftCheek[0], rightCheek[1] - leftCheek[1], rightCheek[2] - leftCheek[2]];

    const normal = normalize3D(cross3D(v1, v2));

    // Eyeball radius approximation (scaled to MediaPipe coordinates)
    // Real eyeball radius ~12mm, but in pixel space we scale relative to face width
    const faceWidth = dist3D(leftCheek, rightCheek);
    const eyeballRadius = faceWidth * 0.06; // ~6% of face width

    // Left eyeball center (behind iris along face normal)
    const leftEyeballCenter = [
        leftIris[0] - normal[0] * eyeballRadius,
        leftIris[1] - normal[1] * eyeballRadius,
        leftIris[2] - normal[2] * eyeballRadius
    ];

    // Right eyeball center
    const rightEyeballCenter = [
        rightIris[0] - normal[0] * eyeballRadius,
        rightIris[1] - normal[1] * eyeballRadius,
        rightIris[2] - normal[2] * eyeballRadius
    ];

    // Gaze direction vectors
    const leftGazeDir = normalize3D([
        leftIris[0] - leftEyeballCenter[0],
        leftIris[1] - leftEyeballCenter[1],
        leftIris[2] - leftEyeballCenter[2]
    ]);

    const rightGazeDir = normalize3D([
        rightIris[0] - rightEyeballCenter[0],
        rightIris[1] - rightEyeballCenter[1],
        rightIris[2] - rightEyeballCenter[2]
    ]);

    // Convert to azimuth/elevation angles
    const azimuthLeft = Math.atan2(leftGazeDir[0], -leftGazeDir[2]);
    const elevationLeft = Math.asin(Math.max(-1, Math.min(1, leftGazeDir[1])));
    const azimuthRight = Math.atan2(rightGazeDir[0], -rightGazeDir[2]);
    const elevationRight = Math.asin(Math.max(-1, Math.min(1, rightGazeDir[1])));

    // Convergence: angle between left and right gaze vectors
    const dotProduct = leftGazeDir[0] * rightGazeDir[0] + leftGazeDir[1] * rightGazeDir[1] + leftGazeDir[2] * rightGazeDir[2];
    const convergence = Math.acos(Math.max(-1, Math.min(1, dotProduct)));

    return { azimuthLeft, elevationLeft, azimuthRight, elevationRight, convergence };
}

// === Math helpers ===

function avgPoint(mesh, indices) {
    let x = 0, y = 0, z = 0;
    for (const i of indices) {
        x += mesh[i][0]; y += mesh[i][1]; z += mesh[i][2] || 0;
    }
    const n = indices.length;
    return [x / n, y / n, z / n];
}

function getIrisPosition(iris, inner, outer, upperLid, lowerLid) {
    const eyeWidth = dist2D(inner, outer);
    const irisFromInner = dist2D(inner, iris);
    const horizRatio = (irisFromInner / eyeWidth) - 0.5;

    const eyeHeight = lowerLid[1] - upperLid[1];
    const eyeCenterY = (upperLid[1] + lowerLid[1]) / 2;
    const irisOffsetY = iris[1] - eyeCenterY;

    let vertRatio = 0;
    if (eyeHeight > 2) {
        vertRatio = (irisOffsetY / (eyeHeight * 0.5)) * 1.5;
        vertRatio = Math.max(-1.5, Math.min(1.5, vertRatio));
    }

    return [horizRatio, vertRatio];
}

function computeHeadPose(noseTip, forehead, chin, leftCheek, rightCheek, mesh) {
    const faceCenterX = (leftCheek[0] + rightCheek[0]) / 2;
    const faceWidth = dist3D(leftCheek, rightCheek);
    const yaw = (noseTip[0] - faceCenterX) / (faceWidth + 0.001);

    const foreheadDist = dist3D(noseTip, forehead);
    const chinDist = dist3D(noseTip, chin);
    const pitch = (foreheadDist - chinDist) / (foreheadDist + chinDist + 0.001);

    const leftEyeY = (mesh[33][1] + mesh[133][1]) / 2;
    const rightEyeY = (mesh[362][1] + mesh[263][1]) / 2;
    const roll = (rightEyeY - leftEyeY) / (faceWidth + 0.001);

    return { yaw, pitch, roll };
}

function getEyeOpenness(mesh, side) {
    const upperIdx = side === 'left' ? 159 : 386;
    const lowerIdx = side === 'left' ? 145 : 374;
    const inner = side === 'left' ? 33 : 362;
    const outer = side === 'left' ? 133 : 263;

    const upper = mesh[upperIdx];
    const lower = mesh[lowerIdx];
    const eyeWidth = dist3D(mesh[inner], mesh[outer]);
    const lidDist = dist3D(upper, lower);
    return lidDist / (eyeWidth + 0.001);
}

function dist2D(p1, p2) {
    return Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2);
}

function dist3D(p1, p2) {
    return Math.sqrt(
        (p1[0] - p2[0]) ** 2 +
        (p1[1] - p2[1]) ** 2 +
        ((p1[2] || 0) - (p2[2] || 0)) ** 2
    );
}

function cross3D(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

function normalize3D(v) {
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    if (len < 1e-10) return [0, 0, -1];
    return [v[0] / len, v[1] / len, v[2] / len];
}

// === Message handler ===

self.onmessage = async function (e) {
    const { type } = e.data;

    switch (type) {
        case 'init':
            await initialize();
            break;
        case 'process':
            processFrame(e.data.frame, e.data.timestamp, e.data.videoWidth, e.data.videoHeight);
            break;
        case 'destroy':
            if (faceLandmarker) {
                faceLandmarker.close();
                faceLandmarker = null;
            }
            break;
    }
};
