import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { EstablishmentType, Terrace, UserPreferences, SunLevel, UserProfile } from './types';
import { gemini } from './services/geminiService';
import { dbService } from './services/dbService';
import TerraceCard from './components/TerraceCard';
import SearchAssistant from './components/SearchAssistant';
import ProfileModal from './components/ProfileModal';
import AdBanner from './components/AdBanner';

const App: React.FC = () => {
  const [terraces, setTerraces] = useState<Terrace[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDbSyncing, setIsDbSyncing] = useState(false);
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  
  const todayStr = new Date().toISOString().split('T')[0];
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 2);
  const maxDateStr = maxDate.toISOString().split('T')[0];
  const currentTimeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace('h', ':');

  const [profile, setProfile] = useState<UserProfile>({
    name: 'Login',
    email: '',
    isSubscribed: false,
    emailNotifications: false,
    preferredType: EstablishmentType.ALL,
    preferredSunLevel: 20,
    favorites: []
  });

  const [preferences, setPreferences] = useState<UserPreferences>({
    type: profile.preferredType,
    minSunExposure: profile.preferredSunLevel,
    date: todayStr,
    time: currentTimeStr
  });

  const displayDateLabel = useMemo(() => {
    if (preferences.date === todayStr) return "aujourd'hui";
    const [year, month, day] = preferences.date.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }, [preferences.date, todayStr]);

  // Listener Firebase Auth
  useEffect(() => {
    const unsubscribe = dbService.onAuthChange(async (user) => {
      if (user) {
        setCurrentUserUid(user.uid);
        const p = await dbService.fetchProfileByUid(user.uid);
        if (p) {
          setProfile(p);
          setPreferences(prev => ({
            ...prev,
            type: p.preferredType,
            minSunExposure: p.preferredSunLevel
          }));
        }
      } else {
        setCurrentUserUid(null);
        setProfile({
          name: 'Login',
          email: '',
          isSubscribed: false,
          emailNotifications: false,
          preferredType: EstablishmentType.ALL,
          preferredSunLevel: 20,
          favorites: []
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSearch = useCallback(async (locationInput?: string) => {
    const loc = locationInput || searchQuery || "Paris";
    setLoading(true);
    setErrorMsg(null);
    try {
      const results = await gemini.findTerraces(
        loc, 
        preferences.type, 
        preferences.date,
        preferences.time,
        preferences.coords?.lat, 
        preferences.coords?.lng
      );
      if (results.length === 0) {
        // On check si c'est vraiment vide ou si l'IA n'a pas répondu correctement
        console.warn("Aucun résultat retourné par Gemini.");
      }
      setTerraces(results);
    } catch (err: any) {
      console.error("Erreur recherche:", err);
      setErrorMsg("Impossible de contacter l'intelligence artificielle. Vérifiez votre connexion ou la clé API.");
      setTerraces([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, preferences]);

  useEffect(() => {
    handleSearch("Quartier Latin, Paris");
  }, []);

  const geolocate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPreferences(prev => ({ ...prev, coords }));
          handleSearch("Ma position actuelle");
        },
        (err) => alert("Géolocalisation refusée.")
      );
    }
  };

  const toggleFavorite = async (id: string) => {
    const newFavorites = profile.favorites.includes(id) 
      ? profile.favorites.filter(f => f !== id)
      : [...profile.favorites, id];
    
    const newProfile = { ...profile, favorites: newFavorites };
    setProfile(newProfile);

    if (currentUserUid) {
      setIsDbSyncing(true);
      try {
        await dbService.updateProfile(currentUserUid, newProfile);
      } catch (e) {
        console.error("Sync failed:", e);
      }
      setIsDbSyncing(false);
    }
  };

  const handleProfileUpdate = (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
  };

  const handleLogout = async () => {
    await dbService.logout();
    setIsProfileOpen(false);
  };

  const favoriteTerraces = useMemo(() => {
    return terraces.filter(t => profile.favorites.includes(t.name + t.address));
  }, [terraces, profile.favorites]);

  const filteredTerraces = useMemo(() => {
    return terraces.filter(t => t.sunExposure >= preferences.minSunExposure);
  }, [terraces, preferences.minSunExposure]);

  const isAdmin = useMemo(() => dbService.isAdmin(profile.email), [profile.email]);

  return (
    <div className="min-h-screen bg-orange-50 pb-12">
      <AdBanner isPro={profile.isSubscribed} />

      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-orange-100 px-4 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center justify-between w-full md:w-auto gap-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-lg rotate-3">
                <i className="fas fa-sun text-2xl"></i>
              </div>
              <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-orange-600">
                Terrasses au soleil
              </h1>
            </div>
            
            <div className="flex items-center gap-3">
              {isDbSyncing && <i className="fas fa-cloud-arrow-up text-orange-500 animate-bounce text-sm"></i>}
              <button onClick={() => setIsProfileOpen(true)} className="md:hidden w-11 h-11 bg-slate-900 rounded-full flex items-center justify-center text-white shadow-lg relative">
                <i className="fas fa-user text-sm"></i>
                {profile.isSubscribed && <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border-2 border-white"></div>}
              </button>
            </div>
          </div>

          <div className="flex w-full md:w-auto gap-2 bg-slate-100 p-1.5 rounded-[1.5rem] items-center shadow-inner border border-slate-200">
            <input 
              type="text" placeholder="Quartier, ville, adresse..." 
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="bg-transparent px-5 py-2.5 outline-none flex-1 md:w-56 text-sm font-medium"
            />
            <button onClick={() => handleSearch()} className="bg-white text-orange-600 w-11 h-11 rounded-2xl flex items-center justify-center shadow-md hover:bg-orange-50 transition-all">
              <i className="fas fa-search"></i>
            </button>
            <button onClick={geolocate} className="bg-white text-slate-500 w-11 h-11 rounded-2xl flex items-center justify-center shadow-md hover:bg-slate-50 transition-all">
              <i className="fas fa-location-crosshairs"></i>
            </button>
            <div className="hidden md:block w-px h-8 bg-slate-200 mx-1"></div>
            <button 
              onClick={() => setIsProfileOpen(true)} 
              className={`hidden md:flex items-center gap-3 px-4 py-2 rounded-2xl text-sm font-bold transition-all shadow-md ${
                currentUserUid ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black ${
                currentUserUid ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600'
              }`}>
                {currentUserUid ? profile.name.charAt(0).toUpperCase() : <i className="fas fa-user"></i>}
              </div>
              <div className="flex flex-col items-start leading-none">
                <span className="text-xs">{profile.name}</span>
                {profile.isSubscribed && <span className="text-[8px] text-yellow-400 font-black tracking-widest uppercase">Premium</span>}
              </div>
              {currentUserUid && <i className={`fas ${isAdmin ? 'fa-user-shield' : 'fa-lock'} text-[10px] text-orange-400`}></i>}
            </button>
          </div>
        </div>
      </nav>

      <header className="px-4 py-16 text-center max-w-4xl mx-auto">
        <h2 className="text-4xl md:text-6xl font-black text-slate-900 mb-6 tracking-tighter leading-[1.1]">
          Le café au soleil, <br/>
          <span className="text-orange-500 italic">sans l'ombre d'un doute.</span>
        </h2>
        <p className="text-slate-500 text-xl font-medium max-w-2xl mx-auto">
          L'IA analyse les façades d'immeubles pour trouver les rayons de soleil pour le {displayDateLabel} à {preferences.time}.
        </p>
      </header>

      <section className="max-w-7xl mx-auto px-4 mb-12">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-orange-100/50 border border-orange-100 grid grid-cols-1 md:grid-cols-4 gap-8 items-end">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Établissement</label>
            <select 
              value={preferences.type}
              onChange={(e) => setPreferences(p => ({ ...p, type: e.target.value as EstablishmentType }))}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:border-orange-500 appearance-none cursor-pointer shadow-sm"
            >
              {[EstablishmentType.ALL, EstablishmentType.BAR, EstablishmentType.RESTAURANT, EstablishmentType.CAFE, EstablishmentType.HOTEL].map(t => (
                <option key={t} value={t}>{t === 'all' ? 'Peu importe' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date Prévue</label>
            <input 
              type="date" min={todayStr} max={maxDateStr}
              value={preferences.date}
              onChange={(e) => setPreferences(p => ({ ...p, date: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:border-orange-500 shadow-sm"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Heure de Visite</label>
            <input 
              type="time" step="1800"
              value={preferences.time}
              onChange={(e) => setPreferences(p => ({ ...p, time: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:border-orange-500 shadow-sm"
            />
          </div>

          <button 
            onClick={() => handleSearch()}
            className="bg-slate-900 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            <i className="fas fa-wand-magic-sparkles"></i> Chercher
          </button>
        </div>

        <div className="mt-6 px-8 py-5 bg-white border border-orange-100 rounded-[2rem] flex items-center gap-8 shadow-md">
          <div className="shrink-0 flex items-center gap-3">
             <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                <i className="fas fa-sun text-orange-500 animate-spin-slow"></i>
             </div>
             <span className="text-xs font-black text-slate-600 uppercase tracking-tight">Exposition désirée</span>
          </div>
          <input 
            type="range" min="0" max="90" step="10"
            value={preferences.minSunExposure}
            onChange={(e) => setPreferences(p => ({ ...p, minSunExposure: parseInt(e.target.value) }))}
            className="flex-1 accent-orange-500 h-2 bg-slate-100 rounded-full appearance-none cursor-pointer"
          />
          <div className="text-lg font-black text-orange-600 bg-orange-50 px-4 py-1 rounded-xl border border-orange-100">
            {preferences.minSunExposure}%
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-24 h-24 border-8 border-orange-100 border-t-orange-500 rounded-full animate-spin mb-8"></div>
            <p className="text-slate-800 font-black text-2xl tracking-tight">Analyse des ombres portées...</p>
            <p className="text-slate-400 mt-2 font-medium">Prévision pour le {displayDateLabel} à {preferences.time}</p>
          </div>
        ) : errorMsg ? (
          <div className="text-center py-20 bg-red-50 rounded-[3rem] border border-red-100">
            <i className="fas fa-triangle-exclamation text-4xl text-red-400 mb-4"></i>
            <p className="text-red-700 font-bold">{errorMsg}</p>
            <button onClick={() => handleSearch()} className="mt-4 px-6 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-bold transition-colors">Réessayer</button>
          </div>
        ) : filteredTerraces.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {filteredTerraces.map(terrace => (
              <TerraceCard 
                key={terrace.id} 
                terrace={terrace} 
                isFavorite={profile.favorites.includes(terrace.name + terrace.address)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8">
              <i className="fas fa-cloud-sun text-5xl text-slate-200"></i>
            </div>
            <h3 className="text-slate-800 font-black text-2xl mb-3">Zone d'ombre détectée</h3>
            <p className="text-slate-500 max-w-sm mx-auto font-medium">
              Aucun établissement ne répond à vos critères à cette heure-là. <br/> Essayez d'élargir votre recherche ou de baisser le seuil d'ensoleillement.
            </p>
          </div>
        )}
      </main>

      <SearchAssistant />
      {isProfileOpen && (
        <ProfileModal 
          profile={profile} 
          favoriteTerraces={favoriteTerraces}
          onSave={handleProfileUpdate} 
          onLogout={handleLogout}
          onClose={() => setIsProfileOpen(false)} 
        />
      )}
    </div>
  );
};

export default App;