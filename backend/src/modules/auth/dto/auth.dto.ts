import { IsEmail, IsString, MinLength, IsIn, IsOptional, IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const USER_ROLES = ['SUPER_ADMIN', 'MANAGER', 'RECRUITER', 'CLIENT_ADMIN', 'CLIENT_USER'] as const;

export class LoginDto {
  @ApiProperty({ example: 'admin@talentmatch.io' })
  @IsEmail()
  email: string;

  // Deliberately no length rule: a wrong password should fail as 401, not as a
  // 400 that reveals the password policy.
  @ApiProperty({ example: 'admin123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class CreateUserDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: USER_ROLES })
  @IsIn(USER_ROLES as unknown as string[])
  role: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Required for CLIENT_ADMIN / CLIENT_USER — the employer they belong to',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
