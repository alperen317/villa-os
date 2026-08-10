import { TestBed } from '@angular/core/testing';
import { PagedResult } from '../../core/models/paged-result.model';
import { Villa } from '../../core/models/villa.model';
import { VillasService } from './villas.service';
import { VillasStore } from './villas.store';

function villa(id: string): Villa {
  return { id, name: id } as Villa;
}

/** A `list` that serves `total` villas out of pages of at most `limit`, like the API does. */
function pagedVillas(total: number): jest.Mock {
  const all = Array.from({ length: total }, (_, index) => villa(`villa-${index + 1}`));

  return jest.fn(async ({ page = 1, limit = 100 }): Promise<PagedResult<Villa>> => {
    const start = (page - 1) * limit;
    return { data: all.slice(start, start + limit), total };
  });
}

describe('VillasStore', () => {
  let villasService: { list: jest.Mock };

  function createStore(list: jest.Mock): InstanceType<typeof VillasStore> {
    villasService = { list };
    TestBed.configureTestingModule({
      providers: [{ provide: VillasService, useValue: villasService }],
    });
    return TestBed.inject(VillasStore);
  }

  it('reads a single page when everything fits in one', async () => {
    const store = createStore(pagedVillas(12));

    await store.ensureLoaded();

    expect(store.villas()).toHaveLength(12);
    expect(villasService.list).toHaveBeenCalledTimes(1);
  });

  it('drains the remaining pages instead of stopping at the API cap', async () => {
    // The villa dropdowns on every filter bar read this store, and a short read there shows
    // up as a villa that simply is not offered — no empty state, nothing to notice.
    const store = createStore(pagedVillas(230));

    await store.ensureLoaded();

    expect(store.villas()).toHaveLength(230);
    expect(villasService.list).toHaveBeenCalledTimes(3);
    expect(store.villas().at(-1)?.id).toBe('villa-230');
  });

  it('asks for exactly the pages it needs when the total lands on a page boundary', async () => {
    const store = createStore(pagedVillas(200));

    await store.ensureLoaded();

    expect(store.villas()).toHaveLength(200);
    expect(villasService.list).toHaveBeenCalledTimes(2);
  });

  it('stops early if a page comes back empty despite the reported total', async () => {
    // A total that outruns the rows actually returned would otherwise spin out the loop.
    const list = jest
      .fn()
      .mockResolvedValueOnce({ data: [villa('villa-1')], total: 500 })
      .mockResolvedValue({ data: [], total: 500 });
    const store = createStore(list);

    await store.ensureLoaded();

    expect(store.villas()).toHaveLength(1);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('does not fetch again once loaded', async () => {
    const store = createStore(pagedVillas(5));

    await store.ensureLoaded();
    await store.ensureLoaded();

    expect(villasService.list).toHaveBeenCalledTimes(1);
  });

  it('refresh re-reads even when already loaded', async () => {
    const store = createStore(pagedVillas(5));

    await store.ensureLoaded();
    await store.refresh();

    expect(villasService.list).toHaveBeenCalledTimes(2);
  });

  it('clears the loading flag when a page fails', async () => {
    const store = createStore(jest.fn().mockRejectedValue(new Error('offline')));

    await expect(store.ensureLoaded()).rejects.toThrow('offline');

    expect(store.loading()).toBe(false);
    expect(store.loaded()).toBe(false);
  });
});
