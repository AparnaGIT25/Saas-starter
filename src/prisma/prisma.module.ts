import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()   // ← makes it available everywhere without re-importing
@Module({
    providers: [PrismaService],
    exports: [PrismaService],
})
export class PrismaModule { }