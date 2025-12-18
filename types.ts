
export enum EstablishmentType {
  BAR = 'bar',
  RESTAURANT = 'restaurant',
  CAFE = 'cafe',
  HOTEL = 'hôtel',
  ALL = 'all'
}

export enum SunLevel {
  FULL = 'En plein soleil',
  PARTIAL = 'Ombre partielle',
  SHADED = 'À l\'ombre'
}

export interface Advertisement {
  id: string;
  text: string;
  link?: string;
  isActive: boolean;
  createdAt: number;
}

export interface UserProfile {
  name: string;
  email: string;
  password?: string;
  isSubscribed: boolean;
  emailNotifications: boolean;
  preferredType: EstablishmentType;
  preferredSunLevel: number;
  favorites: string[];
}

export interface Terrace {
  id: string;
  name: string;
  address: string;
  type: EstablishmentType;
  sunExposure: number;
  sunLevel: SunLevel;
  description: string;
  imageUrl: string;
  rating: number;
  coordinates: {
    lat: number;
    lng: number;
  };
  sources?: Array<{
    title: string;
    uri: string;
  }>;
}

export interface UserPreferences {
  type: EstablishmentType;
  minSunExposure: number;
  location?: string;
  date: string;
  time: string;
  coords?: {
    lat: number;
    lng: number;
  };
}
