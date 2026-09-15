import { Injectable } from '@nestjs/common';
import { StoreService, UserSettings } from '../store/store.service';

@Injectable()
export class SettingsService {
  constructor(private readonly store: StoreService) {}

  get(userId: string) {
    return this.store.getSettings(userId);
  }

  update(userId: string, patch: Partial<Omit<UserSettings, 'userId' | 'updatedAt'>>) {
    return this.store.updateSettings(userId, patch);
  }
}
