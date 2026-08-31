import { ResumesController } from './resumes.controller';
import { ResumesService } from './resumes.service';
import type { Response } from 'express';

describe('ResumesController', () => {
  let controller: ResumesController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    rename: jest.Mock;
    setDefault: jest.Mock;
    remove: jest.Mock;
  };
  const user = { sub: 'user-1' };

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      rename: jest.fn(),
      setDefault: jest.fn(),
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

  describe('preview', () => {
    it('streams the resolved file inline with its mime type', async () => {
      const resume = {
        id: 'resume-1',
        filePath: './uploads/resumes/stored.pdf',
        originalName: 'resume.pdf',
        mimeType: 'application/pdf',
      };
      service.findOne.mockResolvedValue(resume);
      const response = { sendFile: jest.fn() } as unknown as Response;

      await controller.preview(user, 'resume-1', response);

      expect(service.findOne).toHaveBeenCalledWith(user.sub, 'resume-1');
      expect(response.sendFile).toHaveBeenCalledWith(
        expect.stringContaining('stored.pdf'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline; filename="resume.pdf"',
          }),
        }),
      );
    });
  });

  it('delegates rename to the service', async () => {
    const expected = { id: 'resume-1', name: 'Backend .NET' };
    service.rename.mockResolvedValue(expected);

    const result = await controller.rename(user, 'resume-1', {
      name: 'Backend .NET',
    });

    expect(service.rename).toHaveBeenCalledWith(
      user.sub,
      'resume-1',
      'Backend .NET',
    );
    expect(result).toBe(expected);
  });

  it('delegates setDefault to the service', async () => {
    const expected = { id: 'resume-1', isDefault: true };
    service.setDefault.mockResolvedValue(expected);

    const result = await controller.setDefault(user, 'resume-1');

    expect(service.setDefault).toHaveBeenCalledWith(user.sub, 'resume-1');
    expect(result).toBe(expected);
  });

  it('delegates remove to the service', async () => {
    const expected = { message: 'Resume deleted successfully' };
    service.remove.mockResolvedValue(expected);

    const result = await controller.remove(user, 'resume-1');

    expect(service.remove).toHaveBeenCalledWith(user.sub, 'resume-1');
    expect(result).toBe(expected);
  });
});
