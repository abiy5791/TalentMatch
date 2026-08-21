import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../../entities/user.entity';
import { Company } from '../../entities/company.entity';
import { LoginDto, CreateUserDto } from './dto/auth.dto';
import { permissionsFor, ROLE_DESCRIPTIONS, Role, isClientRole, homeFor } from './permissions';
import { jwtExpiresIn, jwtSecret } from './jwt.config';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Company) private companyRepo: Repository<Company>,
    private jwtService: JwtService,
  ) {}

  /** bcrypt is deliberately slow; the demo list never changes at runtime. */
  private demoCache: any[] | null = null;

  /** Attaches the role's resolved permissions so the client can render from them. */
  private async decorate<T extends { role: string; companyId?: string | null }>(user: T) {
    const company = user.companyId
      ? await this.companyRepo.findOne({ where: { id: user.companyId } })
      : null;
    return {
      ...user,
      permissions: permissionsFor(user.role),
      roleDescription: ROLE_DESCRIPTIONS[user.role as Role],
      home: homeFor(user.role),
      company: company ? { id: company.id, name: company.name, tier: company.tier } : null,
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (user && (await bcrypt.compare(password, user.passwordHash))) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException(`Account is ${user.status.toLowerCase()}`);

    // A portal account with no employer attached can see nothing; fail clearly
    // at the door instead of dropping them into an empty portal.
    if (isClientRole(user.role) && !user.companyId) {
      throw new UnauthorizedException(
        'This portal account is not linked to a company. Contact your account manager.',
      );
    }

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId || null,
    };
    return {
      access_token: this.jwtService.sign(payload, {
        secret: jwtSecret(),
        expiresIn: jwtExpiresIn(),
      }),
      user: await this.decorate(user),
    };
  }

  async createUser(dto: CreateUserDto) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already exists');

    const { password, role, companyId, ...rest } = dto;

    // Portal roles are meaningless without an employer; internal roles must not
    // carry one, or scoping would silently apply to staff.
    if (isClientRole(role)) {
      if (!companyId) {
        throw new BadRequestException(`${role} accounts must be linked to a company`);
      }
      const company = await this.companyRepo.findOne({ where: { id: companyId } });
      if (!company) throw new BadRequestException(`Company ${companyId} not found`);
    } else if (companyId) {
      throw new BadRequestException('Only client portal accounts can be linked to a company');
    }

    const hash = await bcrypt.hash(password, 10);
    const user = this.userRepo.create({
      ...rest,
      role: role as User['role'],
      companyId: isClientRole(role) ? companyId : null,
      passwordHash: hash,
    });
    await this.userRepo.save(user);
    const { passwordHash, ...result } = user;
    return this.decorate(result);
  }

  async findById(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) return null;
    const { passwordHash, ...result } = user;
    return this.decorate(result);
  }

  async findAll() {
    const users = await this.userRepo.find({ order: { createdAt: 'DESC' } });
    const companies = await this.companyRepo.find();
    const byId = new Map(companies.map(c => [c.id, c.name]));
    return users.map(u => {
      const { passwordHash, ...rest } = u;
      return { ...rest, companyName: u.companyId ? byId.get(u.companyId) || null : null };
    });
  }

  /**
   * The demo logins, read back out of the database so the sign-in screen can
   * never drift from what was actually seeded. A password is only advertised
   * once it has been checked against the stored hash, so rotating one quietly
   * drops that account off the list instead of showing a credential that no
   * longer works. Off in production, where there is nothing to demonstrate.
   */
  async demoAccounts() {
    if (process.env.NODE_ENV === 'production') return [];
    if (this.demoCache) return this.demoCache;

    const conventions: Record<string, string> = {
      SUPER_ADMIN: 'admin123',
      MANAGER: 'manager123',
      RECRUITER: 'recruiter123',
      CLIENT_ADMIN: 'client123',
      CLIENT_USER: 'client123',
      CANDIDATE: 'candidate123',
    };
    const groups: Record<string, string> = {
      console: 'Recruiter console',
      portal: 'Client portal',
      candidate: 'Candidate',
    };

    const users = await this.userRepo.find({ where: { status: 'ACTIVE' }, order: { createdAt: 'ASC' } });
    const companies = await this.companyRepo.find();
    const companyName = new Map(companies.map(c => [c.id, c.name]));

    const accounts = [];
    for (const user of users) {
      const password = conventions[user.role];
      if (!password || !(await bcrypt.compare(password, user.passwordHash))) continue;
      const home = homeFor(user.role);
      accounts.push({
        email: user.email,
        password,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role,
        roleDescription: ROLE_DESCRIPTIONS[user.role as Role],
        company: user.companyId ? companyName.get(user.companyId) || null : null,
        group: groups[home] || 'Other',
      });
    }

    this.demoCache = accounts;
    return accounts;
  }
}
