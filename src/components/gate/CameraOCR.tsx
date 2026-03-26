'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/components/providers/ToastProvider';
import {
  Camera, ScanLine, Loader2, X, RotateCcw, CheckCircle2,
  Flashlight, FlashlightOff, ZoomIn, AlertTriangle,
} from 'lucide-react';
import { extractContainerNumber, extractTruckPlate } from '@/lib/containerValidation';

type ScanMode = 'container' | 'plate' | 'seal' | 'generic';

interface CameraOCRProps {
  onResult: (text: string) => void;
  onClose: () => void;
  label?: string;
  mode?: ScanMode;
}

// Confidence badge colors
const CONFIDENCE_STYLE = {
  high: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
} as const;

const CONFIDENCE_LABEL = { high: 'มั่นใจสูง', medium: 'ปานกลาง', low: 'ต่ำ — ตรวจสอบก่อนใช้' } as const;

export default function CameraOCR({
  onResult,
  onClose,
  label = 'สแกนข้อความ',
  mode = 'generic',
}: CameraOCRProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workerRef = useRef<any>(null);

  const [streaming, setStreaming] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [rawOcrText, setRawOcrText] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [confidence, setConfidence] = useState<'high' | 'medium' | 'low' | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const isStartingRef = useRef(false); // guard against double-mount in StrictMode

  // Init Tesseract worker on mount (warm-up)
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng', 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100));
            }
          },
        });
        if (!cancelled) {
          workerRef.current = worker;
        } else {
          await worker.terminate();
        }
      } catch (err) {
        console.warn('Tesseract worker init failed:', err);
      }
    };
    init();
    return () => {
      cancelled = true;
      if (workerRef.current) {
        workerRef.current.terminate().catch(() => {});
        workerRef.current = null;
      }
    };
  }, []);

  const startCamera = useCallback(async () => {
    // Prevent double-invocation from React StrictMode or rapid re-triggers
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;

      // Check for torch capability
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const capabilities = videoTrack.getCapabilities() as MediaTrackCapabilities & { torch?: boolean };
        setHasTorch(!!capabilities.torch);
      }

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;

        // Wait for metadata before playing — avoids "play() interrupted by new load" error
        await new Promise<void>((resolve) => {
          const onReady = () => {
            video.removeEventListener('loadedmetadata', onReady);
            resolve();
          };
          if (video.readyState >= 1) {
            resolve(); // already loaded
          } else {
            video.addEventListener('loadedmetadata', onReady);
          }
        });

        // Only play if stream is still active (not stopped during await)
        if (streamRef.current) {
          try {
            await video.play();
            setStreaming(true);
          } catch (playErr) {
            // AbortError is expected when component unmounts mid-play
            if ((playErr as Error).name !== 'AbortError') {
              throw playErr;
            }
          }
        }
      }
    } catch (err) {
      console.error('Camera error:', err);
      toast('error', 'ไม่สามารถเปิดกล้องได้', 'กรุณาอนุญาตการเข้าถึงกล้อง หรือลองใช้งานผ่าน HTTPS');
    } finally {
      isStartingRef.current = false;
    }
  }, [toast]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStreaming(false);
    setTorchOn(false);
  }, []);

  const toggleTorch = useCallback(async () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;
    try {
      const newState = !torchOn;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (videoTrack as any).applyConstraints({ advanced: [{ torch: newState }] });
      setTorchOn(newState);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  }, [torchOn]);

  const capture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Crop to scan zone (center 80% width × 25% height for container number)
    const srcW = video.videoWidth;
    const srcH = video.videoHeight;

    if (mode === 'container' || mode === 'seal') {
      // Crop: center strip (80% wide, middle 30% of height) for horizontal text
      const cropX = srcW * 0.10;
      const cropY = srcH * 0.35;
      const cropW = srcW * 0.80;
      const cropH = srcH * 0.30;
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d')!;
      // Enhance contrast for OCR
      ctx.filter = 'contrast(1.4) brightness(1.1)';
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    } else {
      // Full frame for plate or generic
      canvas.width = srcW;
      canvas.height = srcH;
      const ctx = canvas.getContext('2d')!;
      ctx.filter = 'contrast(1.2)';
      ctx.drawImage(video, 0, 0);
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
    stopCamera();

    // OCR
    setProcessing(true);
    setOcrProgress(0);
    try {
      let worker = workerRef.current;
      let tempWorker = false;

      if (!worker) {
        // Fallback: create on-the-fly
        const { createWorker } = await import('tesseract.js');
        worker = await createWorker('eng', 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text') setOcrProgress(Math.round(m.progress * 100));
          },
        });
        tempWorker = true;
      }

      // Tesseract config optimized for alphanumeric (container numbers)
      await worker.setParameters({
        tessedit_char_whitelist: mode === 'container' || mode === 'seal'
          ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -'
          : '',
        tessedit_pageseg_mode: mode === 'container' ? '7' : '3', // 7=single line, 3=auto
      });

      const { data } = await worker.recognize(dataUrl);
      if (tempWorker) await worker.terminate();

      const rawText: string = data.text || '';
      setRawOcrText(rawText);

      // Smart extraction based on mode
      if (mode === 'container') {
        const extracted = extractContainerNumber(rawText);
        if (extracted) {
          setDisplayText(extracted.value);
          setConfidence(extracted.confidence);
        } else {
          // Fallback: clean up raw text
          const fallback = rawText.replace(/[^A-Z0-9]/g, '').trim().toUpperCase();
          setDisplayText(fallback);
          setConfidence('low');
        }
      } else if (mode === 'plate') {
        const plate = extractTruckPlate(rawText);
        setDisplayText(plate);
        setConfidence(plate.length > 4 ? 'medium' : 'low');
      } else {
        // Generic / seal: clean up
        const cleaned = rawText
          .replace(/[^A-Z0-9\s\-]/gi, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toUpperCase();
        setDisplayText(cleaned);
        setConfidence(cleaned.length > 2 ? 'medium' : 'low');
      }
    } catch (err) {
      console.error('OCR error:', err);
      setDisplayText('');
      setConfidence('low');
      toast('error', 'OCR ล้มเหลว', 'ลองถ่ายใหม่ให้ชัดขึ้น');
    } finally {
      setProcessing(false);
      setOcrProgress(0);
    }
  }, [stopCamera, mode, toast]);

  const handleConfirm = () => {
    onResult(displayText);
    onClose();
  };

  const handleRetry = () => {
    setCapturedImage(null);
    setDisplayText('');
    setRawOcrText('');
    setConfidence(null);
    startCamera();
  };

  // Auto-open camera on mount — cleanup stops stream on unmount (handles StrictMode double-mount)
  useEffect(() => {
    startCamera();
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hint text by mode
  const hintText = {
    container: 'วางเลขตู้ในกรอบสีฟ้า — ตัวอย่าง ABCU1234567',
    plate: 'วางทะเบียนรถในกรอบ',
    seal: 'วางเลขซีลในกรอบสีฟ้า',
    generic: 'วางข้อความที่ต้องการสแกนในกรอบ',
  }[mode];

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2">
          <ScanLine size={18} className="text-blue-400" />
          <h3 className="font-semibold text-white text-sm">{label}</h3>
        </div>
        <div className="flex items-center gap-2">
          {hasTorch && streaming && (
            <button
              onClick={toggleTorch}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                torchOn ? 'bg-amber-400 text-black' : 'bg-white/10 text-white'
              }`}
            >
              {torchOn ? <Flashlight size={16} /> : <FlashlightOff size={16} />}
            </button>
          )}
          <button
            onClick={() => { stopCamera(); onClose(); }}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Camera Viewport */}
      <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
        {/* Video stream */}
        <video
          ref={videoRef}
          className={`w-full h-full object-cover ${streaming ? '' : 'hidden'}`}
          playsInline
          autoPlay
          muted
        />

        {/* Captured image preview */}
        {capturedImage && (
          <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
        )}

        {/* Loading state */}
        {!streaming && !capturedImage && (
          <div className="flex flex-col items-center justify-center gap-3 text-white">
            <Loader2 size={32} className="animate-spin text-blue-400" />
            <p className="text-sm text-white/70">กำลังเปิดกล้อง...</p>
          </div>
        )}

        {/* Scan overlay (only when streaming) */}
        {streaming && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Dark overlay with cutout */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Top overlay */}
              <div className="absolute inset-x-0 top-0 h-[32%] bg-black/50" />
              {/* Bottom overlay */}
              <div className="absolute inset-x-0 bottom-0 h-[32%] bg-black/50" />
              {/* Left overlay */}
              <div className="absolute top-[32%] left-0 w-[8%] h-[36%] bg-black/50" />
              {/* Right overlay */}
              <div className="absolute top-[32%] right-0 w-[8%] h-[36%] bg-black/50" />

              {/* Scan box frame */}
              <div className="absolute top-[32%] left-[8%] right-[8%] h-[36%] rounded-xl overflow-hidden">
                {/* Corner brackets */}
                {/* Top-left */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-blue-400 rounded-tl-lg" style={{ borderWidth: '3px', borderRightColor: 'transparent', borderBottomColor: 'transparent' }} />
                {/* Top-right */}
                <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-blue-400 rounded-tr-lg" style={{ borderWidth: '3px', borderLeftColor: 'transparent', borderBottomColor: 'transparent' }} />
                {/* Bottom-left */}
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-blue-400 rounded-bl-lg" style={{ borderWidth: '3px', borderRightColor: 'transparent', borderTopColor: 'transparent' }} />
                {/* Bottom-right */}
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-blue-400 rounded-br-lg" style={{ borderWidth: '3px', borderLeftColor: 'transparent', borderTopColor: 'transparent' }} />

                {/* Animated scan line */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent animate-scan-line" style={{
                  animation: 'scanLine 2s ease-in-out infinite',
                  top: '50%',
                }} />
              </div>
            </div>

            {/* Hint text */}
            <div className="absolute bottom-24 inset-x-0 flex justify-center">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white/80 text-xs">
                <ZoomIn size={12} />
                {hintText}
              </div>
            </div>
          </div>
        )}

        {/* OCR Processing overlay */}
        {processing && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-full border-4 border-blue-400/30 border-t-blue-400 animate-spin" />
            <div className="text-center">
              <p className="text-white font-medium text-sm">กำลังอ่านข้อความ...</p>
              <p className="text-blue-400 text-xs mt-1">{ocrProgress}%</p>
            </div>
            <div className="w-48 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-all duration-300"
                style={{ width: `${ocrProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Control Panel */}
      <div className="bg-black/90 backdrop-blur-sm px-4 pb-safe-bottom">
        {/* Capture button */}
        {streaming && (
          <div className="py-4 flex justify-center">
            <button
              onClick={capture}
              className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-transform"
            >
              <Camera size={32} className="text-slate-800" />
            </button>
          </div>
        )}

        {/* OCR Result */}
        {displayText && !processing && (
          <div className="py-4 space-y-3">
            {/* Result card */}
            <div className="rounded-xl bg-white/10 border border-white/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-white/50 uppercase font-semibold">
                  {mode === 'container' ? 'เลขตู้ที่อ่านได้' : mode === 'plate' ? 'ทะเบียนที่อ่านได้' : 'ข้อความที่อ่านได้'}
                </p>
                {confidence && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${CONFIDENCE_STYLE[confidence]}`}>
                    {CONFIDENCE_LABEL[confidence]}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={displayText}
                onChange={e => setDisplayText(e.target.value)}
                className="w-full h-12 px-3 rounded-lg bg-white/5 border border-white/20 text-white font-mono text-lg tracking-widest outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
              {confidence === 'low' && (
                <div className="flex items-center gap-1.5 text-amber-400 text-xs">
                  <AlertTriangle size={12} />
                  <span>ตรวจสอบและแก้ไขก่อนยืนยัน</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pb-4">
              <button
                onClick={handleConfirm}
                disabled={!displayText}
                className="flex-1 py-3.5 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                <CheckCircle2 size={18} />
                ใช้ผลนี้
              </button>
              <button
                onClick={handleRetry}
                className="py-3.5 px-5 rounded-xl bg-white/10 text-white hover:bg-white/20 flex items-center gap-2 transition-colors text-sm"
              >
                <RotateCcw size={16} />
                ถ่ายใหม่
              </button>
            </div>
          </div>
        )}

        {/* No result state */}
        {capturedImage && !processing && !displayText && (
          <div className="py-4 space-y-3">
            <div className="rounded-xl bg-rose-500/20 border border-rose-500/30 p-3 flex items-center gap-2 text-rose-300 text-sm">
              <AlertTriangle size={16} />
              <span>อ่านข้อความไม่ได้ — ลองถ่ายใหม่ให้ชัดขึ้น</span>
            </div>
            <button
              onClick={handleRetry}
              className="w-full py-3 rounded-xl bg-white/10 text-white text-sm flex items-center justify-center gap-2 hover:bg-white/20 pb-4"
            >
              <RotateCcw size={16} />
              ถ่ายใหม่
            </button>
          </div>
        )}
      </div>

      {/* Scan line keyframe animation */}
      <style jsx>{`
        @keyframes scanLine {
          0% { top: 10%; }
          50% { top: 90%; }
          100% { top: 10%; }
        }
      `}</style>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
