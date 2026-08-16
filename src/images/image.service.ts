import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  IMAGE_STORAGE_ADAPTER,
  ImageDeliveryVariant,
  ImageStorageAdapter,
  ImageUploadOptions,
  ImageUploadResult,
} from './interfaces/image-storage.adapter';
import {
  ImageDocument,
  ImageEntityType,
  ImageStatus,
  ImageType,
  StoredImage,
} from './schemas/image.schema';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class ImageService {
  constructor(
    @Inject(IMAGE_STORAGE_ADAPTER)
    private readonly storage: ImageStorageAdapter,
    @InjectModel(StoredImage.name)
    private readonly imageModel: Model<ImageDocument>,
  ) {}

  async upload(
    file: Express.Multer.File | undefined,
    options?: ImageUploadOptions,
  ): Promise<ImageUploadResult> {
    this.assertValidImage(file);
    return this.storage.upload(file!.buffer, options);
  }

  /** Upload to storage + persist TEMPORARY product image (spec 011). */
  async uploadTemporaryProductImage(
    file: Express.Multer.File | undefined,
    uploadedBy: string,
  ): Promise<ImageDocument> {
    const uploaded = await this.upload(file, {
      folder: 'products/temp',
      variant: 'product',
    });

    return this.imageModel.create({
      url: uploaded.url,
      publicId: uploaded.publicId,
      provider: 'cloudinary',
      type: ImageType.Product,
      status: ImageStatus.Temporary,
      uploadedBy: new Types.ObjectId(uploadedBy),
      entityType: null,
      entityId: null,
    });
  }

  /**
   * Validate TEMPORARY product images owned by `uploadedBy`.
   * Throws if any id is missing, wrong type/status, or not owned.
   */
  async assertClaimableProductImages(
    imageIds: string[],
    uploadedBy: string,
  ): Promise<ImageDocument[]> {
    if (!imageIds.length) return [];

    const uniqueIds = [...new Set(imageIds)];
    if (uniqueIds.length !== imageIds.length) {
      throw new BadRequestException('Duplicate image ids are not allowed');
    }

    for (const id of uniqueIds) {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException(`Invalid image id: ${id}`);
      }
    }

    const docs = await this.imageModel
      .find({ _id: { $in: uniqueIds.map((id) => new Types.ObjectId(id)) } })
      .exec();

    if (docs.length !== uniqueIds.length) {
      throw new BadRequestException('One or more images were not found');
    }

    const byId = new Map(docs.map((d) => [d.id, d]));
    const ordered: ImageDocument[] = [];

    for (const id of imageIds) {
      const doc = byId.get(id)!;
      if (doc.type !== ImageType.Product) {
        throw new BadRequestException(`Image ${id} is not a product image`);
      }
      if (doc.status !== ImageStatus.Temporary) {
        throw new BadRequestException(
          `Image ${id} is not available for association`,
        );
      }
      if (doc.uploadedBy.toString() !== uploadedBy) {
        throw new ForbiddenException(`Image ${id} does not belong to you`);
      }
      ordered.push(doc);
    }

    return ordered;
  }

  async markAssociatedToProduct(
    imageIds: string[],
    productId: string,
  ): Promise<void> {
    if (!imageIds.length) return;
    await this.imageModel
      .updateMany(
        { _id: { $in: imageIds.map((id) => new Types.ObjectId(id)) } },
        {
          $set: {
            status: ImageStatus.Associated,
            entityType: ImageEntityType.Product,
            entityId: new Types.ObjectId(productId),
          },
        },
      )
      .exec();
  }

  async findById(id: string): Promise<ImageDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.imageModel.findById(id).exec();
  }

  /** Delete storage asset + images collection row. */
  async deletePersisted(image: ImageDocument): Promise<void> {
    await this.delete(image.publicId);
    await this.imageModel.deleteOne({ _id: image._id }).exec();
  }

  async delete(publicId: string): Promise<void> {
    if (!publicId?.trim()) return;
    await this.storage.delete(publicId);
  }

  getDeliveryUrl(
    publicId: string,
    variant: ImageDeliveryVariant = 'default',
  ): string {
    return this.storage.getDeliveryUrl(publicId, variant);
  }

  toUploadItem(image: ImageDocument) {
    return {
      id: image.id,
      url: this.getDeliveryUrl(image.publicId, 'product'),
      publicId: image.publicId,
    };
  }

  private assertValidImage(file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException('file is required (multipart field "file")');
    }
    if (!file.buffer?.length) {
      throw new BadRequestException('Uploaded file is empty');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('Image must be 5 MB or smaller');
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException(
        'Only JPEG, PNG, and WEBP images are allowed',
      );
    }
  }
}
