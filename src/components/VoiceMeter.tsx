"use client";

import { useEffect, useRef, useState } from "react";

/** Live amplitude bars from a MediaStream (Web Audio AnalyserNode). */

type Props = {
  stream: MediaStream | null;
  active: boolean;
  bars?: number;
};

export function VoiceMeter({ stream, active, bars = 28 }: Props) {
  const [levels, setLevels] = useState<number[]>(() =>
    Array.from({ length: bars }, () => 0.12)
  );
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!active || !stream) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try {
        sourceRef.current?.disconnect();
      } catch {
        /* ignore */
      }
      sourceRef.current = null;
      analyserRef.current = null;
      if (ctxRef.current) {
        void ctxRef.current.close().catch(() => undefined);
        ctxRef.current = null;
      }
      setLevels(Array.from({ length: bars }, () => 0.12));
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    ctxRef.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    analyserRef.current = analyser;
    const source = ctx.createMediaStreamSource(stream);
    sourceRef.current = source;
    source.connect(analyser);
    void ctx.resume();

    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const next: number[] = [];
      const slice = Math.floor(data.length / bars);
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        const start = i * slice;
        for (let j = 0; j < slice; j++) sum += data[start + j] || 0;
        const avg = sum / Math.max(1, slice) / 255;
        const boosted = Math.min(1, Math.pow(avg * 1.35, 0.85));
        next.push(0.1 + boosted * 0.9);
      }
      setLevels(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      try {
        source.disconnect();
      } catch {
        /* ignore */
      }
      void ctx.close().catch(() => undefined);
    };
  }, [active, stream, bars]);

  return (
    <div className="voice-meter" aria-hidden>
      {levels.map((v, i) => (
        <span
          key={i}
          className="voice-meter-bar"
          style={{ transform: `scaleY(${v})` }}
        />
      ))}
    </div>
  );
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
