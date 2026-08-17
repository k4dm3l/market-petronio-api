import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AddressDetails,
  LocationSearchOptions,
  LocationSearchResult,
} from '../types/location.types';
import { LocationProvider } from './location-provider.interface';

const AUTOCOMPLETE_NEW_URL =
  'https://places.googleapis.com/v1/places:autocomplete';
const PLACE_DETAILS_NEW_URL = 'https://places.googleapis.com/v1/places';
const AUTOCOMPLETE_LEGACY_URL =
  'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const DEFAULT_RADIUS_M = 50_000;
const MAX_ATTEMPTS = 3;

type PlacePrediction = {
  placeId?: string;
  text?: { text?: string };
};

type AutocompleteNewResponse = {
  suggestions?: Array<{ placePrediction?: PlacePrediction }>;
  error?: { code?: number; status?: string; message?: string };
};

type AutocompleteLegacyResponse = {
  status: string;
  predictions?: Array<{ place_id?: string; description?: string }>;
  error_message?: string;
};

type PlaceComponent = {
  longText?: string;
  types?: string[];
};

type PlaceDetailsNewResponse = {
  id?: string;
  formattedAddress?: string;
  addressComponents?: PlaceComponent[];
  location?: { latitude?: number; longitude?: number };
  error?: { code?: number; status?: string; message?: string };
};

type GeocodeComponent = {
  long_name: string;
  types: string[];
};

type GeocodeResponse = {
  status: string;
  results?: Array<{
    formatted_address?: string;
    address_components?: GeocodeComponent[];
    geometry?: { location?: { lat: number; lng: number } };
  }>;
};

