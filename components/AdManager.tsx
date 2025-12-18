
import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { Advertisement } from '../types';

const AdManager: React.FC = () => {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [newAdText, setNewAdText] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    const unsubscribe = dbService.onAdsChange(setAds);
    return () => unsubscribe();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdText.trim()) return;
    setIsBusy(true);
    try {
      await dbService.addAd(newAdText);
      setNewAdText('');
    } finally {
      setIsBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette publicité ?")) return;
    await dbService.deleteAd(id);
  };

  const handleToggle = async (id: string, currentStatus: boolean) => {
    await dbService.toggleAdStatus(id, currentStatus);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
          <i className="fas fa-ad"></i>
        </div>
        <div>
          <h3 className="text-lg font-black text-slate-800">Régie Publicitaire</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Firestore Live Engine (Stef)</p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input 
          type="text" 
          placeholder="Texte de la publicité..." 
          value={newAdText}
          onChange={(e) => setNewAdText(e.target.value)}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-500"
          required
        />
        <button 
          type="submit" 
          disabled={isBusy}
          className="bg-orange-600 text-white px-6 rounded-xl font-bold hover:bg-orange-700 transition-all disabled:opacity-50"
        >
          {isBusy ? <i className="fas fa-spinner animate-spin"></i> : <i className="fas fa-plus"></i>}
        </button>
      </form>

      <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
        {ads.map(ad => (
          <div key={ad.id} className="bg-white border border-slate-100 p-4 rounded-2xl flex items-center justify-between shadow-sm">
            <div className="flex-1 mr-4">
              <p className="text-sm font-medium text-slate-700 leading-tight">{ad.text}</p>
              <span className="text-[9px] text-slate-400">{new Date(ad.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => handleToggle(ad.id, ad.isActive)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${ad.isActive ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}
                title={ad.isActive ? "Désactiver" : "Activer"}
              >
                <i className={`fas ${ad.isActive ? 'fa-toggle-on' : 'fa-toggle-off'}`}></i>
              </button>
              <button 
                onClick={() => handleDelete(ad.id)}
                className="w-8 h-8 bg-red-50 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-100 transition-all"
                title="Supprimer"
              >
                <i className="fas fa-trash-alt text-xs"></i>
              </button>
            </div>
          </div>
        ))}
        {ads.length === 0 && <p className="text-center text-slate-400 py-8 text-sm italic">Aucune publicité en ligne.</p>}
      </div>
    </div>
  );
};

export default AdManager;
