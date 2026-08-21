import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  @AllowAnonymous()
  getHello() {
    return this.appService.getHello();
  }
  @Get('favicon.ico')
  @AllowAnonymous()
  @HttpCode(HttpStatus.NO_CONTENT)
  getFavicon() {
    return;
  }
}
