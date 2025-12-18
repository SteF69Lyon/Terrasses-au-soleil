
import React, { useEffect, useState } from 'react';
import { dbService } from '../services/dbService';
import { Advertisement } from '../types';

const AdBanner: React.FC<{ isPro: boolean }> = ({ isPro }) => {
  const [ads, setAds] = useState<Advertisement[]>([]);

  useEffect(() => {
    // Écoute en temps réel des publicités actives depuis Firestore
    const unsubscribe = dbService.onAdsChange((allAds) => {
      const activeAds = allAds.filter(a => a.isActive);
      setAds(activeAds);
    });
    return () => unsubscribe();
  }, []);

  if (isPro) {
    return (
      <div className="bg-slate-900 py-1 text-[10px] text-yellow-400 font-bold text-center tracking-widest uppercase border-b border-yellow-400/20">
        <i className="fas fa-crown mr-2"></i> Expérience Premium Activée — Aucune publicité
      </div>
    );
  }

  if (ads.length === 0) return null;

  return (
    <div className="bg-slate-900 overflow-hidden py-2 border-b border-orange-500/30">
      <div className="flex animate-marquee whitespace-nowrap gap-12 items-center">
        {[...ads, ...ads, ...ads].map((ad, idx) => (
          <div key={`${ad.id}-${idx}`} className="flex items-center gap-4 text-white text-xs font-medium">
            <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
            {ad.link ? (
              <a href={ad.link} target="_blank" rel="noopener noreferrer" className="hover:text-orange-400 underline decoration-orange-500/50">
                {ad.text}
              </a>
            ) : (
              <span>{ad.text}</span>
            )}
          </div>
        ))}
      </div>
      
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default AdBanner;
