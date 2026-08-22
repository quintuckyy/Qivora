import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

describe('NotesController', () => {
  let controller: NotesController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  const user = { sub: 'user-1' };
  const applicationId = 'app-1';
  const noteId = 'note-1';

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    controller = new NotesController(service as unknown as NotesService);
  });

  it('delegates create to the service', async () => {
    const dto = { content: 'Note content' };
    const expected = { id: noteId, ...dto };
    service.create.mockResolvedValue(expected);

    const result = await controller.create(user, applicationId, dto);

    expect(service.create).toHaveBeenCalledWith(user.sub, applicationId, dto);
    expect(result).toBe(expected);
  });

  it('delegates findAll to the service', async () => {
    const expected = [{ id: noteId }];
    service.findAll.mockResolvedValue(expected);

    const result = await controller.findAll(user, applicationId);

    expect(service.findAll).toHaveBeenCalledWith(user.sub, applicationId);
    expect(result).toBe(expected);
  });

  it('delegates update to the service', async () => {
    const dto = { content: 'Updated content' };
    const expected = { id: noteId, ...dto };
    service.update.mockResolvedValue(expected);

    const result = await controller.update(user, applicationId, noteId, dto);

    expect(service.update).toHaveBeenCalledWith(
      user.sub,
      applicationId,
      noteId,
      dto,
    );
    expect(result).toBe(expected);
  });

  it('delegates remove to the service', async () => {
    const expected = { id: noteId };
    service.remove.mockResolvedValue(expected);

    const result = await controller.remove(user, applicationId, noteId);

    expect(service.remove).toHaveBeenCalledWith(
      user.sub,
      applicationId,
      noteId,
    );
    expect(result).toBe(expected);
  });
});
