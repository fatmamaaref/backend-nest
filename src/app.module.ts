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
import { ReviewModule } from './review/review.module';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpModule } from '@nestjs/axios';
import { SentimentController } from './sentiment/sentiment.controller';
import { SentimentService } from './sentiment/sentiment.service';


@Module({
  imports: [
    CacheModule.register({
      store: 'memory',
      ttl: 86400,
      max: 1000,
    }),
    HttpModule,
     AuthModule,
     UsersModule,  
     ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,  // Cela rend les variables d'environnement accessibles partout
    }), BusinessModule, PrismaModule, PlateformeModule, ReviewModule,
  ],
  exports: [CacheModule],
  controllers: [AppController, BusinessController, SentimentController],
  providers: [AppService, BusinessService, GoogleBusinessService, SentimentService],
})
export class AppModule {}
