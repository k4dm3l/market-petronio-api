import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CloudinaryImageAdapter } from './adapters/cloudinary/cloudinary.adapter';
import { NoOpImageStorageAdapter } from './adapters/noop-image.adapter';
import { ImageService } from './image.service';
import { IMAGE_STORAGE_ADAPTER } from './interfaces/image-storage.adapter';
import { StoredImage, StoredImageSchema } from './schemas/image.schema';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: StoredImage.name, schema: StoredImageSchema },
    ]),
  ],
  providers: [
    ImageService,
    {
      provide: IMAGE_STORAGE_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const cloudName = config.get<string>('cloudinary.cloudName');
        const apiKey = config.get<string>('cloudinary.apiKey');
        const apiSecret = config.get<string>('cloudinary.apiSecret');
        const looksConfigured =
          !!cloudName &&
          !!apiKey &&
          !!apiSecret &&
          !cloudName.includes('your-') &&
          !apiKey.includes('your-');

        return looksConfigured
          ? new CloudinaryImageAdapter(cloudName, apiKey, apiSecret)
          : new NoOpImageStorageAdapter();
      },
    },
  ],
  exports: [ImageService, MongooseModule],
})
export class ImagesModule {}
