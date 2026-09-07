import Joi from 'joi';
import { validateParams, validateRequest } from '../../middleware/validation';

describe('validation middleware', () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };

  const next = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateRequest', () => {
    it('returns 400 with details on schema error', () => {
      const schema = Joi.object({ age: Joi.number().min(18).required() });
      const mw = validateRequest(schema);

      const req: any = { body: { age: 10 } };
      mw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Validation error',
          details: expect.any(Array),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('sets req.body to validated value and calls next', () => {
      const schema = Joi.object({
        age: Joi.number().default(20),
      });
      const mw = validateRequest(schema);

      const req: any = { body: {} };
      mw(req, res, next);

      expect(req.body).toEqual({ age: 20 });
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('validateParams', () => {
    it('returns 400 when params are invalid', () => {
      const schema = Joi.object({ id: Joi.string().uuid().required() });
      const mw = validateParams(schema);

      const req: any = { params: { id: 'not-a-uuid' } };
      mw(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Invalid parameters',
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next when params are valid', () => {
      const schema = Joi.object({ id: Joi.string().required() });
      const mw = validateParams(schema);

      const req: any = { params: { id: 'x' } };
      mw(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