@Injectable()
export class GoogleMapsAdapter extends LocationProvider {
  private readonly logger = new Logger(GoogleMapsAdapter.name);
  /** Places API (New) returns 403 when not enabled — use classic APIs after that. */
  private useLegacy = false;

  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs: number,
  ) {
    super();
  }

  async searchAddresses(
    query: string,
    options?: LocationSearchOptions,
  ): Promise<LocationSearchResult[]> {
    if (!this.useLegacy) {
      const result = await this.searchNew(query, options);
      if (result !== 'denied') return result;
      this.useLegacy = true;
      this.logger.warn(
        'Places API (New) denied — falling back to Places Autocomplete (legacy). Enable "Places API (New)" in Google Cloud to use the new API.',
      );
    }
    return this.searchLegacy(query, options);
  }

  async getAddressDetails(
    placeId: string,
    sessionToken?: string,
  ): Promise<AddressDetails> {
    const id = placeId.replace(/^places\//, '');
    if (!this.useLegacy) {
      const result = await this.detailsNew(id, sessionToken);
      if (result !== 'denied') return result;
      this.useLegacy = true;
      this.logger.warn(
        'Places API (New) denied — falling back to Geocoding API.',
      );
    }
    return this.detailsGeocode(id);
  }

  private async searchNew(
    query: string,
    options?: LocationSearchOptions,
  ): Promise<LocationSearchResult[] | 'denied'> {
    const body: Record<string, unknown> = { input: query };
    if (options?.sessionToken) body.sessionToken = options.sessionToken;
    const bias = this.bias(options);
    if (bias) body.locationBias = bias;

    const res = await this.request(AUTOCOMPLETE_NEW_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
      },
      body: JSON.stringify(body),
    });

    const json = (await this.readJson(res)) as AutocompleteNewResponse;
    if (this.isDenied(res.status, json.error?.status)) return 'denied';
    if (!res.ok || json.error) {
      this.throwProviderError(res.status, json.error?.status);
    }

    return (json.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is PlacePrediction => !!p?.placeId && !!p.text?.text)
      .map((p) => ({
        placeId: p.placeId!.replace(/^places\//, ''),
        description: p.text!.text!,
      }));
  }

  private async searchLegacy(
    query: string,
    options?: LocationSearchOptions,
  ): Promise<LocationSearchResult[]> {
    const url = new URL(AUTOCOMPLETE_LEGACY_URL);
    url.searchParams.set('input', query);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('language', 'es');
    if (options?.sessionToken) {
      url.searchParams.set('sessiontoken', options.sessionToken);
    }
    if (options?.latitude != null && options?.longitude != null) {
      url.searchParams.set(
        'location',
        `${options.latitude},${options.longitude}`,
      );
      url.searchParams.set(
        'radius',
        String(options.radius ?? DEFAULT_RADIUS_M),
      );
    }

    const res = await this.request(url.toString(), { method: 'GET' });
    const json = (await this.readJson(res)) as AutocompleteLegacyResponse;
    if (
      this.isDenied(res.status, json.status) ||
      json.status === 'REQUEST_DENIED'
    ) {
      this.throwProviderError(403, json.status);
    }
    if (json.status === 'ZERO_RESULTS' || !json.predictions?.length) {
      return [];
    }
    if (json.status !== 'OK') {
      this.throwProviderError(res.ok ? 400 : res.status, json.status);
    }

    return (json.predictions ?? [])
      .filter((p) => p.place_id && p.description)
      .map((p) => ({
        placeId: p.place_id!,
        description: p.description!,
      }));
  }

  private async detailsNew(
    id: string,
    sessionToken?: string,
  ): Promise<AddressDetails | 'denied'> {
    const url = new URL(`${PLACE_DETAILS_NEW_URL}/${encodeURIComponent(id)}`);
    url.searchParams.set('languageCode', 'es');
    if (sessionToken) url.searchParams.set('sessionToken', sessionToken);

    const res = await this.request(url.toString(), {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask':
          'id,formattedAddress,addressComponents,location',
      },
    });

    const json = (await this.readJson(res)) as PlaceDetailsNewResponse;
    if (this.isDenied(res.status, json.error?.status)) return 'denied';
    if (res.status === 404) {
      throw new NotFoundException('Location not found');
    }
    if (!res.ok || json.error) {
      this.throwProviderError(res.status, json.error?.status);
    }

    const lat = json.location?.latitude;
    const lng = json.location?.longitude;
    if (lat == null || lng == null) {
      throw new NotFoundException('Location not found');
    }

    const components = json.addressComponents ?? [];
    const streetNumber = this.newComponent(components, 'street_number');
    const route = this.newComponent(components, 'route');
    const street = [streetNumber, route].filter(Boolean).join(' ');

    return {
      placeId: (json.id ?? id).replace(/^places\//, ''),
      formattedAddress: json.formattedAddress ?? '',
      country: this.newComponent(components, 'country') ?? '',
      department: this.newComponent(
        components,
        'administrative_area_level_1',
      ),
      city:
        this.newComponent(components, 'locality') ??
        this.newComponent(components, 'administrative_area_level_2'),
      address: street || undefined,
      zipcode: this.newComponent(components, 'postal_code'),
      coordinates: { latitude: lat, longitude: lng },
    };
  }

  private async detailsGeocode(id: string): Promise<AddressDetails> {
    const url = new URL(GEOCODE_URL);
    url.searchParams.set('place_id', id);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('language', 'es');

    const res = await this.request(url.toString(), { method: 'GET' });
    const json = (await this.readJson(res)) as GeocodeResponse;

    if (json.status === 'ZERO_RESULTS' || !json.results?.length) {
      throw new NotFoundException('Location not found');
    }
    if (json.status === 'REQUEST_DENIED') {
      this.throwProviderError(403, json.status);
    }
    if (json.status !== 'OK') {
      this.throwProviderError(
        json.status === 'INVALID_REQUEST' ? 400 : 503,
        json.status,
      );
    }

    const result = json.results[0];
    const loc = result.geometry?.location;
    if (loc?.lat == null || loc?.lng == null) {
      throw new NotFoundException('Location not found');
    }

    const components = result.address_components ?? [];
    const streetNumber = this.legacyComponent(components, 'street_number');
    const route = this.legacyComponent(components, 'route');
    const street = [streetNumber, route].filter(Boolean).join(' ');

    return {
      placeId: id,
      formattedAddress: result.formatted_address ?? '',
      country: this.legacyComponent(components, 'country') ?? '',
      department: this.legacyComponent(
        components,
        'administrative_area_level_1',
      ),
      city:
        this.legacyComponent(components, 'locality') ??
        this.legacyComponent(components, 'administrative_area_level_2'),
      address: street || undefined,
      zipcode: this.legacyComponent(components, 'postal_code'),
      coordinates: { latitude: loc.lat, longitude: loc.lng },
    };
  }

  private bias(options?: LocationSearchOptions) {
    if (options?.latitude == null || options?.longitude == null) return null;
    return {
      circle: {
        center: {
          latitude: options.latitude,
          longitude: options.longitude,
        },
        radius: options.radius ?? DEFAULT_RADIUS_M,
      },
    };
  }

  private isDenied(httpStatus: number, providerStatus?: string) {
    return (
      httpStatus === 403 ||
      providerStatus === 'PERMISSION_DENIED' ||
      providerStatus === 'REQUEST_DENIED'
    );
  }

  private newComponent(components: PlaceComponent[], type: string) {
    return components.find((c) => c.types?.includes(type))?.longText;
  }

  private legacyComponent(components: GeocodeComponent[], type: string) {
    return components.find((c) => c.types.includes(type))?.long_name;
  }

  private async request(url: string, init: RequestInit): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (res.status >= 500 && attempt < MAX_ATTEMPTS - 1) {
          await this.delay(attempt);
          continue;
        }
        return res;
      } catch (err) {
        lastError = err;
        if (attempt < MAX_ATTEMPTS - 1) {
          await this.delay(attempt);
          continue;
        }
      }
    }

    this.logger.warn(
      `Google Maps request failed: ${
        lastError instanceof Error ? lastError.message : lastError
      }`,
    );
    throw new ServiceUnavailableException(
      'Location service temporarily unavailable',
    );
  }

  private async readJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch {
      throw new ServiceUnavailableException(
        'Location service temporarily unavailable',
      );
    }
  }

  private throwProviderError(httpStatus: number, providerStatus?: string) {
    const invalid =
      httpStatus === 400 ||
      providerStatus === 'INVALID_ARGUMENT' ||
      providerStatus === 'INVALID_REQUEST';

    if (invalid) {
      throw new BadRequestException('Invalid location search request');
    }

    if (this.isDenied(httpStatus, providerStatus)) {
      this.logger.warn(
        `Google Maps permission denied (${providerStatus ?? httpStatus}). Enable Places API and/or Geocoding API (and billing) on this key.`,
      );
      throw new ServiceUnavailableException(
        'Location provider is not enabled for this API key',
      );
    }

    this.logger.warn(
      `Google Maps error status=${httpStatus} provider=${providerStatus ?? '-'}`,
    );
    throw new ServiceUnavailableException(
      'Location service temporarily unavailable',
    );
  }

  private delay(attempt: number): Promise<void> {
    return new Promise((resolve) =>
      setTimeout(resolve, 200 * 2 ** attempt),
    );
  }
}
