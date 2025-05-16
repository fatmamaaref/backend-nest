import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { JwtGuard } from 'src/auth/jwt.guard';
import { StringDecoder } from 'string_decoder';

@Controller('statistic')
 
export class StatisticsController {
  constructor(private statisticsService: StatisticsService) {}


  
  @UseGuards(JwtGuard)
  @Get('business-count')
  async getBusinessCount(@Req() req) {
    const userId = req.user.id;
    const count = await this.statisticsService.getBusinessCount(userId);
    return { count };
  }

  @UseGuards(JwtGuard)
  @Get('platform-count')
  async getPlatformCount(@Req() req) {
    const userId = req.user.id;
    const count = await this.statisticsService.getPlatformCount(userId);
    return { count };
  }

   @UseGuards(JwtGuard)
  @Get('business-platform-links')
  async getBusinessPlatformLinks(@Req() req ) {
    const userId = req.user.id;
    const count = await this.statisticsService.getBusinessPlatformLinks(userId);
    return { count };
  }
}
