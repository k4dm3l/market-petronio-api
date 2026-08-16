import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { escapeRegex } from '../common/utils/escape-regex';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { Category, CategoryDocument } from './schemas/category.schema';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private categoryModel: Model<CategoryDocument>,
  ) {}

  async create(dto: CreateCategoryDto) {
    const existing = await this.categoryModel
      .findOne({ name: dto.name.trim() })
      .exec();
    if (existing) {
      throw new ConflictException('Category name already exists');
    }

    const category = await this.categoryModel.create({
      name: dto.name.trim(),
      description: dto.description ?? '',
      image: dto.image ?? '',
      isActive: true,
    });

    return this.toResponse(category);
  }

  async findAll(includeInactive = false, search?: string) {
    const filter: Record<string, unknown> = includeInactive
      ? {}
      : { isActive: true };

    if (search?.trim()) {
      const q = escapeRegex(search.trim());
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }

    const categories = await this.categoryModel
      .find(filter)
      .sort({ name: 1 })
      .exec();
    return categories.map((c) => this.toResponse(c));
  }

  async findOne(id: string, includeInactive = false) {
    const category = await this.findByIdOrThrow(id);
    if (!includeInactive && !category.isActive) {
      throw new NotFoundException('Category not found');
    }
    return this.toResponse(category);
  }

  async findActiveById(id: string): Promise<CategoryDocument | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.categoryModel.findOne({ _id: id, isActive: true }).exec();
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.findByIdOrThrow(id);

    if (dto.name !== undefined && dto.name.trim() !== category.name) {
      const clash = await this.categoryModel
        .findOne({ name: dto.name.trim(), _id: { $ne: category._id } })
        .exec();
      if (clash) {
        throw new ConflictException('Category name already exists');
      }
      category.name = dto.name.trim();
    }

    if (dto.description !== undefined) category.description = dto.description;
    if (dto.image !== undefined) category.image = dto.image;
    if (dto.isActive !== undefined) category.isActive = dto.isActive;

    await category.save();
    return this.toResponse(category);
  }

  private async findByIdOrThrow(id: string): Promise<CategoryDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Category not found');
    }
    const category = await this.categoryModel.findById(id).exec();
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  private toResponse(category: CategoryDocument) {
    return {
      id: category.id,
      name: category.name,
      description: category.description,
      image: category.image,
      isActive: category.isActive,
      createdAt: (category as CategoryDocument & { createdAt?: Date }).createdAt,
      updatedAt: (category as CategoryDocument & { updatedAt?: Date }).updatedAt,
    };
  }
}
