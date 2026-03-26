'use client';

import { useState, useRef, useCallback } from 'react';
import { useToast } from '@/components/providers/ToastProvider';
import { Camera, Upload, X, Loader2 } from 'lucide-react';

interface PhotoCaptureProps {
  label: string;
  required?: boolean;
  onCapture: (url: string) => void;
  value?: string;
  folder?: string;
}

async function uploadPhoto(dataUrl: string, folder: string): Promise<string> {
  const res = await fetch('/api/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: dataUrl, folder }),
  });
  const data = await res.json();
  if (data.success) return data.url;
  throw new Error(data.error || 'Upload failed');
}

export default function PhotoCapture({ label, required, onCapture, value, folder = 'photos' }: PhotoCaptureProps) {
  const { toast } = useToast();
  const [preview, setPreview] = useState<string>(value || '');
  const [streaming, setStreaming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreaming(true);
      }
    } catch {
      toast('error', 'ไม่สามารถเปิดกล้องได้');
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }, []);

  const processAndUpload = useCallback(async (dataUrl: string) => {
    setPreview(dataUrl); // Show preview immediately
    setUploading(true);
    try {
      const url = await uploadPhoto(dataUrl, folder);
      setPreview(url); // Switch to server URL
      onCapture(url);
    } catch (err) {
      console.error('Upload failed:', err);
      // Fallback: use base64 if upload fails
      onCapture(dataUrl);
    } finally {
      setUploading(false);
    }
  }, [folder, onCapture]);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    const dataUrl = c.toDataURL('image/jpeg', 0.7);
    stopCamera();
    processAndUpload(dataUrl);
  }, [stopCamera, processAndUpload]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      processAndUpload(result);
    };
    reader.readAsDataURL(file);
  };

  const clear = () => { setPreview(''); onCapture(''); };

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-semibold text-slate-400 uppercase flex items-center gap-1">
        <Camera size={12} /> {label} {required && <span className="text-rose-500">*</span>}
      </label>

      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <img src={preview} alt={label} className="w-full h-40 object-cover" />
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="flex items-center gap-2 text-white text-xs font-medium">
                <Loader2 size={16} className="animate-spin" /> กำลังอัปโหลด...
              </div>
            </div>
          )}
          {!uploading && (
            <button onClick={clear}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500">
              <X size={14} />
            </button>
          )}
        </div>
      ) : streaming ? (
        <div className="relative rounded-xl overflow-hidden border border-blue-300">
          <video ref={videoRef} className="w-full h-40 object-cover" playsInline muted />
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
            <button onClick={capture}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium flex items-center gap-1.5 shadow-lg">
              <Camera size={14} /> ถ่ายภาพ
            </button>
            <button onClick={stopCamera}
              className="px-3 py-2 rounded-lg bg-slate-700/80 text-white text-xs">ยกเลิก</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={startCamera}
            className="flex-1 h-24 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
            <Camera size={20} /> <span className="text-[10px]">ถ่ายรูป</span>
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="flex-1 h-24 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
            <Upload size={20} /> <span className="text-[10px]">อัปโหลด</span>
          </button>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
    </div>
  );
}
