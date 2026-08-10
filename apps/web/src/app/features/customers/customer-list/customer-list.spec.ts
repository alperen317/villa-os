import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Customer } from '../../../core/models/customer.model';
import { CustomersService } from '../customers.service';
import { CustomerList } from './customer-list';

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'customer-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    phone: '+90 555 000 0000',
    email: null,
    identityNumber: null,
    passportNumber: null,
    notes: null,
    ...overrides,
  } as Customer;
}

describe('CustomerList', () => {
  let component: CustomerList;
  let customersService: {
    list: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let router: { navigate: jest.Mock };
  let message: { success: jest.Mock; error: jest.Mock };

  beforeEach(() => {
    customersService = {
      list: jest.fn().mockResolvedValue({ data: [customer()], total: 1 }),
      create: jest.fn().mockResolvedValue(customer()),
      update: jest.fn().mockResolvedValue(customer()),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    router = { navigate: jest.fn() };
    message = { success: jest.fn(), error: jest.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: CustomersService, useValue: customersService },
        { provide: Router, useValue: router },
        { provide: NzMessageService, useValue: message },
      ],
    });

    component = TestBed.runInInjectionContext(() => new CustomerList());
  });

  describe('paging and search', () => {
    it('carries the search term through, and omits an empty one', async () => {
      component['searchTerm'].set('lovelace');
      await component.loadPage();
      expect(customersService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'lovelace' }),
      );

      component['searchTerm'].set('');
      await component.loadPage();
      expect(customersService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: undefined }),
      );
    });

    it('returns to the first page when a new search is run', async () => {
      // Searching from page 4 would otherwise ask for page 4 of a shorter result set and
      // land on an empty table that looks like "no matches".
      component.onPageIndexChange(4);
      expect(component['pageIndex']()).toBe(4);

      component.onSearch();

      expect(component['pageIndex']()).toBe(1);
      expect(customersService.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
    });

    it('keeps the page when only the page changes', async () => {
      component.onPageIndexChange(3);

      expect(customersService.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3 }));
    });

    it('stops the spinner when the list cannot be read', async () => {
      customersService.list.mockRejectedValue(new Error('offline'));

      await expect(component.loadPage()).rejects.toThrow('offline');

      expect(component['loading']()).toBe(false);
    });
  });

  describe('remove', () => {
    it('re-reads the page after deleting, so the row disappears', async () => {
      await component.remove(customer({ id: 'customer-9' }));

      expect(customersService.remove).toHaveBeenCalledWith('customer-9');
      expect(customersService.list).toHaveBeenCalled();
      expect(message.success).toHaveBeenCalled();
    });

    it('reports a refusal rather than pretending the row is gone', async () => {
      customersService.remove.mockRejectedValue(new Error('409'));

      await component.remove(customer());

      expect(message.error).toHaveBeenCalled();
      expect(message.success).not.toHaveBeenCalled();
    });
  });

  describe('goToDetail', () => {
    it('navigates to the customer it was given', () => {
      component.goToDetail(customer({ id: 'customer-3' }));

      expect(router.navigate).toHaveBeenCalledWith(['/customers', 'customer-3']);
    });
  });
});
