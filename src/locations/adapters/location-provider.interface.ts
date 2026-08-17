import {
  AddressDetails,
  LocationSearchOptions,
  LocationSearchResult,
} from '../types/location.types';

export const LOCATION_PROVIDER = Symbol('LOCATION_PROVIDER');

export abstract class LocationProvider {
  abstract searchAddresses(
    query: string,
    options?: LocationSearchOptions,
  ): Promise<LocationSearchResult[]>;

  abstract getAddressDetails(
    placeId: string,
    sessionToken?: string,
  ): Promise<AddressDetails>;
}
