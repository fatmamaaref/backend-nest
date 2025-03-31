import { Module, forwardRef } from '@nestjs/common';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { PrismaService } from '../prisma/prisma.service';
import { PlateformeModule } from '../plateforme/plateforme.module';

@Module({
  imports: [forwardRef(() => PlateformeModule)], // 🔹 Évite la dépendance circulaire
  providers: [BusinessService, PrismaService],
  controllers: [BusinessController],
  exports: [BusinessService], // 🔹 Important pour être utilisé ailleurs
})
export class BusinessModule {}
