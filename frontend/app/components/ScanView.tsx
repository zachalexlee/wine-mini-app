"use client";

import { useRef, useState } from "react";
import {
  WineData,
  s,
  API_BASE,
  getUserId,
  fileToBase64,
  haptic,
  hapticNotification,
} from "./shared";
import WineCard from "./WineCard";

interface ScanViewProps {
  onBack: () => void;
}

export default function ScanView({ onBack }: ScanViewProps) {
  const [scanResult, setScanResult] = useState<WineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
        setCameraError("Camera permission denied. Please allow camera access in your browser/Telegram settings.");
      } else if (msg.includes("NotFoundError")) {
        setCameraError("No camera found on this device.");
      } else {
        setCameraError(`Could not access camera: ${msg}. Try "Upload from Gallery" instead.`);
      }
      setCameraActive(false);
    }
  };

  const sendImageToScan = async (base64: string) => {
    setLoading(true);
    setErrorMsg(null);
    setScanResult(null);
    setSaved(false);
    try {
      const res = await fetch(`${API_BASE}/api/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: WineData = await res.json();
      if (data.error) {
        setErrorMsg(data.error);
        hapticNotification("error");
      } else {
        setScanResult(data);
        hapticNotification("success");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(`Failed to analyze: ${message}`);
      hapticNotification("error");
    } finally {
      setLoading(false);
    }
  };

  const snapPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    haptic("heavy");
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setPreviewUrl(dataUrl);
    sendImageToScan(dataUrl);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCamera();
    setLoading(true);
    setErrorMsg(null);
    setScanResult(null);
    setSaved(false);
    try {
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);
    } catch {
      setPreviewUrl(null);
    }
    try {
      const base64 = await fileToBase64(file);
      await sendImageToScan(base64);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setErrorMsg(`Failed to read file: ${message}`);
      setLoading(false);
    }
  };

  const resetScan = () => {
    stopCamera();
    setScanResult(null);
    setErrorMsg(null);
    setPreviewUrl(null);
    setLoading(false);
    setSaved(false);
    setCameraError(null);
    if (galleryInputRef.current) galleryInputRef.current.value = "";
  };

  const saveWine = async () => {
    if (!scanResult) return;
    try {
      const uid = getUserId();
      const res = await fetch(`${API_BASE}/api/cellar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, wine: scanResult }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        hapticNotification("success");
      }
    } catch {
      // silently fail
    }
  };

  return (
    <div style={s.container}>
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileSelected}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <button
        style={s.back}
        onClick={() => {
          resetScan();
          onBack();
        }}
      >
        &larr; Back
      </button>
      <h2>Scan Bottle</h2>

      {/* Live camera viewfinder */}
      {cameraActive && (
        <div style={{ position: "relative", marginBottom: 16 }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "100%",
              borderRadius: 12,
              background: "#000",
              maxHeight: 350,
              objectFit: "cover",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              padding: "16px 0",
              background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
              borderRadius: "0 0 12px 12px",
            }}
          >
            <button
              onClick={snapPhoto}
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                border: "4px solid #fff",
                background: "rgba(124,58,237,0.8)",
                cursor: "pointer",
                boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
              }}
              title="Capture"
            />
          </div>
          <button
            onClick={stopCamera}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Camera error */}
      {cameraError && (
        <div
          style={{
            ...s.card,
            border: "1px solid rgba(248,113,113,0.3)",
          }}
        >
          <p style={{ margin: 0, color: "#f87171", fontSize: 14 }}>
            {cameraError}
          </p>
          <p style={{ margin: "8px 0 0", opacity: 0.7, fontSize: 13 }}>
            You can still use &quot;Upload from Gallery&quot; below.
          </p>
        </div>
      )}

      {/* Preview */}
      {previewUrl && !cameraActive && (
        <img src={previewUrl} alt="Wine label" style={s.preview} />
      )}

      {/* Loading */}
      {loading && (
        <div style={s.card}>
          <p style={{ margin: 0, textAlign: "center" }}>
            Analyzing wine label...
          </p>
          <p
            style={{
              margin: "8px 0 0",
              textAlign: "center",
              opacity: 0.6,
              fontSize: 13,
            }}
          >
            Our AI sommelier is studying the label
          </p>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div style={s.card}>
          <p style={{ margin: 0, color: "#f87171" }}>{errorMsg}</p>
          <button style={s.actionBtn("#7c3aed")} onClick={resetScan}>
            Try Again
          </button>
        </div>
      )}

      {/* Result */}
      {scanResult && (
        <>
          <WineCard wine={scanResult} isSaved={saved} onSave={saveWine} />
          <button style={s.actionBtn("#7c3aed")} onClick={resetScan}>
            Scan Another Bottle
          </button>
        </>
      )}

      {/* Initial state */}
      {!loading && !scanResult && !errorMsg && !cameraActive && (
        <div style={s.card}>
          <p
            style={{ margin: "0 0 16px", textAlign: "center", opacity: 0.7 }}
          >
            Take a photo of a wine label or choose from your gallery
          </p>
          <button
            style={{ ...s.actionBtn("#7c3aed"), marginBottom: 8 }}
            onClick={() => {
              haptic("light");
              startCamera();
            }}
          >
            Open Camera
          </button>
          <button
            style={s.actionBtn("#6d28d9")}
            onClick={() => {
              haptic("light");
              if (galleryInputRef.current) {
                galleryInputRef.current.value = "";
                galleryInputRef.current.click();
              }
            }}
          >
            Upload from Gallery
          </button>
        </div>
      )}
    </div>
  );
}
