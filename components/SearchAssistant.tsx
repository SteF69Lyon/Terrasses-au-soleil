
import React, { useState, useEffect, useRef } from 'react';
import { gemini } from '../services/geminiService';

const SearchAssistant: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const handleToggle = async () => {
    if (isActive) {
      setIsActive(false);
      sessionRef.current?.close();
      return;
    }

    setIsConnecting(true);
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const inputCtx = new AudioContext({ sampleRate: 16000 });
      let nextStartTime = 0;

      const callbacks = {
        onopen: () => {
          const source = inputCtx.createMediaStreamSource(stream);
          const processor = inputCtx.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (e: any) => {
            const data = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(data.length);
            for (let i = 0; i < data.length; i++) int16[i] = data[i] * 32768;
            
            const binary = String.fromCharCode(...new Uint8Array(int16.buffer));
            const base64 = btoa(binary);
            
            sessionRef.current?.sendRealtimeInput({
              media: { data: base64, mimeType: 'audio/pcm;rate=16000' }
            });
          };
          source.connect(processor);
          processor.connect(inputCtx.destination);
          setIsConnecting(false);
          setIsActive(true);
        },
        onmessage: async (message: any) => {
          const base64 = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64 && audioContextRef.current) {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const dataInt16 = new Int16Array(bytes.buffer);
            
            const buffer = audioContextRef.current.createBuffer(1, dataInt16.length, 24000);
            const channelData = buffer.getChannelData(0);
            for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
            
            const source = audioContextRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContextRef.current.destination);
            
            nextStartTime = Math.max(nextStartTime, audioContextRef.current.currentTime);
            source.start(nextStartTime);
            nextStartTime += buffer.duration;
            sourcesRef.current.add(source);
          }

          if (message.serverContent?.interrupted) {
            sourcesRef.current.forEach(s => s.stop());
            sourcesRef.current.clear();
            nextStartTime = 0;
          }
        },
        onerror: (e: any) => {
          console.error("Live session error:", e);
          setIsActive(false);
          setIsConnecting(false);
        },
        onclose: () => {
          setIsActive(false);
          setIsConnecting(false);
        }
      };

      sessionRef.current = await gemini.connectLiveAssistant(callbacks);
    } catch (err) {
      console.error(err);
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isActive && (
        <div className="absolute bottom-20 right-0 bg-white p-4 rounded-2xl shadow-2xl border border-orange-100 w-64 animate-bounce-slow">
          <p className="text-sm font-medium text-slate-700">"Trouve-moi un bar en plein soleil à Paris 11..."</p>
          <div className="mt-2 flex gap-1 justify-center">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`w-1 h-4 bg-orange-400 rounded-full animate-pulse`} style={{ animationDelay: `${i * 0.2}s` }}></div>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={handleToggle}
        disabled={isConnecting}
        className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all hover:scale-110 active:scale-95 ${
          isActive ? 'bg-red-500' : isConnecting ? 'bg-slate-400 animate-pulse' : 'bg-orange-500'
        } text-white`}
      >
        <i className={`fas ${isActive ? 'fa-stop' : 'fa-microphone'} text-2xl`}></i>
      </button>
    </div>
  );
};

export default SearchAssistant;
