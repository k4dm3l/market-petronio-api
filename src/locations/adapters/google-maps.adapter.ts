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

const AUTOCOMPLETE_URL =
  'https://places.googleapis.com/v1/places:autocomplete';
const PLACE_DETAILS_URL = 'https://places.googleapis.com/v1/places';
const DEFAULT_RADIUS_M = 50_000;
const MAX_ATTEMPTS = 3;

type PlacePrediction = {
  placeId?: string;
  text?: { text?: string };
};

type AutocompleteResponse = {
  suggestions?: Array<{ placePrediction?: PlacePrediction }>;
  error?: { code?: number; status?: string; message?: string };
};

type PlaceComponent = {
  longText?: string;
  types?: string[];
};

type PlaceDetailsResponse = {
  id?: string;
  formattedAddress?: string;
  addressComponents?: PlaceComponent[];
  location?: { latitude?: number; longitude?: number };
  error?: { code?: number; status?: string; message?: string };
};

@Injectable()
export class GoogleMapsAdapter extends LocationProvider {
  private readonly logger = new Logger(GoogleMapsAdapter.name);

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
    const body: Record<string, unknown> = { input: query };
    if (options?.sessionToken) body.sessionToken = options.sessionToken;
    if (options?.latitude != null && options?.longitude != null) {
      body.locationBias = {
        circle: {
          center: {
            latitude: options.latitude,
            longitude: options.longitude,
          },
          radius: options.radius ?? DEFAULT_RADIUS_M,
        },
      };
    }

    const res = await this.request(AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,suggestions.placePrediction.text',
      },
      body: JSON.stringify(body),
    });

    const json = (await this.readJson(res)) as AutocompleteResponse;
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

  async getAddressDetails(
    placeId: string,
    sessionToken?: string,
  ): Promise<AddressDetails> {
    const id = placeId.replace(/^places\//, '');
    const url = new URL(`${PLACE_DETAILS_URL}/${encodeURIComponent(id)}`);
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

    const json = (await this.readJson(res)) as PlaceDetailsResponse;
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
    const streetNumber = this.component(components, 'street_number');
    const route = this.component(components, 'route');
    const street = [streetNumber, route].filter(Boolean).join(' ');

    return {
      placeId: (json.id ?? id).replace(/^places\//, ''),
      formattedAddress: json.formattedAddress ?? '',
      country: this.component(components, 'country') ?? '',
      department: this.component(components, 'administrative_area_level_1'),
      city:
        this.component(components, 'locality') ??
        this.component(components, 'administrative_area_level_2'),
      address: street || undefined,
      zipcode: this.component(components, 'postal_code'),
      coordinates: { latitude: lat, longitude: lng },
    };
  }

  private component(
    components: PlaceComponent[],
    type: string,
  ): string | undefined {
    return components.find((c) => c.types?.includes(type))?.longText;
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
