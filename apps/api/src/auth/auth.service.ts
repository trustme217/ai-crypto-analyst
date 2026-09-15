import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { StoreService } from '../store/store.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly store: StoreService,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string, displayName?: string) {
    const existing = await this.store.findUserByEmail(email);
    if (existing) throw new ConflictException('Email already registered');
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.store.createUser({ email, passwordHash, displayName });
    return this.tokenResponse(user.id, user.email, user.displayName);
  }

  async login(email: string, password: string) {
    const user = await this.store.findUserByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return this.tokenResponse(user.id, user.email, user.displayName);
  }

  private tokenResponse(id: string, email: string, displayName: string | null) {
    const accessToken = this.jwt.sign({ sub: id, email });
    return { accessToken, user: { id, email, displayName } };
  }
}
