
import React, { useState, useEffect } from 'react';
import { UserProfile, EstablishmentType, Terrace } from '../types';
import { gemini } from '../services/geminiService';
import { dbService } from '../services/dbService';
import StripeSimulation from './StripeSimulation';
import AdManager from './AdManager';

interface ProfileModalProps {
  profile: UserProfile;
  favoriteTerraces: Terrace[];
  onSave: (updatedProfile: UserProfile) => void;
  onLogout: () => void;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ profile, favoriteTerraces, onSave, onLogout, onClose }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>(profile.email ? 'login' : 'register');
  const [activeTab, setActiveTab] = useState<'settings' | 'admin'>( 'settings');
  const [showPassword, setShowPassword] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const isLogged = !!currentUserId;

  React.useEffect(() => {
    dbService.getSupabase()?.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  // Initialize name: if logged, use profile name. If not, empty string (don't pre-fill "Login")
  const [name, setName] = useState(isLogged ? profile.name : '');
  const [email, setEmail] = useState(profile.email);
  const [password, setPassword] = useState(profile.password || '');
  const [emailNotifications, setEmailNotifications] = useState(profile.emailNotifications);
  const [preferredType, setPreferredType] = useState(profile.preferredType);
  const [preferredSunLevel, setPreferredSunLevel] = useState(profile.preferredSunLevel);

  const isPro = profile.isSubscribed;
  const isAdmin = isLogged && dbService.isAdmin(profile.email);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBusy(true);
    setError(null);
    try {
      if (authMode === 'register') {
        const newProfile = await dbService.register(name, email, password);
        onSave(newProfile);
      } else {
        const loggedProfile = await dbService.login(email, password);
        onSave(loggedProfile);
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
      triggerShake();
    } finally {
      setIsBusy(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;

    setIsBusy(true);
    setError(null);
    const updated: UserProfile = {
      ...profile,
      name,
      emailNotifications: isPro ? emailNotifications : false,
      preferredType,
      preferredSunLevel
    };
    try {
      await dbService.updateProfile(currentUserId, updated);
      onSave(updated);
      onClose();
    } catch (err: any) {
      setError(err.message);
      triggerShake();
    } finally {
      setIsBusy(false);
    }
  };

  const handleSubscriptionSuccess = async () => {
    if (!currentUserId) return;
    setShowCheckout(false);
    setIsBusy(true);
    try {
      await dbService.setSubscriptionStatus(currentUserId, true);
      onSave({ ...profile, isSubscribed: true });
    } catch (err) {
      console.error(err);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className={`bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden transition-all duration-300 ${shake ? 'animate-shake' : ''}`}>
        
        <div className="bg-gradient-to-br from-slate-900 via-orange-950 to-orange-600 p-8 text-white relative">
          <button onClick={onClose} className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors">
            <i className="fas fa-times"></i>
          </button>
          
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 bg-gradient-to-tr from-orange-500 to-yellow-400 rounded-3xl flex items-center justify-center text-3xl shadow-lg border border-white/20">
                <i className={`fas ${isLogged ? 'fa-user-gear' : 'fa-shield-halved'}`}></i>
              </div>
              {isPro && (
                <div className="absolute -top-2 -right-2 bg-yellow-400 text-slate-900 text-[10px] font-black px-2 py-1 rounded-lg border-2 border-white shadow-md animate-bounce">
                  PRO
                </div>
              )}
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight">
                {isLogged ? profile.name : authMode === 'login' ? 'Login' : 'Bienvenue'}
              </h2>
              <p className="text-orange-200 text-sm font-medium">
                {isAdmin ? 'Administrateur Système' : isLogged ? (isPro ? 'Membre Premium' : 'Utilisateur gratuit') : 'Le soleil vous attend.'}
              </p>
            </div>
          </div>

          {isAdmin && (
            <div className="flex mt-8 bg-white/10 p-1 rounded-2xl border border-white/10">
              <button 
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'settings' ? 'bg-white text-slate-900' : 'text-white/60 hover:text-white'}`}
              >
                Mon Profil
              </button>
              <button 
                onClick={() => setActiveTab('admin')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'admin' ? 'bg-white text-slate-900' : 'text-white/60 hover:text-white'}`}
              >
                Régie Pubs
              </button>
            </div>
          )}
        </div>

        <div className="p-8">
          {error && <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium">{error}</div>}

          {!isLogged ? (
            <form onSubmit={handleAuth} className="space-y-6">
              {authMode === 'register' && (
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Prénom" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none focus:border-orange-500 transition-all" />
              )}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Email" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 outline-none focus:border-orange-500 transition-all" />
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Mot de passe" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 pr-14 outline-none focus:border-orange-500 transition-all" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-4 text-slate-400 hover:text-orange-500"><i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i></button>
              </div>
              <button type="submit" disabled={isBusy} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                {isBusy && <i className="fas fa-spinner animate-spin"></i>}
                {authMode === 'login' ? 'Se connecter' : 'Créer mon compte'}
              </button>
              <p className="text-center text-sm text-slate-500">
                {authMode === 'login' ? "Nouveau ?" : "Déjà membre ?"}
                <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="ml-2 text-orange-600 font-bold hover:underline">
                  {authMode === 'login' ? "S'inscrire" : "Se connecter"}
                </button>
              </p>
            </form>
          ) : activeTab === 'admin' ? (
            <AdManager />
          ) : (
            <div className="space-y-8 animate-in slide-in-from-left-4 duration-300">
              {!isPro && (
                <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden group">
                  <div className="relative z-10 flex justify-between items-center">
                    <div>
                      <h3 className="text-xl font-black mb-1">Découvrez Terrasses Pro</h3>
                      <p className="text-white/80 text-xs">Plus de pubs, alertes email et spots VIP.</p>
                    </div>
                    <button onClick={() => setShowCheckout(true)} className="bg-white text-orange-600 px-6 py-2.5 rounded-2xl font-black text-sm shadow-md hover:scale-105 transition-all">
                      9.90€ / mois
                    </button>
                  </div>
                  <i className="fas fa-crown absolute -right-4 -bottom-4 text-white/10 text-8xl -rotate-12 group-hover:scale-110 transition-transform"></i>
                </div>
              )}

              <form onSubmit={handleUpdate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 outline-none" placeholder="Nom d'affichage" />
                    
                    <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${isPro ? 'bg-orange-50 border-orange-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${isPro ? 'bg-orange-500 text-white' : 'bg-slate-300 text-slate-500'}`}>
                          {isPro ? <i className="fas fa-bell"></i> : <i className="fas fa-lock"></i>}
                        </div>
                        <span className="text-xs font-bold text-slate-700">Alertes Email</span>
                      </div>
                      <label className={`relative inline-flex items-center ${isPro ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                        <input type="checkbox" checked={emailNotifications} disabled={!isPro} onChange={(e) => setEmailNotifications(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:bg-orange-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      {Object.values(EstablishmentType).map(t => (
                        <button key={t} type="button" onClick={() => setPreferredType(t)} className={`py-2 rounded-xl text-[10px] font-bold capitalize border ${preferredType === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'}`}>{t === 'all' ? 'Tous' : t}</button>
                      ))}
                    </div>
                    <div className="pt-2">
                       <label className="text-[10px] font-bold text-slate-400 uppercase">Min Soleil : {preferredSunLevel}%</label>
                       <input type="range" min="0" max="100" step="10" value={preferredSunLevel} onChange={(e) => setPreferredSunLevel(parseInt(e.target.value))} className="w-full accent-orange-500 h-2 bg-slate-100 rounded-full appearance-none" />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button type="button" onClick={onLogout} className="flex-1 text-slate-400 font-bold hover:text-red-500 text-sm"><i className="fas fa-power-off mr-2"></i>Déconnexion</button>
                  <button type="submit" disabled={isBusy} className="flex-[2] bg-orange-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-orange-700 transition-all flex items-center justify-center gap-2">
                    {isBusy && <i className="fas fa-spinner animate-spin"></i>}
                    Sauvegarder
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {showCheckout && (
        <StripeSimulation 
          amount="9.90€" 
          onSuccess={handleSubscriptionSuccess} 
          onCancel={() => setShowCheckout(false)} 
        />
      )}

      <style>{`
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-10px); } 75% { transform: translateX(10px); } }
        .animate-shake { animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both; }
      `}</style>
    </div>
  );
};

export default ProfileModal;
