/**
 * Browser live transcription via OpenAI Realtime (WebRTC + ephemeral key).
 * Falls back callers can still use /api/transcribe (Whisper batch).
 */

export type LiveTranscriptHandlers = {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onStatus?: (msg: string) => void;
  onError?: (msg: string) => void;
};

export type LiveSession = {
  stop: () => Promise<string>;
  stream: MediaStream;
};

function floatTo16BitPCM(float32: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Downsample/resample Float32 mono to 24 kHz PCM16 base64 chunks. */
function resampleTo24k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === 24000) return input;
  const ratio = inputRate / 24000;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const t = src - i0;
    out[i] = input[i0] * (1 - t) + input[i1] * t;
  }
  return out;
}

/**
 * Preferred path: WebRTC peer connection to OpenAI Realtime calls endpoint.
 */
async function startWebRtcLive(
  ephemeralKey: string,
  handlers: LiveTranscriptHandlers
): Promise<LiveSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
    },
  });

  const pc = new RTCPeerConnection();
  stream.getTracks().forEach((t) => pc.addTrack(t, stream));

  let partial = "";
  const finals: string[] = [];
  const dc = pc.createDataChannel("oai-events");

  const handleEvent = (raw: string) => {
    let ev: {
      type?: string;
      delta?: string;
      transcript?: string;
      error?: { message?: string };
    };
    try {
      ev = JSON.parse(raw);
    } catch {
      return;
    }
    if (ev.type === "conversation.item.input_audio_transcription.delta" && ev.delta) {
      partial += ev.delta;
      handlers.onPartial(partial);
    }
    if (
      ev.type === "conversation.item.input_audio_transcription.completed" &&
      ev.transcript
    ) {
      const t = ev.transcript.trim();
      if (t) {
        finals.push(t);
        partial = "";
        handlers.onFinal(finals.join(" "));
        handlers.onPartial(finals.join(" "));
      }
    }
    if (ev.type === "error" && ev.error?.message) {
      handlers.onError?.(ev.error.message);
    }
  };

  dc.addEventListener("message", (e) => {
    if (typeof e.data === "string") handleEvent(e.data);
  });

  pc.addEventListener("datachannel", (e) => {
    e.channel.addEventListener("message", (ev) => {
      if (typeof ev.data === "string") handleEvent(ev.data);
    });
  });

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const sdpRes = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ephemeralKey}`,
      "Content-Type": "application/sdp",
    },
    body: offer.sdp || "",
  });

  if (!sdpRes.ok) {
    stream.getTracks().forEach((t) => t.stop());
    pc.close();
    const errText = await sdpRes.text().catch(() => "");
    throw new Error(
      `WebRTC Realtime falló (${sdpRes.status}). ${errText.slice(0, 120)}`
    );
  }

  const answerSdp = await sdpRes.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
  handlers.onStatus?.("En vivo — hablá y mirá el texto");

  const stop = async () => {
    try {
      if (dc.readyState === "open") {
        dc.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      }
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 600));
    stream.getTracks().forEach((t) => t.stop());
    try {
      pc.close();
    } catch {
      /* ignore */
    }
    const joined = [finals.join(" "), partial].filter(Boolean).join(" ").trim();
    return joined;
  };

  return { stop, stream };
}

/**
 * Fallback path: browser WebSocket with ephemeral key via subprotocol
 * (works when WebRTC is blocked).
 */
async function startWebSocketLive(
  ephemeralKey: string,
  handlers: LiveTranscriptHandlers
): Promise<LiveSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
    },
  });

  const url = "wss://api.openai.com/v1/realtime?intent=transcription";
  // Browser cannot set Authorization headers on WebSocket; use insecure key subprotocol.
  const ws = new WebSocket(url, [
    "realtime",
    `openai-insecure-api-key.${ephemeralKey}`,
  ]);

  await new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error("Timeout WS realtime")), 10000);
    ws.onopen = () => {
      window.clearTimeout(t);
      resolve();
    };
    ws.onerror = () => {
      window.clearTimeout(t);
      reject(new Error("No se pudo abrir WebSocket Realtime"));
    };
  });

  let partial = "";
  const finals: string[] = [];

  ws.onmessage = (msg) => {
    let ev: {
      type?: string;
      delta?: string;
      transcript?: string;
      error?: { message?: string };
    };
    try {
      ev = JSON.parse(String(msg.data));
    } catch {
      return;
    }
    if (ev.type === "conversation.item.input_audio_transcription.delta" && ev.delta) {
      partial += ev.delta;
      handlers.onPartial(partial);
    }
    if (
      ev.type === "conversation.item.input_audio_transcription.completed" &&
      ev.transcript
    ) {
      const t = ev.transcript.trim();
      if (t) {
        finals.push(t);
        partial = "";
        handlers.onFinal(finals.join(" "));
        handlers.onPartial(finals.join(" "));
      }
    }
    if (ev.type === "error" && ev.error?.message) {
      handlers.onError?.(ev.error.message);
    }
  };

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new AudioCtx();
  await ctx.resume();
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(processor);
  processor.connect(mute);
  mute.connect(ctx.destination);

  processor.onaudioprocess = (e) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const input = e.inputBuffer.getChannelData(0);
    const resampled = resampleTo24k(input, ctx.sampleRate);
    const pcm = floatTo16BitPCM(resampled);
    const audio = arrayBufferToBase64(pcm);
    ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio }));
  };

  handlers.onStatus?.("En vivo (WS) — hablá y mirá el texto");

  const stop = async () => {
    try {
      processor.disconnect();
      source.disconnect();
    } catch {
      /* ignore */
    }
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      }
    } catch {
      /* ignore */
    }
    await new Promise((r) => setTimeout(r, 700));
    try {
      ws.close();
    } catch {
      /* ignore */
    }
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => undefined);
    return [finals.join(" "), partial].filter(Boolean).join(" ").trim();
  };

  return { stop, stream };
}

export async function startLiveTranscription(
  handlers: LiveTranscriptHandlers
): Promise<LiveSession> {
  const tokenRes = await fetch("/api/transcribe/session", { method: "POST" });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.value) {
    throw new Error(tokenData.error || "No pude crear sesión realtime");
  }

  try {
    return await startWebRtcLive(tokenData.value, handlers);
  } catch (webrtcErr) {
    handlers.onStatus?.(
      `WebRTC no disponible (${webrtcErr instanceof Error ? webrtcErr.message : "error"}). Probando WebSocket…`
    );
    return startWebSocketLive(tokenData.value, handlers);
  }
}
