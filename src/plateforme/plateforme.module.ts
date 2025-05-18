import { Module, forwardRef } from '@nestjs/common';
import { PlateformeService } from './plateforme.service';
import { PlateformeController } from './plateforme.controller';

import { PrismaService } from '../prisma/prisma.service';
import { BusinessModule } from '../business/business.module';
import { FacebookService } from './facebook.service';
import { GoogleService } from './google.service';
import { InstagramService } from './instegram.service';

@Module({
  imports: [forwardRef(() => BusinessModule)], // 🔹 Ajout du module Business
  providers: [PlateformeService, FacebookService, GoogleService, PrismaService,InstagramService],
  controllers: [PlateformeController],
  exports: [PlateformeService], // 🔹 Important pour être utilisé ailleurs
})
export class PlateformeModule {}
