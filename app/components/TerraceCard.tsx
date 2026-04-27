
import React, { useState } from 'react';
import { Terrace, SunLevel } from '../types';
import { gemini } from '../services/geminiService';
import SunHourlyChart from './SunHourlyChart';

interface TerraceCardProps {
  terrace: Terrace;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
}

const TerraceCard: React.FC<TerraceCardProps> = ({ terrace, isFavorite, onToggleFavorite }) => {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${terrace.coordinates.lat},${terrace.coordinates.lng}`;
    const shareData = {
      title: terrace.name,
      text: `${terrace.name} — terrasse ensoleillée à ${terrace.sunExposure}% · ${terrace.address}`,
      url: mapsUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        /* user cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  };

  const getSunColor = (level: SunLevel) => {
    switch (level) {
      case SunLevel.FULL: return 'text-yellow-500';
      case SunLevel.PARTIAL: return 'text-orange-400';
      case SunLevel.SHADED: return 'text-slate-400';
      default: return 'text-slate-400';
    }
  };

  const handleSpeech = () => {
    gemini.speakDescription(`${terrace.name} est situé au ${terrace.address}. C'est un ${terrace.type} avec ${terrace.sunExposure}% d'ensoleillement.`);
  };

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden transition-all hover:shadow-xl hover:scale-[1.01] border border-orange-100 flex flex-col h-full group">
      <div className="relative h-48">
        <img src={terrace.imageUrl} alt={terrace.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        
        {/* Favorite Button */}
        <button 
          onClick={() => onToggleFavorite(terrace.name + terrace.address)}
          className={`absolute top-3 left-3 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            isFavorite ? 'bg-red-500 text-white shadow-lg' : 'bg-white/80 backdrop-blur text-slate-400 hover:text-red-500'
          }`}
        >
          <i className={`${isFavorite ? 'fas' : 'far'} fa-heart`}></i>
        </button>

        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
          <i className={`fas fa-sun ${getSunColor(terrace.sunLevel)}`}></i>
          <span className="text-sm font-bold">{terrace.sunExposure}%</span>
        </div>
        <div className="absolute bottom-3 left-3 bg-orange-500 text-white px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider shadow-sm">
          {terrace.type}
        </div>
      </div>
      
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-bold text-slate-800 line-clamp-1">{terrace.name}</h3>
          <div className="flex items-center text-yellow-500 text-sm font-medium">
            <i className="fas fa-star mr-1"></i>
            <span>{terrace.rating}</span>
          </div>
        </div>
        
        <p className="text-sm text-slate-500 mb-3 flex items-center">
          <i className="fas fa-location-dot mr-2 shrink-0"></i>
          <span className="line-clamp-1">{terrace.address}</span>
        </p>
        
        <p className="text-sm text-slate-600 line-clamp-2 mb-2 flex-1 italic">
          "{terrace.description}"
        </p>

        <SunHourlyChart
          lat={terrace.coordinates.lat}
          lng={terrace.coordinates.lng}
        />

        <div className="flex gap-2 mt-3">
          <button 
            onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${terrace.coordinates.lat},${terrace.coordinates.lng}`, '_blank')}
            className="flex-1 bg-orange-100 hover:bg-orange-200 text-orange-700 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            <i className="fas fa-route"></i> Itinéraire
          </button>
          <button
            onClick={handleSpeech}
            className="w-12 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center transition-colors"
            title="Écouter la description"
          >
            <i className="fas fa-volume-up"></i>
          </button>
          <button
            onClick={handleShare}
            className="w-12 h-10 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center transition-colors relative"
            title="Partager cette terrasse"
          >
            <i className={`fas ${copied ? 'fa-check' : 'fa-share-alt'}`}></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TerraceCard;
