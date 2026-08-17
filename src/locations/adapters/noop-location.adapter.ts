import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  AddressDetails,
  LocationSearchOptions,
  LocationSearchResult,
} from '../types/location.types';
import { LocationProvider } from './location-provider.interface';

/** Used when GOOGLE_MAPS_API_KEY is missing / placeholder. */
@Injectable()
export class NoOpLocationAdapter extends LocationProvider {
  searchAddresses(
    _query: string,
    _options?: LocationSearchOptions,
  ): Promise<LocationSearchResult[]> {
    throw new ServiceUnavailableException(
      'Location service is not configured (set GOOGLE_MAPS_API_KEY)',
    );
  }

  getAddressDetails(
    _placeId: string,
    _sessionToken?: string,
  ): Promise<AddressDetails> {
    throw new ServiceUnavailableException(
      'Location service is not configured (set GOOGLE_MAPS_API_KEY)',
    );
  }
}
