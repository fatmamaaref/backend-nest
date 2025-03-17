import { Test, TestingModule } from '@nestjs/testing';
import { GoogleBusinessService } from './google-business.service';

describe('GoogleBusinessService', () => {
  let service: GoogleBusinessService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GoogleBusinessService],
    }).compile();

    service = module.get<GoogleBusinessService>(GoogleBusinessService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
