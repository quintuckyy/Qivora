import { ResumesController } from './resumes.controller';
import { ResumesService } from './resumes.service';
import type { Response } from 'express';

describe('ResumesController', () => {
  let controller: ResumesController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };
  const user = { sub: 'user-1' };

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    controller = new ResumesController(
      service as unknown as ResumesService,
    );
  });

  describe('upload', () => {
    it('delegates to the service using the uploaded file original name', async () => {
      const file = { originalname: 'resume.pdf' } as Express.Multer.File;
      const expected = { id: 'resume-1' };
      service.create.mockResolvedValue(expected);

      const result = await controller.upload(user, file);

      expect(service.create).toHaveBeenCalledWith(
        user.sub,
        'resume.pdf',
        file,
      );
      expect(result).toBe(expected);
    });

    it('falls back to "Resume" as the name when no file is present', async () => {
      service.create.mockResolvedValue({});

      await controller.upload(user, undefined as never);

      expect(service.create).toHaveBeenCalledWith(
        user.sub,
        'Resume',
        undefined,
      );
    });
  });

  it('delegates findAll to the service', async () => {
    const expected = [{ id: 'resume-1' }];
    service.findAll.mockResolvedValue(expected);

    const result = await controller.findAll(user);

    expect(service.findAll).toHaveBeenCalledWith(user.sub);
    expect(result).toBe(expected);
  });

  describe('download', () => {
    it('resolves the resume then streams it via response.download', async () => {
      const resume = {
        id: 'resume-1',
        filePath: '/uploads/resumes/stored.pdf',
        originalName: 'resume.pdf',
      };
      service.findOne.mockResolvedValue(resume);
      const response = { download: jest.fn() } as unknown as Response;

      await controller.download(user, 'resume-1', response);

      expect(service.findOne).toHaveBeenCalledWith(user.sub, 'resume-1');
      expect(response.download).toHaveBeenCalledWith(
        resume.filePath,
        resume.originalName,
      );
    });
  });

  it('delegates remove to the service', async () => {
    const expected = { message: 'Resume deleted successfully' };
    service.remove.mockResolvedValue(expected);

    const result = await controller.remove(user, 'resume-1');

    expect(service.remove).toHaveBeenCalledWith(user.sub, 'resume-1');
    expect(result).toBe(expected);
  });
});
