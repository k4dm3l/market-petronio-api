export type LocationSearchOptions = {
  sessionToken?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
};

export type LocationSearchResult = {
  placeId: string;
  description: string;
};

export type AddressDetails = {
  placeId: string;
  formattedAddress: string;
  country: string;
  department?: string;
  city?: string;
  address?: string;
  zipcode?: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
};
