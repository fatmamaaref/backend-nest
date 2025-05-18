import { Module } from '@nestjs/common';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { HttpModule } from '@nestjs/axios';
import { FacebookService } from 'src/plateforme/facebook.service';

import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';


@Module({
 
  imports: [
    ScheduleModule.forRoot(),
    HttpModule,ConfigModule,
    CacheModule.register(), 
  ],
  providers: [ReviewService,PrismaService,FacebookService],
  controllers: [ReviewController]
   
})
export class ReviewModule {}
