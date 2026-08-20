import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../../entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(@InjectRepository(Notification) private repo: Repository<Notification>) {}

  async findByUser(userId: string) {
    return this.repo.find({
      where: { recipient: { id: userId } },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async create(dto: Partial<Notification>) {
    return this.repo.save(this.repo.create(dto));
  }

  async markRead(id: string, actorId: string, canReadAny = false) {
    const notification = await this.repo.findOne({ where: { id }, relations: ['recipient'] });
    if (!notification) throw new NotFoundException('Notification not found');
    if (!canReadAny && notification.recipient?.id !== actorId) {
      throw new ForbiddenException('You can only update your own notifications');
    }
    await this.repo.update(id, { readAt: new Date() });
    return this.repo.findOne({ where: { id } });
  }
}
