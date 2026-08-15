import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Prepared meals' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'Ready-to-eat traditional dishes' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/demo/image/upload/category.jpg',
  })
  @IsOptional()
  @IsUrl()
  image?: string;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  image?: string;

  @ApiPropertyOptional({ description: 'Admin activate/deactivate' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
