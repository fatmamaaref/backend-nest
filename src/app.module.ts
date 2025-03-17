import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { BusinessService } from './business/business.service';
import { BusinessController } from './business/business.controller';
import { BusinessModule } from './business/business.module';
import { PrismaModule } from './prisma/prisma.module';
import { PlateformeModule } from './plateforme/plateforme.module';
import { GoogleBusinessService } from './google-business/google-business.service';

@Module({
  imports: [
   
     AuthModule,
     UsersModule,  
     ConfigModule.forRoot({
      isGlobal: true,  // Cela rend les variables d'environnement accessibles partout
    }), BusinessModule, PrismaModule, PlateformeModule,
  ],

  controllers: [AppController, BusinessController],
  providers: [AppService, BusinessService, GoogleBusinessService],
})
export class AppModule {}
