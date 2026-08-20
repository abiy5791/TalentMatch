import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../../entities/user.entity';
import { Company } from '../../entities/company.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Company]),
    // Global so JwtAuthGuard can resolve JwtService inside every feature module.
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'recruitment-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
