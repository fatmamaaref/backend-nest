import { Test, TestingModule } from '@nestjs/testing';
import { PlateformeService } from './plateforme.service';

describe('PlateformeService', () => {
  let service: PlateformeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlateformeService],
    }).compile();

    service = module.get<PlateformeService>(PlateformeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
