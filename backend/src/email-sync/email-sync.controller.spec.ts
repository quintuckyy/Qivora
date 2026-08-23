import { EmailSyncController } from './email-sync.controller';
import { EmailSyncService } from './email-sync.service';

type ServiceMock = {
  getAuthUrl: jest.Mock;
  exchangeCode: jest.Mock;
  getStatus: jest.Mock;
  disconnect: jest.Mock;
  sync: jest.Mock;
  listSuggestions: jest.Mock;
  confirmSuggestion: jest.Mock;
  dismissSuggestion: jest.Mock;
};

describe('EmailSyncController', () => {
  let controller: EmailSyncController;
  let service: ServiceMock;
  const user = { sub: 'user-1' };

  beforeEach(() => {
    service = {
      getAuthUrl: jest.fn(),
      exchangeCode: jest.fn(),
      getStatus: jest.fn(),
      disconnect: jest.fn(),
      sync: jest.fn(),
      listSuggestions: jest.fn(),
      confirmSuggestion: jest.fn(),
      dismissSuggestion: jest.fn(),
    };
    controller = new EmailSyncController(service as unknown as EmailSyncService);
  });

  it('delegates getAuthUrl', () => {
    service.getAuthUrl.mockReturnValue({ url: 'https://accounts.google.com/...' });
    expect(controller.getAuthUrl()).toEqual({ url: 'https://accounts.google.com/...' });
  });

  it('delegates exchangeCode with the caller id and code', () => {
    controller.exchangeCode(user, { code: 'auth-code' });
    expect(service.exchangeCode).toHaveBeenCalledWith('user-1', 'auth-code');
  });

  it('delegates getStatus with the caller id', () => {
    controller.getStatus(user);
    expect(service.getStatus).toHaveBeenCalledWith('user-1');
  });

  it('delegates disconnect with the caller id', () => {
    controller.disconnect(user);
    expect(service.disconnect).toHaveBeenCalledWith('user-1');
  });

  it('delegates sync with the caller id', () => {
    controller.sync(user);
    expect(service.sync).toHaveBeenCalledWith('user-1');
  });

  it('delegates listSuggestions with the caller id', () => {
    controller.listSuggestions(user);
    expect(service.listSuggestions).toHaveBeenCalledWith('user-1');
  });

  it('delegates confirmSuggestion with the caller id, suggestion id, and overrides', () => {
    controller.confirmSuggestion(user, 'row-1', { company: 'Acme' });
    expect(service.confirmSuggestion).toHaveBeenCalledWith('user-1', 'row-1', { company: 'Acme' });
  });

  it('delegates dismissSuggestion with the caller id and suggestion id', () => {
    controller.dismissSuggestion(user, 'row-1');
    expect(service.dismissSuggestion).toHaveBeenCalledWith('user-1', 'row-1');
  });
});
