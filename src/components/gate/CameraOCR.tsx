'use client';

import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/components/providers/ToastProvider';
import { Camera, ScanLine, Loader2, X, RotateCcw, CheckCircle2 } from 'lucide-react';

interface CameraOCRProps {
  onResult: (text: string) => void;
  onClose: () => void;
  label?: string;
}

export default function CameraOCR({ onResult, onClose, label = 'สแกนข้อความ' }: CameraOCRProps) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streaming, setStreaming] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<string>('');
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreaming(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      toast('error', 'ไม่สามารถเปิดกล้องได้', 'กรุณาอนุญาตการเข้าถึงกล้อง');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }, []);

  const capture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedImage(dataUrl);
    stopCamera();

    // OCR with Tesseract.js (lazy loaded)
    setProcessing(true);
    try {
      const Tesseract = await import('tesseract.js');
      const { data } = await Tesseract.recognize(dataUrl, 'eng', {
        logger: () => {},
      });
      // Clean up: extract container-like or license-like patterns
      const cleaned = data.text
        .replace(/[^A-Z0-9\s\-]/gi, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
      setOcrResult(cleaned);
    } catch (err) {
      console.error('OCR error:', err);
      setOcrResult('❌ ไม่สามารถอ่านได้');
    } finally {
      setProcessing(false);
    }
  }, [stopCamera]);

  const handleConfirm = () => {
    onResult(ocrResult);
    onClose();
  };

  const handleRetry = () => {
    setCapturedImage(null);
    setOcrResult('');
    startCamera();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScanLine size={18} className="text-blue-500" />
            <h3 className="font-semibold text-slate-800 dark:text-white text-sm">{label}</h3>
          </div>
          <button onClick={() => { stopCamera(); onClose(); }} className="text-slate-400 hover:text-red-500"><X size={18} /></button>
        </div>

        <div className="relative bg-black" style={{ minHeight: 240 }}>
          {!streaming && !capturedImage && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Camera size={40} className="text-slate-500" />
              <button onClick={startCamera}
                className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
                <Camera size={16} /> เปิดกล้อง
              </button>
            </div>
          )}

          <video ref={videoRef} className={`w-full ${streaming ? '' : 'hidden'}`} playsInline muted />

          {capturedImage && (
            <img src={capturedImage} alt="Captured" className="w-full" />
          )}

          {streaming && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 h-16 border-2 border-blue-400 rounded-lg bg-blue-400/10 flex items-center justify-center">
                <ScanLine size={20} className="text-blue-400 animate-pulse" />
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="p-4 space-y-3">
          {streaming && (
            <button onClick={capture}
              className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 flex items-center justify-center gap-2">
              <Camera size={18} /> ถ่ายภาพ
            </button>
          )}

          {processing && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin" /> กำลังอ่านข้อความ (OCR)...
            </div>
          )}

          {ocrResult && !processing && (
            <>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">ผลลัพธ์ OCR</p>
                <input type="text" value={ocrResult} onChange={e => setOcrResult(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-mono text-slate-800 dark:text-white" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleConfirm}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} /> ยืนยัน
                </button>
                <button onClick={handleRetry}
                  className="py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 text-sm hover:bg-slate-200 flex items-center gap-2">
                  <RotateCcw size={14} /> ถ่ายใหม่
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
