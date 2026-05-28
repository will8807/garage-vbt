import { DEFAULT_MARKER_CONFIG, makeRoiAroundPoint } from './markerTypes';
import { detectMarker } from './markerDetector';
import { createMotionTracker } from './motionTracker';
import { createRepSegmenter } from './repSegmenter';
import { createRoiTracker } from './roiTracker';
import type { LiveAnalyzer, LiveAnalyzerHandle } from './types';

export function createRealLiveAnalyzer(): LiveAnalyzer {
  return {
    async start(input, onEvent): Promise<LiveAnalyzerHandle> {
      if (!input.stream) {
        throw new Error('Real CV requires a camera stream.');
      }
      if (!input.realCv?.acquisitionPoint && !input.realCv?.initialRoi) {
        throw new Error('Real CV requires a marker tap/acquisition point.');
      }

      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = input.stream;
      await video.play();
      await waitForVideoSize(video);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Unable to create CV canvas context.');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const frameSize = { width: canvas.width, height: canvas.height };
      const initialRoi = input.realCv.initialRoi ?? makeRoiAroundPoint(
        input.realCv.acquisitionPoint!,
        160,
        frameSize,
      );
      const markerConfig = {
        ...DEFAULT_MARKER_CONFIG,
        diameterMm: input.realCv.markerDiameterMm,
        profile: input.realCv.markerProfile,
      };
      const roiTracker = createRoiTracker({ initialRoi, frameSize });
      const motionTracker = createMotionTracker({
        markerDiameterMm: input.realCv.markerDiameterMm,
      });
      const segmenter = createRepSegmenter({
        startPhase: input.realCv.startPhase ?? (input.liftId === 'deadlift' ? 'bottom' : 'top'),
      });

      let running = true;
      let raf = 0;
      let previousCenter: { x: number; y: number } | undefined;

      onEvent({ type: 'ready' });

      const tick = () => {
        if (!running) return;
        const tMs = performance.now();
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const roi = roiTracker.getRoi();
        const imageData = ctx.getImageData(roi.x, roi.y, roi.width, roi.height);
        const detection = detectMarker(imageData, roi, markerConfig, { previousCenter });
        if (detection) previousCenter = { x: detection.cx, y: detection.cy };

        const roiSample = roiTracker.push(detection);
        if (roiSample.justLost) onEvent({ type: 'tracking_lost' });
        if (roiSample.justRestored) onEvent({ type: 'tracking_restored' });

        const velocitySample = motionTracker.push(
          detection,
          tMs,
          Math.min(detection?.score ?? 0, roiSample.confidence),
        );
        if (velocitySample && roiSample.status !== 'lost') {
          const rep = segmenter.push(velocitySample);
          if (rep) onEvent({ type: 'rep', rep });
        }

        if (input.realCv?.debug) {
          onEvent({
            type: 'debug',
            frame: {
              tMs,
              roi: roiSample.roi,
              marker: detection
                ? {
                    cx: detection.cx,
                    cy: detection.cy,
                    radiusPx: detection.radiusPx,
                    score: detection.score,
                  }
                : undefined,
              velocityMps: velocitySample?.velocityMps,
              confidence: Math.min(detection?.score ?? 0, roiSample.confidence),
              state: roiSample.status === 'lost'
                ? 'lost'
                : motionTracker.isCalibrated()
                  ? 'tracking'
                  : 'acquiring',
              reason: detection ? undefined : 'marker_not_found',
            },
          });
        }

        raf = requestAnimationFrame(tick);
      };

      raf = requestAnimationFrame(tick);

      return {
        async stop() {
          if (!running) return;
          running = false;
          cancelAnimationFrame(raf);
          video.pause();
          video.srcObject = null;
          onEvent({ type: 'ended', reason: 'user' });
        },
        isRunning() {
          return running;
        },
      };
    },
  };
}

function waitForVideoSize(video: HTMLVideoElement): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for camera video metadata.'));
    }, 4000);
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('loadedmetadata', onLoaded);
    };
    video.addEventListener('loadedmetadata', onLoaded);
  });
}
