import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { UserProfile, EstablishmentType, Advertisement } from '../types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL ?? '').toLowerCase().trim();

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[dbService] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing.');
}
if (!ADMIN_EMAIL) {
  console.warn('[dbService] VITE_ADMIN_EMAIL is not set — admin UI gating disabled.');
}

// Helpers de mapping snake_case (DB) ↔ camelCase (TS)
type DbProfile = {
  id: string;
  name: string;
  email: string;
  is_subscribed: boolean;
  email_notifications: boolean;
  preferred_type: string;
  preferred_sun_level: number;
  favorites: string[];
};

function dbToProfile(row: DbProfile): UserProfile {
  return {
    name: row.name,
    email: row.email,
    isSubscribed: row.is_subscribed,
    emailNotifications: row.email_notifications,
    preferredType: row.preferred_type as EstablishmentType,
    preferredSunLevel: row.preferred_sun_level,
    favorites: row.favorites,
  };
}

function profileToDb(p: Partial<UserProfile>): Partial<DbProfile> {
  const out: Partial<DbProfile> = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.email !== undefined) out.email = p.email;
  if (p.isSubscribed !== undefined) out.is_subscribed = p.isSubscribed;
  if (p.emailNotifications !== undefined) out.email_notifications = p.emailNotifications;
  if (p.preferredType !== undefined) out.preferred_type = p.preferredType;
  if (p.preferredSunLevel !== undefined) out.preferred_sun_level = p.preferredSunLevel;
  if (p.favorites !== undefined) out.favorites = p.favorites;
  return out;
}

class DatabaseService {
  private supabase?: SupabaseClient;

  constructor() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
      });
      console.log('Database Engine initialized (Supabase).');
    } else {
      console.warn('Supabase client not initialized — env vars missing.');
    }
  }

  onAuthChange(callback: (user: User | null) => void) {
    if (!this.supabase) return () => {};
    const { data } = this.supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
    // Initial value
    this.supabase.auth.getUser().then(({ data: { user } }) => callback(user));
    return () => data.subscription.unsubscribe();
  }

  async register(name: string, email: string, password: string): Promise<UserProfile> {
    if (!this.supabase) throw new Error('Service indisponible.');
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (error || !data.user) throw new Error(error?.message ?? "Erreur d'inscription");

    const newProfile: UserProfile = {
      name,
      email: data.user.email!,
      isSubscribed: false,
      emailNotifications: false,
      preferredType: EstablishmentType.ALL,
      preferredSunLevel: 20,
      favorites: [],
    };

    const { error: insertErr } = await this.supabase
      .from('profiles')
      .insert({ id: data.user.id, ...profileToDb(newProfile) });
    if (insertErr) throw new Error(insertErr.message);

    return newProfile;
  }

  async login(email: string, password: string): Promise<UserProfile> {
    if (!this.supabase) throw new Error('Service indisponible.');
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error(error?.message ?? 'Erreur de connexion');

    const profile = await this.fetchProfileByUid(data.user.id);
    return profile ?? {
      name: data.user.email?.split('@')[0] ?? 'Utilisateur',
      email: data.user.email!,
      isSubscribed: false,
      emailNotifications: false,
      preferredType: EstablishmentType.ALL,
      preferredSunLevel: 20,
      favorites: [],
    };
  }

  async logout() {
    if (this.supabase) await this.supabase.auth.signOut();
  }

  async updateProfile(uid: string, profile: UserProfile): Promise<void> {
    if (!this.supabase) return;
    const { error } = await this.supabase
      .from('profiles')
      .update(profileToDb(profile))
      .eq('id', uid);
    if (error) console.error('Profile sync error:', error.message);
  }

  async fetchProfileByUid(uid: string): Promise<UserProfile | null> {
    if (!this.supabase) return null;
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single();
    if (error || !data) return null;
    return dbToProfile(data as DbProfile);
  }

  async setSubscriptionStatus(uid: string, status: boolean): Promise<void> {
    if (!this.supabase) return;
    await this.supabase.from('profiles').update({ is_subscribed: status }).eq('id', uid);
  }

  isAdmin(email?: string | null): boolean {
    return email?.toLowerCase().trim() === ADMIN_EMAIL;
  }

  onAdsChange(callback: (ads: Advertisement[]) => void) {
    if (!this.supabase) return () => {};

    // Helper : recharger la liste complète depuis la DB
    const refresh = async () => {
      const { data } = await this.supabase!
        .from('ads')
        .select('id, text, link, is_active, created_at')
        .order('created_at', { ascending: false });
      const ads: Advertisement[] = (data ?? []).map((row) => ({
        id: row.id,
        text: row.text,
        link: row.link ?? undefined,
        isActive: row.is_active,
        createdAt: new Date(row.created_at).getTime(),
      }));
      callback(ads);
    };

    // Charge initiale
    refresh();

    // Realtime channel — n'importe quel changement → refresh
    const channel = this.supabase
      .channel('ads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ads' }, (_payload: any) => refresh())
      .subscribe();

    return () => {
      this.supabase!.removeChannel(channel);
    };
  }

  async addAd(text: string, link?: string): Promise<void> {
    if (!this.supabase) return;
    const { error } = await this.supabase
      .from('ads')
      .insert({ text, link: link || null, is_active: true });
    if (error) throw new Error(error.message);
  }

  async deleteAd(id: string): Promise<void> {
    if (!this.supabase) return;
    const { error } = await this.supabase.from('ads').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async toggleAdStatus(id: string, currentStatus: boolean): Promise<void> {
    if (!this.supabase) return;
    const { error } = await this.supabase
      .from('ads')
      .update({ is_active: !currentStatus })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  getSupabase() { return this.supabase; }
  getAuth() { return this.supabase?.auth; }  // back-compat avec l'ancienne API
}

export const dbService = new DatabaseService();
