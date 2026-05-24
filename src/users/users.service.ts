import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client'; // ← import Prisma types

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        memberships: {
          include: { organization: true },
        },
      },
    });
  }

  async create(data: Prisma.UserCreateInput) {
    // ← use Prisma's type, not manual
    return this.prisma.user.create({ data });
  }
}
