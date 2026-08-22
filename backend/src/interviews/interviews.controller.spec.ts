import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';

describe('InterviewsController', () => {
  let controller: InterviewsController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  const user = { sub: 'user-1' };
  const applicationId = 'app-1';
  const interviewId = 'interview-1';

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    controller = new InterviewsController(
      service as unknown as InterviewsService,
    );
  });

  it('delegates create to the service', async () => {
    const dto = { title: 'Technical Interview', scheduledAt: '2026-08-25T10:00:00+08:00' };
    const expected = { id: interviewId };
    service.create.mockResolvedValue(expected);

    const result = await controller.create(user, applicationId, dto as never);

    expect(service.create).toHaveBeenCalledWith(user.sub, applicationId, dto);
    expect(result).toBe(expected);
  });

  it('delegates findAll to the service', async () => {
    const expected = [{ id: interviewId }];
    service.findAll.mockResolvedValue(expected);

    const result = await controller.findAll(user, applicationId);

    expect(service.findAll).toHaveBeenCalledWith(user.sub, applicationId);
    expect(result).toBe(expected);
  });

  it('delegates update to the service', async () => {
    const dto = { title: 'Final Interview' };
    const expected = { id: interviewId, ...dto };
    service.update.mockResolvedValue(expected);

    const result = await controller.update(
      user,
      applicationId,
      interviewId,
      dto as never,
    );

    expect(service.update).toHaveBeenCalledWith(
      user.sub,
      applicationId,
      interviewId,
      dto,
    );
    expect(result).toBe(expected);
  });

  it('delegates remove to the service', async () => {
    const expected = { id: interviewId };
    service.remove.mockResolvedValue(expected);

    const result = await controller.remove(user, applicationId, interviewId);

    expect(service.remove).toHaveBeenCalledWith(
      user.sub,
      applicationId,
      interviewId,
    );
    expect(result).toBe(expected);
  });
});
