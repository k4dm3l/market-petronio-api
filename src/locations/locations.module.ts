import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GoogleMapsAdapter } from './adapters/google-maps.adapter';
import { LOCATION_PROVIDER } from './adapters/location-provider.interface';
import { NoOpLocationAdapter } from './adapters/noop-location.adapter';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

@Module({
  imports: [ConfigModule],
  controllers: [LocationsController],
  providers: [
    LocationsService,
    {
      provide: LOCATION_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('googleMaps.apiKey');
        const timeoutMs = config.get<number>('googleMaps.timeoutMs', 4000);
        const looksConfigured =
          !!apiKey &&
          apiKey.length > 20 &&
          !apiKey.includes('your-') &&
          !apiKey.includes('xxxx');

        return looksConfigured
          ? new GoogleMapsAdapter(apiKey, timeoutMs)
          : new NoOpLocationAdapter();
      },
    },
  ],
})
export class LocationsModule {}
