import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { ApplicationStatus } from '../generated/prisma/enums';

describe('ApplicationsController', () => {
  let controller: ApplicationsController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    getStatistics: jest.Mock;
    getAnalytics: jest.Mock;
    checkDuplicate: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    updateStatus: jest.Mock;
    assignResume: jest.Mock;
    getHistory: jest.Mock;
    remove: jest.Mock;
  };
  const user = { sub: 'user-1' };

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      getStatistics: jest.fn(),
      getAnalytics: jest.fn(),
      checkDuplicate: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      assignResume: jest.fn(),
      getHistory: jest.fn(),
      remove: jest.fn(),
    };

    controller = new ApplicationsController(
      service as unknown as ApplicationsService,
    );
  });

  it('delegates create to the service', async () => {
    const dto = { company: 'Infor', position: 'Engineer' };
    const expected = { id: 'app-1' };
    service.create.mockResolvedValue(expected);

    const result = await controller.create(user, dto as never);

    expect(service.create).toHaveBeenCalledWith(user.sub, dto);
    expect(result).toBe(expected);
  });

  it('delegates findAll to the service', async () => {
    const query = { page: 1, limit: 10 };
    const expected = { data: [], meta: {} };
    service.findAll.mockResolvedValue(expected);

    const result = await controller.findAll(user, query as never);

    expect(service.findAll).toHaveBeenCalledWith(user.sub, query);
    expect(result).toBe(expected);
  });

  it('delegates getStatistics to the service', async () => {
    const expected = { totalApplications: 0 };
    service.getStatistics.mockResolvedValue(expected);

    const result = await controller.getStatistics(user);

    expect(service.getStatistics).toHaveBeenCalledWith(user.sub);
    expect(result).toBe(expected);
  });

  it('delegates getAnalytics to the service', async () => {
    const expected = { funnel: { applied: 0, assessment: 0, interview: 0, offer: 0 } };
    service.getAnalytics.mockResolvedValue(expected);

    const result = await controller.getAnalytics(user);

    expect(service.getAnalytics).toHaveBeenCalledWith(user.sub);
    expect(result).toBe(expected);
  });

  it('delegates checkDuplicate to the service with the jobUrl from the query', async () => {
    const query = { jobUrl: 'https://www.linkedin.com/jobs/view/1234567890/' };
    const expected = { exists: true, application: { id: 'app-1' } };
    service.checkDuplicate.mockResolvedValue(expected);

    const result = await controller.checkDuplicate(user, query as never);

    expect(service.checkDuplicate).toHaveBeenCalledWith(user.sub, query.jobUrl);
    expect(result).toBe(expected);
  });

  it('delegates findOne to the service', async () => {
    const expected = { id: 'app-1' };
    service.findOne.mockResolvedValue(expected);

    const result = await controller.findOne(user, 'app-1');

    expect(service.findOne).toHaveBeenCalledWith(user.sub, 'app-1');
    expect(result).toBe(expected);
  });

  it('delegates update to the service', async () => {
    const dto = { company: 'Updated' };
    const expected = { id: 'app-1', company: 'Updated' };
    service.update.mockResolvedValue(expected);

    const result = await controller.update(user, 'app-1', dto as never);

    expect(service.update).toHaveBeenCalledWith(user.sub, 'app-1', dto);
    expect(result).toBe(expected);
  });

  it('delegates updateStatus to the service with the status from the DTO', async () => {
    const dto = { status: ApplicationStatus.INTERVIEW };
    const expected = { id: 'app-1', status: ApplicationStatus.INTERVIEW };
    service.updateStatus.mockResolvedValue(expected);

    const result = await controller.updateStatus(user, 'app-1', dto);

    expect(service.updateStatus).toHaveBeenCalledWith(
      user.sub,
      'app-1',
      dto.status,
    );
    expect(result).toBe(expected);
  });

  it('delegates assignResume to the service with the resumeId from the DTO', async () => {
    const dto = { resumeId: 'resume-1' };
    const expected = { id: 'app-1', resumeId: 'resume-1' };
    service.assignResume.mockResolvedValue(expected);

    const result = await controller.assignResume(user, 'app-1', dto);

    expect(service.assignResume).toHaveBeenCalledWith(
      user.sub,
      'app-1',
      dto.resumeId,
    );
    expect(result).toBe(expected);
  });

  it('delegates getHistory to the service', async () => {
    const expected = [{ id: 'history-1' }];
    service.getHistory.mockResolvedValue(expected);

    const result = await controller.getHistory(user, 'app-1');

    expect(service.getHistory).toHaveBeenCalledWith(user.sub, 'app-1');
    expect(result).toBe(expected);
  });

  it('delegates remove to the service', async () => {
    const expected = { id: 'app-1' };
    service.remove.mockResolvedValue(expected);

    const result = await controller.remove(user, 'app-1');

    expect(service.remove).toHaveBeenCalledWith(user.sub, 'app-1');
    expect(result).toBe(expected);
  });
});
