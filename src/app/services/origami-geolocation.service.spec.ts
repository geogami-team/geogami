import { OrigamiGeolocationService } from './origami-geolocation.service';

describe('OrigamiGeolocationService', () => {
  let receivePosition: (payload: any) => void;
  let positions: any[];

  beforeEach(() => {
    const socket = {
      on: (_event: string, listener: (payload: any) => void) => receivePosition = listener
    };
    const service = new OrigamiGeolocationService(null, null, socket as any);
    service.init(true);
    positions = [];
    service.avatarGeolocationSubscription.subscribe(position => positions.push(position));
  });

  it('preserves fractional coordinates and height from German and English clients', () => {
    receivePosition({ x: '111000,5', z: '-224000,75', y: '100,25' });
    receivePosition({ x: '111000.5', z: '-224000.75', y: '100.25' });
    expect(positions).toEqual([
      { x: 111000.5, z: -224000.75, y: 100.25 },
      { x: 111000.5, z: -224000.75, y: 100.25 }
    ]);
  });

  it('accepts initial positions without height and skips incomplete or invalid packets', () => {
    receivePosition({ x: '0', z: '0' });
    for (const payload of [null, {}, { x: '1,5' }, { x: '', z: 0 }, { x: 1, z: 2, y: 'invalid' }]) {
      receivePosition(payload);
    }
    receivePosition({ x: 1.5, z: 2.25 });
    expect(positions).toEqual([{ x: 0, z: 0 }, { x: 1.5, z: 2.25 }]);
  });
});
