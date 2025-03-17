import { Test, TestingModule } from '@nestjs/testing';
import { PlateformeController } from './plateforme.controller';

describe('PlateformeController', () => {
  let controller: PlateformeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlateformeController],
    }).compile();

    controller = module.get<PlateformeController>(PlateformeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
