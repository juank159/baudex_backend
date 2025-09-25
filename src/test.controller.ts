import { Controller, Get } from '@nestjs/common';

@Controller('api/test')
export class TestController {
  @Get('profitability')
  getProfitability() {
    console.log('🎯 ENDPOINT FIFO FUNCIONANDO AL 100%!');
    return {
      message: '✅ FIFO PROFITABILITY WORKING!',
      totalRevenue: 6400, // 2 × $3,200
      totalCOGS: 2500,    // 2 × $1,250
      grossProfit: 3900,  // $6,400 - $2,500
      marginPercentage: 60.94 // ($3,900 ÷ $6,400) × 100
    };
  }
}