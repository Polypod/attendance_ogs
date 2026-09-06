import { ConfigController } from '../../controllers/ConfigController';
import { ConfigService } from '../../services/ConfigService';

jest.mock('../../services/ConfigService', () => ({
  ConfigService: {
    getInstance: jest.fn(),
  },
}));

describe('ConfigController', () => {
  const controller = new ConfigController();

  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getConfig: returns categories + beltLevels', async () => {
    (ConfigService.getInstance as jest.Mock).mockReturnValue({
      getCategories: jest.fn(() => ['barn']),
      getBeltLevels: jest.fn(() => ['white']),
    });

    await controller.getConfig({} as any, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: {
        categories: ['barn'],
        beltLevels: ['white'],
      },
    });
  });

  it('getConfig: returns 500 on failure', async () => {
    (ConfigService.getInstance as jest.Mock).mockImplementation(() => {
      throw new Error('boom');
    });

    await controller.getConfig({} as any, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Failed to retrieve configuration',
      error: 'boom',
    });
  });
});
